// app/api/admin/batch-issue/route.ts
// deno-lint-ignore-file

export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { MemberType, TicketStatus } from '@prisma/client';
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
  family: 6,
  student: 1,
  pensioner: 1,
};

// ───────────────────────────────────────────────────────────────────────────────
// OCR helper (server-to-server call to Next.js /api/ocr-proof)
// ───────────────────────────────────────────────────────────────────────────────
const INTERNAL_API_TOKEN = process.env.INTERNAL_API_TOKEN!;
const INTERNAL_BASE_URL =
  process.env.INTERNAL_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

async function verifyPaymentWithOCR(proofUrlOrKey: string, expectedAmount: number) {
  try {
    if (!proofUrlOrKey) return { ok: false, paid: null as number | null, reason: 'no_proof' };

    // accept: public url, signed url, or raw "bucket/key"
    const path = toStorageKey(proofUrlOrKey);
    if (!INTERNAL_API_TOKEN) return { ok: false, paid: null, reason: 'missing_INTERNAL_API_TOKEN' };

    const res = await fetch(`${INTERNAL_BASE_URL.replace(/\/$/, '')}/api/ocr-proof`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${INTERNAL_API_TOKEN}`,
      },
      body: JSON.stringify({ path }), // your OCR route derives amount from this
      cache: 'no-store',
    });

    const text = await res.text();
    const data = safeJson(text) ?? {};
    if (!res.ok || data?.error) {
      return { ok: false, paid: null, reason: data.error || `http_${res.status}` };
    }

    const paid = normalizePaidAmount(String(data.amount ?? '0'));
    // allow tiny OCR jitter (±3 SEK)
    const ok = Math.abs(paid - expectedAmount) <= 3;
    return { ok, paid, reason: ok ? undefined : 'amount_mismatch' };
  } catch (e: any) {
    console.error('OCR fetch exception:', e?.message);
    return { ok: false, paid: null, reason: 'exception' };
  }
}

// Accepts: "bucket/key" OR Supabase public/signed/authenticated URL -> "bucket/key"
function toStorageKey(urlOrKey: string) {
  if (!/^https?:\/\//i.test(urlOrKey)) {
    return urlOrKey.replace(/^\/+/, '');
  }
  const withoutPrefix = urlOrKey
    .replace(
      /^https?:\/\/[^/]+\/storage\/v1\/object\/(?:public|sign|authenticated)\//,
      ''
    )
    .replace(/\?.*$/, '');
  // IMPORTANT: decode %2F, %20, etc.
  return decodeURIComponent(withoutPrefix);
}

function safeJson(s: string) { try { return JSON.parse(s); } catch { return null; } }

function normalizePaidAmount(raw: string) {
  const s = raw
    .replace(/[^\d.,+\-]/g, '')
    .replace(/[\u00A0\u2000-\u200A\u202F]/g, '')
    .replace(/\.(?=\d{3}\b)/g, '')
    .replace(',', '.');
  const n = Number(s.replace(/[+]/g, '').replace(/^-/, ''));
  return Math.round(Number.isFinite(n) ? n : 0);
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
  // try a few times in case ticketNo collides with unique index
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await prisma.ticket.create({
        data: {
          registrationId: data.registrationId,
          type: data.type,                // Prisma enum should match your TicketType
          ticketNo: data.ticketNo,
          qrUrl: data.qrUrl,
          status: 'issued',              // must match your Prisma enum value
        },
      });
    } catch (e: any) {
      // Prisma unique constraint error
      const isUnique =
        e?.code === 'P2002' &&
        (Array.isArray(e?.meta?.target)
          ? e.meta.target.includes('ticketNo')
          : String(e?.meta?.target || '').includes('ticketNo'));

      if (isUnique) {
        // regenerate and retry
        data.ticketNo = makeTicketNo();
        continue;
      }
      // not a unique error -> rethrow
      throw e;
    }
  }
  throw new Error('Could not generate a unique ticket number after retries');
}


// ───────────────────────────────────────────────────────────────────────────────
// Handler
// ───────────────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const onlyPending = req.nextUrl.searchParams.get('onlyPending') === '1';
    const onlyFlagged = req.nextUrl.searchParams.get('onlyFlagged') === '1';
    const dryRun     = req.nextUrl.searchParams.get('dryRun') === '1';
    const useOCR     = req.nextUrl.searchParams.get('useOCR') === '1';
    const limit      = Number(req.nextUrl.searchParams.get('limit') ?? '50');

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
        const withinLimit = mType ? r.tickets_member <= limitByType : r.tickets_member === 0;

        return {
          registrationId: r.id,
          name: r.name,
          email: r.email,
          isMember: !!mType,
          memberType: mType ?? null,
          claimedMemberTickets: r.tickets_member,
          allowedMemberTickets: mType ? limitByType : 0,
          memberOK: memberOk && withinLimit,
          willIssueTickets: memberOk && withinLimit,
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
      emailSent: boolean;
      emailError?: string;
      status: 'issued' | 'skipped';
      reason?: string;
      expected?: number | null;   // <-- add
      detected?: number | null;   // <-- add
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
            member_checked_at: new Date(),
          },
        });
        results.push({
          registrationId: r.id, name: r.name, email: r.email,
          issuedCount: 0, emailSent: false, status: 'skipped',
          reason: 'membership_not_found',
        });
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
              member_checked_at: new Date(),
            },
          });
          results.push({
            registrationId: r.id, name: r.name, email: r.email,
            issuedCount: 0, emailSent: false, status: 'skipped',
            reason: `member_limit_exceeded:${mType}:${lim}`,
          });
          continue;
        }
      }

      // — OCR check → flag & skip if mismatch
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
              ocr_expected_amount: r.total_amount,
            },
          });
          results.push({
            registrationId: r.id,
            name: r.name,
            email: r.email,
            issuedCount: 0,
            emailSent: false,
            status: 'skipped',
            reason: `payment_ocr_${check.reason || 'mismatch'}`,
            expected: r.total_amount,
            detected: paidDetected,
          });
          continue;
        }

        // For successful OCR
        await prisma.registration.update({
          where: { id: r.id },
          data: {
            payment_status: 'confirmed',
            ocr_amount_detected: paidDetected,
            ocr_expected_amount: r.total_amount,
          },
        });
      }


      // — Generate tickets (persist regardless of later email outcome)
      const plan: { type: TicketType; count: number }[] = [
        { type: 'regular',  count: r.tickets_regular },
        { type: 'member',   count: r.tickets_member },
        { type: 'children', count: r.tickets_children },
      ];

      const issued: IssuedTicket[] = [];
      for (const { type, count } of plan) {
        for (let i = 0; i < count; i++) {
          const ticketNo = makeTicketNo();
          const { qrUrl, token } = await generateAndStoreQR(r.id, ticketNo);
          await saveTicketWithRetry({ registrationId: r.id, type, ticketNo, qrUrl });
          issued.push({ ticketNo, qrUrl, token, type });
        }
      }

      // — Mark registration tickets status to "issued"
      await prisma.registration.update({
        where: { id: r.id },
        data: {
          ticket_status: 'issued' satisfies TicketStatus,
          // clear/confirm checks as applicable
          review_status: 'ok',
          review_reason: null,
          member_type_detected: mType ?? null,
          member_checked_at: mType ? new Date() : undefined,
          ...(useOCR
            ? { payment_status: 'confirmed', ocr_amount_detected: r.total_amount, ocr_checked_at: new Date() }
            : {}),
        },
      });

      // — Email the registrant (tickets email) — do not affect invoice fields
      let emailOk = true;
      let emailErr = '';
      if (issued.length > 0) {
        try {
          await sendTicketsEmail(r.email, r.name, issued);
          await prisma.registration.update({
            where: { id: r.id },
            data: {
              tickets_email_sent: true,
              tickets_email_last_error: null,
              tickets_email_last_attempt: new Date(),
            },
          });
        } catch (e: any) {
          emailOk = false;
          emailErr = e?.message || 'email_send_failed';
          await prisma.registration.update({
            where: { id: r.id },
            data: {
              tickets_email_sent: false,
              tickets_email_last_error: emailErr,
              tickets_email_last_attempt: new Date(),
              review_status: 'recheck',
              review_reason: `tickets_email_failed:${emailErr}`,
            },
          });
        }
      }

      results.push({
        registrationId: r.id,
        name: r.name,
        email: r.email,
        issuedCount: issued.length,
        emailSent: emailOk,
        emailError: emailOk ? undefined : emailErr,
        status: 'issued',
        reason: emailOk ? undefined : `tickets_email_failed:${emailErr}`,
      });
    }

    return NextResponse.json({ ok: true, processed: results.length, results });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message || 'internal error' }, { status: 500 });
  }
}

