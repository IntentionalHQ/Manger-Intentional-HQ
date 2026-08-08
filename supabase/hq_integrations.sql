-- Apply this file to the Intentional HQ Supabase project, never Scurry.
-- It stores HQ-owned OAuth tokens, activity, schedules, and saved queries.
create extension if not exists pgcrypto;

create table if not exists public.hq_connections (
  owner_email text not null,
  provider text not null check (provider in ('tiktok', 'youtube', 'instagram')),
  access_token_encrypted text not null,
  refresh_token_encrypted text,
  token_expires_at timestamptz,
  external_account_id text,
  external_account_name text,
  scopes text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (owner_email, provider)
);

create table if not exists public.hq_activity_events (
  id uuid primary key default gen_random_uuid(),
  owner_email text not null,
  provider text not null,
  kind text not null,
  title text not null,
  detail text,
  external_id text,
  created_at timestamptz not null default now()
);

create index if not exists hq_activity_owner_created_idx
  on public.hq_activity_events (owner_email, created_at desc);

create table if not exists public.hq_scheduled_posts (
  id uuid primary key default gen_random_uuid(),
  owner_email text not null,
  targets text[] not null,
  payload jsonb not null,
  scheduled_for timestamptz not null,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'published', 'failed')),
  results jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists hq_scheduled_due_idx
  on public.hq_scheduled_posts (status, scheduled_for);

create table if not exists public.hq_saved_queries (
  id uuid primary key default gen_random_uuid(),
  owner_email text not null,
  name text not null,
  query_text text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_email, name)
);

alter table public.hq_connections enable row level security;
alter table public.hq_activity_events enable row level security;
alter table public.hq_scheduled_posts enable row level security;
alter table public.hq_saved_queries enable row level security;

revoke all on public.hq_connections from anon, authenticated;
revoke all on public.hq_activity_events from anon, authenticated;
revoke all on public.hq_scheduled_posts from anon, authenticated;
revoke all on public.hq_saved_queries from anon, authenticated;

create or replace function public.hq_run_readonly_query(query_text text)
returns jsonb
language plpgsql
security definer
set search_path = public
set statement_timeout = '5s'
as $$
declare
  normalized text := btrim(query_text);
  result jsonb;
begin
  if normalized !~* '^(select|with)\s'
    or normalized ~* '\m(insert|update|delete|alter|drop|create|grant|revoke|truncate|copy|call|do|execute)\M'
    or position(';' in normalized) > 0 then
    raise exception 'Only one read-only SELECT or WITH query is allowed.';
  end if;

  execute
    'select coalesce(jsonb_agg(row_to_json(result_row)), ''[]''::jsonb) from (' ||
    normalized ||
    ') result_row'
    into result;
  return result;
end;
$$;

revoke all on function public.hq_run_readonly_query(text) from public, anon, authenticated;
grant execute on function public.hq_run_readonly_query(text) to service_role;
