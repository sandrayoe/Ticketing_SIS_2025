import prisma from '@/lib/prisma';
import { normalizeName } from './name-normalize';
import type { MemberType } from '@prisma/client';

// Build once per server process and reuse
let memberMapPromise: Promise<Map<string, MemberType>> | null = null;

async function buildMemberMap() {
  const rows = await prisma.member.findMany({ select: { name_key: true, type: true } });
  const map = new Map<string, MemberType>();
  for (const m of rows) {
    map.set(normalizeName(m.name_key), m.type);
  }
  return map;
}

async function getMemberMap() {
  if (!memberMapPromise) memberMapPromise = buildMemberMap();
  return memberMapPromise;
}

// Call this after you reimport/modify the Member table to refresh the cache
export async function refreshMemberCache() {
  memberMapPromise = buildMemberMap();
}

export async function isActiveMemberByName(name: string) {
  const key = normalizeName(name);
  const map = await getMemberMap();
  const type = map.get(key);
  return type ? { ok: true, type } : { ok: false as const };
}
