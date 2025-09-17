// app/api/admin/manual-register/route.ts
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { TicketStatus, PaymentStatus } from '@prisma/client';
import { makeTicketNo } from '@/lib/tickets';

const PRICE_REGULAR = 100;
const PRICE_MEMBER  = 60;
const PRICE_STUDENT = 60;
const PRICE_CHILD   = 0;

// Use a local union that matches your Prisma String field semantics
type TicketKind = 'regular' | 'member' | 'student' | 'children';

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

    const total_amount =
      tickets_regular * PRICE_REGULAR +
      tickets_member  * PRICE_MEMBER  +
      tickets_student * PRICE_STUDENT +
      tickets_children * PRICE_CHILD;

    const payment_status: PaymentStatus = payment_verified
      ? PaymentStatus.confirmed
      : PaymentStatus.pending;

    const proof_url = payment_verified ? 'manual:verified' : 'manual:unverified';

    const types: TicketKind[] = [
      ...Array.from({ length: tickets_regular  }, () => 'regular'  as const),
      ...Array.from({ length: tickets_member   }, () => 'member'   as const),
      ...Array.from({ length: tickets_student  }, () => 'student'  as const),
      ...Array.from({ length: tickets_children }, () => 'children' as const),
    ];

    const result = await prisma.$transaction(async (tx) => {
      const reg = await tx.registration.create({
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
          payment_status,
          review_status: 'ok', 
        },
        select: {
          id: true, name: true, email: true,
          total_tickets: true, total_amount: true, payment_status: true
        }
      });

      // Ticket numbers
      const codes: string[] = [];
      for (let i = 0; i < types.length; i++) {
        codes.push(await makeTicketNo());
      }
      const now = new Date();

      const rows = codes.map((code, i) => ({
        registrationId: reg.id,
        type: types[i],                 // <- plain string
        ticketNo: code,
        qrUrl: 'manual',                // since it is manual
        status: TicketStatus.issued,
        checkedIn: true,
        checkedInAt: now,
      }));

      const { count } = await tx.ticket.createMany({ data: rows });

      return { reg, issued: count, ticketNo: codes };
    });

    return NextResponse.json({
      ok: true,
      registration: result.reg,
      issued_tickets: result.issued,
      checked_in: true,
      emailed: false,
      ticketNo: result.ticketNo,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 });
  }
}



