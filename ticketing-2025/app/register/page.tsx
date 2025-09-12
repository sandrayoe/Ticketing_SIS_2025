'use client'
import { time } from 'console'
import { useState } from 'react'

export default function RegisterPage() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    tickets_standing: 0,
    tickets_chair: 0,
    tickets_children: 0,
    tickets_member: 0,
    proof_url: '',
  })
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setMsg(null)
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error || 'Failed')
      setMsg(`✅ Registered! Amount: ${data.amount} SEK`)
      // optional: redirect to /success
      // window.location.href = `/success?rid=${data.registrationId}`
    } catch (err: any) {
      setMsg(`❌ ${err.message ?? 'Error'}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto p-4 space-y-3">
      <h1 className="text-xl font-semibold">Register</h1>

      <form onSubmit={submit} className="space-y-2">
        <input className="border p-2 w-full" placeholder="Full name" required
          value={form.name} onChange={e=>setForm(f=>({...f, name: e.target.value}))}/>
        <input className="border p-2 w-full" placeholder="Email" type="email" required
          value={form.email} onChange={e=>setForm(f=>({...f, email: e.target.value}))}/>

        <div className="grid grid-cols-3 gap-2">
          <input className="border p-2" type="number" min={0} placeholder="Standing"
            value={form.tickets_standing}
            onChange={e=>setForm(f=>({...f, tickets_standing: +e.target.value}))}/>
          <input className="border p-2" type="number" min={0} placeholder="Chair"
            value={form.tickets_chair}
            onChange={e=>setForm(f=>({...f, tickets_chair: +e.target.value}))}/>
          <input className="border p-2" type="number" min={0} placeholder="Member"
            value={form.tickets_member}
            onChange={e=>setForm(f=>({...f, tickets_chair: +e.target.value}))}/>
          <input className="border p-2" type="number" min={0} placeholder="Children"
            value={form.tickets_children}
            onChange={e=>setForm(f=>({...f, tickets_children: +e.target.value}))}/>
        </div>

        <input className="border p-2 w-full" placeholder="Payment proof URL (optional)"
          value={form.proof_url} onChange={e=>setForm(f=>({...f, proof_url: e.target.value}))}/>

        <button disabled={loading} className="border rounded px-3 py-2">
          {loading ? 'Submitting…' : 'Submit'}
        </button>
      </form>

      {msg && <div className="p-2">{msg}</div>}
    </div>
  )
}
