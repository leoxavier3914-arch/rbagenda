-- Table to store service photos with ordering
create table if not exists public.service_photos (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services(id) on delete cascade,
  url text not null,
  order_index int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists service_photos_service_id_idx on public.service_photos(service_id, order_index);

alter table public.service_photos enable row level security;

-- Policies: public select for active/accessible services; writes restricted to super/admin with branch access
drop policy if exists service_photos_select_public on public.service_photos;
drop policy if exists service_photos_insert_branch_admin on public.service_photos;
drop policy if exists service_photos_update_branch_admin on public.service_photos;
drop policy if exists service_photos_delete_branch_admin on public.service_photos;

create policy service_photos_select_public
  on public.service_photos
  for select
  using (
    exists (
      select 1
      from public.services s
      where s.id = service_id
        and (
          s.active = true
          or s.branch_id is null
          or public.can_access_branch(auth.uid(), s.branch_id)
        )
    )
  );

create policy service_photos_insert_branch_admin
  on public.service_photos
  for insert
  with check (
    public.is_panel_admin(auth.uid())
    and exists (
      select 1
      from public.services s
      where s.id = service_id
        and (
          s.branch_id is null
          or public.can_access_branch(auth.uid(), s.branch_id)
        )
    )
  );

create policy service_photos_update_branch_admin
  on public.service_photos
  for update
  using (
    public.is_panel_admin(auth.uid())
    and exists (
      select 1
      from public.services s
      where s.id = service_id
        and (
          s.branch_id is null
          or public.can_access_branch(auth.uid(), s.branch_id)
        )
    )
  )
  with check (
    public.is_panel_admin(auth.uid())
    and exists (
      select 1
      from public.services s
      where s.id = service_id
        and (
          s.branch_id is null
          or public.can_access_branch(auth.uid(), s.branch_id)
        )
    )
  );

create policy service_photos_delete_branch_admin
  on public.service_photos
  for delete
  using (
    public.is_panel_admin(auth.uid())
    and exists (
      select 1
      from public.services s
      where s.id = service_id
        and (
          s.branch_id is null
          or public.can_access_branch(auth.uid(), s.branch_id)
        )
    )
  );
