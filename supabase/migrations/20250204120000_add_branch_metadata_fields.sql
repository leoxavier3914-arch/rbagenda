-- Add metadata fields to branches to support admin filiais page
alter table public.branches
  add column if not exists region text,
  add column if not exists focus text,
  add column if not exists status text not null default 'ativa' check (status in ('ativa', 'pausada')),
  add column if not exists staff_slots int not null default 0 check (staff_slots >= 0);

