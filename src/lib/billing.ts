export const plans = [
  { id: 'free', name: 'Prueba', monthlyPrice: 0, generationLimit: 3, scheduledLimit: 1, description: 'Para conocer Clic y probar el flujo.' },
  { id: 'starter', name: 'Emprende', monthlyPrice: 29, generationLimit: 20, scheduledLimit: 10, description: 'Para un negocio que publica cada semana.' },
  { id: 'pro', name: 'Impulso', monthlyPrice: 59, generationLimit: 60, scheduledLimit: 40, description: 'Para negocios que necesitan más contenido.' },
] as const;

export type PlanId = typeof plans[number]['id'];
export type PaymentProvider = 'test' | 'mercadopago' | 'culqi' | 'stripe';
export type SubscriptionStatus = 'trial' | 'active';
export type Subscription = {
  planId: PlanId;
  status: SubscriptionStatus;
  mode: 'test' | 'live';
  provider: PaymentProvider;
  providerSubscriptionId: string | null;
  cancelAtPeriodEnd: boolean;
  period: string;
  generationsUsed: number;
  updatedAt: string;
};

export function getPlan(planId: PlanId) {
  return plans.find(plan => plan.id === planId) || plans[0];
}

export function currentPeriod(date = new Date()) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Fila de `public.subscriptions` (supabase/migrations/20261111000000_planes_y_programacion.sql). */
export type SubscriptionRow = {
  plan_id: string; status: string; mode: string; provider: string; provider_subscription_id: string | null;
  cancel_at_period_end: boolean; period: string; generations_used: number; updated_at: string;
};

export function subscriptionFromRow(row: SubscriptionRow): Subscription {
  const planId = plans.some(plan => plan.id === row.plan_id) ? row.plan_id as PlanId : 'free';
  return {
    planId,
    status: row.status === 'active' ? 'active' : 'trial',
    mode: row.mode === 'live' ? 'live' : 'test',
    provider: (['test', 'mercadopago', 'culqi', 'stripe'] as const).find(item => item === row.provider) ?? 'test',
    providerSubscriptionId: row.provider_subscription_id,
    cancelAtPeriodEnd: !!row.cancel_at_period_end,
    period: row.period,
    generationsUsed: Math.max(0, Number(row.generations_used) || 0),
    updatedAt: row.updated_at,
  };
}

/**
 * ¿El error indica que la migración de planes todavía no se aplicó en Supabase?
 * (función o tabla inexistente). En ese caso la app sigue funcionando sin límites de plan.
 */
export function isBillingSchemaMissing(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  return ['PGRST202', 'PGRST205', '42883', '42P01'].includes(error.code ?? '') || /could not find the (function|table)|does not exist/i.test(error.message ?? '');
}

export const billingSetupMessage = 'Los planes aún no están activados en la base de datos. Un administrador debe aplicar la migración 20261111000000_planes_y_programacion.sql.';
