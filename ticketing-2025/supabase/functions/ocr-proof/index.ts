// supabase/functions/ocr-proof/index.ts
// POST { path: string } -> { amount: number|null, raw?: string, note?: string }

/// <reference lib="deno.ns" />
/// <reference lib="dom" />

import { createClient } from "@supabase/supabase-js";

type OCRReq = { path: string };

const JSONH = { "Content-Type": "application/json" } as const;
const bad = (s: number, error: string, extra: Record<string, unknown> = {}) =>
  new Response(JSON.stringify({ error, ...extra }), { status: s, headers: JSONH });
const ok = (body: unknown) => new Response(JSON.stringify(body), { headers: JSONH });

// Accepts: "bucket/key" or Supabase public/signed URL -> { bucket, key }
function parseBucketKey(input: string) {
  const cleaned = input
    .replace(/^https?:\/\/[^/]+\/storage\/v1\/object\/(?:public|sign)\//, "")
    .replace(/\?.*$/, "");
  const [bucket, ...rest] = cleaned.split("/");
  const key = rest.join("/");
  return { bucket, key };
}

function normalizePaidAmount(raw: string) {
  const s = raw
    .replace(/[^\d.,+\-]/g, "")
    .replace(/[\u00A0\u2000-\u200A\u202F]/g, "")
    .replace(/\.(?=\d{3}\b)/g, "")
    .replace(",", ".");
  const n = Number(s.replace(/[+]/g, "").replace(/^-/, ""));
  return Math.round(Number.isFinite(n) ? n : 0);
}

function extractAmountSEK(text: string): number | null {
  const lines = text.split(/\r?\n/);
  const moneyRE = /([+-]?\d{1,3}(?:[ .]\d{3})*(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)\s*(kr|sek)\b/i;
  const candidates: number[] = [];
  for (const line of lines) {
    const m = line.match(moneyRE);
    if (m) {
      const v = normalizePaidAmount(m[1]);
      if (v > 0 && v < 200000) candidates.push(v);
    }
  }
  if (candidates.length) return candidates[0];

  const anyRE = /[+-]?\d{2,5}(?:[.,]\d{1,2})?/g;
  const any = text.match(anyRE);
  if (any) {
    for (const tok of any) {
      const v = normalizePaidAmount(tok);
      if (v > 0) return v;
    }
  }
  return null;
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") return bad(405, "Use POST");
    if (!req.headers.get("authorization")?.startsWith("Bearer "))
      return bad(401, "Missing bearer");

    const body = (await req.json()) as OCRReq;
    if (!body?.path) return bad(400, "Missing 'path'");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const OCRSPACE_KEY = Deno.env.get("OCRSPACE_API_KEY");
    const DEFAULT_BUCKET = Deno.env.get("PROOF_BUCKET") || "payment-proofs";

    if (!SUPABASE_URL) return bad(500, "env_missing", { which: "SUPABASE_URL" });
    if (!SERVICE_KEY)  return bad(500, "env_missing", { which: "SUPABASE_SERVICE_ROLE_KEY" });
    if (!OCRSPACE_KEY) return bad(500, "env_missing", { which: "OCRSPACE_API_KEY" });

    let { bucket, key } = parseBucketKey(body.path);
    if (!bucket || !key) {
      bucket = bucket || DEFAULT_BUCKET;
      key    = key || body.path.replace(/^\/+/, "");
    }

    const sb = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: file, error } = await sb.storage.from(bucket).download(key);
    if (error || !file) {
      console.log("DOWNLOAD ERROR", { bucket, key, error: error?.message });
      return bad(404, "file_not_found", { bucket, key, detail: error?.message });
    }

    const form = new FormData();
    form.append("isOverlayRequired", "false");
    form.append("OCREngine", "2");
    form.append("detectOrientation", "true");
    form.append("scale", "true");
    form.append("file", file, key.split("/").pop() || "payment-proofs");

    const ocrRes = await fetch("https://api.ocr.space/parse/image", {
      method: "POST",
      headers: { apikey: OCRSPACE_KEY },
      body: form,
    });

    if (!ocrRes.ok) {
      const t = await ocrRes.text();
      return bad(502, "ocrspace_http_error", { status: ocrRes.status, body: t });
    }

    const ocrJson = await ocrRes.json();

    let parsedText = "";
    if (ocrJson?.OCRExitCode === 1 && ocrJson?.ParsedResults?.length) {
      parsedText = String(ocrJson.ParsedResults[0].ParsedText || "");
    } else {
      return ok({
        amount: null,
        raw: "",
        note: "ocr_no_text",
        exit: ocrJson?.OCRExitCode ?? null,
        message: ocrJson?.ErrorMessage ?? ocrJson?.ErrorDetails ?? null,
      });
    }

    if (!parsedText.trim()) return ok({ amount: null, raw: "", note: "no_text" });

    const amount = extractAmountSEK(parsedText);
    return ok({ amount, raw: parsedText, bucket, key });
  } catch (e) {
    console.error("OCR_PROOF_ERROR", e);
    return bad(500, "internal_error");
  }
});

