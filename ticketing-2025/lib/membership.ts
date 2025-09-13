import prisma from '@/lib/prisma';
import { normalizeName } from './name-normalize';

export async function isActiveMemberByName(name: string) {
  const name_key = normalizeName(name);
  const m = await prisma.member.findUnique({ where: { name_key } });
  return m ? { ok: true, type: m.type } : { ok: false };
}