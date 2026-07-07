-- Supabase Storage setup for user avatars and uploaded message images.
-- Avatar uploads use: seeday-images/{user_id}/avatars/profile.jpg

begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'seeday-images',
  'seeday-images',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set
  public = true,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "seeday_images_public_read" on storage.objects;
create policy "seeday_images_public_read"
  on storage.objects
  for select
  using (bucket_id = 'seeday-images');

drop policy if exists "seeday_images_insert_own_folder" on storage.objects;
create policy "seeday_images_insert_own_folder"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'seeday-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "seeday_images_update_own_folder" on storage.objects;
create policy "seeday_images_update_own_folder"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'seeday-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  )
  with check (
    bucket_id = 'seeday-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "seeday_images_delete_own_folder" on storage.objects;
create policy "seeday_images_delete_own_folder"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'seeday-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

commit;
