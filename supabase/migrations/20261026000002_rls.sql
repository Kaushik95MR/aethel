-- Row Level Security: default deny, then explicit policies per role.
-- Role is read from public.staff at query time (not from JWT claims) so role changes apply immediately.

-- ---------------------------------------------------------------- helpers
create function public.staff_role() returns public.staff_role
language sql stable security definer set search_path = public as $$
  select role from public.staff where id = auth.uid() and active;
$$;

create function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.staff where id = auth.uid() and active);
$$;

create function public.has_role(variadic roles public.staff_role[]) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.staff where id = auth.uid() and active and role = any (roles)
  );
$$;

create function public.current_customer_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.customers where auth_user_id = auth.uid();
$$;

revoke all on function public.staff_role(), public.is_staff(), public.has_role(public.staff_role[]), public.current_customer_id() from public;
grant execute on function public.staff_role(), public.is_staff(), public.has_role(public.staff_role[]), public.current_customer_id() to anon, authenticated;
grant execute on function public.seats_left(uuid) to anon, authenticated;

-- ---------------------------------------------------------------- enable RLS everywhere
alter table public.staff enable row level security;
alter table public.customers enable row level security;
alter table public.media enable row level security;
alter table public.destinations enable row level security;
alter table public.packages enable row level security;
alter table public.package_destinations enable row level security;
alter table public.package_days enable row level security;
alter table public.departures enable row level security;
alter table public.package_media enable row level security;
alter table public.destination_media enable row level security;
alter table public.enquiries enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_items enable row level security;
alter table public.travellers enable row level security;
alter table public.itinerary_documents enable row level security;
alter table public.booking_events enable row level security;
alter table public.payments enable row level security;
alter table public.refunds enable row level security;
alter table public.payment_events enable row level security;
alter table public.audit_log enable row level security;
alter table public.email_outbox enable row level security;
-- payment_events and email_outbox intentionally have no policies: service role only.

-- ---------------------------------------------------------------- staff
create policy staff_select on public.staff for select to authenticated
  using (id = (select auth.uid()) or public.has_role('owner', 'manager'));
create policy staff_owner_write on public.staff for all to authenticated
  using (public.has_role('owner')) with check (public.has_role('owner'));

-- ---------------------------------------------------------------- customers
create policy customers_select_own on public.customers for select to authenticated
  using (auth_user_id = (select auth.uid()));
create policy customers_staff_select on public.customers for select to authenticated
  using (public.has_role('owner', 'manager', 'agent', 'accounts'));
create policy customers_staff_write on public.customers for all to authenticated
  using (public.has_role('owner', 'manager', 'agent'))
  with check (public.has_role('owner', 'manager', 'agent'));

-- ---------------------------------------------------------------- catalogue (public read of published rows)
create policy destinations_read on public.destinations for select to anon, authenticated
  using (status = 'published' or public.is_staff());
create policy destinations_write on public.destinations for all to authenticated
  using (public.has_role('owner', 'manager', 'content_editor'))
  with check (public.has_role('owner', 'manager', 'content_editor'));

create policy packages_read on public.packages for select to anon, authenticated
  using (status = 'published' or public.is_staff());
create policy packages_write on public.packages for all to authenticated
  using (public.has_role('owner', 'manager', 'content_editor'))
  with check (public.has_role('owner', 'manager', 'content_editor'));

create policy package_destinations_read on public.package_destinations for select to anon, authenticated
  using (exists (select 1 from public.packages p where p.id = package_id and (p.status = 'published' or public.is_staff())));
create policy package_destinations_write on public.package_destinations for all to authenticated
  using (public.has_role('owner', 'manager', 'content_editor'))
  with check (public.has_role('owner', 'manager', 'content_editor'));

create policy package_days_read on public.package_days for select to anon, authenticated
  using (exists (select 1 from public.packages p where p.id = package_id and (p.status = 'published' or public.is_staff())));
create policy package_days_write on public.package_days for all to authenticated
  using (public.has_role('owner', 'manager', 'content_editor'))
  with check (public.has_role('owner', 'manager', 'content_editor'));

create policy departures_read on public.departures for select to anon, authenticated
  using (exists (select 1 from public.packages p where p.id = package_id and (p.status = 'published' or public.is_staff())));
create policy departures_write on public.departures for all to authenticated
  using (public.has_role('owner', 'manager', 'content_editor'))
  with check (public.has_role('owner', 'manager', 'content_editor'));

create policy package_media_read on public.package_media for select to anon, authenticated
  using (exists (select 1 from public.packages p where p.id = package_id and (p.status = 'published' or public.is_staff())));
create policy package_media_write on public.package_media for all to authenticated
  using (public.has_role('owner', 'manager', 'content_editor'))
  with check (public.has_role('owner', 'manager', 'content_editor'));

create policy destination_media_read on public.destination_media for select to anon, authenticated
  using (exists (select 1 from public.destinations d where d.id = destination_id and (d.status = 'published' or public.is_staff())));
create policy destination_media_write on public.destination_media for all to authenticated
  using (public.has_role('owner', 'manager', 'content_editor'))
  with check (public.has_role('owner', 'manager', 'content_editor'));

create policy media_read on public.media for select to anon, authenticated
  using (kind <> 'document' or public.is_staff());
create policy media_write on public.media for all to authenticated
  using (public.has_role('owner', 'manager', 'content_editor'))
  with check (public.has_role('owner', 'manager', 'content_editor'));

-- ---------------------------------------------------------------- enquiries
-- Public submissions go through a validated server route using the service role (no anon insert).
create policy enquiries_select_own on public.enquiries for select to authenticated
  using (customer_id = public.current_customer_id());
create policy enquiries_staff_select on public.enquiries for select to authenticated
  using (
    public.has_role('owner', 'manager')
    or (public.has_role('agent') and (assigned_to is null or assigned_to = (select auth.uid())))
  );
create policy enquiries_staff_insert on public.enquiries for insert to authenticated
  with check (public.has_role('owner', 'manager', 'agent'));
create policy enquiries_staff_update on public.enquiries for update to authenticated
  using (
    public.has_role('owner', 'manager')
    or (public.has_role('agent') and (assigned_to is null or assigned_to = (select auth.uid())))
  )
  with check (
    public.has_role('owner', 'manager')
    or (public.has_role('agent') and (assigned_to is null or assigned_to = (select auth.uid())))
  );
create policy enquiries_manager_delete on public.enquiries for delete to authenticated
  using (public.has_role('owner', 'manager'));

-- ---------------------------------------------------------------- bookings and children
create policy bookings_select_own on public.bookings for select to authenticated
  using (customer_id = public.current_customer_id());
create policy bookings_staff_select on public.bookings for select to authenticated
  using (public.has_role('owner', 'manager', 'agent', 'accounts'));
create policy bookings_staff_write on public.bookings for all to authenticated
  using (public.has_role('owner', 'manager', 'agent'))
  with check (public.has_role('owner', 'manager', 'agent'));

create policy booking_items_select_own on public.booking_items for select to authenticated
  using (exists (select 1 from public.bookings b where b.id = booking_id and b.customer_id = public.current_customer_id()));
create policy booking_items_staff_select on public.booking_items for select to authenticated
  using (public.has_role('owner', 'manager', 'agent', 'accounts'));
create policy booking_items_staff_write on public.booking_items for all to authenticated
  using (public.has_role('owner', 'manager', 'agent'))
  with check (public.has_role('owner', 'manager', 'agent'));

create policy travellers_select_own on public.travellers for select to authenticated
  using (exists (select 1 from public.bookings b where b.id = booking_id and b.customer_id = public.current_customer_id()));
create policy travellers_staff on public.travellers for all to authenticated
  using (public.has_role('owner', 'manager', 'agent'))
  with check (public.has_role('owner', 'manager', 'agent'));

create policy itinerary_documents_select_own on public.itinerary_documents for select to authenticated
  using (
    published_at is not null
    and exists (select 1 from public.bookings b where b.id = booking_id and b.customer_id = public.current_customer_id())
  );
create policy itinerary_documents_staff on public.itinerary_documents for all to authenticated
  using (public.has_role('owner', 'manager', 'agent'))
  with check (public.has_role('owner', 'manager', 'agent'));

create policy booking_events_staff_select on public.booking_events for select to authenticated
  using (public.has_role('owner', 'manager', 'agent', 'accounts'));
create policy booking_events_staff_insert on public.booking_events for insert to authenticated
  with check (public.has_role('owner', 'manager', 'agent', 'accounts'));

-- ---------------------------------------------------------------- payments
create policy payments_select_own on public.payments for select to authenticated
  using (exists (select 1 from public.bookings b where b.id = booking_id and b.customer_id = public.current_customer_id()));
create policy payments_staff_select on public.payments for select to authenticated
  using (public.has_role('owner', 'manager', 'agent', 'accounts'));
create policy payments_staff_write on public.payments for all to authenticated
  using (public.has_role('owner', 'manager', 'accounts'))
  with check (public.has_role('owner', 'manager', 'accounts') and provider = 'offline');

create policy refunds_staff_select on public.refunds for select to authenticated
  using (public.has_role('owner', 'manager', 'accounts'));

-- ---------------------------------------------------------------- audit (read-only for managers; written by triggers)
create policy audit_log_select on public.audit_log for select to authenticated
  using (public.has_role('owner', 'manager'));

-- ---------------------------------------------------------------- storage
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('public-media', 'public-media', true, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'video/mp4']),
  ('models', 'models', true, 52428800, array['model/gltf-binary', 'application/octet-stream', 'image/ktx2']),
  ('itineraries', 'itineraries', false, 20971520, array['application/pdf'])
on conflict (id) do nothing;

create policy public_media_write on storage.objects for all to authenticated
  using (bucket_id in ('public-media', 'models') and public.has_role('owner', 'manager', 'content_editor'))
  with check (bucket_id in ('public-media', 'models') and public.has_role('owner', 'manager', 'content_editor'));

create policy itineraries_staff on storage.objects for all to authenticated
  using (bucket_id = 'itineraries' and public.has_role('owner', 'manager', 'agent'))
  with check (bucket_id = 'itineraries' and public.has_role('owner', 'manager', 'agent'));

-- Customers can read (and sign URLs for) only published itinerary PDFs on their own bookings.
create policy itineraries_customer_read on storage.objects for select to authenticated
  using (
    bucket_id = 'itineraries'
    and exists (
      select 1
      from public.itinerary_documents d
      join public.bookings b on b.id = d.booking_id
      where d.storage_path = name
        and d.published_at is not null
        and b.customer_id = public.current_customer_id()
    )
  );
