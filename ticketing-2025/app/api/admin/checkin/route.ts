// app/api/admin/checkin/route.ts
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// POST 
export async function POST(req: NextRequest) {
  try {
    const { ticketNo } = await req.json();

    if (!ticketNo || typeof ticketNo !== 'string') {
      return NextResponse.json({ ok: false, error: 'ticketNo required' }, { status: 400 });
    }

    const ticket = await prisma.ticket.findUnique({ where: { ticketNo } });
    if (!ticket) {
      return NextResponse.json({ ok: false, error: 'Ticket not found' }, { status: 404 });
    }

    if (ticket.checkedIn) {
      return NextResponse.json({ ok: true, status: 'already_checked_in', ticket }, { status: 200 });
    }

    const updated = await prisma.ticket.update({
      where: { ticketNo },
      data: { checkedIn: true, checkedInAt: new Date() },
    });

    return NextResponse.json({ ok: true, status: 'checked_in', ticket: updated });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 });
  }
}

// GET 
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const ticketNo = searchParams.get('ticketNo');

  if (!ticketNo) {
    return NextResponse.json({ ok: false, error: 'ticketNo required' }, { status: 400 });
  }

  const ticket = await prisma.ticket.findUnique({ where: { ticketNo } });
  if (!ticket) {
    return NextResponse.json({ ok: false, error: 'Ticket not found' }, { status: 404 });
  }

  return NextResponse.json({ ok: true, ticket });
}
