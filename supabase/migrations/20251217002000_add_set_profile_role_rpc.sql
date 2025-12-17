-- Secure role management via RPC
set local search_path = public;

create or replace function public.set_profile_role(target_user_id uuid, new_role text)
returns void
language plpgsql
security definer
as $$
declare
  caller_role text;
begin
  if auth.uid() is null then
    raise exception 'A sessão não foi encontrada para alterar o cargo.';
  end if;

  if new_role not in ('client', 'admin', 'adminsuper', 'adminmaster') then
    raise exception 'Cargo inválido.';
  end if;

  select role into caller_role
  from public.profiles
  where id = auth.uid();

  if caller_role is null then
    raise exception 'Permissões insuficientes.';
  end if;

  if caller_role = 'admin' then
    raise exception 'Administradores não podem alterar cargos.';
  end if;

  if caller_role = 'adminsuper' and new_role in ('adminsuper', 'adminmaster') then
    raise exception 'Admin super não pode promover para este cargo.';
  end if;

  update public.profiles
  set role = new_role
  where id = target_user_id;
end;
$$;

grant execute on function public.set_profile_role(uuid, text) to authenticated;
