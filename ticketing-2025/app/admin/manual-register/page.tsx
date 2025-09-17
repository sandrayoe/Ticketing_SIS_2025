// app/admin/manual-register/page.tsx
'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

const shell = 'mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8';

// Prices (keep in sync with API or move to shared/constants)
const PRICE_REGULAR = 100;
const PRICE_MEMBER  = 60;
const PRICE_STUDENT = 60;
const PRICE_CHILD   = 0;

function sek(n: number) {
  return new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', maximumFractionDigits: 0 }).format(n);
}

export default function ManualRegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: '',
    email: '',
    tickets_regular: 0,
    tickets_member: 0,
    tickets_student: 0,
    tickets_children: 0,
  });
  const [isMember, setIsMember] = useState(false);
  const [paymentVerified, setPaymentVerified] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Auto-show member input only if toggled
  const memberTickets = isMember ? form.tickets_member : 0;

  const totals = useMemo(() => {
    const regQty = Number(form.tickets_regular) || 0;
    const memQty = Number(memberTickets) || 0;
    const stuQty = Number(form.tickets_student) || 0;
    const kidQty = Number(form.tickets_children) || 0;

    const regTotal = regQty * PRICE_REGULAR;
    const memTotal = memQty * PRICE_MEMBER;
    const stuTotal = stuQty * PRICE_STUDENT;
    const kidTotal = kidQty * PRICE_CHILD;

    const totalQty = regQty + memQty + stuQty + kidQty;
    const grand = regTotal + memTotal + stuTotal + kidTotal;

    return { regQty, memQty, stuQty, kidQty, regTotal, memTotal, stuTotal, kidTotal, totalQty, grand };
  }, [form.tickets_regular, memberTickets, form.tickets_student, form.tickets_children]);

  const canSubmit = totals.totalQty > 0 && paymentVerified && !loading;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    if (totals.totalQty === 0) {
      setMsg('❌ Please select at least one ticket.');
      return;
    }
    if (!paymentVerified) {
      setMsg('❌ Please confirm that staff has verified the payment.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/admin/manual-register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim().toLowerCase(),
          tickets_regular: Number(form.tickets_regular) || 0,
          tickets_member: Number(isMember ? form.tickets_member : 0) || 0,
          tickets_student: Number(form.tickets_student) || 0,
          tickets_children: Number(form.tickets_children) || 0,
          payment_verified: paymentVerified,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Failed');

      setMsg(`✅ Saved.`);
      // Optionally redirect back to check-in page or stay for the next entry:
      // router.push('/admin/checkin');
    } catch (err: any) {
      console.error(err);
      setMsg('❌ Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-svh flex flex-col bg-earthy-light text-earthy-dark">
      <header className="border-b bg-earthy-green text-white">
        <nav className={`${shell} flex h-14 items-center justify-between`}>
          <a href="/admin/checkin" className="text-sm font-semibold hover:underline">← Back to Check-in</a>
          <div className="text-sm font-semibold">Manual Registration (Staff Only)</div>
          <div />
        </nav>
      </header>

      <main className={`${shell} grow py-8 sm:py-10`}>
        <div className="mx-auto max-w-2xl">
          <div className="text-center">
            <h1 className="text-3xl font-bold sm:text-4xl">Manual Registration</h1>
            <p className="mt-3 text-earthy-dark/80 sm:text-lg">
              Enter attendee details and ticket quantities. No file upload — just confirm you’ve seen their payment.
            </p>
          </div>

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
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
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
                      onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    />
                  </label>
                </div>

                {/* Member toggle */}
                <div className="rounded-2xl border border-earthy-dark/10 p-4 sm:p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-earthy-dark/80">Is the buyer a SIS member?</span>
                    <div className="inline-flex overflow-hidden rounded-xl border border-earthy-dark/20">
                      <button
                        type="button"
                        onClick={() => setIsMember(false)}
                        className={`px-4 py-2 text-sm font-medium ${!isMember ? 'bg-earthy-green text-white' : 'bg-white text-earthy-dark hover:bg-earthy-light/60'}`}
                        aria-pressed={!isMember}
                      >
                        No
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsMember(true)}
                        className={`px-4 py-2 text-sm font-medium ${isMember ? 'bg-earthy-green text-white' : 'bg-white text-earthy-dark hover:bg-earthy-light/60'}`}
                        aria-pressed={isMember}
                      >
                        Yes
                      </button>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-earthy-dark/70">
                    Staff will verify membership eligibility later; this only reveals the member ticket field.
                  </p>
                </div>

                {/* Tickets */}
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <NumInput
                    label="Regular"
                    value={form.tickets_regular}
                    onChange={v => setForm(f => ({ ...f, tickets_regular: v }))}
                  />
                  <NumInput
                    label="Student"
                    value={form.tickets_student}
                    onChange={v => setForm(f => ({ ...f, tickets_student: v }))}
                    hint="*valid only for students/pensionär"
                  />
                  <NumInput
                    label="Children"
                    value={form.tickets_children}
                    onChange={v => setForm(f => ({ ...f, tickets_children: v }))}
                  />
                  {isMember && (
                    <NumInput
                      label="Member"
                      value={form.tickets_member}
                      onChange={v => setForm(f => ({ ...f, tickets_member: v }))}
                      hint="*member tickets are for you (single) or your family only"
                    />
                  )}
                </div>

                {/* Summary */}
                <div className="mt-4 rounded-2xl border border-earthy-dark/10 bg-earthy-light/50 p-4 sm:p-5">
                  <h2 className="text-sm font-semibold text-earthy-dark/80">Summary</h2>
                  <div className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                    <SummaryRow label={`Regular × ${totals.regQty} @ ${sek(PRICE_REGULAR)}`} value={sek(totals.regTotal)} />
                    <SummaryRow label={`Children × ${totals.kidQty} @ ${sek(PRICE_CHILD)}`} value={sek(totals.kidTotal)} />
                    <SummaryRow label={`Student × ${totals.stuQty} @ ${sek(PRICE_STUDENT)}`} value={sek(totals.stuTotal)} />
                    <SummaryRow label={`Member × ${totals.memQty} @ ${sek(PRICE_MEMBER)}`} value={sek(totals.memTotal)} />
                  </div>
                  <div className="mt-4 flex items-center justify-between rounded-xl border border-earthy-green/30 bg-white px-4 py-3">
                    <div className="text-earthy-dark/80">
                      <div className="text-xs">Total tickets: <span className="font-medium">{totals.totalQty}</span></div>
                      <div className="text-xs italic">Tickets issued later will match this quantity.</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-earthy-dark/70">Estimated total</div>
                      <div className="text-2xl font-bold">{sek(totals.grand)}</div>
                    </div>
                  </div>
                </div>

                {/* Payment verified checkbox */}
                <label className="mt-2 flex items-center gap-3 rounded-xl border border-earthy-dark/10 bg-earthy-light/40 p-3">
                  <input
                    type="checkbox"
                    checked={paymentVerified}
                    onChange={(e) => setPaymentVerified(e.target.checked)}
                  />
                  <span className="text-sm">
                    Staff has <span className="font-semibold">verified payment</span> (Swish/receipt shown on site)
                  </span>
                </label>

                {/* Submit */}
                <div className="pt-2 flex items-center gap-3">
                  <button
                    disabled={!canSubmit}
                    className="rounded-xl bg-earthy-brown px-6 py-3 text-sm font-semibold text-earthy-dark shadow hover:bg-earthy-green hover:text-white disabled:opacity-60"
                  >
                    {loading ? 'Submitting…' : 'Submit'}
                  </button>
                  {!paymentVerified && (
                    <span className="text-xs text-earthy-dark/70">Tick the box after you’ve seen their payment.</span>
                  )}
                </div>
              </form>

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
    </div>
  );
}

function NumInput({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium">{label}</span>
      <input
        type="number"
        min={0}
        step={1}
        className="w-full rounded-lg border border-earthy-dark/20 bg-white p-2.5 focus:outline-none focus:ring-2 focus:ring-earthy-green"
        value={value === 0 ? '' : value}
        onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
        placeholder="0"
      />
      {hint && <span className="mt-1 block text-[11px] text-red-600">{hint}</span>}
    </label>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between rounded-lg border border-earthy-dark/10 bg-white px-3 py-2">
      <span>{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
