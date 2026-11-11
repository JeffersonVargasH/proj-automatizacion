import { randomUUID } from 'node:crypto';
import type { PlanId, PaymentProvider } from './billing';

export type CheckoutInput = { userId: string; planId: PlanId; amount: number; currency: 'PEN' };
export type CheckoutSession = { id: string; provider: PaymentProvider; mode: 'test' | 'live'; checkoutUrl: string | null; expiresAt: string };

export interface PaymentGateway {
  createCheckoutSession(input: CheckoutInput): Promise<CheckoutSession>;
}

class TestPaymentGateway implements PaymentGateway {
  async createCheckoutSession(input: CheckoutInput): Promise<CheckoutSession> {
    return { id: `test-checkout-${randomUUID()}`, provider: 'test', mode: 'test', checkoutUrl: `/billing?checkout=test&plan=${input.planId}`, expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString() };
  }
}

export function getPaymentGateway(): PaymentGateway {
  const provider = process.env.PAYMENT_PROVIDER || 'test';
  if (provider === 'test') return new TestPaymentGateway();
  throw new Error(`El adaptador de pagos para ${provider} aún no está configurado.`);
}
