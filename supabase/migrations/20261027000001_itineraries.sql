-- Reusable itineraries: a package can have several (Itinerary 1, Itinerary 2 ...), each built from days and ordered steps.
-- A departure points at the itinerary it runs. Vehicles and places are picked from a shared options list.

create type public.step_kind as enum ('pickup', 'travel', 'trek', 'activity', 'meal', 'stay', 'free_time', 'drop_off');

create table public.catalogue_options (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('vehicle', 'location')),
  label text not null check (char_length(label) between 1 and 120),
  maps_url text check (maps_url is null or maps_url ~ '^https?://'),
  created_at timestamptz not null default now(),
  unique (kind, label)
);

create table public.itineraries (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.packages (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  description text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index itineraries_package_idx on public.itineraries (package_id, sort_order);

create table public.itinerary_days (
  id uuid primary key default gen_random_uuid(),
  itinerary_id uuid not null references public.itineraries (id) on delete cascade,
  day_no int not null check (day_no > 0),
  title text not null default '',
  summary text,
  unique (itinerary_id, day_no)
);

create table public.itinerary_steps (
  id uuid primary key default gen_random_uuid(),
  day_id uuid not null references public.itinerary_days (id) on delete cascade,
  sort_order int not null default 0,
  kind public.step_kind not null,
  title text not null default '',
  description text,
  start_time time,
  end_time time,
  vehicle_id uuid references public.catalogue_options (id) on delete set null,
  location_id uuid references public.catalogue_options (id) on delete set null,
  to_location_id uuid references public.catalogue_options (id) on delete set null,
  -- Story sound scene (city, bus, forest ...). Null means pick one automatically from the kind and vehicle.
  sound text,
  created_at timestamptz not null default now()
);
create index itinerary_steps_day_idx on public.itinerary_steps (day_id, sort_order);
create index itinerary_steps_vehicle_idx on public.itinerary_steps (vehicle_id);
create index itinerary_steps_location_idx on public.itinerary_steps (location_id);
create index itinerary_steps_to_location_idx on public.itinerary_steps (to_location_id);

create table public.itinerary_step_media (
  step_id uuid not null references public.itinerary_steps (id) on delete cascade,
  media_id uuid not null references public.media (id) on delete cascade,
  sort_order int not null default 0,
  primary key (step_id, media_id)
);
create index itinerary_step_media_media_idx on public.itinerary_step_media (media_id);

alter table public.departures add column itinerary_id uuid references public.itineraries (id) on delete set null;
create index departures_itinerary_idx on public.departures (itinerary_id);

create trigger itineraries_set_updated_at before update on public.itineraries
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- RLS
alter table public.catalogue_options enable row level security;
alter table public.itineraries enable row level security;
alter table public.itinerary_days enable row level security;
alter table public.itinerary_steps enable row level security;
alter table public.itinerary_step_media enable row level security;

create policy catalogue_options_read on public.catalogue_options for select to anon, authenticated using (true);
create policy catalogue_options_write on public.catalogue_options for all to authenticated
  using (public.has_role('owner', 'manager', 'content_editor'))
  with check (public.has_role('owner', 'manager', 'content_editor'));

create policy itineraries_read on public.itineraries for select to anon, authenticated
  using (exists (select 1 from public.packages p where p.id = package_id and (p.status = 'published' or public.is_staff())));
create policy itineraries_write on public.itineraries for all to authenticated
  using (public.has_role('owner', 'manager', 'content_editor'))
  with check (public.has_role('owner', 'manager', 'content_editor'));

create policy itinerary_days_read on public.itinerary_days for select to anon, authenticated
  using (exists (
    select 1 from public.itineraries i join public.packages p on p.id = i.package_id
    where i.id = itinerary_id and (p.status = 'published' or public.is_staff())
  ));
create policy itinerary_days_write on public.itinerary_days for all to authenticated
  using (public.has_role('owner', 'manager', 'content_editor'))
  with check (public.has_role('owner', 'manager', 'content_editor'));

create policy itinerary_steps_read on public.itinerary_steps for select to anon, authenticated
  using (exists (
    select 1 from public.itinerary_days d
    join public.itineraries i on i.id = d.itinerary_id
    join public.packages p on p.id = i.package_id
    where d.id = day_id and (p.status = 'published' or public.is_staff())
  ));
create policy itinerary_steps_write on public.itinerary_steps for all to authenticated
  using (public.has_role('owner', 'manager', 'content_editor'))
  with check (public.has_role('owner', 'manager', 'content_editor'));

create policy itinerary_step_media_read on public.itinerary_step_media for select to anon, authenticated
  using (exists (
    select 1 from public.itinerary_steps s
    join public.itinerary_days d on d.id = s.day_id
    join public.itineraries i on i.id = d.itinerary_id
    join public.packages p on p.id = i.package_id
    where s.id = step_id and (p.status = 'published' or public.is_staff())
  ));
create policy itinerary_step_media_write on public.itinerary_step_media for all to authenticated
  using (public.has_role('owner', 'manager', 'content_editor'))
  with check (public.has_role('owner', 'manager', 'content_editor'));

-- ---------------------------------------------------------------- starter vehicles
insert into public.catalogue_options (kind, label) values
  ('vehicle', 'Bus'), ('vehicle', 'Jeep'), ('vehicle', 'Van'), ('vehicle', 'Tempo Traveller'),
  ('vehicle', 'Car'), ('vehicle', 'On foot')
on conflict do nothing;
