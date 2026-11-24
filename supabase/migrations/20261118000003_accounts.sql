-- Traveller accounts: a customer row gains the details shown to the other people on a trip.
-- Date of birth and phone stay private (a customer reads only their own row). Fellow travellers see only
-- first name, age and Instagram, through departure_travellers() below.
alter table public.customers
  add column date_of_birth date check (date_of_birth is null or date_of_birth between date '1900-01-01' and current_date),
  add column instagram text check (instagram is null or instagram ~ '^[A-Za-z0-9._]{1,30}$');

-- Who is going on a departure. Only people confirmed on that same departure (and staff) get a list;
-- everyone else gets nothing, and the public site shows the seat count instead.
create function public.departure_travellers(p_departure_id uuid)
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

revoke all on function public.departure_travellers(uuid) from public, anon;
grant execute on function public.departure_travellers(uuid) to authenticated;
