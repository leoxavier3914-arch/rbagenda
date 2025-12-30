-- Fix policies for service-photos bucket: read only for authenticated users

drop policy if exists service_photos_public_select on storage.objects;
drop policy if exists service_photos_select_authenticated on storage.objects;

drop policy if exists service_photos_admin_insert on storage.objects;
drop policy if exists service_photos_admin_update on storage.objects;
drop policy if exists service_photos_admin_delete on storage.objects;

-- SELECT: only authenticated users can read
create policy service_photos_select_authenticated
  on storage.objects
  for select
  using (
    bucket_id = 'service-photos'
    and auth.role() = 'authenticated'
  );

-- INSERT: only panel admins can upload
create policy service_photos_admin_insert
  on storage.objects
  for insert
  with check (
    bucket_id = 'service-photos'
    and public.is_panel_admin(auth.uid())
  );

-- UPDATE: only panel admins can update/replace files
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

-- DELETE: only panel admins can delete files
create policy service_photos_admin_delete
  on storage.objects
  for delete
  using (
    bucket_id = 'service-photos'
    and public.is_panel_admin(auth.uid())
  );
