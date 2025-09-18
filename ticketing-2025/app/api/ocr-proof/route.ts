// app/api/ocr-proof/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ⬇️ we lazy-load sharp to avoid issues in edge runtimes
async function loadSharp() {
  const mod = await import('sharp');
  return mod.default || (mod as any);
}

type OCRReq = { path: string };

const JSONH = { 'Content-Type': 'application/json' } as const;
const bad = (s: number, body: unknown) =>
  new NextResponse(JSON.stringify(body), { status: s, headers: JSONH });
const ok = (body: unknown) => NextResponse.json(body);

// Accepts: "bucket/key" OR Supabase public/signed/authenticated URL -> { bucket, key }
function parseBucketKey(input: string) {
  const trimmed = String(input || '').trim();
  const withoutPrefix = trimmed
    .replace(
      /^https?:\/\/[^/]+\/storage\/v1\/object\/(?:public|sign|authenticated)\//,
      ''
    )
    .replace(/\?.*$/, '');
  const cleaned = decodeURIComponent(withoutPrefix);
  const [bucket, ...rest] = cleaned.split('/');
  const key = rest.join('/');
  return { bucket, key };
}

function normalizePaidAmount(raw: string) {
  const s = raw
    .replace(/[^\d.,+\-]/g, '')
    .replace(/[\u00A0\u2000-\u200A\u202F]/g, '')
    .replace(/\.(?=\d{3}\b)/g, '')
    .replace(',', '.');
  const n = Number(s.replace(/[+]/g, '').replace(/^-/, ''));
  return Math.round(Number.isFinite(n) ? n : 0);
}

function extractAmountSEK(text: string): number | null {
  const cleaned = text.replace(/[\u00A0\u2000-\u200A\u202F]/g, ' ');
  const moneyRE =
    /([+-]?\d{1,3}(?:[ .]\d{3})*(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)\s*(?:kr|sek)\b/gi;
  const candidates: number[] = [];
  for (const m of cleaned.matchAll(moneyRE)) {
    const v = normalizePaidAmount(m[1]);
    if (v > 0 && v < 200000) candidates.push(v);
  }
  if (candidates.length) return Math.max(...candidates);

  const splitLineRE = /([+-]?\d+(?:[.,]\d{1,2})?)\s*[\r\n]+\s*(?:kr|sek)\b/gi;
  for (const m of cleaned.matchAll(splitLineRE)) {
    const v = normalizePaidAmount(m[1]);
    if (v > 0 && v < 200000) return v;
  }

  const aroundCurrencyRE =
    /(?:amount|summa|belopp|paid|betalt)[^\d]{0,15}([+-]?\d{1,3}(?:[ .]\d{3})*(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)/i;
  const near = cleaned.match(aroundCurrencyRE);
  if (near) {
    const v = normalizePaidAmount(near[1]);
    if (v > 0 && v < 200000) return v;
  }
  return null;
}

// ⬇️ shrink images to safely under 900 KB
async function shrinkImageToUnder900KB(inputBlob: Blob): Promise<{ blob: Blob; filename: string }> {
  const sharp = await loadSharp();
  const filename = 'proof.jpg';
  const srcBuf = Buffer.from(await inputBlob.arrayBuffer());

  console.log('[OCR-PROOF] original bytes:', srcBuf.length);

  let width = 900;
  let quality = 70;
  let out = await sharp(srcBuf)
    .rotate()
    .resize({ width, withoutEnlargement: true })
    .jpeg({ quality })
    .toBuffer();

  while (out.length > 900 * 1024 && (quality > 40 || width > 600)) {
    if (quality > 40) quality -= 5;
    else if (width > 600) width -= 50;
    out = await sharp(srcBuf)
      .rotate()
      .resize({ width, withoutEnlargement: true })
      .jpeg({ quality })
      .toBuffer();
  }

  console.log('[OCR-PROOF] compressed bytes:', out.length, 'width:', width, 'quality:', quality);
  return {
    blob: new Blob([new Uint8Array(out)], { type: 'image/jpeg' }),
    filename,
  };
}

export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get('authorization') || '';
    if (!auth.startsWith('Bearer ')) return bad(401, { error: 'Missing bearer' });

    const body = (await req.json()) as OCRReq;
    if (!body?.path) return bad(400, { error: "Missing 'path'" });

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const OCRSPACE_KEY = process.env.OCRSPACE_API_KEY;
    const DEFAULT_BUCKET = process.env.PROOF_BUCKET || 'payment-proofs';

    if (!SUPABASE_URL) return bad(500, { error: 'env_missing', which: 'SUPABASE_URL' });
    if (!SERVICE_KEY) return bad(500, { error: 'env_missing', which: 'SUPABASE_SERVICE_ROLE_KEY' });
    if (!OCRSPACE_KEY) return bad(500, { error: 'env_missing', which: 'OCRSPACE_API_KEY' });

    let { bucket, key } = parseBucketKey(body.path);
    if (!bucket || !key) {
      bucket = bucket || DEFAULT_BUCKET;
      key = key || body.path.replace(/^https?:\/\/[^/]+\/storage\/v1\/object\/(?:public|sign|authenticated)\//, '').replace(/\?.*$/, '').replace(/^\/+/, '');
    }

    const sb = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: file, error } = await sb.storage.from(bucket).download(key);
    if (error || !file) {
      console.log('DOWNLOAD ERROR', { bucket, key, error: error?.message });
      return bad(404, { error: 'file_not_found', bucket, key, detail: error?.message });
    }

    const { blob: sendBlob, filename } = await shrinkImageToUnder900KB(file as unknown as Blob);
    console.log('[OCR-PROOF] sending blob bytes:', sendBlob.size);

    const form = new FormData();
    form.append('isOverlayRequired', 'false');
    form.append('detectOrientation', 'true');
    form.append('scale', 'true');
    form.append('language', 'swe,eng');
    form.append('OCREngine', '2');
    form.append('file', new File([sendBlob], filename, { type: 'image/jpeg' }));

    const ocrRes = await fetch('https://api.ocr.space/parse/image', {
      method: 'POST',
      headers: { apikey: OCRSPACE_KEY },
      body: form,
    });

    if (!ocrRes.ok) {
      const t = await ocrRes.text();
      return bad(502, { error: 'ocrspace_http_error', status: ocrRes.status, body: t });
    }

    const ocrJson = await ocrRes.json();
    let parsedText = '';
    if (ocrJson?.OCRExitCode === 1 && ocrJson?.ParsedResults?.length) {
      parsedText = String(ocrJson.ParsedResults[0].ParsedText || '');
    } else {
      return ok({
        amount: null,
        raw: '',
        note: 'ocr_no_text',
        exit: ocrJson?.OCRExitCode ?? null,
        message: ocrJson?.ErrorMessage ?? ocrJson?.ErrorDetails ?? null,
      });
    }

    if (!parsedText.trim()) return ok({ amount: null, raw: '', note: 'no_text' });
    const amount = extractAmountSEK(parsedText);
    return ok({ amount, raw: parsedText, bucket, key });
  } catch (e) {
    console.error('OCR_PROOF_ERROR', e);
    return bad(500, { error: 'internal_error' });
  }
}
