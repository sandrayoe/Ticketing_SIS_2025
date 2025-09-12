// app/api/upload/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

const BUCKET = 'payment-proofs'; // create this public bucket in Supabase Storage

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get('file');
    if (!file || typeof file === 'string') {
      return NextResponse.json({ ok:false, error:'No file uploaded' }, { status: 400 });
    }

    const f = file as File;
    const bytes = new Uint8Array(await f.arrayBuffer());
    const ext = (f.type?.split('/')?.[1] || 'bin').toLowerCase();
    const key = `payment-proofs/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { error } = await supabaseAdmin
      .storage.from(BUCKET)
      .upload(key, bytes, { contentType: f.type });

    if (error) return NextResponse.json({ ok:false, error: error.message }, { status: 500 });

    const { data } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(key);
    return NextResponse.json({ url: data.publicUrl });
  } catch (e: any) {
    return NextResponse.json({ ok:false, error: e?.message ?? 'Upload failed' }, { status: 500 });
  }
}