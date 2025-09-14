'use client';

import { useMemo, useState } from 'react';

type BatchRow = {
  registrationId: string;
  name: string;
  email: string;
  isMember?: boolean;
  memberType?: string | null;
  claimedMemberTickets?: number;
  allowedMemberTickets?: number;
  memberOK?: boolean;
  willIssueTickets?: boolean;
};

type BatchResult = {
  ok: boolean;
  mode?: 'dryRun';
  count?: number;
  rows?: BatchRow[];
  processed?: number;
  results?: Array<{
    registrationId: string;
    name: string;
    email: string;
    issuedCount: number;
    status: 'issued' | 'skipped';
    reason?: string;
  }>;
  error?: string;
};

export default function AdminBatchPage() {
  const [onlyPending, setOnlyPending] = useState(true);
  const [onlyFlagged, setOnlyFlagged] = useState(false);
  const [useOCR, setUseOCR] = useState(false);
  const [limit, setLimit] = useState(25);

  const [loading, setLoading] =
    useState<'preview' | 'issue' | 'issueOCR' | null>(null);
  const [data, setData] = useState<BatchResult | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const previewCount = useMemo(
    () => data?.rows?.length ?? data?.processed ?? 0,
    [data]
  );

  async function run(opts: { dryRun: boolean; useOCR: boolean }) {
    setLoading(opts.dryRun ? 'preview' : opts.useOCR ? 'issueOCR' : 'issue');
    setErr(null);
    setData(null);

    try {
      const qs = new URLSearchParams();
      if (onlyPending) qs.set('onlyPending', '1');
      if (onlyFlagged) qs.set('onlyFlagged', '1'); // supported if your API handles it
      if (opts.dryRun) qs.set('dryRun', '1');
      if (opts.useOCR) qs.set('useOCR', '1');
      qs.set('limit', String(Math.max(1, Math.min(500, limit))));

      const res = await fetch(`/api/admin/batch-issue?${qs}`, {
        method: 'GET',
        cache: 'no-store',
      });
      const json: BatchResult = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || 'Request failed');
      setData(json);
    } catch (e: any) {
      setErr(e?.message || 'Something went wrong');
    } finally {
      setLoading(null);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 p-6 text-gray-900">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-2xl font-semibold mb-4">Batch Issuance</h1>

        <div className="grid gap-4 md:grid-cols-3">
          {/* Filters */}
          <div className="rounded-2xl bg-white p-4 shadow">
            <h2 className="font-semibold mb-3">Filters</h2>

            <label className="flex items-center gap-2 mb-2">
              <input
                type="checkbox"
                checked={onlyPending}
                onChange={(e) => setOnlyPending(e.target.checked)}
              />
              <span>Only pending payments</span>
            </label>

            <label className="flex items-center gap-2 mb-2">
              <input
                type="checkbox"
                checked={onlyFlagged}
                onChange={(e) => setOnlyFlagged(e.target.checked)}
              />
              <span>Only flagged (needs_member / needs_ocr)</span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={useOCR}
                onChange={(e) => setUseOCR(e.target.checked)}
              />
              <span>Require OCR amount match</span>
            </label>
          </div>

          {/* Batch size */}
          <div className="rounded-2xl bg-white p-4 shadow">
            <h2 className="font-semibold mb-3">Batch size</h2>
            <input
              type="number"
              min={1}
              max={500}
              value={limit}
              onChange={(e) => setLimit(parseInt(e.target.value || '25', 10))}
              className="w-28 rounded border border-gray-300 px-3 py-2"
            />
            <p className="text-sm text-gray-600 mt-2">
              Process this many registrations at once.
            </p>
          </div>

          {/* Actions */}
          <div className="rounded-2xl bg-white p-4 shadow">
            <h2 className="font-semibold mb-3">Actions</h2>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => run({ dryRun: true, useOCR })}
                disabled={loading !== null}
                className="rounded-lg bg-gray-900 px-4 py-2 text-white hover:bg-black disabled:opacity-50"
              >
                {loading === 'preview' ? 'Previewing…' : 'Preview'}
              </button>

              <button
                onClick={() => run({ dryRun: false, useOCR: false })}
                disabled={loading !== null}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {loading === 'issue' ? 'Issuing…' : 'Issue (no OCR)'}
              </button>

              <button
                onClick={() => run({ dryRun: false, useOCR: true })}
                disabled={loading !== null}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {loading === 'issueOCR' ? 'Issuing…' : 'Issue (with OCR)'}
              </button>
            </div>
            <p className="text-xs text-gray-600 mt-2">
              Preview first, then issue in small batches (e.g. 20–25).
            </p>
          </div>
        </div>

        {/* Status / results */}
        <div className="mt-6">
          {err && (
            <div className="rounded-lg bg-red-50 border border-red-200 text-red-800 p-3">
              {err}
            </div>
          )}

          {data && (
            <div className="rounded-2xl bg-white p-4 shadow">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">
                  {data.mode === 'dryRun'
                    ? `Preview: ${previewCount} row(s)`
                    : `Processed: ${data.processed ?? 0} row(s)`}
                </h3>
              </div>

              {/* Dry run table */}
              {data.mode === 'dryRun' && data.rows && (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="bg-gray-100 text-left text-gray-700 uppercase text-xs tracking-wide">
                        <th className="p-2">Name</th>
                        <th className="p-2">Email</th>
                        <th className="p-2">Member</th>
                        <th className="p-2">Type</th>
                        <th className="p-2">Claimed/Allowed</th>
                        <th className="p-2">Will Issue</th>
                      </tr>
                    </thead>
                    <tbody className="text-gray-900">
                      {data.rows.map((r) => (
                        <tr key={r.registrationId} className="border-t border-gray-200">
                          <td className="p-2">{r.name}</td>
                          <td className="p-2">{r.email}</td>
                          <td className="p-2">{r.isMember ? '✅' : '❌'}</td>
                          <td className="p-2">{r.memberType ?? '-'}</td>
                          <td className="p-2">
                            {r.claimedMemberTickets}/{r.allowedMemberTickets}
                          </td>
                          <td className="p-2">{r.willIssueTickets ? '✅' : '❌'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Real run results */}
              {data.results && (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="bg-gray-100 text-left text-gray-700 uppercase text-xs tracking-wide">
                        <th className="p-2">Name</th>
                        <th className="p-2">Email</th>
                        <th className="p-2">Issued</th>
                        <th className="p-2">Status</th>
                        <th className="p-2">Reason</th>
                      </tr>
                    </thead>
                    <tbody className="text-gray-900">
                      {data.results.map((r) => (
                        <tr key={r.registrationId} className="border-t border-gray-200">
                          <td className="p-2">{r.name}</td>
                          <td className="p-2">{r.email}</td>
                          <td className="p-2">{r.issuedCount}</td>
                          <td className="p-2">
                            <span
                              className={
                                r.status === 'issued'
                                  ? 'inline-block rounded bg-emerald-100 px-2 py-0.5 text-emerald-800'
                                  : 'inline-block rounded bg-amber-100 px-2 py-0.5 text-amber-800'
                              }
                            >
                              {r.status}
                            </span>
                          </td>
                          <td className="p-2">{r.reason ?? '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
