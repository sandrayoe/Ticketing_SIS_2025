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
  family: 5,
  student: 1,
  pensioner: 1,
};

// ───────────────────────────────────────────────────────────────────────────────
// OCR helper (server-to-server call to Next.js /api/ocr-proof)
// ───────────────────────────────────────────────────────────────────────────────
const INTERNAL_API_TOKEN = process.env.INTERNAL_API_TOKEN!;
const INTERNAL_BASE_URL =
  process.env.PUBLIC_SITE_URL || 'http://localhost:3000';

async function verifyPaymentWithOCR(proofUrlOrKey: string, expectedAmount: number) {
  try {
    if (!proofUrlOrKey) return { ok: false, paid: null as number | null, reason: 'no_proof' };

    const path = toStorageKey(proofUrlOrKey);
    if (!INTERNAL_API_TOKEN) return { ok: false, paid: null, reason: 'missing_INTERNAL_API_TOKEN' };

    const res = await fetch(`${INTERNAL_BASE_URL.replace(/\/$/, '')}/api/ocr-proof`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${INTERNAL_API_TOKEN}`,
      },
      body: JSON.stringify({ path }),
      cache: 'no-store',
    });

    const text = await res.text();
    const data = safeJson(text) ?? {};
    if (!res.ok || data?.error) {
      return { ok: false, paid: null, reason: data.error || `http_${res.status}` };
    }

    const paid = normalizePaidAmount(String(data.amount ?? '0'));
    const ok = Math.abs(paid - expectedAmount) <= 3; // allow tiny OCR jitter
    return { ok, paid, reason: ok ? undefined : 'amount_mismatch' };
  } catch (e: any) {
    console.error('OCR fetch exception:', e?.message);
    return { ok: false, paid: null, reason: 'exception' };
  }
}

function toStorageKey(urlOrKey: string) {
  if (!/^https?:\/\//i.test(urlOrKey)) return urlOrKey.replace(/^\/+/, '');
  const withoutPrefix = urlOrKey
    .replace(
      /^https?:\/\/[^/]+\/storage\/v1\/object\/(?:public|sign|authenticated)\//,
      ''
    )
    .replace(/\?.*$/, '');
  return decodeURIComponent(withoutPrefix);
}

function safeJson(s: string) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

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
// Handler
// ───────────────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    // New filters (preferred)
    const onlyUnissued        = req.nextUrl.searchParams.get('onlyUnissued') === '1';
    const onlyMemberTroubled  = req.nextUrl.searchParams.get('onlyMemberTroubled') === '1';
    const onlyOcrTroubled     = req.nextUrl.searchParams.get('onlyOcrTroubled') === '1';

    // Back-compat with old flags (optional)
    const onlyPendingLegacy = req.nextUrl.searchParams.get('onlyPending') === '1';
    const onlyFlaggedLegacy = req.nextUrl.searchParams.get('onlyFlagged') === '1';

    const dryRun = req.nextUrl.searchParams.get('dryRun') === '1';
    const useOCR = req.nextUrl.searchParams.get('useOCR') === '1';
    const limit = Math.max(1, Math.min(500, Number(req.nextUrl.searchParams.get('limit') ?? '50')));

    // 1) Load members once (normalize DB values -> MemberType)
    const members = await prisma.member.findMany({ select: { name_key: true, type: true } });
    const memberMap = new Map<string, MemberType>();
    for (const m of members) memberMap.set(normalizeName(m.name_key), m.type);

    // 2) Build WHERE from new flags (and legacy ones if provided)
    const orTroubled: any[] = [];
    if (onlyMemberTroubled) orTroubled.push({ review_status: { in: ['needs_member', 'recheck'] } });
    if (onlyOcrTroubled)    orTroubled.push({ review_status: 'needs_ocr' });

    // Legacy “flagged”
    if (onlyFlaggedLegacy && orTroubled.length === 0) {
      orTroubled.push({ review_status: { in: ['needs_member', 'needs_ocr', 'recheck'] } });
    }

    const where: any = {
      // “Only unissued” means no tickets; otherwise don’t constrain by tickets.
      ...(onlyUnissued ? { tickets: { none: {} } } : {}),

      // Legacy pending (kept; remove if you don’t use it anymore)
      ...(onlyPendingLegacy ? { payment_status: 'pending' } : {}),

      // If any troubled filters are active, apply OR
      ...(orTroubled.length > 0 ? { OR: orTroubled } : {}),
    };

    // 3) Pull registrations (you can add tickets: { none: {} } to where if you always want unissued)
    const regs = await prisma.registration.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        proof_url: true,

        tickets_regular: true,
        tickets_member: true,
        tickets_student: true,
        tickets_children: true,

        total_amount: true,
        payment_status: true,
        review_status: true,

        // Keep what we last stored for OCR
        ocr_amount_detected: true,
        ocr_expected_amount: true,

        createdAt: true,
        // We don't need existing tickets when we already filter for unissued,
        // but if you want to be safe, you can fetch count:
        // _count: { select: { tickets: true } },
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });

    // Helper to compute “expected” (you already have total_amount stored)
    const getExpected = (r: any) => Number(r.total_amount ?? 0);

    // 4) Dry run (preview only)
    if (dryRun) {
      const preview = regs.map((r) => {
        const key = normalizeName(r.name);
        const mType = memberMap.get(key);
        const memberOk = r.tickets_member === 0 ? true : !!mType;
        const limitByType = mType ? MAX_BY_TYPE[mType] ?? 1 : 0;
        const withinLimit = mType ? r.tickets_member <= limitByType : r.tickets_member === 0;

        // ⬇️ new: show amounts in preview
        const expected = Number(r.total_amount ?? 0);
        const detected = r.ocr_amount_detected ?? null;

        // ⬇️ new: enforce OCR match in preview if checkbox is on
        const ocrOk = !useOCR
          ? true
          : detected !== null && Math.abs(detected - expected) <= 3; // same jitter you use elsewhere

        return {
          registrationId: r.id,
          name: r.name,
          email: r.email,
          isMember: !!mType,
          memberType: mType ?? null,
          claimedMemberTickets: r.tickets_member,
          allowedMemberTickets: mType ? limitByType : 0,
          memberOK: memberOk && withinLimit,
          willIssueTickets: memberOk && withinLimit && ocrOk, // ⬅️ include OCR
          expected,   // for your preview table
          detected,   // for your preview table
        };
      });

      return NextResponse.json({ ok: true, mode: 'dryRun', count: preview.length, rows: preview });
    }


    // 5) Real issuing
    const results: Array<{
      registrationId: string;
      name: string;
      email: string;
      issuedCount: number;
      emailSent: boolean;
      emailError?: string;
      status: 'issued' | 'skipped';
      reason?: string;
      expected?: number | null;
      detected?: number | null;
    }> = [];

    for (const r of regs) {
      const key = normalizeName(r.name);
      const mType = memberMap.get(key);

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
          registrationId: r.id,
          name: r.name,
          email: r.email,
          issuedCount: 0,
          emailSent: false,
          status: 'skipped',
          reason: 'membership_not_found',
          expected: Number(r.total_amount ?? 0),
          detected: r.ocr_amount_detected ?? null,
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
            registrationId: r.id,
            name: r.name,
            email: r.email,
            issuedCount: 0,
            emailSent: false,
            status: 'skipped',
            reason: `member_limit_exceeded:${mType}:${lim}`,
            expected: Number(r.total_amount ?? 0),
            detected: r.ocr_amount_detected ?? null,
          });
          continue;
        }
      }

      // — OCR check (if requested) → flag & skip if mismatch
      let paidDetected: number | null = r.ocr_amount_detected ?? null; // keep prior if any
      if (useOCR) {
        const expectedAmt = Number(r.total_amount ?? 0);
        const check = await verifyPaymentWithOCR(r.proof_url, expectedAmt);
        paidDetected = check.paid ?? null;

        if (!check.ok) {
          await prisma.registration.update({
            where: { id: r.id },
            data: {
              review_status: 'needs_ocr',
              review_reason: `payment_ocr_${check.reason || 'mismatch'}`,
              ocr_amount_detected: paidDetected,
              ocr_expected_amount: expectedAmt,
              ocr_checked_at: new Date(),
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
            expected: expectedAmt,
            detected: paidDetected,
          });
          continue;
        }

        // Successful OCR: persist what we actually detected (⚠ don’t overwrite with expected later)
        await prisma.registration.update({
          where: { id: r.id },
          data: {
            payment_status: 'confirmed',
            ocr_amount_detected: paidDetected,
            ocr_expected_amount: expectedAmt,
            ocr_checked_at: new Date(),
          },
        });
      }

      // — Generate tickets
      const plan: { type: TicketType; count: number }[] = [
        { type: 'regular', count: r.tickets_regular },
        { type: 'member',  count: r.tickets_member  },
        { type: 'student', count: r.tickets_student },
        { type: 'children',count: r.tickets_children},
      ];

      const issued: IssuedTicket[] = [];
      for (const { type, count } of plan) {
        for (let i = 0; i < count; i++) {
          const ticketNo = await makeTicketNo();
          const { qrUrl, token } = await generateAndStoreQR(r.id, ticketNo);

          await prisma.ticket.create({
            data: {
              registrationId: r.id,
              type,
              ticketNo,
              qrUrl,
              status: 'issued',
            },
          });

          issued.push({ ticketNo, qrUrl, token, type });
        }
      }

      // — Mark registration “issued”
      await prisma.registration.update({
        where: { id: r.id },
        data: {
          ticket_status: 'issued' as TicketStatus,
          review_status: 'ok',
          review_reason: null,
          member_type_detected: mType ?? null,
          member_checked_at: mType ? new Date() : undefined,
          ...(useOCR
            ? {
                payment_status: 'confirmed',
                // DO NOT overwrite detected with expected; we already stored detected above.
                // ocr_amount_detected: paidDetected, // <-- omit to avoid accidental overwrite
                // ocr_expected_amount: r.total_amount, // <-- omit too
              }
            : {}),
        },
      });

      // — Email the registrant
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

      const expectedAmt = Number(r.total_amount ?? 0);
      results.push({
        registrationId: r.id,
        name: r.name,
        email: r.email,
        issuedCount: issued.length,
        emailSent: emailOk,
        emailError: emailOk ? undefined : emailErr,
        status: 'issued',
        reason: emailOk ? undefined : `tickets_email_failed:${emailErr}`,
        expected: expectedAmt,
        detected: paidDetected, // ← report detected even on success
      });
    }

    return NextResponse.json({ ok: true, processed: results.length, results });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message || 'internal error' }, { status: 500 });
  }
}
