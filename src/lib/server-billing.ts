import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { currentPeriod, getPlan, plans, type PlanId, type Subscription } from './billing';

type BillingStore = Record<string, Subscription>;
const storePath = path.join(process.cwd(), 'data', 'billing.json');

async function readStore(): Promise<BillingStore> {
  try {
    const parsed = JSON.parse(await readFile(storePath, 'utf8')) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as BillingStore : {};
  } catch {
    return {};
  }
}

async function saveStore(store: BillingStore) {
  await mkdir(path.dirname(storePath), { recursive: true });
  await writeFile(storePath, JSON.stringify(store, null, 2), 'utf8');
}

function defaultSubscription(): Subscription {
  return { planId: 'free', status: 'trial', mode: 'test', provider: 'test', providerSubscriptionId: null, cancelAtPeriodEnd: false, period: currentPeriod(), generationsUsed: 0, updatedAt: new Date().toISOString() };
}

function normalize(subscription: Subscription): Subscription {
  const period = currentPeriod();
  const normalized = { ...defaultSubscription(), ...subscription, provider: subscription.provider || 'test', providerSubscriptionId: subscription.providerSubscriptionId || null, cancelAtPeriodEnd: subscription.cancelAtPeriodEnd || false };
  return normalized.period === period ? normalized : { ...normalized, period, generationsUsed: 0, cancelAtPeriodEnd: false, updatedAt: new Date().toISOString() };
}

export async function getServerSubscription(userId: string): Promise<Subscription> {
  const store = await readStore();
  const subscription = normalize(store[userId] || defaultSubscription());
  if (!store[userId] || store[userId].period !== subscription.period) await saveStore({ ...store, [userId]: subscription });
  return subscription;
}

export async function changeServerPlan(userId: string, planId: string): Promise<Subscription> {
  if (!plans.some(plan => plan.id === planId)) throw new Error('El plan seleccionado no existe.');
  const current = await getServerSubscription(userId);
  const next: Subscription = { ...current, planId: planId as PlanId, status: planId === 'free' ? 'trial' : 'active', mode: 'test', provider: 'test', providerSubscriptionId: planId === 'free' ? null : `test-sub-${userId}-${Date.now()}`, cancelAtPeriodEnd: false, updatedAt: new Date().toISOString() };
  const store = await readStore();
  await saveStore({ ...store, [userId]: next });
  return next;
}

export async function cancelServerSubscription(userId: string): Promise<Subscription> {
  const current = await getServerSubscription(userId);
  const next = { ...current, cancelAtPeriodEnd: true, updatedAt: new Date().toISOString() };
  const store = await readStore();
  await saveStore({ ...store, [userId]: next });
  return next;
}

export async function renewServerSubscription(userId: string): Promise<Subscription> {
  const current = await getServerSubscription(userId);
  const next = { ...current, status: current.planId === 'free' ? 'trial' as const : 'active' as const, cancelAtPeriodEnd: false, updatedAt: new Date().toISOString() };
  const store = await readStore();
  await saveStore({ ...store, [userId]: next });
  return next;
}

export async function reserveGeneration(userId: string): Promise<{ ok: true; subscription: Subscription } | { ok: false; subscription: Subscription; limit: number }> {
  const current = await getServerSubscription(userId);
  const limit = getPlan(current.planId).generationLimit;
  if (current.generationsUsed >= limit) return { ok: false, subscription: current, limit };
  const next = { ...current, generationsUsed: current.generationsUsed + 1, updatedAt: new Date().toISOString() };
  const store = await readStore();
  await saveStore({ ...store, [userId]: next });
  return { ok: true, subscription: next };
}

export async function releaseGeneration(userId: string) {
  const current = await getServerSubscription(userId);
  const next = { ...current, generationsUsed: Math.max(0, current.generationsUsed - 1), updatedAt: new Date().toISOString() };
  const store = await readStore();
  await saveStore({ ...store, [userId]: next });
}
