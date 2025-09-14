// app/api/admin/batch-issue/route.ts
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { MemberType } from '@prisma/client';
import { normalizeName } from '@/lib/name-normalize';
import {
  generateAndStoreQR,
  makeTicketNo,
  type TicketType,
  type IssuedTicket,
} from '@/lib/tickets';
import { sendTicketsEmail } from '@/lib/mailer';

// ───────────────────────────────────────────────────────────────────────────────
// Config
// ───────────────────────────────────────────────────────────────────────────────
const MAX_BY_TYPE: Partial<Record<MemberType, number>> = {
  single: 1,
  family: 6, // your rule
  student: 1,
  pensioner: 1,
};

// ───────────────────────────────────────────────────────────────────────────────
// OCR helper (returns details so we can flag + audit)
// ───────────────────────────────────────────────────────────────────────────────
async function verifyPaymentWithOCR(proofUrl: string, expectedAmount: number) {
  try {
    if (!proofUrl) return { ok: false, paid: null as number | null, reason: 'no_proof' };

    // If you stored a public URL, strip to bucket key; else accept relative key directly:
    const key = proofUrl.replace(
      /^https?:\/\/[^/]+\/storage\/v1\/object\/public\/[^/]+\//,
      ''
    );

    const res = await fetch(`${process.env.SUPABASE_URL}/functions/v1/ocr-proof`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ path: key }),
    });

    const data = await res.json();
    if (!res.ok) return { ok: false, paid: null, reason: data.error || 'ocr_failed' };

    const paid = normalizePaidAmount(String(data.amount ?? '0'));
    const ok = Math.abs(paid - expectedAmount) <= 3; // 3 SEK tolerance
    return { ok, paid, reason: ok ? undefined : 'amount_mismatch' };
  } catch {
    return { ok: false, paid: null, reason: 'exception' };
  }
}

function normalizePaidAmount(raw: string) {
  // strip currency & spaces, normalize separators
  const s = raw
    .replace(/[^\d.,]/g, '')
    .replace(/[\u00A0\u2000-\u200A\u202F]/g, '') // remove thin/nbsp
    .replace(/\.(?=\d{3}\b)/g, '')               // drop thousands dots: 1.234 -> 1234
    .replace(',', '.');                           // decimal comma -> dot
  return Math.round(Number(s) || 0);
}

// ───────────────────────────────────────────────────────────────────────────────
// Unique constraint retry for ticketNo collisions
// ───────────────────────────────────────────────────────────────────────────────
async function saveTicketWithRetry(data: {
  registrationId: string;
  type: TicketType;
  ticketNo: string;
  qrUrl: string;
}) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await prisma.ticket.create({ data: { ...data, status: 'issued' } });
    } catch (e: any) {
      if (e?.code === 'P2002' && e?.meta?.target?.includes('ticketNo')) {
        data.ticketNo = makeTicketNo(); // regenerate and retry
        continue;
      }
      throw e;
    }
  }
  throw new Error('Could not generate a unique ticket number');
}

// ───────────────────────────────────────────────────────────────────────────────
// Handler
// ───────────────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const onlyPending = req.nextUrl.searchParams.get('onlyPending') === '1';
    const onlyFlagged = req.nextUrl.searchParams.get('onlyFlagged') === '1'; 
    const dryRun = req.nextUrl.searchParams.get('dryRun') === '1';
    const useOCR = req.nextUrl.searchParams.get('useOCR') === '1';
    const limit = Number(req.nextUrl.searchParams.get('limit') ?? '50');

    // 1) Load members once (normalize DB values -> MemberType)
    const members = await prisma.member.findMany({ select: { name_key: true, type: true } });
    const memberMap = new Map<string, MemberType>();
    for (const m of members) {
      memberMap.set(normalizeName(m.name_key), m.type);
    }


    // 2) Registrations with NO tickets yet
    const regs = await prisma.registration.findMany({
      where: {
        ...(onlyPending ? { payment_status: 'pending' } : {}),
         ...(onlyFlagged ? { review_status: { in: ['needs_member', 'needs_ocr', 'recheck'] } } : {}),
        tickets: { none: {} },
      },
      select: {
        id: true,
        name: true,
        email: true,
        proof_url: true,
        tickets_regular: true,
        tickets_member: true,
        tickets_children: true,
        total_amount: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
      take: Math.max(1, Math.min(500, limit)),
    });

    // 3) Dry run (preview only)
    if (dryRun) {
      const preview = regs.map((r) => {
        const key = normalizeName(r.name);
        const mType = memberMap.get(key); // MemberType | undefined
        const memberOk = r.tickets_member === 0 ? true : !!mType;
        const limitByType = mType ? MAX_BY_TYPE[mType] ?? 1 : 0;
        const withinLimit = r.tickets_member <= limitByType;

        return {
          registrationId: r.id,
          name: r.name,
          email: r.email,
          isMember: !!mType,
          memberType: mType ?? null,
          claimedMemberTickets: r.tickets_member,
          allowedMemberTickets: mType ? limitByType : 0,
          memberOK: memberOk && (mType ? withinLimit : r.tickets_member === 0),
          willIssueTickets: memberOk && (mType ? withinLimit : r.tickets_member === 0),
        };
      });

      return NextResponse.json({ ok: true, mode: 'dryRun', count: preview.length, rows: preview });
    }

    // 4) Issue sequentially
    const results: Array<{
      registrationId: string;
      name: string;
      email: string;
      issuedCount: number;
      status: 'issued' | 'skipped';
      reason?: string;
    }> = [];

    for (const r of regs) {
      const key = normalizeName(r.name);
      const mType = memberMap.get(key); // MemberType | undefined

      // — Membership required but not found → flag & skip
      if (r.tickets_member > 0 && !mType) {
        await prisma.registration.update({
          where: { id: r.id },
          data: {
            review_status: 'needs_member',
            review_reason: 'membership_not_found',
            member_type_detected: null,
          },
        });
        results.push({ registrationId: r.id, name: r.name, email: r.email, issuedCount: 0, status: 'skipped', reason: 'membership_not_found' });
        continue;
      }

      // — Member present but exceeded policy → flag & skip
      if (mType) {
        const lim = MAX_BY_TYPE[mType] ?? 1;
        if (r.tickets_member > lim) {
          await prisma.registration.update({
            where: { id: r.id },
            data: {
              review_status: 'needs_member',
              review_reason: `member_limit_exceeded:${mType}:${lim}`,
              member_type_detected: mType,
            },
          });
          results.push({ registrationId: r.id, name: r.name, email: r.email, issuedCount: 0, status: 'skipped', reason: `member_limit_exceeded:${mType}:${lim}` });
          continue;
        }
      }

      // — Optional OCR check → flag & skip if mismatch
      let paidDetected: number | null = null;
      if (useOCR) {
        const check = await verifyPaymentWithOCR(r.proof_url, r.total_amount);
        paidDetected = check.paid ?? null;

        if (!check.ok) {
          await prisma.registration.update({
            where: { id: r.id },
            data: {
              review_status: 'needs_ocr',
              review_reason: `payment_ocr_${check.reason || 'mismatch'}`,
              ocr_amount_detected: paidDetected,
            },
          });
          results.push({ registrationId: r.id, name: r.name, email: r.email, issuedCount: 0, status: 'skipped', reason: `payment_ocr_${check.reason || 'mismatch'}` });
          continue;
        }
      }

      // — Generate tickets
      const plan: { type: TicketType; count: number }[] = [
        { type: 'regular', count: r.tickets_regular },
        { type: 'member', count: r.tickets_member },
        { type: 'children', count: r.tickets_children },
      ];

      const issued: IssuedTicket[] = [];

      for (const { type, count } of plan) {
        for (let i = 0; i < count; i++) {
          const ticketNo = makeTicketNo(); // uses env prefix/length
          const { qrUrl, token } = await generateAndStoreQR(r.id, ticketNo);

          await saveTicketWithRetry({ registrationId: r.id, type, ticketNo, qrUrl });
          issued.push({ ticketNo, qrUrl, token, type });
        }
      }

      // — Email the registrant
      if (issued.length > 0) {
        await sendTicketsEmail(r.email, r.name, issued);
      }

      // — Mark success (no flags)
      await prisma.registration.update({
        where: { id: r.id },
        data: {
          payment_status: useOCR ? 'confirmed' : undefined,
          invoice_sent: issued.length > 0 ? true : undefined,
          review_status: 'ok',
          review_reason: null,
          member_type_detected: mType ?? null,
          ocr_amount_detected: useOCR ? r.total_amount : undefined,
        },
      });

      results.push({ registrationId: r.id, name: r.name, email: r.email, issuedCount: issued.length, status: 'issued' });
    }

    return NextResponse.json({ ok: true, processed: results.length, results });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message || 'internal error' }, { status: 500 });
  }
}
