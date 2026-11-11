-- CreaMás production schema (PostgreSQL)
-- Apply this schema only after selecting the managed Postgres provider.

create table if not exists app_users (
  id text primary key,
  name text not null,
  email text not null unique,
  business text not null,
  role text not null check (role in ('admin', 'entrepreneur')),
  status text not null check (status in ('active', 'pending')) default 'active',
  password_hash text not null,
  password_salt text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists subscriptions (
  user_id text primary key references app_users(id) on delete cascade,
  plan_id text not null check (plan_id in ('free', 'starter', 'pro')),
  status text not null check (status in ('trial', 'active')),
  mode text not null check (mode in ('test', 'live')) default 'test',
  provider text not null check (provider in ('test', 'mercadopago', 'culqi', 'stripe')),
  provider_subscription_id text,
  cancel_at_period_end boolean not null default false,
  period text not null,
  generations_used integer not null default 0 check (generations_used >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists generation_jobs (
  ticket_id text primary key,
  owner_id text not null references app_users(id) on delete cascade,
  status text not null default 'processing',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists media_assets (
  id uuid primary key,
  owner_id text not null references app_users(id) on delete cascade,
  object_key text not null unique,
  content_type text not null,
  created_at timestamptz not null default now()
);

create table if not exists scheduled_posts (
  id uuid primary key,
  owner_id text not null references app_users(id) on delete cascade,
  design_id text not null,
  channel text not null check (channel in ('Instagram', 'Facebook', 'WhatsApp')),
  scheduled_at timestamptz not null,
  caption text not null default '',
  status text not null check (status in ('pending_connection', 'cancelled', 'published', 'error')) default 'pending_connection',
  provider_post_id text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists scheduled_posts_owner_status_idx on scheduled_posts(owner_id, status, scheduled_at);
create index if not exists generation_jobs_owner_idx on generation_jobs(owner_id, created_at desc);
