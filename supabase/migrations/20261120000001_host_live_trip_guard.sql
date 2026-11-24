-- A host edits a trip only while it is unpublished (draft, or sent back). A live trip can have bookings that a host cannot see.
create or replace function public.host_can_edit_package(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.packages p
    where p.id = pid and p.host_id is not null and p.host_id = public.my_host_id()
      and p.status = 'draft'
      and p.review_state in ('draft', 'changes_requested')
  );
$$;

-- Nobody deletes a date that has bookings: cancel it instead, so the bookings keep their trip.
create function public.departures_keep_booked() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.bookings where departure_id = old.id) then
    raise exception 'This date has bookings. Cancel it instead of deleting it.' using errcode = '23503';
  end if;
  return old;
end;
$$;
create trigger departures_keep_booked before delete on public.departures
  for each row execute function public.departures_keep_booked();
