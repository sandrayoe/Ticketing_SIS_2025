// app/api/register/route.ts
import { NextRequest, NextResponse } from 'next/server'
import  prisma  from '@/lib/prisma'

const PRICE_REGULAR = Number(process.env.PRICE_REGULAR ?? 150)
const PRICE_MEMBER  = Number(process.env.PRICE_MEMBER  ?? 120)
const PRICE_CHILD   = Number(process.env.PRICE_CHILD   ??  50)

export async function POST(req: NextRequest) {
  const body = await req.json()

  const tickets_regular = Number(body.tickets_regular ?? 0)
  const tickets_member  = Number(body.tickets_member  ?? 0)
  const tickets_children   = Number(body.tickets_child   ?? body.tickets_children ?? 0)

  const total_amount =
    tickets_regular * PRICE_REGULAR +
    tickets_member  * PRICE_MEMBER  +
    tickets_children   * PRICE_CHILD

  const reg = await prisma.registration.create({
    data: {
      name: body.name,
      email: body.email,
      tickets_regular,
      tickets_member,
      tickets_children,
      total_amount,
      proof_url: body.proof_url ?? '',
    },
  })

  return NextResponse.json({ ok: true, registrationId: reg.id, amount: total_amount })
}
