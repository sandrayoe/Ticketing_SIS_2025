// run this if i want to reset ticket numbers
// alter sequence public.ticket_seq restart with 1;
// in supabase or prisma (migration.sql)
// npx prisma migrate dev --create-only -n reset_ticket_seq_2026

import QRCode from 'qrcode';
import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';
import prisma from '@/lib/prisma'; 

export type TicketType = 'regular' | 'member' | 'student' | 'children';
export type IssuedTicket = { ticketNo: string; qrUrl: string; type: TicketType; token: string };

const {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_QR_BUCKET,
  TICKET_SIGNING_SECRET,
  TICKET_PREFIX = 'PM25',
  TICKET_USE_JWT = '1',
} = process.env;

const sb = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

function maybeSignTicket(payload: object) {
  if (TICKET_USE_JWT === '1') {
    if (!TICKET_SIGNING_SECRET) throw new Error('TICKET_SIGNING_SECRET is required when TICKET_USE_JWT=1');
    return jwt.sign(payload, TICKET_SIGNING_SECRET, { algorithm: 'HS256', expiresIn: '365d' });
  }
  return '';
}

export async function makeTicketNo(prefix = process.env.TICKET_PREFIX ?? 'PM25') {
  const rows = await prisma.$queryRaw<{ next_ticket_code: string }[]>`
    select public.next_ticket_code(${prefix}) as next_ticket_code
  `;
  const code = rows?.[0]?.next_ticket_code;
  if (!code) throw new Error('next_ticket_code returned no value');
  return code;
}


async function makeQrPngBuffer(text: string): Promise<Uint8Array> {
  return QRCode.toBuffer(text, { type: 'png', errorCorrectionLevel: 'M', margin: 2, scale: 6 });
}

export async function generateAndStoreQR(regId: string, ticketNo: string) {
  const bucket = SUPABASE_QR_BUCKET || 'tickets-qr';
  const token = maybeSignTicket({ t: ticketNo, r: regId });
  const qrText = token || ticketNo;

  const png = await makeQrPngBuffer(qrText);
  const key = `qr/${regId}/${ticketNo}.png`;

  const { error } = await sb.storage.from(bucket).upload(key, png, {
    contentType: 'image/png',
    upsert: true,
  });
  if (error) throw new Error(`QR upload failed: ${error.message}`);

  const publicUrl = `${SUPABASE_URL!.replace(/\/$/, '')}/storage/v1/object/public/${bucket}/${key}`;
  return { qrUrl: publicUrl, token: token || ticketNo };
}

export async function issueTicketsBatch(regId: string, type: TicketType, count: number) {
  const out: IssuedTicket[] = [];

  for (let i = 0; i < count; i++) {
    const ticketNo = await makeTicketNo();
    const { qrUrl, token } = await generateAndStoreQR(regId, ticketNo);

    await prisma.ticket.create({
      data: { registrationId: regId, type, ticketNo, qrUrl, status: 'issued' },
    });

    out.push({ ticketNo, qrUrl, token, type });
  }

  return out;
}