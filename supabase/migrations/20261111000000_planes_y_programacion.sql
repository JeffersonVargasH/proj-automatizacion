-- Clic · planes, consumo mensual y publicaciones programadas.
-- Trae a Supabase lo que la rama avance-hasta-3.6 guardaba en archivos JSON (data/billing.json y
-- data/scheduled-posts.json). No modifica ninguna tabla existente.
-- Ejecutar una vez en el SQL Editor de Supabase (o con `supabase db push`) DESPUÉS de 20261029000000_base.sql.
--
-- Seguridad: cada persona solo puede LEER lo suyo (RLS). Nadie escribe estas tablas directamente:
-- todo cambio pasa por las funciones de abajo, que validan la sesión, el plan y los límites.
-- Así nadie puede regalarse generaciones ni saltarse el límite desde el navegador.

-- ───────────────────────── Planes ─────────────────────────
-- Deben coincidir con `plans` en src/lib/billing.ts (lo comprueba tests/billing.test.cjs).

create function public.plan_generation_limit(p_plan text) returns integer
language sql immutable set search_path = '' as $$
  select case p_plan when 'free' then 3 when 'starter' then 20 when 'pro' then 60 end;
$$;

create function public.plan_scheduled_limit(p_plan text) returns integer
language sql immutable set search_path = '' as $$
  select case p_plan when 'free' then 1 when 'starter' then 10 when 'pro' then 40 end;
$$;

-- ───────────────────────── Tablas ─────────────────────────

create table public.subscriptions (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  plan_id text not null default 'free' check (plan_id in ('free', 'starter', 'pro')),
  status text not null default 'trial' check (status in ('trial', 'active')),
  -- Mientras no haya pasarela real, todo es modo pruebas: no se cobra nada.
  mode text not null default 'test' check (mode in ('test', 'live')),
  provider text not null default 'test' check (provider in ('test', 'mercadopago', 'culqi', 'stripe')),
  provider_subscription_id text,
  cancel_at_period_end boolean not null default false,
  -- Mes del consumo en UTC (AAAA-MM). Al cambiar de mes el contador vuelve a cero.
  period text not null default to_char(now() at time zone 'utc', 'YYYY-MM'),
  generations_used integer not null default 0 check (generations_used >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.scheduled_posts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  publication_id uuid not null references public.publications (id) on delete cascade,
  channel text not null check (channel in ('instagram', 'facebook', 'whatsapp')),
  scheduled_at timestamptz not null,
  caption text not null default '' check (char_length(caption) <= 2200),
  -- pending_connection: en cola hasta que se conecte la publicación automática en redes.
  status text not null default 'pending_connection' check (status in ('pending_connection', 'cancelled', 'published', 'error')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index scheduled_posts_owner_idx on public.scheduled_posts (owner_id, scheduled_at);
create index scheduled_posts_publication_idx on public.scheduled_posts (publication_id);

create trigger subscriptions_touch before update on public.subscriptions for each row execute function public.touch_updated_at();
create trigger scheduled_posts_touch before update on public.scheduled_posts for each row execute function public.touch_updated_at();

-- ───────────────────────── RLS (solo lectura de lo propio) ─────────────────────────

alter table public.subscriptions enable row level security;
alter table public.scheduled_posts enable row level security;
revoke all on public.subscriptions, public.scheduled_posts from anon;
-- Sin políticas de insert/update/delete: los usuarios no pueden escribir estas tablas directamente.
revoke insert, update, delete on public.subscriptions, public.scheduled_posts from authenticated;

create policy "plan: ver el propio o admin" on public.subscriptions for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());
create policy "programación: ver las propias o admin" on public.scheduled_posts for select to authenticated
  using (owner_id = (select auth.uid()) or public.is_admin());

-- ───────────────────────── Funciones ─────────────────────────

-- Devuelve el plan de quien llama: lo crea en modo pruebas si no existe y reinicia el consumo al cambiar de mes.
create function public.my_subscription() returns public.subscriptions
language plpgsql security definer set search_path = '' as $$
declare
  current_period text := to_char(now() at time zone 'utc', 'YYYY-MM');
  rec public.subscriptions;
begin
  if auth.uid() is null or not public.is_active() then raise exception 'not authenticated'; end if;
  insert into public.subscriptions (user_id) values (auth.uid()) on conflict (user_id) do nothing;
  select * into rec from public.subscriptions where user_id = auth.uid() for update;
  if rec.period <> current_period then
    update public.subscriptions set period = current_period, generations_used = 0, cancel_at_period_end = false
      where user_id = auth.uid() returning * into rec;
  end if;
  return rec;
end $$;

-- Reserva una generación del mes. Devuelve ok=false (sin consumir) si se llegó al límite del plan.
create function public.reserve_generation() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  rec public.subscriptions := public.my_subscription();
  max_generations integer := public.plan_generation_limit(rec.plan_id);
begin
  if rec.generations_used >= max_generations then
    return jsonb_build_object('ok', false, 'used', rec.generations_used, 'limit', max_generations);
  end if;
  update public.subscriptions set generations_used = generations_used + 1 where user_id = auth.uid() returning * into rec;
  return jsonb_build_object('ok', true, 'used', rec.generations_used, 'limit', max_generations);
end $$;

-- Devuelve la generación reservada cuando n8n no aceptó el trabajo.
create function public.release_generation() returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.my_subscription();
  update public.subscriptions set generations_used = greatest(0, generations_used - 1) where user_id = auth.uid();
end $$;

-- Cambia de plan SOLO en modo pruebas. Con una pasarela real, el cambio lo confirmará su webhook firmado.
create function public.change_plan_test(p_plan text) returns public.subscriptions
language plpgsql security definer set search_path = '' as $$
declare
  rec public.subscriptions := public.my_subscription();
begin
  if public.plan_generation_limit(p_plan) is null then raise exception 'El plan seleccionado no existe.'; end if;
  if rec.mode <> 'test' then raise exception 'Los cambios de plan reales se confirman con el pago.'; end if;
  update public.subscriptions set
    plan_id = p_plan,
    status = case when p_plan = 'free' then 'trial' else 'active' end,
    provider = 'test',
    provider_subscription_id = case when p_plan = 'free' then null else 'test-sub-' || gen_random_uuid() end,
    cancel_at_period_end = false
  where user_id = auth.uid() returning * into rec;
  return rec;
end $$;

-- Marca (o desmarca) la cancelación al cierre del periodo.
create function public.set_cancel_at_period_end(p_cancel boolean) returns public.subscriptions
language plpgsql security definer set search_path = '' as $$
declare
  rec public.subscriptions := public.my_subscription();
begin
  update public.subscriptions set
    cancel_at_period_end = coalesce(p_cancel, false),
    status = case when not coalesce(p_cancel, false) and plan_id <> 'free' then 'active' else status end
  where user_id = auth.uid() returning * into rec;
  return rec;
end $$;

-- Programa una publicación propia en el futuro, respetando el límite de programadas del plan.
create function public.schedule_post(p_publication uuid, p_channel text, p_at timestamptz, p_caption text default '')
returns public.scheduled_posts
language plpgsql security definer set search_path = '' as $$
declare
  plan public.subscriptions := public.my_subscription();
  max_scheduled integer := public.plan_scheduled_limit(plan.plan_id);
  pending integer;
  rec public.scheduled_posts;
begin
  if p_channel not in ('instagram', 'facebook', 'whatsapp') then raise exception 'Elige Instagram, Facebook o WhatsApp.'; end if;
  if p_at is null or p_at <= now() then raise exception 'La fecha debe estar en el futuro.'; end if;
  if not exists (select 1 from public.publications where id = p_publication and owner_id = auth.uid()) then
    raise exception 'Guarda la publicación antes de programarla.';
  end if;
  -- Bloquea el plan para que dos programaciones simultáneas no superen el límite.
  perform 1 from public.subscriptions where user_id = auth.uid() for update;
  select count(*) into pending from public.scheduled_posts where owner_id = auth.uid() and status = 'pending_connection';
  if pending >= max_scheduled then
    raise exception 'Alcanzaste el límite de % publicaciones programadas del plan actual.', max_scheduled;
  end if;
  insert into public.scheduled_posts (owner_id, publication_id, channel, scheduled_at, caption)
    values (auth.uid(), p_publication, p_channel, p_at, left(coalesce(p_caption, ''), 2200))
    returning * into rec;
  return rec;
end $$;

-- Cancela una publicación programada propia (no la borra: queda el registro como cancelada).
create function public.cancel_scheduled_post(p_id uuid) returns public.scheduled_posts
language plpgsql security definer set search_path = '' as $$
declare
  rec public.scheduled_posts;
begin
  if auth.uid() is null or not public.is_active() then raise exception 'not authenticated'; end if;
  update public.scheduled_posts set status = 'cancelled'
    where id = p_id and owner_id = auth.uid() and status = 'pending_connection'
    returning * into rec;
  return rec;
end $$;

-- Solo usuarios con sesión pueden llamar a estas funciones.
revoke execute on function public.my_subscription() from public, anon;
revoke execute on function public.reserve_generation() from public, anon;
revoke execute on function public.release_generation() from public, anon;
revoke execute on function public.change_plan_test(text) from public, anon;
revoke execute on function public.set_cancel_at_period_end(boolean) from public, anon;
revoke execute on function public.schedule_post(uuid, text, timestamptz, text) from public, anon;
revoke execute on function public.cancel_scheduled_post(uuid) from public, anon;
grant execute on function public.my_subscription() to authenticated;
grant execute on function public.reserve_generation() to authenticated;
grant execute on function public.release_generation() to authenticated;
grant execute on function public.change_plan_test(text) to authenticated;
grant execute on function public.set_cancel_at_period_end(boolean) to authenticated;
grant execute on function public.schedule_post(uuid, text, timestamptz, text) to authenticated;
grant execute on function public.cancel_scheduled_post(uuid) to authenticated;
