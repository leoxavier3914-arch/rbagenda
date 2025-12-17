-- Re-apply branch admin table helpers and RLS/policies to address prior deploy errors

-- Ensure branch_admins structure exists
create table if not exists public.branch_admins (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  assigned_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index if not exists branch_admins_branch_user_uniq on public.branch_admins(branch_id, user_id);
create index if not exists branch_admins_branch_id_idx on public.branch_admins(branch_id);
create index if not exists branch_admins_user_id_idx on public.branch_admins(user_id);

alter table public.branch_admins enable row level security;

-- Permission helpers
create or replace function public.is_master(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p where p.id = uid and p.role = 'adminmaster'
  );
$$;

grant execute on function public.is_master(uuid) to public;

create or replace function public.is_super(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_master(uid)
    or exists (
      select 1 from public.profiles p where p.id = uid and p.role = 'adminsuper'
    );
$$;

grant execute on function public.is_super(uuid) to public;

create or replace function public.is_panel_admin(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p where p.id = uid and p.role in ('admin', 'adminsuper', 'adminmaster')
  );
$$;

grant execute on function public.is_panel_admin(uuid) to public;

create or replace function public.can_access_branch(uid uuid, branch uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_master(uid)
    or (
      public.is_super(uid)
      and exists (
        select 1 from public.branches b where b.id = branch and b.owner_id = uid
      )
    )
    or exists (
      select 1 from public.branch_admins ba where ba.branch_id = branch and ba.user_id = uid
    );
$$;

grant execute on function public.can_access_branch(uuid, uuid) to public;

create or replace function public.is_admin(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_panel_admin(uid);
$$;

grant execute on function public.is_admin(uuid) to public;

-- Branch admin policies
drop policy if exists branch_admins_select_policy on public.branch_admins;
drop policy if exists branch_admins_insert_policy on public.branch_admins;
drop policy if exists branch_admins_delete_policy on public.branch_admins;

create policy branch_admins_select_policy
  on public.branch_admins
  for select
  using (
    user_id = auth.uid()
    or public.is_master(auth.uid())
    or (
      public.is_super(auth.uid())
      and exists (select 1 from public.branches b where b.id = branch_id and b.owner_id = auth.uid())
    )
  );

create policy branch_admins_insert_policy
  on public.branch_admins
  for insert
  with check (
    public.is_master(auth.uid())
    or (
      public.is_super(auth.uid())
      and exists (select 1 from public.branches b where b.id = branch_id and b.owner_id = auth.uid())
    )
  );

create policy branch_admins_delete_policy
  on public.branch_admins
  for delete
  using (
    public.is_master(auth.uid())
    or (
      public.is_super(auth.uid())
      and exists (select 1 from public.branches b where b.id = branch_id and b.owner_id = auth.uid())
    )
  );

-- Support policies (recreated to ensure helpers exist before usage)
drop policy if exists support_threads_select on public.support_threads;
drop policy if exists support_threads_insert on public.support_threads;
drop policy if exists support_threads_update on public.support_threads;

drop policy if exists support_messages_select on public.support_messages;
drop policy if exists support_messages_insert on public.support_messages;

drop policy if exists profiles_admin_access on public.profiles;
create policy profiles_admin_access
  on public.profiles
  for select
  using (public.is_admin(auth.uid()));

create policy support_threads_select
  on public.support_threads
  for select
  using (
    user_id = auth.uid()
    or public.can_access_branch(auth.uid(), branch_id)
    or (branch_id is null and public.is_master(auth.uid()))
  );

create policy support_threads_insert
  on public.support_threads
  for insert
  with check (
    user_id = auth.uid()
    or public.can_access_branch(auth.uid(), branch_id)
    or (branch_id is null and public.is_master(auth.uid()))
  );

create policy support_threads_update
  on public.support_threads
  for update
  using (
    user_id = auth.uid()
    or public.can_access_branch(auth.uid(), branch_id)
    or (branch_id is null and public.is_master(auth.uid()))
  );

create policy support_messages_select
  on public.support_messages
  for select
  using (
    exists (
      select 1 from public.support_threads t
      where t.id = thread_id
        and (
          t.user_id = auth.uid()
          or public.can_access_branch(auth.uid(), t.branch_id)
          or (t.branch_id is null and public.is_master(auth.uid()))
        )
    )
  );

create policy support_messages_insert
  on public.support_messages
  for insert
  with check (
    exists (
      select 1 from public.support_threads t
      where t.id = thread_id
        and (
          t.user_id = auth.uid()
          or public.can_access_branch(auth.uid(), t.branch_id)
          or (t.branch_id is null and public.is_master(auth.uid()))
        )
    )
  );
