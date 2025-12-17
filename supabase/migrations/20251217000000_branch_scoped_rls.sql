-- Enforce branch-scoped RLS across catalog and operational tables

-- Enable RLS on branch-scoped tables
alter table public.branches enable row level security;
alter table public.services enable row level security;
alter table public.service_types enable row level security;
alter table public.service_type_assignments enable row level security;
alter table public.staff enable row level security;
alter table public.business_hours enable row level security;
alter table public.staff_hours enable row level security;
alter table public.blackouts enable row level security;
alter table public.payments enable row level security;
alter table public.reminders enable row level security;
alter table public.webhook_events enable row level security;
-- appointments already had RLS enabled; policies updated below

-- Catalog policies (public read, branch-admin write)
-- services
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
  with check (public.can_access_branch(auth.uid(), branch_id));

create policy services_update_branch
  on public.services
  for update
  using (public.can_access_branch(auth.uid(), branch_id))
  with check (public.can_access_branch(auth.uid(), branch_id));

create policy services_delete_branch
  on public.services
  for delete
  using (public.can_access_branch(auth.uid(), branch_id));

-- service_types
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
  with check (public.can_access_branch(auth.uid(), branch_id));

create policy service_types_update_branch
  on public.service_types
  for update
  using (public.can_access_branch(auth.uid(), branch_id))
  with check (public.can_access_branch(auth.uid(), branch_id));

create policy service_types_delete_branch
  on public.service_types
  for delete
  using (public.can_access_branch(auth.uid(), branch_id));

-- service_type_assignments
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
        and (s.active = true or public.can_access_branch(auth.uid(), s.branch_id))
    )
    or exists (
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
    exists (
      select 1
      from public.services s
      where s.id = service_id
        and public.can_access_branch(auth.uid(), s.branch_id)
    )
  );

create policy service_type_assignments_update_branch
  on public.service_type_assignments
  for update
  using (
    exists (
      select 1
      from public.services s
      where s.id = service_id
        and public.can_access_branch(auth.uid(), s.branch_id)
    )
  )
  with check (
    exists (
      select 1
      from public.services s
      where s.id = service_id
        and public.can_access_branch(auth.uid(), s.branch_id)
    )
  );

create policy service_type_assignments_delete_branch
  on public.service_type_assignments
  for delete
  using (
    exists (
      select 1
      from public.services s
      where s.id = service_id
        and public.can_access_branch(auth.uid(), s.branch_id)
    )
  );

-- staff
drop policy if exists staff_select_public on public.staff;
drop policy if exists staff_insert_branch on public.staff;
drop policy if exists staff_update_branch on public.staff;
drop policy if exists staff_delete_branch on public.staff;

create policy staff_select_public
  on public.staff
  for select
  using (
    active = true
    or public.can_access_branch(auth.uid(), branch_id)
  );

create policy staff_insert_branch
  on public.staff
  for insert
  with check (public.can_access_branch(auth.uid(), branch_id));

create policy staff_update_branch
  on public.staff
  for update
  using (public.can_access_branch(auth.uid(), branch_id))
  with check (public.can_access_branch(auth.uid(), branch_id));

create policy staff_delete_branch
  on public.staff
  for delete
  using (public.can_access_branch(auth.uid(), branch_id));

-- business_hours
drop policy if exists business_hours_select_public on public.business_hours;
drop policy if exists business_hours_insert_branch on public.business_hours;
drop policy if exists business_hours_update_branch on public.business_hours;
drop policy if exists business_hours_delete_branch on public.business_hours;

create policy business_hours_select_public
  on public.business_hours
  for select
  using (true);

create policy business_hours_insert_branch
  on public.business_hours
  for insert
  with check (public.can_access_branch(auth.uid(), branch_id));

create policy business_hours_update_branch
  on public.business_hours
  for update
  using (public.can_access_branch(auth.uid(), branch_id))
  with check (public.can_access_branch(auth.uid(), branch_id));

create policy business_hours_delete_branch
  on public.business_hours
  for delete
  using (public.can_access_branch(auth.uid(), branch_id));

-- staff_hours (scoped via staff.branch_id)
drop policy if exists staff_hours_select_public on public.staff_hours;
drop policy if exists staff_hours_insert_branch on public.staff_hours;
drop policy if exists staff_hours_update_branch on public.staff_hours;
drop policy if exists staff_hours_delete_branch on public.staff_hours;

create policy staff_hours_select_public
  on public.staff_hours
  for select
  using (
    exists (
      select 1
      from public.staff s
      where s.id = staff_hours.staff_id
        and (s.active = true or public.can_access_branch(auth.uid(), s.branch_id))
    )
  );

create policy staff_hours_insert_branch
  on public.staff_hours
  for insert
  with check (
    exists (
      select 1
      from public.staff s
      where s.id = staff_hours.staff_id
        and public.can_access_branch(auth.uid(), s.branch_id)
    )
  );

create policy staff_hours_update_branch
  on public.staff_hours
  for update
  using (
    exists (
      select 1
      from public.staff s
      where s.id = staff_hours.staff_id
        and public.can_access_branch(auth.uid(), s.branch_id)
    )
  )
  with check (
    exists (
      select 1
      from public.staff s
      where s.id = staff_hours.staff_id
        and public.can_access_branch(auth.uid(), s.branch_id)
    )
  );

create policy staff_hours_delete_branch
  on public.staff_hours
  for delete
  using (
    exists (
      select 1
      from public.staff s
      where s.id = staff_hours.staff_id
        and public.can_access_branch(auth.uid(), s.branch_id)
    )
  );

-- blackouts
drop policy if exists blackouts_select_public on public.blackouts;
drop policy if exists blackouts_insert_branch on public.blackouts;
drop policy if exists blackouts_update_branch on public.blackouts;
drop policy if exists blackouts_delete_branch on public.blackouts;

create policy blackouts_select_public
  on public.blackouts
  for select
  using (
    public.can_access_branch(auth.uid(), branch_id)
    or auth.uid() is not null
  );

create policy blackouts_insert_branch
  on public.blackouts
  for insert
  with check (public.can_access_branch(auth.uid(), branch_id));

create policy blackouts_update_branch
  on public.blackouts
  for update
  using (public.can_access_branch(auth.uid(), branch_id))
  with check (public.can_access_branch(auth.uid(), branch_id));

create policy blackouts_delete_branch
  on public.blackouts
  for delete
  using (public.can_access_branch(auth.uid(), branch_id));

-- Branch policies
drop policy if exists branches_select_public on public.branches;
drop policy if exists branches_insert_master on public.branches;
drop policy if exists branches_update_admins on public.branches;
drop policy if exists branches_delete_master on public.branches;

create policy branches_select_public
  on public.branches
  for select
  using (true);

create policy branches_insert_master
  on public.branches
  for insert
  with check (public.is_master(auth.uid()));

create policy branches_update_admins
  on public.branches
  for update
  using (
    public.is_master(auth.uid())
    or (public.is_super(auth.uid()) and owner_id = auth.uid())
  )
  with check (
    public.is_master(auth.uid())
    or (public.is_super(auth.uid()) and owner_id = auth.uid())
  );

create policy branches_delete_master
  on public.branches
  for delete
  using (public.is_master(auth.uid()));

-- Appointments (branch-aware access)
drop policy if exists appt_select on public.appointments;
drop policy if exists appt_insert on public.appointments;
drop policy if exists appt_update on public.appointments;
drop policy if exists appt_delete on public.appointments;

create policy appt_select
  on public.appointments
  for select
  using (
    customer_id = auth.uid()
    or public.can_access_branch(auth.uid(), branch_id)
  );

create policy appt_insert
  on public.appointments
  for insert
  with check (
    customer_id = auth.uid()
    or public.can_access_branch(auth.uid(), branch_id)
  );

create policy appt_update
  on public.appointments
  for update
  using (
    customer_id = auth.uid()
    or public.can_access_branch(auth.uid(), branch_id)
  )
  with check (
    customer_id = auth.uid()
    or public.can_access_branch(auth.uid(), branch_id)
  );

create policy appt_delete
  on public.appointments
  for delete
  using (public.can_access_branch(auth.uid(), branch_id));

-- Payments: select via appointment ownership/branch access (writes via service role)
drop policy if exists payments_select_branch_scope on public.payments;

create policy payments_select_branch_scope
  on public.payments
  for select
  using (
    exists (
      select 1
      from public.appointments a
      where a.id = payments.appointment_id
        and (
          a.customer_id = auth.uid()
          or public.can_access_branch(auth.uid(), a.branch_id)
        )
    )
  );

-- Reminders: select via appointment ownership/branch access
drop policy if exists reminders_select_branch_scope on public.reminders;

create policy reminders_select_branch_scope
  on public.reminders
  for select
  using (
    exists (
      select 1
      from public.appointments a
      where a.id = reminders.appointment_id
        and (
          a.customer_id = auth.uid()
          or public.can_access_branch(auth.uid(), a.branch_id)
        )
    )
  );

-- Webhook events: master-only visibility
drop policy if exists webhook_events_select_master on public.webhook_events;

create policy webhook_events_select_master
  on public.webhook_events
  for select
  using (public.is_master(auth.uid()));
