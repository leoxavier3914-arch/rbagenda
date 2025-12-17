-- Patch RLS leaks for branch-scoped tables

-- Blackouts: remove public read leak and enforce branch scope
drop policy if exists blackouts_select_public on public.blackouts;
drop policy if exists blackouts_select_admin_scope on public.blackouts;

create policy blackouts_select_admin_scope
  on public.blackouts for select
  using (public.can_access_branch(auth.uid(), branch_id));

-- Service type assignments: require both service and type to be accessible
drop policy if exists service_type_assignments_select_public on public.service_type_assignments;

create policy service_type_assignments_select_public
  on public.service_type_assignments for select
  using (
    exists (
      select 1 from public.services s
      where s.id = service_id
        and (s.active = true or public.can_access_branch(auth.uid(), s.branch_id))
    )
    and exists (
      select 1 from public.service_types st
      where st.id = service_type_id
        and (st.branch_id is null or st.active = true or public.can_access_branch(auth.uid(), st.branch_id))
    )
  );
