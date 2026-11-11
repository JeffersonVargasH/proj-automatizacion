import { NextResponse } from 'next/server';
import { plans } from '@/lib/billing';
import { requireUser } from '@/lib/supabase/server';

export async function GET() {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;
  return NextResponse.json({ plans });
}
