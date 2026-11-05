-- A pick-up can happen at several places, each at its own time (Hebbal 9:30 pm, Silk Board 10:00 pm ...).

create table public.itinerary_step_stops (
  id uuid primary key default gen_random_uuid(),
  step_id uuid not null references public.itinerary_steps (id) on delete cascade,
  sort_order int not null default 0,
  location_id uuid not null references public.catalogue_options (id) on delete restrict,
  stop_time time
);
create index itinerary_step_stops_step_idx on public.itinerary_step_stops (step_id, sort_order);
create index itinerary_step_stops_location_idx on public.itinerary_step_stops (location_id);

alter table public.itinerary_step_stops enable row level security;

create policy itinerary_step_stops_read on public.itinerary_step_stops for select to anon, authenticated
  using (exists (
    select 1 from public.itinerary_steps s
    join public.itinerary_days d on d.id = s.day_id
    join public.itineraries i on i.id = d.itinerary_id
    join public.packages p on p.id = i.package_id
    where s.id = step_id and (p.status = 'published' or public.is_staff())
  ));
create policy itinerary_step_stops_write on public.itinerary_step_stops for all to authenticated
  using (public.has_role('owner', 'manager', 'content_editor'))
  with check (public.has_role('owner', 'manager', 'content_editor'));

-- Existing pick-up steps keep their single place as the first stop.
insert into public.itinerary_step_stops (step_id, location_id, stop_time)
select id, location_id, start_time from public.itinerary_steps where kind = 'pickup' and location_id is not null;
