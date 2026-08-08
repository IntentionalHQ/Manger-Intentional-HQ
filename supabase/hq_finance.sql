-- Intentional HQ / Finance database
-- Apply this file to the NEW Intentional HQ Supabase project, never Scurry.
-- The service-role-only application layer owns all writes. Posted journals
-- are protected from mutation and can only be corrected with reversals.

create extension if not exists pgcrypto;

create table if not exists public.hq_businesses (
  id uuid primary key default gen_random_uuid(),
  owner_email text not null unique,
  name text not null,
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  fiscal_year_start_month smallint not null default 1
    check (fiscal_year_start_month between 1 and 12),
  next_entry_number bigint not null default 1 check (next_entry_number > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.hq_chart_accounts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.hq_businesses(id) on delete cascade,
  code text not null,
  name text not null,
  type text not null check (type in ('asset', 'liability', 'equity', 'revenue', 'expense')),
  subtype text not null default '',
  active boolean not null default true,
  system_account boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, code)
);

create index if not exists hq_chart_accounts_business_idx
  on public.hq_chart_accounts (business_id, code);

create table if not exists public.hq_journal_entries (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.hq_businesses(id) on delete cascade,
  entry_number bigint not null,
  entry_date date not null,
  memo text not null,
  status text not null default 'draft' check (status in ('draft', 'posted', 'reversed')),
  source_type text not null default 'manual'
    check (source_type in ('manual', 'opening_balance', 'bank_import', 'adjustment', 'reversal')),
  source_id text,
  posted_at timestamptz,
  reversed_by uuid references public.hq_journal_entries(id),
  created_by_email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, entry_number),
  unique (business_id, source_type, source_id)
);

create index if not exists hq_journal_entries_business_date_idx
  on public.hq_journal_entries (business_id, entry_date desc, entry_number desc);

create table if not exists public.hq_journal_lines (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.hq_businesses(id) on delete cascade,
  entry_id uuid not null references public.hq_journal_entries(id) on delete cascade,
  account_id uuid not null references public.hq_chart_accounts(id),
  description text,
  debit_cents bigint not null default 0 check (debit_cents >= 0),
  credit_cents bigint not null default 0 check (credit_cents >= 0),
  created_at timestamptz not null default now(),
  check ((debit_cents > 0 and credit_cents = 0) or (credit_cents > 0 and debit_cents = 0))
);

create index if not exists hq_journal_lines_entry_idx
  on public.hq_journal_lines (entry_id);
create index if not exists hq_journal_lines_account_idx
  on public.hq_journal_lines (business_id, account_id);

create table if not exists public.hq_source_transactions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.hq_businesses(id) on delete cascade,
  source_provider text not null,
  external_id text not null,
  account_id uuid references public.hq_chart_accounts(id),
  posted_date date not null,
  description text not null default '',
  merchant_name text,
  amount_cents bigint not null,
  pending boolean not null default false,
  source_state text not null default 'active' check (source_state in ('active', 'modified', 'removed')),
  review_status text not null default 'unreviewed'
    check (review_status in ('unreviewed', 'matched', 'posted', 'excluded')),
  journal_entry_id uuid references public.hq_journal_entries(id),
  raw_payload jsonb not null default '{}'::jsonb,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (business_id, source_provider, external_id)
);

create index if not exists hq_source_transactions_review_idx
  on public.hq_source_transactions (business_id, review_status, posted_date desc);

create table if not exists public.hq_reconciliations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.hq_businesses(id) on delete cascade,
  account_id uuid not null references public.hq_chart_accounts(id),
  statement_start_date date not null,
  statement_end_date date not null,
  statement_ending_balance_cents bigint not null,
  book_ending_balance_cents bigint,
  difference_cents bigint,
  status text not null default 'in_progress' check (status in ('in_progress', 'completed', 'reopened')),
  completed_at timestamptz,
  completed_by_email text,
  created_at timestamptz not null default now(),
  unique (business_id, account_id, statement_end_date)
);

create table if not exists public.hq_reconciliation_items (
  reconciliation_id uuid not null references public.hq_reconciliations(id) on delete cascade,
  journal_line_id uuid not null references public.hq_journal_lines(id),
  cleared boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (reconciliation_id, journal_line_id)
);

create table if not exists public.hq_fiscal_periods (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.hq_businesses(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  status text not null default 'open' check (status in ('open', 'closed')),
  closed_at timestamptz,
  closed_by_email text,
  created_at timestamptz not null default now(),
  check (end_date >= start_date),
  unique (business_id, start_date, end_date)
);

create table if not exists public.hq_receipts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.hq_businesses(id) on delete cascade,
  journal_entry_id uuid references public.hq_journal_entries(id),
  source_transaction_id uuid references public.hq_source_transactions(id),
  storage_bucket text not null default 'finance-documents',
  storage_path text not null,
  original_filename text not null,
  content_type text not null,
  size_bytes bigint not null check (size_bytes >= 0),
  sha256 text,
  uploaded_by_email text not null,
  created_at timestamptz not null default now(),
  unique (business_id, storage_bucket, storage_path)
);

create table if not exists public.hq_forecast_scenarios (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.hq_businesses(id) on delete cascade,
  name text not null,
  is_default boolean not null default false,
  assumptions jsonb not null default '{}'::jsonb,
  source_as_of date,
  created_by_email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, name)
);

create unique index if not exists hq_forecast_one_default_idx
  on public.hq_forecast_scenarios (business_id) where is_default;

create table if not exists public.hq_forecast_periods (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.hq_businesses(id) on delete cascade,
  scenario_id uuid not null references public.hq_forecast_scenarios(id) on delete cascade,
  period_start date not null,
  paying_users bigint not null default 0,
  active_users bigint not null default 0,
  revenue_cents bigint not null default 0,
  cost_cents bigint not null default 0,
  net_cash_cents bigint not null default 0,
  result jsonb not null default '{}'::jsonb,
  generated_at timestamptz not null default now(),
  unique (scenario_id, period_start)
);

create table if not exists public.hq_forecast_actual_mappings (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.hq_businesses(id) on delete cascade,
  forecast_cost_key text not null,
  account_id uuid not null references public.hq_chart_accounts(id),
  created_at timestamptz not null default now(),
  unique (business_id, forecast_cost_key, account_id)
);

create table if not exists public.hq_audit_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.hq_businesses(id) on delete cascade,
  actor_email text not null,
  action text not null,
  entity_type text not null,
  entity_id text not null,
  before_state jsonb,
  after_state jsonb,
  created_at timestamptz not null default now()
);

create index if not exists hq_audit_business_created_idx
  on public.hq_audit_events (business_id, created_at desc);

create or replace function public.hq_block_posted_entry_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_setting('hq.allow_posted_mutation', true) = 'on' then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  if old.status in ('posted', 'reversed') then
    raise exception 'Posted journal entries are immutable; create a reversal instead.';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists hq_protect_posted_entries on public.hq_journal_entries;
create trigger hq_protect_posted_entries
before update or delete on public.hq_journal_entries
for each row execute function public.hq_block_posted_entry_mutation();

create or replace function public.hq_block_posted_line_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  parent_status text;
begin
  if current_setting('hq.allow_posted_mutation', true) = 'on' then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  select status into parent_status
  from public.hq_journal_entries
  where id = coalesce(new.entry_id, old.entry_id);
  if parent_status in ('posted', 'reversed') then
    raise exception 'Lines belonging to posted entries are immutable.';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists hq_protect_posted_lines on public.hq_journal_lines;
create trigger hq_protect_posted_lines
before update or delete on public.hq_journal_lines
for each row execute function public.hq_block_posted_line_mutation();

create or replace function public.hq_block_closed_period_entry()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_setting('hq.allow_posted_mutation', true) = 'on' then return new; end if;
  if exists (
    select 1 from public.hq_fiscal_periods
    where business_id = new.business_id
      and status = 'closed'
      and new.entry_date between start_date and end_date
  ) then
    raise exception 'This accounting period is closed. Use an entry date in an open period.';
  end if;
  return new;
end;
$$;

drop trigger if exists hq_protect_closed_periods on public.hq_journal_entries;
create trigger hq_protect_closed_periods
before insert or update of entry_date on public.hq_journal_entries
for each row execute function public.hq_block_closed_period_entry();

create or replace function public.hq_post_journal_entry(p_entry_id uuid, p_actor_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.hq_journal_entries%rowtype;
  debit_total bigint;
  credit_total bigint;
  line_count bigint;
begin
  select * into target from public.hq_journal_entries where id = p_entry_id for update;
  if target.id is null then raise exception 'Journal entry not found.'; end if;
  if target.status <> 'draft' then raise exception 'Only draft entries can be posted.'; end if;

  select count(*), coalesce(sum(debit_cents), 0), coalesce(sum(credit_cents), 0)
    into line_count, debit_total, credit_total
  from public.hq_journal_lines where entry_id = p_entry_id;

  if line_count < 2 then raise exception 'A journal entry needs at least two lines.'; end if;
  if debit_total <= 0 or debit_total <> credit_total then
    raise exception 'Journal entry debits and credits must balance.';
  end if;

  perform set_config('hq.allow_posted_mutation', 'on', true);
  update public.hq_journal_entries
    set status = 'posted', posted_at = now(), updated_at = now()
    where id = p_entry_id;
  insert into public.hq_audit_events
    (business_id, actor_email, action, entity_type, entity_id, after_state)
  values
    (target.business_id, lower(p_actor_email), 'posted', 'journal_entry', target.id::text,
     jsonb_build_object('debit_cents', debit_total, 'credit_cents', credit_total));
end;
$$;

create or replace function public.hq_reverse_journal_entry(
  p_entry_id uuid,
  p_reversal_date date,
  p_actor_email text,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  original public.hq_journal_entries%rowtype;
  reversal_id uuid := gen_random_uuid();
  next_number bigint;
begin
  select * into original from public.hq_journal_entries where id = p_entry_id for update;
  if original.id is null or original.status <> 'posted' then
    raise exception 'Only a posted journal entry can be reversed.';
  end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'A reversal reason is required.'; end if;

  update public.hq_businesses
    set next_entry_number = next_entry_number + 1, updated_at = now()
    where id = original.business_id
    returning next_entry_number - 1 into next_number;

  insert into public.hq_journal_entries
    (id, business_id, entry_number, entry_date, memo, status, source_type, source_id, posted_at, created_by_email)
  values
    (reversal_id, original.business_id, next_number, p_reversal_date,
     'Reversal: ' || p_reason, 'draft', 'reversal', original.id::text, null, lower(p_actor_email));

  insert into public.hq_journal_lines
    (business_id, entry_id, account_id, description, debit_cents, credit_cents)
  select business_id, reversal_id, account_id, description, credit_cents, debit_cents
  from public.hq_journal_lines where entry_id = original.id;

  perform public.hq_post_journal_entry(reversal_id, p_actor_email);
  perform set_config('hq.allow_posted_mutation', 'on', true);
  update public.hq_journal_entries
    set status = 'reversed', reversed_by = reversal_id, updated_at = now()
    where id = original.id;
  return reversal_id;
end;
$$;

create or replace function public.hq_create_journal_entry(
  p_business_id uuid,
  p_entry_date date,
  p_memo text,
  p_source_type text,
  p_source_id text,
  p_actor_email text,
  p_lines jsonb,
  p_post boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_entry_id uuid := gen_random_uuid();
  next_number bigint;
  item jsonb;
  item_account_id uuid;
  item_debit bigint;
  item_credit bigint;
begin
  if coalesce(trim(p_memo), '') = '' then raise exception 'A memo is required.'; end if;
  if p_source_type not in ('manual', 'opening_balance', 'bank_import', 'adjustment', 'reversal') then
    raise exception 'Unsupported journal source type.';
  end if;
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) < 2 then
    raise exception 'A journal entry needs at least two lines.';
  end if;

  update public.hq_businesses
    set next_entry_number = next_entry_number + 1, updated_at = now()
    where id = p_business_id
    returning next_entry_number - 1 into next_number;
  if next_number is null then raise exception 'Business not found.'; end if;

  insert into public.hq_journal_entries
    (id, business_id, entry_number, entry_date, memo, source_type, source_id, created_by_email)
  values
    (new_entry_id, p_business_id, next_number, p_entry_date, trim(p_memo),
     p_source_type, nullif(trim(p_source_id), ''), lower(trim(p_actor_email)));

  for item in select value from jsonb_array_elements(p_lines)
  loop
    item_account_id := (item->>'account_id')::uuid;
    item_debit := coalesce((item->>'debit_cents')::bigint, 0);
    item_credit := coalesce((item->>'credit_cents')::bigint, 0);
    if not exists (
      select 1 from public.hq_chart_accounts
      where id = item_account_id and business_id = p_business_id and active
    ) then
      raise exception 'Journal account is missing, inactive, or belongs to another business.';
    end if;
    insert into public.hq_journal_lines
      (business_id, entry_id, account_id, description, debit_cents, credit_cents)
    values
      (p_business_id, new_entry_id, item_account_id, nullif(item->>'description', ''), item_debit, item_credit);
  end loop;

  if p_post then perform public.hq_post_journal_entry(new_entry_id, p_actor_email); end if;
  return new_entry_id;
end;
$$;

create or replace function public.hq_close_fiscal_period(
  p_business_id uuid,
  p_start_date date,
  p_end_date date,
  p_actor_email text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  period_id uuid;
  draft_count bigint;
  unreviewed_count bigint;
begin
  if p_end_date < p_start_date then raise exception 'Period end must be on or after its start.'; end if;
  if p_end_date >= current_date then raise exception 'Only a completed accounting period can be closed.'; end if;
  if exists (
    select 1 from public.hq_fiscal_periods
    where business_id = p_business_id and status = 'closed'
      and daterange(start_date, end_date, '[]') && daterange(p_start_date, p_end_date, '[]')
  ) then
    raise exception 'The requested period overlaps an existing closed period.';
  end if;

  select count(*) into draft_count from public.hq_journal_entries
  where business_id = p_business_id and status = 'draft'
    and entry_date between p_start_date and p_end_date;
  if draft_count > 0 then raise exception 'Post or remove every draft entry before closing.'; end if;

  select count(*) into unreviewed_count from public.hq_source_transactions
  where business_id = p_business_id and review_status = 'unreviewed'
    and posted_date between p_start_date and p_end_date;
  if unreviewed_count > 0 then raise exception 'Review every imported transaction before closing.'; end if;

  insert into public.hq_fiscal_periods
    (business_id, start_date, end_date, status, closed_at, closed_by_email)
  values
    (p_business_id, p_start_date, p_end_date, 'closed', now(), lower(trim(p_actor_email)))
  returning id into period_id;

  insert into public.hq_audit_events
    (business_id, actor_email, action, entity_type, entity_id, after_state)
  values
    (p_business_id, lower(trim(p_actor_email)), 'closed', 'fiscal_period', period_id::text,
     jsonb_build_object('start_date', p_start_date, 'end_date', p_end_date));
  return period_id;
end;
$$;

create or replace function public.hq_create_business(p_owner_email text, p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business_id uuid;
begin
  if coalesce(trim(p_owner_email), '') = '' or coalesce(trim(p_name), '') = '' then
    raise exception 'Owner email and business name are required.';
  end if;
  insert into public.hq_businesses (owner_email, name)
  values (lower(trim(p_owner_email)), trim(p_name))
  returning id into v_business_id;

  insert into public.hq_chart_accounts
    (business_id, code, name, type, subtype, system_account)
  values
    (v_business_id, '1000', 'Operating cash', 'asset', 'cash', true),
    (v_business_id, '1100', 'Accounts receivable', 'asset', 'receivable', true),
    (v_business_id, '1200', 'Prepaid expenses', 'asset', 'prepaid', false),
    (v_business_id, '2000', 'Accounts payable', 'liability', 'payable', true),
    (v_business_id, '2100', 'Credit cards payable', 'liability', 'credit_card', false),
    (v_business_id, '2200', 'Sales tax payable', 'liability', 'tax', false),
    (v_business_id, '3000', 'Founder contributions', 'equity', 'contributed_capital', true),
    (v_business_id, '3100', 'Retained earnings', 'equity', 'retained_earnings', true),
    (v_business_id, '4000', 'Subscription revenue', 'revenue', 'operating_revenue', true),
    (v_business_id, '4100', 'Other revenue', 'revenue', 'other_revenue', false),
    (v_business_id, '6100', 'Payment processing', 'expense', 'cost_of_revenue', true),
    (v_business_id, '6200', 'Hosting — Supabase', 'expense', 'hosting', true),
    (v_business_id, '6210', 'Hosting — Vercel', 'expense', 'hosting', true),
    (v_business_id, '6220', 'Transactional email', 'expense', 'software', true),
    (v_business_id, '6230', 'Bank synchronization', 'expense', 'software', true),
    (v_business_id, '6300', 'Contractors', 'expense', 'people', false),
    (v_business_id, '6400', 'Legal and professional', 'expense', 'professional_services', false),
    (v_business_id, '6500', 'Marketing', 'expense', 'marketing', false),
    (v_business_id, '6600', 'Insurance', 'expense', 'insurance', false),
    (v_business_id, '6900', 'Other operating expense', 'expense', 'other', false);

  insert into public.hq_forecast_scenarios
    (business_id, name, is_default, assumptions, created_by_email)
  values (v_business_id, 'Base case', true, '{}'::jsonb, lower(trim(p_owner_email)));

  insert into public.hq_forecast_actual_mappings (business_id, forecast_cost_key, account_id)
  select business_id,
    case code
      when '6100' then 'stripe'
      when '6200' then 'supabase'
      when '6210' then 'vercel'
      when '6220' then 'email'
      when '6230' then 'bank_sync'
    end,
    id
  from public.hq_chart_accounts
  where business_id = v_business_id
    and code in ('6100', '6200', '6210', '6220', '6230');

  return v_business_id;
end;
$$;

alter table public.hq_businesses enable row level security;
alter table public.hq_chart_accounts enable row level security;
alter table public.hq_journal_entries enable row level security;
alter table public.hq_journal_lines enable row level security;
alter table public.hq_source_transactions enable row level security;
alter table public.hq_reconciliations enable row level security;
alter table public.hq_reconciliation_items enable row level security;
alter table public.hq_fiscal_periods enable row level security;
alter table public.hq_receipts enable row level security;
alter table public.hq_forecast_scenarios enable row level security;
alter table public.hq_forecast_periods enable row level security;
alter table public.hq_forecast_actual_mappings enable row level security;
alter table public.hq_audit_events enable row level security;

revoke all on all tables in schema public from anon, authenticated;
revoke all on function public.hq_post_journal_entry(uuid, text) from public, anon, authenticated;
revoke all on function public.hq_reverse_journal_entry(uuid, date, text, text) from public, anon, authenticated;
revoke all on function public.hq_create_journal_entry(uuid, date, text, text, text, text, jsonb, boolean) from public, anon, authenticated;
revoke all on function public.hq_close_fiscal_period(uuid, date, date, text) from public, anon, authenticated;
revoke all on function public.hq_create_business(text, text) from public, anon, authenticated;
grant all on all tables in schema public to service_role;
grant execute on function public.hq_post_journal_entry(uuid, text) to service_role;
grant execute on function public.hq_reverse_journal_entry(uuid, date, text, text) to service_role;
grant execute on function public.hq_create_journal_entry(uuid, date, text, text, text, text, jsonb, boolean) to service_role;
grant execute on function public.hq_close_fiscal_period(uuid, date, date, text) to service_role;
grant execute on function public.hq_create_business(text, text) to service_role;
