-- Base values now live in service_types
alter table public.service_types
  add column if not exists base_duration_min int not null default 0,
  add column if not exists base_price_cents int not null default 0,
  add column if not exists base_deposit_cents int not null default 0,
  add column if not exists base_buffer_min int not null default 0;

-- Overrides per vínculo (service + option)
alter table public.service_type_assignments
  add column if not exists use_service_defaults boolean not null default true,
  add column if not exists override_duration_min int null,
  add column if not exists override_price_cents int null,
  add column if not exists override_deposit_cents int null,
  add column if not exists override_buffer_min int null;
