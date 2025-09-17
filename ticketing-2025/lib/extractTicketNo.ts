// lib/tickets/extractTicketNo.ts
import jwt from 'jsonwebtoken';

export function extractTicketNo(input: string): { ticketNo: string; regId?: string } {
  // If it's a JWT (three dot-separated parts), try verify/decode
  if (input.split('.').length === 3 && process.env.TICKET_USE_JWT === '1') {
    const secret = process.env.TICKET_SIGNING_SECRET;
    if (!secret) throw new Error('TICKET_SIGNING_SECRET not set');

    try {
      const decoded = jwt.verify(input, secret) as any;
      const t = decoded?.t;
      const r = decoded?.r;
      if (typeof t === 'string' && t) return { ticketNo: t, regId: r };
      throw new Error('JWT missing ticket number');
    } catch (e) {
      // fall through to try plain
    }
  }
  // Treat as plain ticketNo
  const ticketNo = String(input || '').trim();
  if (!ticketNo) throw new Error('Empty code');
  return { ticketNo };
}
