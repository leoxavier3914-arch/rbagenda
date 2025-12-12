-- Align roles and support messaging metadata
alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('client', 'admin', 'adminsuper', 'adminmaster'));

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
          'select 1 from public.profiles where id = $1 and role in (''admin'', ''adminsuper'', ''adminmaster'')'
          ')'
    into result
    using uid;

  return result;
end;
$$;

grant execute on function public.is_admin(uuid) to public;

-- sender tracking for support messages
alter table public.support_messages
  add column if not exists sender_id uuid references public.profiles(id) on delete set null;

create index if not exists support_messages_sender_id_idx on public.support_messages(sender_id);
