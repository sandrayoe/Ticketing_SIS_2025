// app/api/admin/checkin/stats/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    // total registrants = sum of total_tickets from Registration
    const result = await prisma.registration.aggregate({
      _sum: { total_tickets: true },
    });
    const totalRegistrants = result._sum.total_tickets ?? 0;

    // checked-in tickets = count of Ticket rows where checkedIn = true
    const checkedIn = await prisma.ticket.count({
      where: { checkedIn: true },
    });

    return NextResponse.json(
      { ok: true, totalRegistrants, checkedIn },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { ok: false, error: 'Server error' },
      { status: 500 }
    );
  }
}

