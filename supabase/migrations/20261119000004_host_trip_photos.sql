-- A host adds photos to their own trip's gallery while the trip is still theirs to edit.
create policy package_media_host_select on public.package_media for select to authenticated
  using (public.host_owns_package(package_id));
create policy package_media_host_write on public.package_media for all to authenticated
  using (public.host_can_edit_package(package_id)) with check (public.host_can_edit_package(package_id));

-- Trip gallery pictures are stored under packages/<trip id>/..., next to the itinerary/ and hosts/ folders.
drop policy public_media_host_insert on storage.objects;
create policy public_media_host_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'public-media' and public.is_host()
    and (
      name like 'itinerary/%'
      or name like 'packages/%'
      or name like 'hosts/' || coalesce(public.my_host_id()::text, 'none') || '/%'
    )
  );
