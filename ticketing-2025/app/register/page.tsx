'use client';

import { useMemo, useState } from 'react';

const shell = "mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8";

export default function RegisterPage() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    tickets_regular: 0,
    tickets_member: 0,
    tickets_children: 0,
    proof_url: '', // will be set after upload
  });
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const isImage = useMemo(
    () => proofFile?.type?.startsWith('image/'),
    [proofFile]
  );

  const previewUrl = useMemo(() => {
    if (!proofFile) return null;
    if (proofFile.type.startsWith('image/')) return URL.createObjectURL(proofFile);
    return null; // PDFs won’t be previewed, we’ll just show filename
  }, [proofFile]);

  async function uploadProofIfNeeded(): Promise<string | null> {
    if (!proofFile) return form.proof_url || null;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', proofFile);
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok || !data?.url) throw new Error(data?.error || 'Upload failed');
      return data.url as string;
    } finally {
      setUploading(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setMsg(null);
    try {
      // 1) upload file first (if any) to get a public URL
      const proofUrl = await uploadProofIfNeeded();

      // 2) submit registration with proof_url included
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({ ...form, proof_url: proofUrl ?? '' }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Failed');
      setMsg(`✅ Registered! Amount: ${data.amount} SEK`);
      // window.location.href = `/success?rid=${data.registrationId}`;
    } catch (err: any) {
      setMsg(`❌ ${err.message ?? 'Error'}`);
    } finally {
      setLoading(false);
    }
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    if (!f) { setProofFile(null); return; }
    // optional size guard: ~10 MB
    if (f.size > 10 * 1024 * 1024) {
      setMsg('❌ File too large. Max 10 MB.');
      e.target.value = '';
      return;
    }
    // allow only images or pdf
    if (!(f.type.startsWith('image/') || f.type === 'application/pdf')) {
      setMsg('❌ Only images or PDFs are allowed.');
      e.target.value = '';
      return;
    }
    setMsg(null);
    setProofFile(f);
  }

  return (
    <div className="min-h-svh flex flex-col bg-earthy-light text-earthy-dark">
      {/* Header matches landing */}
      <header className="border-b bg-earthy-green text-white">
        <nav className={`${shell} flex h-14 items-center justify-between`}>
          <a href="/" className="text-sm font-semibold">Ticketing</a>
          <div className="hidden sm:flex gap-6 text-sm">
            <a href="/about" className="hover:underline">About</a>
          </div>
        </nav>
      </header>

      {/* Main */}
      <main className={`${shell} grow py-10 sm:py-14`}>
        <div className="mx-auto max-w-2xl">
          {/* Title / intro */}
          <div className="text-center">
            <h1 className="text-3xl font-bold sm:text-4xl">Register</h1>
            <p className="mt-3 text-earthy-dark/80 sm:text-lg">
              Please fill in your details and ticket quantities below.
            </p>
          </div>

          {/* White card wrapper */}
          <section className="relative mt-8">
            <div className="rounded-3xl border border-earthy-green/40 bg-white p-6 shadow sm:p-8">
              <form onSubmit={submit} className="space-y-5">
                {/* Name / Email */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1 block text-sm font-medium">Full name</span>
                    <input
                      className="w-full rounded-lg border border-earthy-dark/20 bg-white p-2.5 focus:outline-none focus:ring-2 focus:ring-earthy-green"
                      placeholder="Full name"
                      required
                      value={form.name}
                      onChange={e=>setForm(f=>({...f, name: e.target.value}))}
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-sm font-medium">Email</span>
                    <input
                      className="w-full rounded-lg border border-earthy-dark/20 bg-white p-2.5 focus:outline-none focus:ring-2 focus:ring-earthy-green"
                      placeholder="you@gmail.com"
                      type="email"
                      required
                      value={form.email}
                      onChange={e=>setForm(f=>({...f, email: e.target.value}))}
                    />
                  </label>
                </div>

                {/* Tickets grid */}
                <fieldset className="rounded-2xl border border-earthy-dark/10 p-4 sm:p-5">
                  <legend className="px-2 text-sm font-semibold text-earthy-dark/80">
                    Tickets
                  </legend>
                  <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <label className="block">
                      <span className="mb-1 block text-xs font-medium">Regular</span>
                      <input
                        type="number" min={0} step={1}
                        className="w-full rounded-lg border border-earthy-dark/20 bg-white p-2.5 focus:outline-none focus:ring-2 focus:ring-earthy-green"
                        value={form.tickets_regular}
                        onChange={e=>setForm(f=>({...f, tickets_regular: Number(e.target.value)}))}
                        placeholder="0"
                      />
                    </label>

                    <label className="block">
                      <span className="mb-1 block text-xs font-medium">Member</span>
                      <input
                        type="number" min={0} step={1}
                        className="w-full rounded-lg border border-earthy-dark/20 bg-white p-2.5 focus:outline-none focus:ring-2 focus:ring-earthy-green"
                        value={form.tickets_member}
                        onChange={e=>setForm(f=>({...f, tickets_member: Number(e.target.value)}))}
                        placeholder="0"
                      />
                    </label>

                    <label className="block">
                      <span className="mb-1 block text-xs font-medium">Children</span>
                      <input
                        type="number" min={0} step={1}
                        className="w-full rounded-lg border border-earthy-dark/20 bg-white p-2.5 focus:outline-none focus:ring-2 focus:ring-earthy-green"
                        value={form.tickets_children}
                        onChange={e=>setForm(f=>({...f, tickets_children: Number(e.target.value)}))}
                        placeholder="0"
                      />
                    </label>
                  </div>
                </fieldset>

                {/* Proof uploader */}
                <div className="rounded-2xl border border-earthy-dark/10 p-4 sm:p-5">
                  <label className="block">
                    <span className="mb-1 block text-sm font-medium">Payment proof (image or PDF)</span>
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={onFileChange}
                      className="w-full cursor-pointer rounded-lg border border-earthy-dark/20 bg-white p-2.5 file:mr-4 file:rounded-md file:border-0 file:bg-earthy-brown file:px-4 file:py-2 file:text-sm file:font-semibold file:text-earthy-dark hover:file:bg-earthy-green hover:file:text-white"
                    />
                  </label>

                  {/* Preview */}
                  {proofFile && (
                    <div className="mt-3 flex items-center gap-3 text-sm">
                      {isImage && previewUrl ? (
                        <img
                          src={previewUrl}
                          alt="Preview"
                          className="h-16 w-16 rounded-md border object-cover"
                          onLoad={() => URL.revokeObjectURL(previewUrl)}
                        />
                      ) : (
                        <div className="rounded-md border px-3 py-2">
                          {proofFile.name} ({Math.round(proofFile.size/1024)} KB)
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Submit */}
                <div className="pt-2 flex items-center gap-3">
                  <button
                    disabled={loading || uploading}
                    className="rounded-xl bg-earthy-brown px-6 py-3 text-sm font-semibold text-earthy-dark shadow hover:bg-earthy-green hover:text-white focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-earthy-green disabled:opacity-60"
                  >
                    {uploading ? 'Uploading…' : loading ? 'Submitting…' : 'Submit'}
                  </button>
                  {(uploading || loading) && (
                    <span className="text-xs text-earthy-dark/70">Please don’t close this page.</span>
                  )}
                </div>
              </form>

              {/* Message */}
              {msg && (
                <div
                  className={`mt-4 rounded-lg border p-3 text-sm ${
                    msg.startsWith('✅')
                      ? 'border-green-300 bg-green-50 text-green-800'
                      : 'border-red-300 bg-red-50 text-red-800'
                  }`}
                >
                  {msg}
                </div>
              )}
            </div>
          </section>
        </div>
      </main>

      {/* Footer matches landing */}
      <footer className="mt-6 border-t bg-earthy-green text-white">
        <div className={`${shell} py-4 text-center text-xs`}>
          © 2025 sandrayoe. All pictures and documentations belong to SIS archive. All rights reserved.
        </div>
      </footer>
    </div>
  );
}

