// app/api/admin/checkin/route.ts
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { extractTicketNo } from '@/lib/extractTicketNo';

export async function POST(req: NextRequest) {
  try {
    const { code } = await req.json();

    if (!code || typeof code !== 'string') {
      return NextResponse.json({ ok: false, error: 'code required' }, { status: 400 });
    }

    let ticketNo: string;
    try {
      ({ ticketNo } = extractTicketNo(code));
    } catch (e: any) {
      return NextResponse.json({ ok: false, error: `Invalid code: ${e.message}` }, { status: 400 });
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

// let GET also accept ?code=... and decode
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const ticketNoParam = searchParams.get('ticketNo');

    if (!code && !ticketNoParam) {
      return NextResponse.json({ ok: false, error: 'code or ticketNo required' }, { status: 400 });
    }

    const { ticketNo } = code ? extractTicketNo(code) : { ticketNo: String(ticketNoParam) };

    const ticket = await prisma.ticket.findUnique({ where: { ticketNo } });
    if (!ticket) {
      return NextResponse.json({ ok: false, error: 'Ticket not found' }, { status: 404 });
    }

    return NextResponse.json({ ok: true, ticket });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: 'Invalid code' }, { status: 400 });
  }
}
