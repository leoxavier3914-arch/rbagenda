-- Add branch scoping to support threads
alter table public.support_threads
  add column if not exists branch_id uuid references public.branches(id) on delete set null;

create index if not exists support_threads_branch_id_idx on public.support_threads(branch_id);

-- Backfill branch_id using most recent appointment per customer
update public.support_threads st
set branch_id = sub.branch_id
from (
  select a.customer_id, (array_agg(a.branch_id order by a.created_at desc))[1] as branch_id
  from public.appointments a
  where a.branch_id is not null
  group by a.customer_id
) sub
where st.branch_id is null
  and st.user_id = sub.customer_id;
