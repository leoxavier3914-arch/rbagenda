-- Create storage bucket for service photos
insert into storage.buckets (id, name, public)
values ('service-photos', 'service-photos', false)
on conflict (id) do update set
  name = excluded.name,
  public = excluded.public;

-- Policies for service photos bucket
alter table storage.objects enable row level security;

drop policy if exists service_photos_public_select on storage.objects;
drop policy if exists service_photos_admin_insert on storage.objects;
drop policy if exists service_photos_admin_update on storage.objects;
drop policy if exists service_photos_admin_delete on storage.objects;

-- Allow public read access to service photos
create policy service_photos_public_select
  on storage.objects
  for select
  using (bucket_id = 'service-photos');

-- Allow panel admins to upload new service photos
create policy service_photos_admin_insert
  on storage.objects
  for insert
  with check (
    bucket_id = 'service-photos'
    and public.is_panel_admin(auth.uid())
  );

-- Allow panel admins to replace metadata/files
create policy service_photos_admin_update
  on storage.objects
  for update
  using (
    bucket_id = 'service-photos'
    and public.is_panel_admin(auth.uid())
  )
  with check (
    bucket_id = 'service-photos'
    and public.is_panel_admin(auth.uid())
  );

-- Allow panel admins to delete service photos
create policy service_photos_admin_delete
  on storage.objects
  for delete
  using (
    bucket_id = 'service-photos'
    and public.is_panel_admin(auth.uid())
  );
