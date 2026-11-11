'use client';

import { useEffect, useState } from 'react';
import { CheckCircle, CreditCard } from '@mui/icons-material';
import { Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Stack, Typography } from '@mui/material';
import type { PlanId, Subscription } from '@/lib/billing';

type Plan = { id: PlanId; name: string; monthlyPrice: number; generationLimit: number; scheduledLimit: number; description: string };

export function BillingView() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  useEffect(() => {
    void Promise.all([fetch('/api/billing/plans'), fetch('/api/billing/subscription')]).then(async ([plansResponse, subscriptionResponse]) => {
      const planData = await plansResponse.json();
      const subscriptionData = await subscriptionResponse.json();
      if (!plansResponse.ok || !subscriptionResponse.ok) throw new Error(planData.error || subscriptionData.error || 'No se pudo cargar tu plan.');
      setPlans(planData.plans); setSubscription(subscriptionData.subscription);
    }).catch(reason => setError(reason instanceof Error ? reason.message : 'No se pudo cargar tu plan.'));
  }, []);

  async function updateSubscription(url: string, body?: object) {
    setBusy(url); setError('');
    try {
      const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No se pudo actualizar la suscripción.');
      setSubscription(data.subscription);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo actualizar la suscripción.'); }
    finally { setBusy(''); }
  }

  return <Stack spacing={3}>
    <Box><Typography variant="overline" color="primary.dark" sx={{ fontWeight: 800, letterSpacing: '.12em' }}>PLANES Y CONSUMO</Typography><Typography variant="h1">Elige cómo quieres impulsar tu negocio.</Typography><Typography color="text.secondary" sx={{ maxWidth: 700 }}>Los planes están en modo pruebas: no se realiza ningún cobro. Aquí puedes validar límites antes de conectar la pasarela de pagos.</Typography></Box>
    {error && <Alert severity="error">{error}</Alert>}
    {subscription && <Alert severity="info" icon={<CreditCard />} action={<Button color="inherit" size="small" disabled={busy !== ''} onClick={() => void updateSubscription(subscription.cancelAtPeriodEnd ? '/api/billing/subscription/renew' : '/api/billing/subscription/cancel')}>{busy ? <CircularProgress size={16} /> : subscription.cancelAtPeriodEnd ? 'Renovar' : 'Cancelar al cierre'}</Button>}>Plan actual: <strong>{plans.find(plan => plan.id === subscription.planId)?.name || subscription.planId}</strong> · {subscription.generationsUsed} generaciones usadas este mes.{subscription.cancelAtPeriodEnd && ' Se cancelará al cierre del periodo.'}</Alert>}
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 2 }}>{plans.map(plan => <Card key={plan.id} variant="outlined" sx={{ borderColor: subscription?.planId === plan.id ? 'primary.main' : 'divider', boxShadow: subscription?.planId === plan.id ? '0 12px 28px rgba(63,99,233,.12)' : undefined }}><CardContent sx={{ p: 2.75 }}><Stack spacing={2}><Stack direction="row" justifyContent="space-between" alignItems="center"><Typography variant="h2" fontSize={22}>{plan.name}</Typography>{subscription?.planId === plan.id && <Chip icon={<CheckCircle />} label="Actual" color="primary" size="small" />}</Stack><Box><Typography variant="h1" sx={{ fontSize: '2.2rem' }}>S/ {plan.monthlyPrice}</Typography><Typography variant="caption" color="text.secondary">por mes · modo pruebas</Typography></Box><Typography variant="body2" color="text.secondary" sx={{ minHeight: 44 }}>{plan.description}</Typography><Stack spacing={.75}><Typography variant="body2">✓ {plan.generationLimit} generaciones de contenido</Typography><Typography variant="body2">✓ {plan.scheduledLimit} publicaciones programables</Typography><Typography variant="body2">✓ Historial y editor visual</Typography></Stack><Button variant={subscription?.planId === plan.id ? 'outlined' : 'contained'} disabled={busy !== '' || subscription?.planId === plan.id} onClick={() => void updateSubscription('/api/billing/subscription', { planId: plan.id })}>{busy.includes('/api/billing/subscription') ? <CircularProgress size={20} /> : subscription?.planId === plan.id ? 'Plan actual' : 'Probar este plan'}</Button></Stack></CardContent></Card>)}</Box>
    <Alert severity="warning">Pendiente de conectar: pasarela de pagos real, renovación automática y comprobantes. El modo pruebas registra la elección, cancelación y renovación, además de aplicar los límites.</Alert>
  </Stack>;
}
