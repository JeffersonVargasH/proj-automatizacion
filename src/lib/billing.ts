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
