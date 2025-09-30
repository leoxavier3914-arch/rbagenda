alter table public.branches
  add column if not exists owner_id uuid references public.profiles(id) on delete set null;

create index if not exists branches_owner_id_idx on public.branches(owner_id);
