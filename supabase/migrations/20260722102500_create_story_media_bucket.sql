insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'story-media',
  'story-media',
  true,
  52428800,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/heic',
    'image/heif',
    'image/avif',
    'video/mp4',
    'video/quicktime',
    'video/webm',
    'video/3gpp'
  ]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Members upload their own story media'
  ) then
    create policy "Members upload their own story media"
      on storage.objects
      for insert
      to authenticated
      with check (
        bucket_id = 'story-media'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Members update their own story media'
  ) then
    create policy "Members update their own story media"
      on storage.objects
      for update
      to authenticated
      using (
        bucket_id = 'story-media'
        and (storage.foldername(name))[1] = auth.uid()::text
      )
      with check (
        bucket_id = 'story-media'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;
end
$$;
