// app/api/register/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { sendRegistrationEmail } from '@/lib/mailer';

const PRICE_REGULAR = Number(process.env.PRICE_REGULAR ?? 125);
const PRICE_MEMBER  = Number(process.env.PRICE_MEMBER  ?? 80);
const PRICE_CHILD   = Number(process.env.PRICE_CHILD   ?? 0);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // ── 1) sanitize
    const name  = String(body.name ?? '').trim();
    const email = String(body.email ?? '').trim().toLowerCase();

    const tickets_regular  = Number(body.tickets_regular ?? 0);
    const tickets_member   = Number(body.tickets_member  ?? 0);
    const tickets_children = Number(body.tickets_child ?? body.tickets_children ?? 0);

    const proof_url = String(body.proof_url ?? '').trim();

    // ── 2) validate
    if (!name || !email) {
      return NextResponse.json({ ok: false, error: 'Name and email are required.' }, { status: 400 });
    }
    if ([tickets_regular, tickets_member, tickets_children].some(n => !Number.isFinite(n) || n < 0)) {
      return NextResponse.json({ ok: false, error: 'Invalid ticket quantities.' }, { status: 400 });
    }
    if (tickets_regular + tickets_member + tickets_children === 0) {
      return NextResponse.json({ ok: false, error: 'Select at least one ticket.' }, { status: 400 });
    }
    if (!proof_url) {
      return NextResponse.json({ ok: false, error: 'Payment proof is required.' }, { status: 400 });
    }

    // ── 3) compute
    const total_amount =
      tickets_regular * PRICE_REGULAR +
      tickets_member  * PRICE_MEMBER  +
      tickets_children * PRICE_CHILD;

    // ── 4) create row
    const reg = await prisma.registration.create({
      data: {
        name,
        email,
        tickets_regular,
        tickets_member,
        tickets_children,
        total_amount,
        proof_url,
        review_status: 'pending',
        review_reason: null,
      },
    });

    // ── 5) try to send INVOICE/RECEIPT email
    let emailWarning: string | null = null;
    try {
      await sendRegistrationEmail({
        to: reg.email,
        name: reg.name,
        tickets_regular: reg.tickets_regular,
        tickets_member: reg.tickets_member,
        tickets_children: reg.tickets_children,
        total_amount: reg.total_amount,
        regId: reg.id,
      });

      // mark invoice_sent = true only on success
      await prisma.registration.update({
        where: { id: reg.id },
        data: {
          invoice_sent: true,
          invoice_last_error: null,
          invoice_last_attempt: new Date(),
        },
      });
    } catch (e: any) {
      // keep the registration; flag for recheck and keep invoice_sent false
      const errMsg = e?.message || 'send_invoice_failed';
      emailWarning = errMsg;

      // Don’t fail the whole request; just mark for recheck so you can retry email later.
      await prisma.registration.update({
        where: { id: reg.id },
        data: {
          invoice_sent: false,
          // If you track review fields:
          review_status: 'recheck',
          review_reason: 'invoice_email_failed',
          invoice_last_error: errMsg,
          invoice_last_attempt: new Date(),
        } as any,
      });
    }

    // ── 6) respond (ok even if email failed; include a soft warning for UI)
    return NextResponse.json({
      ok: true,
      registrationId: reg.id,
      amount: total_amount,
      ...(emailWarning ? { emailWarning } : {}),
    });
  } catch (err: any) {
    console.error('REGISTER_ERROR:', err);
    const msg = err?.code ? `${err.code}: ${err.message}` : (err?.message || 'Internal error');
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
