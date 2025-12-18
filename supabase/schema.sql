create extension if not exists "uuid-ossp" with schema extensions;
create extension if not exists pgcrypto with schema extensions;
-- Types idempotentes
do $$
begin
  if not exists (select 1 from pg_type where typname = 'appointment_status') then
    create type appointment_status as enum ('pending','reserved','confirmed','canceled','completed');
  end if;
  if not exists (select 1 from pg_type where typname = 'payment_status') then
    create type payment_status as enum ('pending','approved','failed','refunded','partially_refunded');
  end if;
  if not exists (select 1 from pg_type where typname = 'payment_kind') then
    create type payment_kind as enum ('deposit','balance','full');
  end if;
end
$$;
-- Perfis (mapeia usuários do Auth)
create table if not exists profiles (
  id uuid primary key, -- igual a auth.uid()
  role text not null default 'client' check (role in ('client','admin','adminsuper','adminmaster')),
  full_name text,
  email text,
  whatsapp text,
  birth_date date,
  created_at timestamptz not null default now()
);
create unique index if not exists profiles_email_idx on profiles(lower(email)) where email is not null;
-- Filiais/Serviços/Staff
create table if not exists branches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  timezone text not null default 'America/Sao_Paulo',
  owner_id uuid references profiles(id) on delete set null,
  region text,
  focus text,
  status text not null default 'ativa' check (status in ('ativa','pausada')),
  staff_slots int not null default 0 check (staff_slots >= 0),
  created_at timestamptz not null default now()
);
create index if not exists branches_owner_id_idx on branches(owner_id);
create table if not exists service_types (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid references branches(id) on delete set null,
  name text not null,
  slug text unique,
  description text,
  active boolean not null default true,
  order_index int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists service_types_branch_idx on service_types(branch_id);
create table if not exists services (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid references branches(id) on delete cascade,
  name text not null,
  slug text,
  description text,
  duration_min int not null check (duration_min > 0),
  price_cents int not null check (price_cents >= 0),
  deposit_cents int not null default 0 check (deposit_cents >= 0),
  buffer_min int not null default 15,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists services_branch_idx on services(branch_id);
create table if not exists service_type_assignments (
  service_id uuid references services(id) on delete cascade,
  service_type_id uuid references service_types(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (service_id, service_type_id)
);
create table if not exists staff (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid references branches(id) on delete cascade,
  display_name text not null,
  user_id uuid references profiles(id) on delete set null,
  color text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists staff_branch_idx on staff(branch_id);
-- Horários e bloqueios
create table if not exists business_hours (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid references branches(id) on delete cascade,
  weekday int not null check (weekday between 0 and 6), -- 0=Dom
  open_time time not null,
  close_time time not null,
  unique (branch_id, weekday)
);
create table if not exists staff_hours (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid references staff(id) on delete cascade,
  weekday int not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  unique (staff_id, weekday)
);
create table if not exists blackouts (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid references branches(id) on delete cascade,
  staff_id uuid references staff(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text
);
create index if not exists blackouts_staff_time_idx on blackouts(staff_id, starts_at, ends_at);
-- Agendamentos / Pagamentos
create table if not exists appointments (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid references branches(id) on delete cascade,
  customer_id uuid references profiles(id) on delete restrict,
  staff_id uuid references staff(id) on delete set null,
  service_id uuid references services(id) on delete restrict,
  service_type_id uuid references service_types(id) on delete set null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status appointment_status not null default 'pending',
  total_cents int not null default 0,
  deposit_cents int not null default 0,
  paid_in_full boolean not null default false,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  notes text,
  created_at timestamptz not null default now(),
  unique (staff_id, starts_at, ends_at)
);
create index if not exists appointments_customer_idx on appointments(customer_id);
create index if not exists appointments_staff_time_idx on appointments(staff_id, starts_at);
create index if not exists appointments_service_type_idx on appointments(service_type_id);
create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references appointments(id) on delete cascade,
  provider text not null,
  provider_payment_id text,
  kind payment_kind not null,
  covers_deposit boolean not null default false,
  status payment_status not null default 'pending',
  amount_cents int not null check (amount_cents > 0),
  currency text not null default 'BRL',
  payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(provider, provider_payment_id)
);
create index if not exists payments_appt_idx on payments(appointment_id);
create table if not exists webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_id text not null,
  received_at timestamptz not null default now(),
  payload jsonb not null,
  unique(provider, event_id)
);
-- Reminders (WhatsApp / e-mail)
create table if not exists reminders (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid references appointments(id) on delete cascade,
  channel text not null check (channel in ('whatsapp','email')),
  to_address text not null, -- phone ou e-mail
  template text not null, -- 'reminder_24h' | 'reminder_2h' | 'confirm'
  message text not null,
  scheduled_at timestamptz not null,
  sent_at timestamptz,
  status text not null default 'pending' check (status in ('pending','sent','error')),
  attempts int not null default 0,
  last_error text
);
create index if not exists reminders_sched_idx on reminders(scheduled_at) where status='pending';
-- Comunicação e políticas da plataforma
create table if not exists system_announcements (
  id uuid primary key default gen_random_uuid(),
  title text,
  message text,
  audience text,
  status text,
  publish_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references profiles(id) on delete set null
);

create table if not exists platform_policies (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  value jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_platform_policies_updated_at on platform_policies;
create trigger trg_platform_policies_updated_at
before update on platform_policies
for each row execute function set_updated_at();

alter table system_announcements enable row level security;
alter table platform_policies enable row level security;


drop policy if exists system_announcements_adminmaster_rw on system_announcements;
create policy system_announcements_adminmaster_rw on system_announcements for all using (

  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'adminmaster'
  )
) with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'adminmaster'
  )
);


drop policy if exists platform_policies_adminmaster_rw on platform_policies;
create policy platform_policies_adminmaster_rw on platform_policies for all using (

  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'adminmaster'
  )
) with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'adminmaster'
  )
);

insert into platform_policies (name, value)
values
  ('booking_rules', '{}'::jsonb),
  ('integrations', '{}'::jsonb)
on conflict (name) do nothing;
-- View de totais pagos
create or replace view appointment_payment_totals as
select
  a.id as appointment_id,
  coalesce(sum(case when p.status in ('approved','partially_refunded') then p.amount_cents else 0 end),0) as paid_cents
from appointments a
left join payments p on p.appointment_id = a.id
group by a.id;
-- Trigger: sincroniza paid_in_full
create or replace function sync_paid_full()
returns trigger as $$
begin
  update appointments a
  set paid_in_full = (
    select t.paid_cents from appointment_payment_totals t where t.appointment_id = a.id
  ) >= a.total_cents
  where a.id = new.appointment_id;
  return new;
end
$$ language plpgsql;
drop trigger if exists trg_payments_after_change on payments;
create trigger trg_payments_after_change
after insert or update of status, amount_cents on payments
for each row execute function sync_paid_full();
-- RLS básica (clientes veem só o que é deles; admin vê tudo)
alter table profiles enable row level security;
alter table appointments enable row level security;
create or replace function public.is_admin(uid uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result boolean;
begin
  execute 'select exists(' ||
          'select 1 from public.profiles where id = $1 and role in (''admin'',''adminsuper'',''adminmaster'')'
          ')'
    into result
    using uid;

  return result;
end;
$$;

grant execute on function public.is_admin(uuid) to public;

drop policy if exists profiles_self on profiles;
drop policy if exists profiles_admin_access on profiles;
drop policy if exists profiles_self_insert on profiles;

create policy profiles_self on profiles for select using (
  auth.uid() = id
);

create policy profiles_admin_access on profiles for select using (
  public.is_admin(auth.uid())
);

create policy profiles_self_insert on profiles for insert with check (
  auth.uid() = id or public.is_admin(auth.uid())
);
create policy if not exists appt_select on appointments for select using (
  customer_id = auth.uid() or public.is_admin(auth.uid())
);
create policy if not exists appt_insert on appointments for insert with check (
  customer_id = auth.uid() or public.is_admin(auth.uid())
);

-- Suporte
create table if not exists public.support_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  status text not null default 'open' check (status in ('open','closed','escalated')),
  last_message_preview text,
  last_actor text check (last_actor in ('user','staff','assistant')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists support_threads_user_id_idx on public.support_threads(user_id);
create index if not exists support_threads_status_created_at_idx on public.support_threads(status, created_at);

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.support_threads(id) on delete cascade,
  sender_type text not null check (sender_type in ('user','staff','assistant')),
  sender_id uuid references public.profiles(id) on delete set null,
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists support_messages_thread_id_created_at_idx on public.support_messages(thread_id, created_at);
create index if not exists support_messages_sender_id_idx on public.support_messages(sender_id);

alter table public.support_threads enable row level security;
alter table public.support_messages enable row level security;

drop policy if exists support_threads_select on public.support_threads;
drop policy if exists support_threads_insert on public.support_threads;
drop policy if exists support_threads_update on public.support_threads;

create policy support_threads_select on public.support_threads for select using (
  user_id = auth.uid() or public.is_admin(auth.uid())
);

create policy support_threads_insert on public.support_threads for insert with check (
  user_id = auth.uid() or public.is_admin(auth.uid())
);

create policy support_threads_update on public.support_threads for update using (
  user_id = auth.uid() or public.is_admin(auth.uid())
);

drop policy if exists support_messages_select on public.support_messages;
drop policy if exists support_messages_insert on public.support_messages;

create policy support_messages_select on public.support_messages for select using (
  exists (
    select 1 from public.support_threads t
    where t.id = thread_id and (t.user_id = auth.uid() or public.is_admin(auth.uid()))
  )
);

create policy support_messages_insert on public.support_messages for insert with check (
  exists (
    select 1 from public.support_threads t
    where t.id = thread_id and (t.user_id = auth.uid() or public.is_admin(auth.uid()))
  )
);
