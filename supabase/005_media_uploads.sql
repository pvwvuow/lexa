-- Lexa 005: image uploads (avatars, course covers, centre logos)
-- Safe to run more than once. Run in the Supabase SQL editor after 002-004.
--
-- Uploads failed because builds up to 0.10.19 send "x-upsert: true": Storage then
-- needs a SELECT policy on storage.objects too, and 002 only had insert/update/delete.
-- Newer builds no longer upsert; this script fixes the builds already installed.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('lexa-media', 'lexa-media', true, 4194304,
        array['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "lexa media read own" on storage.objects;
create policy "lexa media read own" on storage.objects for select to authenticated
  using (bucket_id = 'lexa-media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "lexa media insert own" on storage.objects;
create policy "lexa media insert own" on storage.objects for insert to authenticated
  with check (bucket_id = 'lexa-media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "lexa media update own" on storage.objects;
create policy "lexa media update own" on storage.objects for update to authenticated
  using (bucket_id = 'lexa-media' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'lexa-media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "lexa media delete own" on storage.objects;
create policy "lexa media delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'lexa-media' and (storage.foldername(name))[1] = auth.uid()::text);
