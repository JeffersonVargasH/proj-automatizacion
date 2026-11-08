-- Clic · esquema base: usuarios, negocios, publicaciones, auditoría y archivos.
-- Ejecutar una vez en el SQL Editor de Supabase (o con `supabase db push`).

create type public.app_role as enum ('admin', 'entrepreneur');
create type public.account_status as enum ('active', 'suspended');

-- ───────────────────────── Tablas ─────────────────────────

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text not null default '' check (char_length(full_name) <= 120),
  role public.app_role not null default 'entrepreneur',
  status public.account_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null default '' check (char_length(name) <= 120),
  -- Colores, contacto, preferencias de publicación y redes (sin tokens).
  brand jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index businesses_owner_idx on public.businesses (owner_id);

create table public.publications (
  id uuid primary key,
  business_id uuid not null references public.businesses (id) on delete cascade,
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title text not null default '' check (char_length(title) <= 200),
  status text not null default 'draft' check (status in ('draft', 'processing', 'generated', 'published', 'error')),
  -- El diseño completo; las imágenes se guardan como referencias a Storage, nunca en base64.
  design jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index publications_business_idx on public.publications (business_id, updated_at desc);
create index publications_owner_idx on public.publications (owner_id);

create table public.activity_log (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity text not null,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index activity_log_actor_idx on public.activity_log (actor_id, created_at desc);
create index activity_log_created_idx on public.activity_log (created_at desc);

-- ───────────────────────── Funciones ─────────────────────────

create function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and status = 'active');
$$;

create function public.is_active() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and status = 'active');
$$;

create function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
create trigger businesses_touch before update on public.businesses for each row execute function public.touch_updated_at();
create trigger publications_touch before update on public.publications for each row execute function public.touch_updated_at();

-- Un usuario normal solo puede cambiar su nombre: rol, estado y correo los decide un administrador.
-- Sin auth.uid() (SQL Editor o service role) se permite, para poder crear el primer administrador.
create function public.protect_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.role := old.role;
    new.status := old.status;
    new.email := old.email;
  end if;
  return new;
end $$;
create trigger profiles_protect before update on public.profiles for each row execute function public.protect_profile();

-- Cada cuenta nueva recibe su perfil y un primer negocio con el nombre que indicó al registrarse.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  business_name text := left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'business'), ''), 'Mi negocio'), 120);
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, left(coalesce(trim(new.raw_user_meta_data ->> 'full_name'), ''), 120));
  insert into public.businesses (owner_id, name, brand)
  values (new.id, business_name, jsonb_build_object('name', business_name));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create function public.sync_profile_email() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end $$;
create trigger on_auth_user_email after update of email on auth.users for each row execute function public.sync_profile_email();

-- Auditoría automática: altas, bajas, cambios de estado de publicaciones y de rol/estado de cuentas.
create function public.audit_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  old_row jsonb := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  new_row jsonb := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
  row_data jsonb := coalesce(new_row, old_row);
  details jsonb;
begin
  if tg_op = 'UPDATE' then
    if tg_table_name = 'publications' and old_row ->> 'status' is not distinct from new_row ->> 'status' then return new; end if;
    if tg_table_name = 'profiles' and old_row ->> 'role' is not distinct from new_row ->> 'role'
      and old_row ->> 'status' is not distinct from new_row ->> 'status' then return new; end if;
    if tg_table_name = 'businesses' and old_row ->> 'name' is not distinct from new_row ->> 'name' then return new; end if;
  end if;
  details := jsonb_strip_nulls(jsonb_build_object(
    'name', row_data ->> 'name',
    'title', row_data ->> 'title',
    'status', row_data ->> 'status',
    'role', row_data ->> 'role',
    'business_id', row_data ->> 'business_id'
  ));
  insert into public.activity_log (actor_id, action, entity, entity_id, details)
  values (auth.uid(), lower(tg_op), tg_table_name, row_data ->> 'id', details);
  return coalesce(new, old);
end $$;
create trigger businesses_audit after insert or update or delete on public.businesses for each row execute function public.audit_change();
create trigger publications_audit after insert or update or delete on public.publications for each row execute function public.audit_change();
create trigger profiles_audit after update on public.profiles for each row execute function public.audit_change();

-- Eventos de la app (inicio de sesión, generación, publicación). Siempre a nombre de quien llama.
create function public.log_activity(p_action text, p_entity text, p_entity_id text default null, p_details jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  insert into public.activity_log (actor_id, action, entity, entity_id, details)
  values (auth.uid(), left(p_action, 60), left(p_entity, 60), left(p_entity_id, 120), coalesce(p_details, '{}'::jsonb));
end $$;

revoke execute on function public.log_activity(text, text, text, jsonb) from public, anon;
grant execute on function public.log_activity(text, text, text, jsonb) to authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.sync_profile_email() from public, anon, authenticated;

-- ───────────────────────── RLS ─────────────────────────

alter table public.profiles enable row level security;
alter table public.businesses enable row level security;
alter table public.publications enable row level security;
alter table public.activity_log enable row level security;

revoke all on public.profiles, public.businesses, public.publications, public.activity_log from anon;

create policy "perfil: ver el propio o admin" on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.is_admin());
create policy "perfil: editar el propio o admin" on public.profiles for update to authenticated
  using (id = (select auth.uid()) or public.is_admin())
  with check (id = (select auth.uid()) or public.is_admin());

create policy "negocio: ver los propios o admin" on public.businesses for select to authenticated
  using ((owner_id = (select auth.uid()) and public.is_active()) or public.is_admin());
create policy "negocio: crear" on public.businesses for insert to authenticated
  with check (owner_id = (select auth.uid()) and public.is_active());
create policy "negocio: editar los propios" on public.businesses for update to authenticated
  using (owner_id = (select auth.uid()) and public.is_active())
  with check (owner_id = (select auth.uid()));
create policy "negocio: eliminar los propios" on public.businesses for delete to authenticated
  using (owner_id = (select auth.uid()) and public.is_active());

create policy "publicación: ver las propias o admin" on public.publications for select to authenticated
  using ((owner_id = (select auth.uid()) and public.is_active()) or public.is_admin());
create policy "publicación: crear en un negocio propio" on public.publications for insert to authenticated
  with check (
    owner_id = (select auth.uid()) and public.is_active()
    and exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = (select auth.uid()))
  );
create policy "publicación: editar las propias" on public.publications for update to authenticated
  using (owner_id = (select auth.uid()) and public.is_active())
  with check (
    owner_id = (select auth.uid())
    and exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = (select auth.uid()))
  );
create policy "publicación: eliminar las propias" on public.publications for delete to authenticated
  using (owner_id = (select auth.uid()) and public.is_active());

-- Nadie escribe la auditoría directamente: solo los triggers y log_activity().
create policy "auditoría: ver la propia o admin" on public.activity_log for select to authenticated
  using (actor_id = (select auth.uid()) or public.is_admin());

-- ───────────────────────── Storage ─────────────────────────
-- Bucket privado. Ruta: <usuario>/<negocio>/<hash>.<ext>. Se sirve con URLs firmadas.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', false, 10485760, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

create policy "media: ver lo propio o admin" on storage.objects for select to authenticated
  using (bucket_id = 'media' and ((storage.foldername(name))[1] = (select auth.uid())::text or public.is_admin()));
create policy "media: subir a la carpeta propia" on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid())::text and public.is_active());
create policy "media: reemplazar lo propio" on storage.objects for update to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid())::text and public.is_active());
create policy "media: borrar lo propio" on storage.objects for delete to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid())::text and public.is_active());

-- Primer administrador (ejecutar después de registrarse en la app):
-- update public.profiles set role = 'admin' where email = 'tu-correo@ejemplo.com';
