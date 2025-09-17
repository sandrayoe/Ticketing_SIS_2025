// app/admin/checkin/page.tsx
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Scanner } from '@yudiel/react-qr-scanner';

type CheckinResponse = {
  ok: boolean;
  status?: 'checked_in' | 'already_checked_in';
  error?: string;
  ticket?: {
    ticketNo: string;
    checkedIn: boolean;
    checkedInAt?: string | null;
  };
};

type StatsResponse = {
  ok: boolean;
  totalRegistrants: number; // sum of Registration.total_tickets
  checkedIn: number;        // count of Ticket where checkedIn=true
};

const shell = 'mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8';

export default function AdminCheckinPage() {
  const [lastTicketNo, setLastTicketNo] = useState('');
  const [manualTicketNo, setManualTicketNo] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [status, setStatus] = useState<'ok' | 'warn' | 'error' | null>(null);

  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [poll, setPoll] = useState(true);

  // NEW: camera/scanner controls
  const [cameraOn, setCameraOn] = useState(true);   // mount/unmount the Scanner
  const [paused, setPaused] = useState(false);      // keep preview but pause decoding

  const lockRef = useRef(false); // prevents rapid double scans

  const fetchStats = useCallback(async () => {
    try {
      const r = await fetch('/api/admin/checkin/stats', {
        cache: 'no-store',
        headers: { 'cache-control': 'no-cache' },
      });
      if (!r.ok) return;
      const j = (await r.json()) as StatsResponse;
      if (j.ok) setStats(j);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchStats();
    if (!poll) return;
    const id = setInterval(fetchStats, 4000);
    return () => clearInterval(id);
  }, [fetchStats, poll]);

  const doCheckin = useCallback(async (ticketNo: string) => {
    if (!ticketNo) return;
    setBusy(true);
    setMessage(null);
    setStatus(null);
    try {
      const r = await fetch('/api/admin/checkin', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ticketNo }),
        cache: 'no-store',
      });
      const j = (await r.json()) as CheckinResponse;

      if (!j.ok) {
        setMessage(j.error || 'Failed to check-in');
        setStatus('error');
        return;
      }

      setLastTicketNo(j.ticket?.ticketNo || ticketNo);
      if (j.status === 'checked_in') {
        setMessage(`Checked in: ${j.ticket?.ticketNo ?? ticketNo}`);
        setStatus('ok');
      } else if (j.status === 'already_checked_in') {
        setMessage(`Already checked in: ${j.ticket?.ticketNo ?? ticketNo}`);
        setStatus('warn');
      } else {
        setMessage('Done.');
        setStatus('ok');
      }
      fetchStats();
    } catch {
      setMessage('Network error');
      setStatus('error');
    } finally {
      setBusy(false);
      lockRef.current = false;
    }
  }, [fetchStats]);

  return (
    <div className="min-h-svh flex flex-col bg-earthy-light text-earthy-dark">
      <main className={`${shell} grow py-6 sm:py-10`}>
        <h1 className="text-2xl font-bold">Admin · Check-in</h1>

        {/* Stats */}
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <StatCard label="Total registrants" value={stats?.totalRegistrants ?? '-'} />
          <StatCard label="Checked-in" value={stats?.checkedIn ?? '-'} />
          <StatCard
            label="Remaining"
            value={stats ? Math.max((stats.totalRegistrants ?? 0) - (stats.checkedIn ?? 0), 0) : '-'}
          />
        </div>

        {/* Scanner + Manual */}
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-earthy-green/40 bg-white p-4 shadow">
            <div className="flex items-center justify-between mb-3">
              <div className="text-lg font-semibold">Scan QR</div>

              {/* Controls */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    // toggling camera off will unmount the Scanner and release camera
                    const next = !cameraOn;
                    setCameraOn(next);
                    if (!next) {
                      // reset locks when camera is off
                      lockRef.current = false;
                      setPaused(false);
                    }
                  }}
                  className={`rounded-xl px-3 py-1.5 text-sm font-semibold border ${
                    cameraOn
                      ? 'bg-earthy-brown text-white border-earthy-brown hover:opacity-90'
                      : 'bg-white text-earthy-brown border-earthy-brown hover:bg-earthy-light/70'
                  }`}
                  aria-pressed={cameraOn}
                >
                  {cameraOn ? 'Turn camera off' : 'Turn camera on'}
                </button>

                <button
                  type="button"
                  onClick={() => setPaused((p) => !p)}
                  disabled={!cameraOn}
                  className={`rounded-xl px-3 py-1.5 text-sm font-semibold border ${
                    paused
                      ? 'bg-yellow-600 text-white border-yellow-700 hover:opacity-90'
                      : 'bg-white text-yellow-700 border-yellow-700 hover:bg-yellow-50'
                  } disabled:opacity-50`}
                  aria-pressed={paused}
                >
                  {paused ? 'Resume scanning' : 'Pause scanning'}
                </button>
              </div>
            </div>

            {/* Scanner or placeholder */}
            {cameraOn ? (
              <Scanner
                onScan={(codes) => {
                  if (paused) return;
                  if (!codes || codes.length === 0) return;
                  if (lockRef.current) return; // throttle double read
                  lockRef.current = true;

                  const ticketNo = codes[0].rawValue; // QR text content
                  doCheckin(ticketNo);
                }}
                onError={(err) => {
                  console.error('Scanner error:', err);
                }}
                paused={paused}
                constraints={{ facingMode: 'environment' }}
                scanDelay={500}
              />
            ) : (
              <div className="flex h-56 items-center justify-center rounded-xl border border-dashed border-earthy-dark/20 bg-earthy-light/40 text-earthy-dark/60">
                <div className="text-center">
                  <div className="font-semibold">Camera is off</div>
                  <div className="text-sm">Turn it on to start scanning QR codes.</div>
                </div>
              </div>
            )}

            <p className="mt-2 text-sm text-earthy-dark/70">
              Last scanned: <span className="font-mono">{lastTicketNo || '—'}</span>
            </p>
          </div>

          <div className="rounded-2xl border border-earthy-green/40 bg-white p-4 shadow">
            <div className="text-lg font-semibold mb-3">Manual ticket number</div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!manualTicketNo.trim()) return;
                doCheckin(manualTicketNo.trim());
                setManualTicketNo('');
              }}
              className="flex flex-col gap-3"
            >
              <input
                className="w-full rounded-xl border px-3 py-2 font-mono outline-none focus:ring-2 focus:ring-earthy-green"
                placeholder="e.g. PM25-999"
                value={manualTicketNo}
                onChange={(e) => setManualTicketNo(e.target.value)}
                disabled={busy}
                autoFocus
              />
              <button
                type="submit"
                className="rounded-xl bg-earthy-green px-4 py-2 font-semibold text-white hover:bg-earthy-brown disabled:opacity-50"
                disabled={busy}
              >
                {busy ? 'Checking…' : 'Check-in'}
              </button>
            </form>

            {message && (
              <div
                className={`mt-3 rounded-xl px-3 py-2 text-sm ${
                  status === 'ok'
                    ? 'bg-green-50 text-green-700 border border-green-200'
                    : status === 'warn'
                    ? 'bg-yellow-50 text-yellow-700 border border-yellow-200'
                    : 'bg-red-50 text-red-700 border border-red-200'
                }`}
              >
                {message}
              </div>
            )}
          </div>
        </div>

        {/* Poll toggle */}
        <div className="mt-6">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={poll}
              onChange={(e) => setPoll(e.target.checked)}
            />
            <span className="text-sm text-earthy-dark/70">Live refresh stats</span>
          </label>
        </div>
      </main>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-earthy-green/40 bg-white p-4 shadow">
      <div className="text-sm text-earthy-dark/70">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
    </div>
  );
}
