import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'

// Set prices here 
const PRICE_STANDING = Number(process.env.PRICE_STANDING ?? 125) // SEK
const PRICE_CHAIR    = Number(process.env.PRICE_CHAIR ?? 150)
const PRICE_CHILD    = Number(process.env.PRICE_CHILD ?? 0)
const PRICE_MEMBER   = Number(process.env.PRICE_CHILD ?? 80)

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body) return Response.json({ error: 'Invalid JSON' }, { status: 400 })

  const {
    name, email,
    tickets_standing = 0,
    tickets_chair = 0,
    tickets_children = 0,
    tickets_member = 0,
    proof_url = ''
  } = body

  if (!name || typeof name !== 'string' || name.trim().length < 2)
    return Response.json({ error: 'Name required' }, { status: 400 })
  if (!email || typeof email !== 'string' || !email.includes('@'))
    return Response.json({ error: 'Valid email required' }, { status: 400 })

  const s = Number(tickets_standing) | 0
  const c = Number(tickets_chair)    | 0
  const k = Number(tickets_children) | 0
  const m = Number(tickets_member)  | 0
  if (s < 0 || c < 0 || k < 0) return Response.json({ error: 'Bad ticket counts' }, { status: 400 })

  const total =
    s * PRICE_STANDING +
    c * PRICE_CHAIR +
    k * PRICE_CHILD + 
    m * PRICE_MEMBER

  const reg = await prisma.registration.create({
    data: {
      name,
      email,
      tickets_standing: s,
      tickets_chair: c,
      tickets_children: k,
      total_amount: total,
      proof_url: String(proof_url ?? ''),
      // invoice_sent: default false
      // payment_status: default pending
      // ticket_status: default not_issued
      // created_at: default now()
    },
    select: { id: true, total_amount: true }
  })

  return Response.json({ ok: true, registrationId: reg.id, amount: reg.total_amount })
}
