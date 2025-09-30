-- Adds adminmaster role and updates admin detection
alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('client', 'admin', 'adminmaster'));

create or replace function public.is_admin(uid uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result boolean;
begin
  execute 'select exists(' ||
          'select 1 from public.profiles where id = $1 and role in (''admin'', ''adminmaster'')'
          ')'
    into result
    using uid;

  return result;
end;
$$;

grant execute on function public.is_admin(uuid) to public;

alter policy profiles_self on public.profiles using (
  auth.uid() = id or public.is_admin(auth.uid())
);

alter policy profiles_self_insert on public.profiles with check (
  auth.uid() = id or public.is_admin(auth.uid())
);

alter policy appt_select on public.appointments using (
  customer_id = auth.uid() or public.is_admin(auth.uid())
);

alter policy appt_insert on public.appointments with check (
  customer_id = auth.uid() or public.is_admin(auth.uid())
);
