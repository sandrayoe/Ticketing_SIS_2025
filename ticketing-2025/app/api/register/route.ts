// app/api/register/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { gmailTransporter, mailFromName, mailBcc } from '@/lib/mailer';
import { htmlToText } from 'html-to-text';

const PRICE_REGULAR = Number(process.env.PRICE_REGULAR ?? 125);
const PRICE_MEMBER  = Number(process.env.PRICE_MEMBER  ?? 80);
const PRICE_CHILD   = Number(process.env.PRICE_CHILD   ??  0);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const name  = String(body.name ?? '').trim();
    const email = String(body.email ?? '').trim();

    const tickets_regular  = Number(body.tickets_regular ?? 0);
    const tickets_member   = Number(body.tickets_member  ?? 0);
    const tickets_children = Number(body.tickets_child ?? body.tickets_children ?? 0);

    const proof_url = String(body.proof_url ?? '').trim();

    // Minimal guards (UI should already enforce these)
    if (!name || !email) {
      return NextResponse.json({ ok: false, error: 'Name and email are required.' }, { status: 400 });
    }
    if ([tickets_regular, tickets_member, tickets_children].some(n => !Number.isFinite(n) || n < 0)) {
      return NextResponse.json({ ok: false, error: 'Invalid ticket quantities.' }, { status: 400 });
    }
    const totalTickets = tickets_regular + tickets_member + tickets_children;
    if (totalTickets === 0) {
      return NextResponse.json({ ok: false, error: 'Select at least one ticket.' }, { status: 400 });
    }
    if (!proof_url) {
      return NextResponse.json({ ok: false, error: 'Payment proof is required.' }, { status: 400 });
    }

    const total_amount =
      tickets_regular * PRICE_REGULAR +
      tickets_member  * PRICE_MEMBER  +
      tickets_children * PRICE_CHILD;

    const reg = await prisma.registration.create({
      data: {
        name,
        email,
        tickets_regular,
        tickets_member,
        tickets_children,
        total_amount,
        proof_url,
      },
    });

      // ---- Send email via Gmail SMTP ----
      if (!gmailTransporter) {
        return NextResponse.json({ ok: false, error: 'Mailer not configured.' }, { status: 500 });
      }

      const from = `"${mailFromName}" <${process.env.GMAIL_USER}>`;
      const to = reg.email;

      const html = `
        <p>Hi ${reg.name},</p>
        <p>Thank you for registering for <strong>Pasar Malam SIS 2025</strong>.</p>
        <p>Your order:</p>
        <ul>
          <li>Regular: ${reg.tickets_regular}</li>
          <li>Member: ${reg.tickets_member}</li>
          <li>Children: ${reg.tickets_children}</li>
        </ul>
        <p>Total: <strong>${reg.total_amount} SEK</strong></p>
        <p>We will send you the tickets once we verified your payment 
        (up to 48 hours).</p>
        <p>Cheers,<br/>Pasar Malam SIS Team</p>
      `;

      // Generate plain text from the html automatically
      const text = htmlToText(html, {
        wordwrap: 100,   
        selectors: [     // optional tweaks
          { selector: 'a', options: { hideLinkHrefIfSameAsText: true } },
        ],
      });

      await gmailTransporter.sendMail({
        from,
        to,
        bcc: mailBcc,          // optional internal copy
        subject: 'Your registration to Pasar Malam 2025 is confirmed 🎉',
        html,
        text,
        headers: {
          'X-Entity-Ref-ID': reg.id, // helpful for threading/tracking
        },
      });

      // mark invoice_sent = true
      await prisma.registration.update({
        where: { id: reg.id },
        data: { invoice_sent: true },
      });

    return NextResponse.json({ ok: true, registrationId: reg.id, amount: total_amount });
  } catch (err: any) {
    console.error('REGISTER_ERROR:', err);
    const msg = err?.code ? `${err.code}: ${err.message}` : (err?.message || 'Internal error');
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
