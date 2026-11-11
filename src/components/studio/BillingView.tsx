'use client';

// "Mi plan": planes, consumo del mes y cambio de plan en modo pruebas (sin cobros).
// Traído de avance-hasta-3.6 (roimerbautista); ahora lee y guarda en Supabase a través de /api/billing.
import { useEffect, useState } from 'react';
import { CheckCircle, CreditCard } from '@mui/icons-material';
import { Alert, Box, Button, Card, CardContent, Chip, CircularProgress, LinearProgress, Link, Skeleton, Stack, Typography } from '@mui/material';
import { getPlan, type plans as planList, type Subscription } from '@/lib/billing';

type Plan = typeof planList[number];

export function BillingView() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [error, setError] = useState('');
  const [setupRequired, setSetupRequired] = useState(false);
  const [busy, setBusy] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    void Promise.all([fetch('/api/billing/plans'), fetch('/api/billing/subscription')]).then(async ([plansResponse, subscriptionResponse]) => {
      const planData = await plansResponse.json().catch(() => ({}));
      const subscriptionData = await subscriptionResponse.json().catch(() => ({}));
      if (!live) return;
      if (plansResponse.ok) setPlans(planData.plans);
      if (subscriptionResponse.ok) setSubscription(subscriptionData.subscription);
      else { setSetupRequired(!!subscriptionData.setupRequired); setError(subscriptionData.error || 'No se pudo cargar tu plan.'); }
    }).catch(() => { if (live) setError('No se pudo cargar tu plan. Revisa tu conexión.'); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, []);

  async function updateSubscription(url: string, body?: object) {
    setBusy(url); setError('');
    try {
      const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'No se pudo actualizar el plan.');
      setSubscription(data.subscription);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo actualizar el plan.'); }
    finally { setBusy(''); }
  }

  const current = subscription ? getPlan(subscription.planId) : null;
  const usage = subscription && current ? Math.min(100, Math.round(subscription.generationsUsed / current.generationLimit * 100)) : 0;

  return <Stack spacing={3}>
    <Box>
      <Typography variant="h1">Mi plan</Typography>
      <Typography color="text.secondary" sx={{ mt: .75, maxWidth: 700 }}>Los planes están en <strong>modo pruebas</strong>: no se realiza ningún cobro. Puedes cambiar de plan para probar los límites antes de conectar la pasarela de pagos.</Typography>
    </Box>
    {error && <Alert severity={setupRequired ? 'warning' : 'error'}>{error}</Alert>}
    {loading && <Skeleton variant="rounded" height={72} />}
    {subscription && current && <Alert severity="info" icon={<CreditCard />}
      action={<Button color="inherit" size="small" disabled={busy !== ''} onClick={() => void updateSubscription(subscription.cancelAtPeriodEnd ? '/api/billing/subscription/renew' : '/api/billing/subscription/cancel')}>{busy.includes('/cancel') || busy.includes('/renew') ? <CircularProgress size={16} /> : subscription.cancelAtPeriodEnd ? 'Renovar' : 'Cancelar al cierre'}</Button>}>
      <Typography variant="body2">Plan actual: <strong>{current.name}</strong> · {subscription.generationsUsed} de {current.generationLimit} generaciones este mes.{subscription.cancelAtPeriodEnd && ' Se cancelará al cierre del periodo.'}</Typography>
      <LinearProgress variant="determinate" value={usage} sx={{ mt: 1, borderRadius: 1, maxWidth: 320 }} aria-label="Generaciones usadas este mes" />
    </Alert>}
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 2 }}>{plans.map(plan => {
      const selected = subscription?.planId === plan.id;
      return <Card key={plan.id} variant="outlined" sx={{ borderRadius: '20px', borderColor: selected ? 'primary.main' : 'divider', boxShadow: selected ? '0 12px 28px rgba(47,91,255,.12)' : undefined }}>
        <CardContent sx={{ p: 2.75 }}><Stack spacing={2}>
          <Stack direction="row" justifyContent="space-between" alignItems="center"><Typography variant="h2" fontSize={22}>{plan.name}</Typography>{selected && <Chip icon={<CheckCircle />} label="Actual" color="primary" size="small" />}</Stack>
          <Box><Typography sx={{ fontSize: '2.2rem', fontWeight: 700, lineHeight: 1.1 }}>S/ {plan.monthlyPrice}</Typography><Typography variant="caption" color="text.secondary">por mes · modo pruebas</Typography></Box>
          <Typography variant="body2" color="text.secondary" sx={{ minHeight: 44 }}>{plan.description}</Typography>
          <Stack spacing={.75}><Typography variant="body2">✓ {plan.generationLimit} generaciones con IA al mes</Typography><Typography variant="body2">✓ {plan.scheduledLimit} {plan.scheduledLimit === 1 ? 'publicación programada' : 'publicaciones programadas'}</Typography><Typography variant="body2">✓ Historial y editor visual</Typography></Stack>
          <Button variant={selected ? 'outlined' : 'contained'} disabled={busy !== '' || selected || !subscription} onClick={() => void updateSubscription('/api/billing/subscription', { planId: plan.id })}>{busy === '/api/billing/subscription' ? <CircularProgress size={20} /> : selected ? 'Plan actual' : 'Probar este plan'}</Button>
        </Stack></CardContent>
      </Card>;
    })}</Box>
    <Typography variant="body2" color="text.secondary">Pendiente: pasarela de pagos real, renovación automática y comprobantes. Lee los <Link href="/legal/terminos" target="_blank" rel="noopener">términos</Link> y la <Link href="/legal/privacidad" target="_blank" rel="noopener">política de privacidad</Link> (borradores en revisión).</Typography>
  </Stack>;
}
