-- Hosts as vendors. A host signs in to the admin, writes their own trip and itinerary, and submits it. They cannot set a price
-- or publish: an admin reviews, sets the price and publishes. A host sees only their own trips and nobody else's data.

-- ---------------------------------------------------------------- who is who
-- "Staff" now means the admin side only. Hosts are in the same table (they sign in the same way) but never count as staff,
-- so no existing rule that says "staff can read this" ever lets a host in.
create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.staff where id = auth.uid() and active and role <> 'host');
$$;

create function public.is_host() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.staff where id = auth.uid() and active and role = 'host');
$$;

alter table public.hosts add column staff_id uuid unique references public.staff (id) on delete set null;

create function public.my_host_id() returns uuid
language sql stable security definer set search_path = public as $$
  select h.id from public.hosts h join public.staff s on s.id = h.staff_id
  where h.staff_id = auth.uid() and s.active and s.role = 'host';
$$;

-- ---------------------------------------------------------------- trips belong to a host and go through review
alter table public.packages
  add column host_id uuid references public.hosts (id) on delete set null,
  add column review_state text not null default 'approved'
    check (review_state in ('draft', 'submitted', 'changes_requested', 'approved')),
  add column review_note text check (review_note is null or char_length(review_note) <= 1000);
create index packages_host_idx on public.packages (host_id);

-- Ownership checks, written as functions so the rules below stay short and cannot loop into each other.
create function public.host_owns_package(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.packages p where p.id = pid and p.host_id is not null and p.host_id = public.my_host_id());
$$;
create function public.host_can_edit_package(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.packages p
    where p.id = pid and p.host_id is not null and p.host_id = public.my_host_id()
      and p.review_state in ('draft', 'changes_requested')
  );
$$;
create function public.host_owns_itinerary(iid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.itineraries i where i.id = iid and public.host_owns_package(i.package_id));
$$;
create function public.host_can_edit_itinerary(iid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.itineraries i where i.id = iid and public.host_can_edit_package(i.package_id));
$$;
create function public.host_owns_day(did uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.itinerary_days d where d.id = did and public.host_owns_itinerary(d.itinerary_id));
$$;
create function public.host_can_edit_day(did uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.itinerary_days d where d.id = did and public.host_can_edit_itinerary(d.itinerary_id));
$$;
create function public.host_owns_step(sid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.itinerary_steps s where s.id = sid and public.host_owns_day(s.day_id));
$$;
create function public.host_can_edit_step(sid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.itinerary_steps s where s.id = sid and public.host_can_edit_day(s.day_id));
$$;

revoke all on function
  public.is_host(), public.my_host_id(), public.host_owns_package(uuid), public.host_can_edit_package(uuid),
  public.host_owns_itinerary(uuid), public.host_can_edit_itinerary(uuid), public.host_owns_day(uuid), public.host_can_edit_day(uuid),
  public.host_owns_step(uuid), public.host_can_edit_step(uuid)
from public, anon;
grant execute on function
  public.is_host(), public.my_host_id(), public.host_owns_package(uuid), public.host_can_edit_package(uuid),
  public.host_owns_itinerary(uuid), public.host_can_edit_itinerary(uuid), public.host_owns_day(uuid), public.host_can_edit_day(uuid),
  public.host_owns_step(uuid), public.host_can_edit_step(uuid)
to authenticated;

-- ---------------------------------------------------------------- packages: a host reads and edits only their own, until they submit
create policy packages_host_select on public.packages for select to authenticated
  using (host_id is not null and host_id = public.my_host_id());
create policy packages_host_insert on public.packages for insert to authenticated
  with check (public.is_host() and host_id = public.my_host_id());
create policy packages_host_update on public.packages for update to authenticated
  using (host_id = public.my_host_id() and review_state in ('draft', 'changes_requested'))
  with check (host_id = public.my_host_id());
create policy packages_host_delete on public.packages for delete to authenticated
  using (host_id = public.my_host_id() and review_state = 'draft' and status = 'draft');

-- Whatever a host sends, these columns stay under admin control: the price, publishing, the owner and the review note.
-- A host can move a trip only from draft (or sent back) to submitted.
create function public.packages_host_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_host() then return new; end if;
  if tg_op = 'INSERT' then
    new.host_id := public.my_host_id();
    new.status := 'draft';
    new.review_state := 'draft';
    new.review_note := null;
    new.base_price_paise := null;
    return new;
  end if;
  new.host_id := old.host_id;
  new.status := old.status;
  new.base_price_paise := old.base_price_paise;
  new.review_note := old.review_note;
  if new.review_state is distinct from old.review_state
     and not (new.review_state = 'submitted' and old.review_state in ('draft', 'changes_requested')) then
    raise exception 'A host can only submit a trip for review' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger packages_host_guard before insert or update on public.packages
  for each row execute function public.packages_host_guard();

-- ---------------------------------------------------------------- dates: a host proposes dates and seats, never a price
create policy departures_host_select on public.departures for select to authenticated
  using (public.host_owns_package(package_id));
create policy departures_host_write on public.departures for all to authenticated
  using (public.host_can_edit_package(package_id)) with check (public.host_can_edit_package(package_id));

create function public.departures_host_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_host() then return new; end if;
  new.host_id := public.my_host_id();
  if tg_op = 'INSERT' then
    new.price_override_paise := null;
    new.status := 'open';
  else
    new.price_override_paise := old.price_override_paise;
    new.status := old.status;
  end if;
  return new;
end;
$$;
create trigger departures_host_guard before insert or update on public.departures
  for each row execute function public.departures_host_guard();

-- ---------------------------------------------------------------- itinerary: read and write on their own trip
create policy itineraries_host_select on public.itineraries for select to authenticated using (public.host_owns_package(package_id));
create policy itineraries_host_write on public.itineraries for all to authenticated
  using (public.host_can_edit_package(package_id)) with check (public.host_can_edit_package(package_id));

create policy itinerary_days_host_select on public.itinerary_days for select to authenticated using (public.host_owns_itinerary(itinerary_id));
create policy itinerary_days_host_write on public.itinerary_days for all to authenticated
  using (public.host_can_edit_itinerary(itinerary_id)) with check (public.host_can_edit_itinerary(itinerary_id));

create policy itinerary_steps_host_select on public.itinerary_steps for select to authenticated using (public.host_owns_day(day_id));
create policy itinerary_steps_host_write on public.itinerary_steps for all to authenticated
  using (public.host_can_edit_day(day_id)) with check (public.host_can_edit_day(day_id));

create policy itinerary_step_media_host_select on public.itinerary_step_media for select to authenticated using (public.host_owns_step(step_id));
create policy itinerary_step_media_host_write on public.itinerary_step_media for all to authenticated
  using (public.host_can_edit_step(step_id)) with check (public.host_can_edit_step(step_id));

create policy itinerary_step_stops_host_select on public.itinerary_step_stops for select to authenticated using (public.host_owns_step(step_id));
create policy itinerary_step_stops_host_write on public.itinerary_step_stops for all to authenticated
  using (public.host_can_edit_step(step_id)) with check (public.host_can_edit_step(step_id));

-- ---------------------------------------------------------------- photos: a host adds pictures and removes only their own
alter table public.media alter column uploaded_by set default auth.uid();
create policy media_host_insert on public.media for insert to authenticated with check (public.is_host());
create policy media_host_update on public.media for update to authenticated
  using (public.is_host() and uploaded_by = auth.uid()) with check (public.is_host() and uploaded_by = auth.uid());
create policy media_host_delete on public.media for delete to authenticated
  using (public.is_host() and uploaded_by = auth.uid());

create policy public_media_host_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'public-media' and public.is_host()
    and (name like 'itinerary/%' or name like 'hosts/' || coalesce(public.my_host_id()::text, 'none') || '/%')
  );
create policy public_media_host_modify on storage.objects for update to authenticated
  using (bucket_id = 'public-media' and public.is_host() and owner_id = auth.uid()::text);
create policy public_media_host_remove on storage.objects for delete to authenticated
  using (bucket_id = 'public-media' and public.is_host() and owner_id = auth.uid()::text);

-- ---------------------------------------------------------------- a host's own profile
create policy hosts_self_select on public.hosts for select to authenticated using (staff_id = auth.uid());
create policy hosts_self_update on public.hosts for update to authenticated
  using (staff_id = auth.uid()) with check (staff_id = auth.uid());

create function public.hosts_host_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_host() then return new; end if;
  new.staff_id := old.staff_id;
  new.status := old.status;
  new.slug := old.slug;
  new.sort_order := old.sort_order;
  new.is_sample := old.is_sample;
  return new;
end;
$$;
create trigger hosts_host_guard before update on public.hosts
  for each row execute function public.hosts_host_guard();

-- ---------------------------------------------------------------- who is going: a host also sees the group on their own trip
create or replace function public.departure_travellers(p_departure_id uuid)
returns table (first_name text, instagram text, age int, is_you boolean)
language sql stable security definer set search_path = public as $$
  select
    split_part(c.full_name, ' ', 1),
    c.instagram,
    case when c.date_of_birth is null then null else extract(year from age(c.date_of_birth))::int end,
    c.auth_user_id is not distinct from auth.uid()
  from public.bookings b
  join public.customers c on c.id = b.customer_id
  where b.departure_id = p_departure_id
    and b.status in ('confirmed', 'completed')
    and (
      public.is_staff()
      or exists (
        select 1 from public.departures d
        where d.id = p_departure_id and public.host_owns_package(d.package_id)
      )
      or exists (
        select 1
        from public.bookings mb
        join public.customers mc on mc.id = mb.customer_id
        where mb.departure_id = p_departure_id
          and mb.status in ('confirmed', 'completed')
          and mc.auth_user_id = auth.uid()
      )
    )
  order by b.created_at;
$$;
