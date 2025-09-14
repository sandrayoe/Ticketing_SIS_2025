import QRCode from 'qrcode';
import { customAlphabet } from 'nanoid';
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';

export type TicketType = 'regular' | 'member' | 'children';
export type IssuedTicket = { ticketNo: string; qrUrl: string; type: TicketType; token: string };

const {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_QR_BUCKET,         // <- prefer this env name
  TICKET_SIGNING_SECRET,
  TICKET_PREFIX = 'PM25',
  TICKET_LEN = '4',
  TICKET_USE_JWT = '1',
} = process.env;

// Reuse a single server client (service role – server only!)
const sb = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

// "ABC..." no 0/O/1/I for readability
const nano = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', Number(TICKET_LEN) || 4);

export function makeTicketNo(prefix = TICKET_PREFIX) {
  return `${prefix}-${nano()}`;
}

function maybeSignTicket(payload: object) {
  if (TICKET_USE_JWT === '1') {
    if (!TICKET_SIGNING_SECRET) {
      throw new Error('TICKET_SIGNING_SECRET is required when TICKET_USE_JWT=1');
    }
    return jwt.sign(payload, TICKET_SIGNING_SECRET, { algorithm: 'HS256', expiresIn: '365d' });
  }
  return ''; // no token
}

// Generate a PNG image *buffer* for the given QR text
async function makeQrPngBufferFromText(text: string): Promise<Uint8Array> {
  // qrcode.toBuffer returns a Node Buffer (Uint8Array) in Node environments
  return await QRCode.toBuffer(text, {
    type: 'png',
    errorCorrectionLevel: 'M', // good tradeoff
    margin: 2,                 // quiet zone
    scale: 6,                  // size
  });
}

export async function generateAndStoreQR(regId: string, ticketNo: string) {
  const QR_BUCKET = process.env.QR_BUCKET || 'tickets-qr'; // unify names

  // Decide what goes *inside* the QR
  const payload = { t: ticketNo, r: regId };         // minimal payload
  const token   = maybeSignTicket(payload);          // '' if JWT disabled
  const qrText  = token || ticketNo;                 // encode JWT if available, else the ticketNo

  // 1) PNG bytes (the "buffer")
  const pngBuffer = await makeQrPngBufferFromText(qrText);

  // 2) Upload to Storage
  const key = `qr/${regId}/${ticketNo}.png`;
  console.log('QR upload ->', { bucket: QR_BUCKET, key });

  // Optional: quick sanity check that bucket exists
  const list = await sb.storage.from(QR_BUCKET).list('', { limit: 1 });
  if (list.error && /not found/i.test(list.error.message)) {
    throw new Error(`Bucket "${QR_BUCKET}" does not exist in this project`);
  }

  const { error } = await sb.storage
    .from(QR_BUCKET)
    .upload(key, pngBuffer, { contentType: 'image/png', upsert: true });

  if (error) {
    throw new Error(`QR upload failed: ${error.message}`);
  }

  // 3) Public URL (if bucket is public). For private bucket, create a signed URL instead.
  const publicUrl = `${SUPABASE_URL!.replace(/\/$/, '')}/storage/v1/object/public/${QR_BUCKET}/${key}`;

  return { qrUrl: publicUrl, token: token || ticketNo };
}

/** Issue N tickets of a type */
export async function issueTicketsBatch(regId: string, type: TicketType, count: number) {
  const out: IssuedTicket[] = [];
  for (let i = 0; i < count; i++) {
    const ticketNo = makeTicketNo();
    const { qrUrl, token } = await generateAndStoreQR(regId, ticketNo);
    out.push({ ticketNo, qrUrl, token, type });
  }
  return out;
}
