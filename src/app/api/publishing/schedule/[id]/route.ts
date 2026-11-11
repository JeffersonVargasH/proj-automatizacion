import { NextResponse } from 'next/server';
import { requireServerSession } from '@/lib/server-auth';
import { cancelScheduledPost } from '@/lib/server-publishing';

export const runtime = 'nodejs';

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireServerSession();
  if (!session) return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 });
  const { id } = await context.params;
  const post = await cancelScheduledPost(session.user.id, id);
  return post ? NextResponse.json({ post }) : NextResponse.json({ error: 'Publicación no encontrada.' }, { status: 404 });
}
