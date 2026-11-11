import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { channels, type PublishingChannel, type ScheduledPost } from './publishing';
import { getPlan } from './billing';
import { getServerSubscription } from './server-billing';

const storePath = path.join(process.cwd(), 'data', 'scheduled-posts.json');

async function readPosts(): Promise<ScheduledPost[]> {
  try {
    const parsed = JSON.parse(await readFile(storePath, 'utf8')) as unknown;
    return Array.isArray(parsed) ? parsed as ScheduledPost[] : [];
  } catch { return []; }
}

async function savePosts(posts: ScheduledPost[]) {
  await mkdir(path.dirname(storePath), { recursive: true });
  await writeFile(storePath, JSON.stringify(posts, null, 2), 'utf8');
}

export async function listScheduledPosts(ownerId: string) {
  return (await readPosts()).filter(post => post.ownerId === ownerId).sort((a, b) => a.at.localeCompare(b.at));
}

export async function createScheduledPost(input: { ownerId: string; designId: string; channel: string; at: string; caption?: string }) {
  if (!input.designId.trim() || !channels.includes(input.channel as PublishingChannel)) throw new Error('El diseño y la red social son obligatorios.');
  const timestamp = new Date(input.at).getTime();
  if (!Number.isFinite(timestamp) || timestamp <= Date.now()) throw new Error('La fecha debe estar en el futuro.');
  const subscription = await getServerSubscription(input.ownerId);
  const plan = getPlan(subscription.planId);
  const existing = (await listScheduledPosts(input.ownerId)).filter(post => post.status === 'pending_connection');
  if (existing.length >= plan.scheduledLimit) throw new Error(`Alcanzaste el límite de ${plan.scheduledLimit} publicaciones programadas del plan actual.`);
  const now = new Date().toISOString();
  const post: ScheduledPost = { id: randomUUID(), ownerId: input.ownerId, designId: input.designId, channel: input.channel as PublishingChannel, at: new Date(timestamp).toISOString(), caption: (input.caption || '').slice(0, 1500), status: 'pending_connection', createdAt: now, updatedAt: now };
  const posts = await readPosts();
  await savePosts([...posts, post]);
  return post;
}

export async function cancelScheduledPost(ownerId: string, id: string) {
  const posts = await readPosts();
  const current = posts.find(post => post.id === id && post.ownerId === ownerId);
  if (!current) return null;
  const next = { ...current, status: 'cancelled' as const, updatedAt: new Date().toISOString() };
  await savePosts(posts.map(post => post.id === id ? next : post));
  return next;
}
