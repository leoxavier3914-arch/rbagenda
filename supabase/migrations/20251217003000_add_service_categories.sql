-- Create editable service categories (ramos) and branch enablement
create table if not exists public.service_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text null,
  active boolean not null default true,
  order_index int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists service_categories_order_idx on public.service_categories(order_index, name);

create table if not exists public.branch_service_categories (
  branch_id uuid not null references public.branches(id) on delete cascade,
  category_id uuid not null references public.service_categories(id) on delete cascade,
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (branch_id, category_id)
);

alter table public.service_categories enable row level security;
alter table public.branch_service_categories enable row level security;

-- Policies for service categories (ramos)
drop policy if exists service_categories_select_authenticated on public.service_categories;
drop policy if exists service_categories_insert_super on public.service_categories;
drop policy if exists service_categories_update_super on public.service_categories;
drop policy if exists service_categories_delete_super on public.service_categories;

create policy service_categories_select_authenticated
  on public.service_categories
  for select
  using (auth.uid() is not null);

create policy service_categories_insert_super
  on public.service_categories
  for insert
  with check (public.is_super(auth.uid()));

create policy service_categories_update_super
  on public.service_categories
  for update
  using (public.is_super(auth.uid()))
  with check (public.is_super(auth.uid()));

create policy service_categories_delete_super
  on public.service_categories
  for delete
  using (public.is_super(auth.uid()));

-- Policies for branch/category enablement
drop policy if exists branch_service_categories_select_policy on public.branch_service_categories;
drop policy if exists branch_service_categories_insert_policy on public.branch_service_categories;
drop policy if exists branch_service_categories_update_policy on public.branch_service_categories;
drop policy if exists branch_service_categories_delete_policy on public.branch_service_categories;

create policy branch_service_categories_select_policy
  on public.branch_service_categories
  for select
  using (public.can_access_branch(auth.uid(), branch_id));

create policy branch_service_categories_insert_policy
  on public.branch_service_categories
  for insert
  with check (
    public.is_super(auth.uid())
    and public.can_access_branch(auth.uid(), branch_id)
  );

create policy branch_service_categories_update_policy
  on public.branch_service_categories
  for update
  using (
    public.is_super(auth.uid())
    and public.can_access_branch(auth.uid(), branch_id)
  )
  with check (
    public.is_super(auth.uid())
    and public.can_access_branch(auth.uid(), branch_id)
  );

create policy branch_service_categories_delete_policy
  on public.branch_service_categories
  for delete
  using (
    public.is_super(auth.uid())
    and public.can_access_branch(auth.uid(), branch_id)
  );

-- Link service types to categories
alter table public.service_types
  add column if not exists category_id uuid references public.service_categories(id) on delete set null;

create index if not exists service_types_category_id_idx on public.service_types(category_id);

-- Restrict catalog writes to super/master roles
drop policy if exists services_select_public on public.services;
drop policy if exists services_insert_branch on public.services;
drop policy if exists services_update_branch on public.services;
drop policy if exists services_delete_branch on public.services;

create policy services_select_public
  on public.services
  for select
  using (
    active = true
    or public.can_access_branch(auth.uid(), branch_id)
    or branch_id is null
  );

create policy services_insert_branch
  on public.services
  for insert
  with check (
    public.is_super(auth.uid())
    and (
      branch_id is null
      or public.can_access_branch(auth.uid(), branch_id)
    )
  );

create policy services_update_branch
  on public.services
  for update
  using (
    public.is_super(auth.uid())
    and (
      branch_id is null
      or public.can_access_branch(auth.uid(), branch_id)
    )
  )
  with check (
    public.is_super(auth.uid())
    and (
      branch_id is null
      or public.can_access_branch(auth.uid(), branch_id)
    )
  );

create policy services_delete_branch
  on public.services
  for delete
  using (
    public.is_super(auth.uid())
    and (
      branch_id is null
      or public.can_access_branch(auth.uid(), branch_id)
    )
  );

drop policy if exists service_types_select_public on public.service_types;
drop policy if exists service_types_insert_branch on public.service_types;
drop policy if exists service_types_update_branch on public.service_types;
drop policy if exists service_types_delete_branch on public.service_types;

create policy service_types_select_public
  on public.service_types
  for select
  using (
    active = true
    or branch_id is null
    or public.can_access_branch(auth.uid(), branch_id)
  );

create policy service_types_insert_branch
  on public.service_types
  for insert
  with check (
    public.is_super(auth.uid())
    and (
      branch_id is null
      or public.can_access_branch(auth.uid(), branch_id)
    )
  );

create policy service_types_update_branch
  on public.service_types
  for update
  using (
    public.is_super(auth.uid())
    and (
      branch_id is null
      or public.can_access_branch(auth.uid(), branch_id)
    )
  )
  with check (
    public.is_super(auth.uid())
    and (
      branch_id is null
      or public.can_access_branch(auth.uid(), branch_id)
    )
  );

create policy service_types_delete_branch
  on public.service_types
  for delete
  using (
    public.is_super(auth.uid())
    and (
      branch_id is null
      or public.can_access_branch(auth.uid(), branch_id)
    )
  );

drop policy if exists service_type_assignments_select_public on public.service_type_assignments;
drop policy if exists service_type_assignments_insert_branch on public.service_type_assignments;
drop policy if exists service_type_assignments_update_branch on public.service_type_assignments;
drop policy if exists service_type_assignments_delete_branch on public.service_type_assignments;

create policy service_type_assignments_select_public
  on public.service_type_assignments
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
    and exists (
      select 1
      from public.service_types st
      where st.id = service_type_id
        and (
          st.branch_id is null
          or st.active = true
          or public.can_access_branch(auth.uid(), st.branch_id)
        )
    )
  );

create policy service_type_assignments_insert_branch
  on public.service_type_assignments
  for insert
  with check (
    public.is_super(auth.uid())
    and exists (
      select 1
      from public.services s
      where s.id = service_id
        and (
          s.branch_id is null
          or public.can_access_branch(auth.uid(), s.branch_id)
        )
    )
    and exists (
      select 1
      from public.service_types st
      where st.id = service_type_id
        and (
          st.branch_id is null
          or public.can_access_branch(auth.uid(), st.branch_id)
        )
    )
  );

create policy service_type_assignments_update_branch
  on public.service_type_assignments
  for update
  using (
    public.is_super(auth.uid())
    and exists (
      select 1
      from public.services s
      where s.id = service_id
        and (
          s.branch_id is null
          or public.can_access_branch(auth.uid(), s.branch_id)
        )
    )
    and exists (
      select 1
      from public.service_types st
      where st.id = service_type_id
        and (
          st.branch_id is null
          or public.can_access_branch(auth.uid(), st.branch_id)
        )
    )
  )
  with check (
    public.is_super(auth.uid())
    and exists (
      select 1
      from public.services s
      where s.id = service_id
        and (
          s.branch_id is null
          or public.can_access_branch(auth.uid(), s.branch_id)
        )
    )
    and exists (
      select 1
      from public.service_types st
      where st.id = service_type_id
        and (
          st.branch_id is null
          or public.can_access_branch(auth.uid(), st.branch_id)
        )
    )
  );

create policy service_type_assignments_delete_branch
  on public.service_type_assignments
  for delete
  using (
    public.is_super(auth.uid())
    and exists (
      select 1
      from public.services s
      where s.id = service_id
        and (
          s.branch_id is null
          or public.can_access_branch(auth.uid(), s.branch_id)
        )
    )
    and exists (
      select 1
      from public.service_types st
      where st.id = service_type_id
        and (
          st.branch_id is null
          or public.can_access_branch(auth.uid(), st.branch_id)
        )
    )
  );
