import { NextResponse } from 'next/server';
import { clearServerSession } from '@/lib/server-auth';

export const runtime = 'nodejs';

export async function POST() {
  await clearServerSession();
  return NextResponse.json({ ok: true });
}
