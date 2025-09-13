// lib/tickets.ts
import QRCode from 'qrcode';
import { customAlphabet } from 'nanoid';
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';

export type TicketType = 'regular' | 'member' | 'children';
export type IssuedTicket = { ticketNo: string; qrUrl: string; type: TicketType; token: string };

const {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_QR_BUCKET,
  TICKET_SIGNING_SECRET,
  TICKET_PREFIX = 'SIS25',
  TICKET_LEN = '4',           // length
  TICKET_USE_JWT = '1',       // 1 to include JWT inside QR for offline verif
} = process.env;

const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

const nano = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', Number(TICKET_LEN) || 4);

export function makeTicketNo(prefix = TICKET_PREFIX) {
  return `${prefix}-${nano()}`;
}

function maybeSignTicket(payload: object) {
  if (TICKET_USE_JWT === '1') {
    return jwt.sign(payload, TICKET_SIGNING_SECRET!, { algorithm: 'HS256', expiresIn: '365d' });
  }
  return ''; // no token
}

export async function generateAndStoreQR(regId: string, ticketNo: string) {
  const token = maybeSignTicket({ v: 1, regId, ticketNo });

  // Keep QR content compact:
  // - With JWT   : "SIS|<ticketNo>|<jwt>"
  const qrData = token ? `SIS|${ticketNo}|${token}` : `SIS|${ticketNo}`;

  const pngBuffer = await QRCode.toBuffer(qrData, { width: 384, margin: 0, errorCorrectionLevel: 'M' });

  const path = `${regId}/${ticketNo}.png`;
  const { error } = await supabase.storage.from(SUPABASE_QR_BUCKET!).upload(path, pngBuffer, {
    contentType: 'image/png',
    upsert: true,
    cacheControl: '31536000',
  });
  if (error) throw error;

  const { data: pub } = supabase.storage.from(SUPABASE_QR_BUCKET!).getPublicUrl(path);
  return { qrUrl: pub.publicUrl, token };
}

/**
 * Helper to issue N tickets quickly.
 * NOTE: DB uniqueness (ticketNo @unique) should be enforced in your Prisma model.
 */
export async function issueTicketsBatch(regId: string, type: TicketType, count: number) {
  const out: IssuedTicket[] = [];
  for (let i = 0; i < count; i++) {
    const ticketNo = makeTicketNo();
    const { qrUrl, token } = await generateAndStoreQR(regId, ticketNo);
    out.push({ ticketNo, qrUrl, token, type });
  }
  return out;
}
