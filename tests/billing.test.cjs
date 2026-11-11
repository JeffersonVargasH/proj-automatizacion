// Planes, consumo y programación (integración de avance-hasta-3.6 sobre Supabase).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { loadTs } = require('./load-ts.cjs');

const plain = value => JSON.parse(JSON.stringify(value));
const billing = loadTs('src/lib/billing.ts');
const publishing = loadTs('src/lib/publishing.ts');
const migration = fs.readFileSync(path.join(__dirname, '../supabase/migrations/20261111000000_planes_y_programacion.sql'), 'utf8');

function sqlLimits(fn) {
  const body = migration.match(new RegExp(`function public\\.${fn}\\(p_plan text\\)[\\s\\S]*?\\$\\$([\\s\\S]*?)\\$\\$`))[1];
  return Object.fromEntries([...body.matchAll(/when '(\w+)' then (\d+)/g)].map(([, plan, value]) => [plan, Number(value)]));
}

test('plan limits are the same in the app and in the database', () => {
  const generation = sqlLimits('plan_generation_limit');
  const scheduled = sqlLimits('plan_scheduled_limit');
  assert.deepEqual(Object.keys(generation).sort(), plain(billing.plans.map(plan => plan.id)).sort());
  for (const plan of billing.plans) {
    assert.equal(generation[plan.id], plan.generationLimit, `${plan.id} generaciones`);
    assert.equal(scheduled[plan.id], plan.scheduledLimit, `${plan.id} programadas`);
  }
  assert.match(migration, new RegExp(`check \\(plan_id in \\(${billing.plans.map(plan => `'${plan.id}'`).join(', ')}\\)\\)`));
});

test('new tables are protected: RLS on, read-only for users, writes only through functions', () => {
  for (const table of ['subscriptions', 'scheduled_posts']) {
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`));
    assert.doesNotMatch(migration, new RegExp(`on public\\.${table} for (insert|update|delete|all)`), `${table} sin políticas de escritura`);
  }
  assert.match(migration, /revoke insert, update, delete on public\.subscriptions, public\.scheduled_posts from authenticated/);
  const definers = [...migration.matchAll(/create function public\.(\w+)\([^)]*\)[^$]*?security definer set search_path = ''/g)].map(match => match[1]);
  assert.deepEqual(definers.sort(), ['cancel_scheduled_post', 'change_plan_test', 'my_subscription', 'release_generation', 'reserve_generation', 'schedule_post', 'set_cancel_at_period_end']);
  for (const fn of definers) assert.match(migration, new RegExp(`revoke execute on function public\\.${fn}\\(`), `${fn} no se puede llamar sin sesión`);
});

test('the migration does not modify existing tables', () => {
  assert.doesNotMatch(migration, /alter table public\.(profiles|businesses|publications|activity_log)\b/);
  assert.doesNotMatch(migration, /drop (table|function|policy)/i);
});

test('subscription rows map to the app model with safe fallbacks', () => {
  const row = { plan_id: 'starter', status: 'active', mode: 'test', provider: 'test', provider_subscription_id: 'x', cancel_at_period_end: true, period: '2026-11', generations_used: 4, updated_at: '2026-11-11T00:00:00Z' };
  assert.deepEqual(plain(billing.subscriptionFromRow(row)), { planId: 'starter', status: 'active', mode: 'test', provider: 'test', providerSubscriptionId: 'x', cancelAtPeriodEnd: true, period: '2026-11', generationsUsed: 4, updatedAt: '2026-11-11T00:00:00Z' });
  const odd = billing.subscriptionFromRow({ ...row, plan_id: 'gold', status: '?', mode: '?', provider: 'paypal', generations_used: -2 });
  assert.deepEqual([odd.planId, odd.status, odd.mode, odd.provider, odd.generationsUsed], ['free', 'trial', 'test', 'test', 0]);
  assert.equal(billing.getPlan('pro').generationLimit, 60);
  assert.equal(billing.currentPeriod(new Date(Date.UTC(2026, 0, 31, 23))), '2026-01');
});

test('a database without the migration is detected so generation keeps working', () => {
  for (const code of ['PGRST202', 'PGRST205', '42883', '42P01']) assert.equal(billing.isBillingSchemaMissing({ code }), true, code);
  assert.equal(billing.isBillingSchemaMissing({ message: 'Could not find the function public.reserve_generation without parameters in the schema cache' }), true);
  assert.equal(billing.isBillingSchemaMissing({ code: '42501', message: 'permission denied' }), false);
  assert.equal(billing.isBillingSchemaMissing(null), false);
  assert.match(billing.billingSetupMessage, /20261111000000_planes_y_programacion\.sql/);
});

test('schedule input is validated before reaching the database', () => {
  const now = Date.parse('2026-11-11T12:00:00Z');
  const id = '11111111-1111-1111-1111-111111111111';
  const ok = publishing.validateScheduleInput({ designId: id, channel: 'facebook', at: '2026-11-12T10:00:00Z', caption: 'x'.repeat(3000) }, now);
  assert.equal(ok.ok, true);
  assert.equal(ok.value.caption.length, 2200);
  assert.equal(ok.value.at, '2026-11-12T10:00:00.000Z');
  assert.match(publishing.validateScheduleInput({ designId: 'no', channel: 'facebook', at: '2026-11-12T10:00:00Z' }, now).error, /publicación/);
  assert.match(publishing.validateScheduleInput({ designId: id, channel: 'Instagram', at: '2026-11-12T10:00:00Z' }, now).error, /Instagram/);
  assert.match(publishing.validateScheduleInput({ designId: id, channel: 'whatsapp', at: '2026-11-10T10:00:00Z' }, now).error, /futuro/);
  assert.match(publishing.validateScheduleInput({ designId: id, channel: 'whatsapp', at: 'mañana' }, now).error, /futuro/);
});

test('scheduled post rows map with safe fallbacks', () => {
  const post = publishing.scheduledPostFromRow({ id: 'a', publication_id: 'p', channel: 'whatsapp', scheduled_at: '2026-11-12T10:00:00Z', caption: 'Hola', status: 'pending_connection', created_at: 'c' });
  assert.deepEqual(plain(post), { id: 'a', publicationId: 'p', channel: 'whatsapp', at: '2026-11-12T10:00:00Z', caption: 'Hola', status: 'pending_connection', createdAt: 'c' });
  const odd = publishing.scheduledPostFromRow({ id: 'a', publication_id: 'p', channel: 'tiktok', scheduled_at: '', caption: '', status: 'weird', created_at: '' });
  assert.deepEqual([odd.channel, odd.status], ['instagram', 'pending_connection']);
});

test('channels match the networks of the studio', () => {
  const studio = fs.readFileSync(path.join(__dirname, '../src/lib/studio.ts'), 'utf8');
  for (const channel of publishing.channels) assert.match(studio, new RegExp(`\\b${channel}: \\{ label:`));
  assert.match(migration, /channel in \('instagram', 'facebook', 'whatsapp'\)/);
});

test('legal drafts use the Clic brand', () => {
  for (const page of ['privacidad', 'terminos']) {
    const source = fs.readFileSync(path.join(__dirname, `../src/app/legal/${page}/page.tsx`), 'utf8');
    assert.doesNotMatch(source, /CreaMás/i);
    assert.match(source, /Borrador para revisión legal/);
  }
});
