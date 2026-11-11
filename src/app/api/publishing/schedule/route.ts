import { NextResponse } from 'next/server';
import { requireServerSession } from '@/lib/server-auth';
import { createScheduledPost, listScheduledPosts } from '@/lib/server-publishing';

export const runtime = 'nodejs';

export async function GET() {
  const session = await requireServerSession();
  if (!session) return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 });
  return NextResponse.json({ posts: await listScheduledPosts(session.user.id) });
}

export async function POST(request: Request) {
  const session = await requireServerSession();
  if (!session) return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 });
  try {
    const body = await request.json() as { designId?: unknown; channel?: unknown; at?: unknown; caption?: unknown };
    if (typeof body.designId !== 'string' || typeof body.channel !== 'string' || typeof body.at !== 'string') return NextResponse.json({ error: 'Faltan datos de programación.' }, { status: 400 });
    return NextResponse.json({ post: await createScheduledPost({ ownerId: session.user.id, designId: body.designId, channel: body.channel, at: body.at, caption: typeof body.caption === 'string' ? body.caption : '' }) }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'No se pudo programar la publicación.' }, { status: 400 });
  }
}
