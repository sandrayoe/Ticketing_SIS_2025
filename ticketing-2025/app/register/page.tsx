'use client';

import { useMemo, useState, useRef, useEffect } from 'react';
import { useRouter } from "next/navigation";
import { Trash2, Copy } from "lucide-react";

const shell = "mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8";
// Prices for calculator
const PRICE_REGULAR = 125;
const PRICE_MEMBER  = 80;
const PRICE_CHILD   = 0;

function sek(n: number) {
  return new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', maximumFractionDigits: 0 }).format(n);
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value.replace(/\s+/g, ' ').trim());
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-earthy-dark/10 bg-white px-3 py-2">
      <div>
        <div className="text-[13px] font-medium text-earthy-dark/90">{label}</div>
        <div className="text-sm text-earthy-dark/80">{value}</div>
      </div>
      <button
        type="button"
        onClick={copy}
        className="rounded-md border border-earthy-dark/20 p-1.5 text-xs hover:bg-earthy-green hover:text-white"
        aria-label={`Copy ${label}`}
        title="Copy"
      >
        {copied ? <span className="px-1 text-[11px]">Copied</span> : <Copy className="h-4 w-4" />}
      </button>
    </div>
  );
}

function PaymentDetails() {
  return (
    <div className="rounded-3xl border border-earthy-green/40 bg-white p-6 shadow sm:p-8">
      <h2 className="text-xl font-semibold text-earthy-dark">Payment details</h2>
      <p className="mt-2 text-sm text-earthy-dark/80">
        Pay using Swish, PlusGiro or bank transfer. Then upload your receipt below.
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {/* Swish & PlusGiro */}
        <div className="rounded-2xl border border-earthy-dark/10 bg-earthy-light/40 p-4">
          <div className="text-sm font-semibold text-earthy-dark">Swish & PlusGiro</div>
          <div className="mt-1 text-xs text-earthy-dark/70">
            Account: <span className="font-medium">Svensk-Indonesiska Sällskapet</span>
          </div>
          <div className="mt-3 space-y-2">
            <CopyRow label="Swish" value="123 673 05 27" />
            <CopyRow label="PlusGiro" value="433 97 34-8" />
          </div>
        </div>

        {/* Bank transfer */}
        <div className="rounded-2xl border border-earthy-dark/10 bg-earthy-light/40 p-4">
          <div className="text-sm font-semibold text-earthy-dark">Bank transfer</div>
          <div className="mt-3 grid gap-2">
            <CopyRow label="IBAN" value="SE56 9500 0099 6034 4339 7348" />
            <CopyRow label="BIC" value="NDEASESS" />
            <CopyRow label="Kontonummer" value="43397348" />
            <CopyRow label="Bankkontonummer" value="9960 3443397348" />
            <CopyRow label="Clearingnummer" value="9960" />
          </div>
        </div>
      </div>

      {/* Prices */}
      <div className="mt-6 rounded-2xl border border-earthy-dark/10 bg-earthy-light/40 p-4">
        <div className="text-sm font-semibold text-earthy-dark/90">Ticket prices</div>
        <ul className="mt-2 list-disc pl-5 text-sm text-earthy-dark/80">
          <li>Regular: {sek(PRICE_REGULAR)}</li>
          <li>Member: {sek(PRICE_MEMBER)}</li>
          <li>Children (&lt; 12 years old): Free </li>
        </ul>
      </div>
    </div>
  );
}


export default function RegisterPage() {
  const router = useRouter();
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

  // For calculator
  const totals = useMemo(() => {
    const regQty  = Number(form.tickets_regular)  || 0;
    const memQty  = Number(form.tickets_member)   || 0;
    const kidQty  = Number(form.tickets_children) || 0;

    const regTotal = regQty * PRICE_REGULAR;
    const memTotal = memQty * PRICE_MEMBER;
    const kidTotal = kidQty * PRICE_CHILD;

    const grand = regTotal + memTotal + kidTotal;
    const totalQty = regQty + memQty + kidQty;

    return { regQty, memQty, kidQty, regTotal, memTotal, kidTotal, grand, totalQty };
  }, [form.tickets_regular, form.tickets_member, form.tickets_children]);

  const [isMember, setIsMember] = useState(false);

  // Keep form.tickets_member in sync with the member toggle
  useEffect(() => {
    setForm(f => ({
      ...f,
      tickets_member: isMember ? 1 : 0, // 1 when member, 0 when not
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMember]);

  // For proof of payment 
  const canSubmit = (proofFile || form.proof_url) && !loading && !uploading && (totals?.totalQty ?? 0) > 0;

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
    setMsg(null);

    // Require tickets to > 0
    if (totals.totalQty === 0) {
      setMsg('❌ Please select at least one ticket.');
      return;
    }

    // ✅ Require proof file/url
    if (!proofFile && !form.proof_url) {
      setMsg('❌ Please attach a payment proof (image or PDF).');
      return;
    }

    setLoading(true);
    try {
      const proofUrl = await uploadProofIfNeeded();

      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({ ...form, proof_url: proofUrl ?? '' }),
      });
      const data = await res.json();

      if (!res.ok || !data.ok) throw new Error(data.error || 'Failed');

      // redirecting to success page
      router.push("/success");
    } catch (err: any) {
      console.error(err);
      setLoading(false);
      alert("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    if (!f) { setProofFile(null); return; }
    // size guard: ~10 MB
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

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // revoke old preview URLs when file changes/unmounts
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function clearProof() {
    setProofFile(null);
    // clear the <input type="file">
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  return (
    <div className="min-h-svh flex flex-col bg-earthy-light text-earthy-dark">
      {/* Navigation (GREEN) */}
      <header className="border-b bg-earthy-green text-white">
        <nav className={`${shell} flex h-14 items-center justify-between`}>
          {/* Logo + Title */}
          <a
            href="/"
            className="flex items-center gap-2 pr-20 text-sm font-semibold sm:text-base lg:text-xl"
          >
            <img
              src="/images/SIS_logo_transp.png"
              alt="Logo"
              className="h-10 w-10 sm:h-12 sm:w-12"
            />
            Pasar Malam 2025: Celebration of Friendship
          </a>

          {/* About link — always visible */}
          <div className="flex gap-6 text-sm sm:text-sm lg:text-lg">
            <a href="/about" className="hover:underline">
              About
            </a>
          </div>
        </nav>
      </header>

      {/* Main */}
      <main className={`${shell} grow py-10 sm:py-14`}>
        <div className="mx-auto max-w-2xl">
          {/* Title / intro */}
          <div className="text-center">
            <h1 className="text-3xl font-bold sm:text-4xl">Registration</h1>
            <p className="mt-3 text-earthy-dark/80 sm:text-lg">
              Please fill in your details, ticket quantities, and proof of payment below.
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

                {/* Member question */}
                <div className="rounded-2xl border border-earthy-dark/10 p-4 sm:p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-earthy-dark/80">
                      Are you a member?
                    </span>
                    <div className="inline-flex overflow-hidden rounded-xl border border-earthy-dark/20">
                      <button
                        type="button"
                        onClick={() => setIsMember(false)}
                        className={`px-4 py-2 text-sm font-medium ${
                          !isMember
                            ? 'bg-earthy-green text-white'
                            : 'bg-white text-earthy-dark hover:bg-earthy-light/60'
                        }`}
                        aria-pressed={!isMember}
                      >
                        No
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsMember(true)}
                        className={`px-4 py-2 text-sm font-medium ${
                          isMember
                            ? 'bg-earthy-green text-white'
                            : 'bg-white text-earthy-dark hover:bg-earthy-light/60'
                        }`}
                        aria-pressed={isMember}
                      >
                        Yes
                      </button>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-earthy-dark/70">
                    We will verify your membership later. Want to become a member?{" "}
                    <a
                      href="https://svensk-indonesiska.se/membership"
                      className="font-medium text-earthy-green underline hover:text-earthy-brown"
                      target="_blank"
                    >
                      Apply here
                    </a>
                  </p>
                </div>

                {/* Payment details card */}
                <div className="relative mt-8">
                  <PaymentDetails />
                </div>

                {/* Tickets grid */}
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {/* Regular */}
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium">Regular</span>
                    <input
                      type="number" min={0} step={1}
                      className="w-full rounded-lg border border-earthy-dark/20 bg-white p-2.5 focus:outline-none focus:ring-2 focus:ring-earthy-green"
                      value={form.tickets_regular === 0 ? "" : form.tickets_regular}
                      onChange={e => {
                        const val = e.target.value === "" ? 0 : Number(e.target.value);
                        setForm(f => ({ ...f, tickets_regular: val }));
                      }}
                      placeholder="0"
                    />
                  </label>

                  {/* Member — show only when isMember; user can choose quantity >= 1 */}
                  {isMember && (
                    <label className="block">
                      <span className="mb-1 block text-xs font-medium">Member</span>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      className="w-full rounded-lg border border-earthy-dark/20 bg-white p-2.5 focus:outline-none focus:ring-2 focus:ring-earthy-green"
                      value={form.tickets_member === 0 ? "" : form.tickets_member}
                      onChange={e => {
                        const val = Number(e.target.value);
                        setForm(f => ({ ...f, tickets_member: isNaN(val) ? 0 : val }));
                      }}
                      placeholder="0"
                    />
                      <span className="mt-1 block text-[11px] text-red-600">
                        *member tickets are for you (single) or your family only (family membership)
                      </span>
                    </label>
                  )}


                  {/* Children */}
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium">Children</span>
                    <input
                      type="number" min={0} step={1}
                      className="w-full rounded-lg border border-earthy-dark/20 bg-white p-2.5 focus:outline-none focus:ring-2 focus:ring-earthy-green"
                      value={form.tickets_children === 0 ? "" : form.tickets_children}
                      onChange={e => {
                        const val = e.target.value === "" ? 0 : Number(e.target.value);
                        setForm(f => ({ ...f, tickets_children: val }));
                      }}
                      placeholder="0"
                    />
                  </label>
                </div>

                {/* Live calculator */}
                <div className="mt-4 rounded-2xl border border-earthy-dark/10 bg-earthy-light/50 p-4 sm:p-5">
                  <h2 className="text-sm font-semibold text-earthy-dark/80">Summary</h2>

                  <div className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                    <div className="flex justify-between rounded-lg border border-earthy-dark/10 bg-white px-3 py-2">
                      <span>Regular × {totals.regQty} @ {sek(PRICE_REGULAR)}</span>
                      <span className="font-medium">{sek(totals.regTotal)}</span>
                    </div>
                    <div className="flex justify-between rounded-lg border border-earthy-dark/10 bg-white px-3 py-2">
                      <span>Member × {totals.memQty} @ {sek(PRICE_MEMBER)}</span>
                      <span className="font-medium">{sek(totals.memTotal)}</span>
                    </div>
                    <div className="flex justify-between rounded-lg border border-earthy-dark/10 bg-white px-3 py-2">
                      <span>Children × {totals.kidQty} @ {sek(PRICE_CHILD)}</span>
                      <span className="font-medium">{sek(totals.kidTotal)}</span>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between rounded-xl border border-earthy-green/30 bg-white px-4 py-3">
                    <div className="text-earthy-dark/80">
                      <div className="text-xs">Total tickets: <span className="font-medium">{totals.totalQty}</span></div>
                      <div className="text-xs italic">The number of tickets sent will match the number you order.</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-earthy-dark/70">Estimated total</div>
                      <div className="text-2xl font-bold">{sek(totals.grand)}</div>
                    </div>
                  </div>
                </div>

                {/* Proof uploader */}
                <div className="rounded-2xl border border-earthy-dark/10 p-4 sm:p-5">
                  <label className="block">
                    <span className="mb-1 block text-sm font-medium">
                      Payment proof (image or PDF)
                    </span>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={onFileChange}
                      // Add `required` if you want hard enforcement at the browser level:
                      // required
                      className="w-full cursor-pointer rounded-lg border border-earthy-dark/20 bg-white p-2.5 file:mr-4 file:rounded-md file:border-0 file:bg-earthy-brown file:px-4 file:py-2 file:text-sm file:font-semibold file:text-earthy-dark hover:file:bg-earthy-green hover:file:text-white"
                    />
                  </label>

                  {/* Preview + Remove */}
                  {proofFile && (
                    <div className="mt-3 flex items-center gap-3 text-sm">
                      {isImage && previewUrl ? (
                        <img
                          src={previewUrl}
                          alt="Preview"
                          className="h-16 w-16 rounded-md border object-cover"
                        />
                      ) : (
                        <div className="rounded-md border px-3 py-2">
                          {proofFile.name} ({Math.round(proofFile.size/1024)} KB)
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={clearProof}
                        className="rounded-md border border-earthy-dark/20 px-3 py-1.5 text-xs font-medium hover:bg-earthy-green hover:text-white"
                        title="Remove file"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Submit */}
                <div className="pt-2 flex items-center gap-3">
                  <button
                    disabled={loading || uploading || !canSubmit}
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

      {/* Footer (GREEN) */}
      <footer className="mt-6 border-t bg-earthy-green text-white">
        <div className={`${shell} py-4 text-center text-xs`}>
          <span>© 2025 SIS.</span>
          <br className="sm:hidden" />
          <span> All rights reserved.</span>
        </div>
      </footer>
    </div>
  );
}

