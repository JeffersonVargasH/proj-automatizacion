import 'server-only';

// Planes y consumo sobre Supabase. Todas las escrituras pasan por funciones SQL `security definer`
// (ver supabase/migrations/20261111000000_planes_y_programacion.sql), que validan la sesión y los límites.
// Reemplaza a la versión de avance-hasta-3.6 que guardaba todo en data/billing.json.
import type { SupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { billingSetupMessage, isBillingSchemaMissing, subscriptionFromRow, type Subscription, type SubscriptionRow } from './billing';

export type BillingResult<T> = { ok: true; value: T } | { ok: false; missing: boolean; error: string };

async function call<T>(run: () => PromiseLike<{ data: unknown; error: { code?: string; message?: string } | null }>, map: (data: unknown) => T): Promise<BillingResult<T>> {
  const { data, error } = await run();
  if (error) {
    const missing = isBillingSchemaMissing(error);
    if (!missing) console.error('Error de planes en Supabase:', error.message);
    return { ok: false, missing, error: error.message || 'No se pudo actualizar el plan.' };
  }
  return { ok: true, value: map(data) };
}

const toSubscription = (data: unknown) => subscriptionFromRow(data as SubscriptionRow);

export const getSubscription = (supabase: SupabaseClient) => call(() => supabase.rpc('my_subscription'), toSubscription);
export const changePlanTest = (supabase: SupabaseClient, planId: string) => call(() => supabase.rpc('change_plan_test', { p_plan: planId }), toSubscription);
export const setCancelAtPeriodEnd = (supabase: SupabaseClient, cancel: boolean) => call(() => supabase.rpc('set_cancel_at_period_end', { p_cancel: cancel }), toSubscription);

/** Reserva una generación del mes. `ok: false` con `missing` si la migración no está aplicada. */
export const reserveGeneration = (supabase: SupabaseClient) =>
  call(() => supabase.rpc('reserve_generation'), data => data as { ok: boolean; used: number; limit: number });

/** Devuelve una generación reservada si n8n no aceptó el trabajo. Nunca lanza: no debe tapar el error original. */
export async function releaseGeneration(supabase: SupabaseClient) {
  try { await supabase.rpc('release_generation'); } catch (error) { console.error('No se pudo liberar la generación:', error); }
}

/** Respuesta común de las rutas de planes: 503 si falta la migración, 400 si la base rechazó el cambio. */
export function billingResponse<T>(result: BillingResult<T>, key = 'subscription') {
  if (result.ok) return NextResponse.json({ [key]: result.value });
  return NextResponse.json({ error: result.missing ? billingSetupMessage : result.error, setupRequired: result.missing || undefined }, { status: result.missing ? 503 : 400 });
}

export type { Subscription };
