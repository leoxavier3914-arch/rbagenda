-- Update support RLS to respect branch scoping

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
