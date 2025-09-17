// app/api/admin/manual-register/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// Match the UI prices (or switch to env vars if you already use those)
const PRICE_REGULAR = 100;
const PRICE_MEMBER  = 60;
const PRICE_STUDENT = 60;
const PRICE_CHILD   = 0;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const name  = String(body.name ?? '').trim();
    const email = String(body.email ?? '').trim().toLowerCase();

    const tickets_regular  = Number(body.tickets_regular ?? 0);
    const tickets_member   = Number(body.tickets_member  ?? 0);
    const tickets_student  = Number(body.tickets_student ?? 0);
    const tickets_children = Number(body.tickets_children ?? 0);

    const payment_verified = Boolean(body.payment_verified);

    if (!name || !email) {
      return NextResponse.json({ ok: false, error: 'Name and email are required.' }, { status: 400 });
    }
    const total_tickets = tickets_regular + tickets_member + tickets_student + tickets_children;
    if (total_tickets <= 0) {
      return NextResponse.json({ ok: false, error: 'At least one ticket is required.' }, { status: 400 });
    }

    // compute SEK total
    const total_amount =
      tickets_regular * PRICE_REGULAR +
      tickets_member  * PRICE_MEMBER  +
      tickets_student * PRICE_STUDENT +
      tickets_children * PRICE_CHILD;

    const payment_status = payment_verified ? 'confirmed' : 'pending'; // Prisma enum PaymentStatus
    const proof_url = payment_verified ? 'manual:verified' : 'manual:unverified';

    // Create the Registration row; tickets can be issued later by your admin batch flow
    const reg = await prisma.registration.create({
      data: {
        name,
        email,
        tickets_regular,
        tickets_member,
        tickets_student,
        tickets_children,
        total_tickets,
        total_amount,
        proof_url,
        payment_status,          // pending | confirmed
        review_status: 'ok'
      },
      select: { id: true, name: true, email: true, total_tickets: true, total_amount: true, payment_status: true }
    });

    return NextResponse.json({ ok: true, registration: reg });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 });
  }
}

