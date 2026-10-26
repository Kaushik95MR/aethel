-- Core schema: identity, catalogue, sales/operations, payments, system.
-- Money is stored as integer paise. All statuses are enums.

create extension if not exists citext with schema extensions;

-- ---------------------------------------------------------------- enums
create type public.staff_role as enum ('owner', 'manager', 'agent', 'content_editor', 'accounts');
create type public.publish_status as enum ('draft', 'published', 'archived');
create type public.departure_status as enum ('open', 'closed', 'sold_out', 'cancelled');
create type public.media_kind as enum ('image', 'video', 'model', 'document');
create type public.enquiry_status as enum ('new', 'contacted', 'quoted', 'won', 'lost');
create type public.enquiry_source as enum ('web', 'phone', 'walk_in', 'referral', 'other');
create type public.booking_status as enum ('pending', 'confirmed', 'completed', 'cancelled');
create type public.booking_item_kind as enum ('package', 'addon', 'discount', 'fee');
create type public.payment_provider as enum ('razorpay', 'offline');
create type public.payment_kind as enum ('deposit', 'balance', 'full');
create type public.payment_status as enum ('created', 'authorized', 'captured', 'failed', 'refunded', 'partially_refunded');
create type public.refund_status as enum ('pending', 'processed', 'failed');
create type public.actor_type as enum ('staff', 'customer', 'system');
create type public.outbox_status as enum ('pending', 'sent', 'failed');

-- ---------------------------------------------------------------- helpers
create function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------- identity
create table public.staff (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  role public.staff_role not null,
  active boolean not null default true,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users (id) on delete set null,
  full_name text not null,
  email extensions.citext unique,
  phone text,
  marketing_consent boolean not null default false,
  consent_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- catalogue
create table public.media (
  id uuid primary key default gen_random_uuid(),
  bucket text not null,
  path text not null,
  kind public.media_kind not null,
  alt text,
  width int,
  height int,
  bytes bigint,
  uploaded_by uuid references public.staff (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (bucket, path)
);

create table public.destinations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  country text not null,
  region text,
  summary text,
  lat double precision,
  lng double precision,
  hero_media_id uuid references public.media (id) on delete set null,
  status public.publish_status not null default 'draft',
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.packages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  summary text,
  description text,
  duration_days int not null check (duration_days > 0),
  base_price_paise bigint check (base_price_paise >= 0),
  price_note text,
  inclusions text[] not null default '{}',
  exclusions text[] not null default '{}',
  highlights text[] not null default '{}',
  tags text[] not null default '{}',
  is_domestic boolean not null default true,
  status public.publish_status not null default 'draft',
  seo_title text,
  seo_description text,
  scene_config jsonb not null default '{}'::jsonb,
  search tsvector generated always as (
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(summary, '') || ' ' || coalesce(description, ''))
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index packages_search_idx on public.packages using gin (search);
create index packages_status_idx on public.packages (status);

create table public.package_destinations (
  package_id uuid not null references public.packages (id) on delete cascade,
  destination_id uuid not null references public.destinations (id) on delete cascade,
  primary key (package_id, destination_id)
);
create index package_destinations_destination_idx on public.package_destinations (destination_id);

create table public.package_days (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.packages (id) on delete cascade,
  day_no int not null check (day_no > 0),
  title text not null,
  description text,
  location text,
  meals text,
  stay text,
  unique (package_id, day_no)
);

create table public.departures (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.packages (id) on delete cascade,
  start_date date not null,
  end_date date not null,
  capacity int not null check (capacity >= 0),
  price_override_paise bigint check (price_override_paise >= 0),
  status public.departure_status not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);
create index departures_package_idx on public.departures (package_id, start_date);

create table public.package_media (
  package_id uuid not null references public.packages (id) on delete cascade,
  media_id uuid not null references public.media (id) on delete cascade,
  role text not null default 'gallery' check (role in ('hero', 'gallery', 'thumb')),
  sort_order int not null default 0,
  primary key (package_id, media_id)
);
create index package_media_media_idx on public.package_media (media_id);

create table public.destination_media (
  destination_id uuid not null references public.destinations (id) on delete cascade,
  media_id uuid not null references public.media (id) on delete cascade,
  role text not null default 'gallery' check (role in ('hero', 'gallery', 'thumb')),
  sort_order int not null default 0,
  primary key (destination_id, media_id)
);
create index destination_media_media_idx on public.destination_media (media_id);

-- ---------------------------------------------------------------- sales & operations
create table public.enquiries (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers (id) on delete set null,
  name text not null,
  email extensions.citext,
  phone text,
  package_id uuid references public.packages (id) on delete set null,
  destination_interest text,
  preferred_start date,
  flexible_dates boolean not null default false,
  adults int not null default 1 check (adults >= 0),
  children int not null default 0 check (children >= 0),
  budget_note text,
  message text,
  source public.enquiry_source not null default 'web',
  utm jsonb not null default '{}'::jsonb,
  status public.enquiry_status not null default 'new',
  lost_reason text,
  assigned_to uuid references public.staff (id) on delete set null,
  consent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (email is not null or phone is not null)
);
create index enquiries_status_idx on public.enquiries (status, created_at desc);
create index enquiries_assigned_idx on public.enquiries (assigned_to);
create index enquiries_customer_idx on public.enquiries (customer_id);
create index enquiries_package_idx on public.enquiries (package_id);

create sequence public.booking_ref_seq;

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique default (
    'BLR-' || to_char(now(), 'YY') || '-' || lpad(nextval('public.booking_ref_seq')::text, 5, '0')
  ),
  customer_id uuid not null references public.customers (id) on delete restrict,
  enquiry_id uuid unique references public.enquiries (id) on delete set null,
  package_id uuid references public.packages (id) on delete set null,
  departure_id uuid references public.departures (id) on delete set null,
  title text,
  start_date date,
  end_date date,
  adults int not null default 1 check (adults >= 0),
  children int not null default 0 check (children >= 0),
  status public.booking_status not null default 'pending',
  total_paise bigint not null default 0 check (total_paise >= 0),
  tax_paise bigint not null default 0 check (tax_paise >= 0),
  currency char(3) not null default 'INR',
  assigned_to uuid references public.staff (id) on delete set null,
  internal_notes text,
  cancelled_at timestamptz,
  cancel_reason text,
  created_by uuid references public.staff (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (package_id is not null or title is not null)
);
create index bookings_customer_idx on public.bookings (customer_id);
create index bookings_status_idx on public.bookings (status, start_date);
create index bookings_assigned_idx on public.bookings (assigned_to);
create index bookings_package_idx on public.bookings (package_id);
create index bookings_departure_idx on public.bookings (departure_id);

create table public.booking_items (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  kind public.booking_item_kind not null default 'package',
  description text not null,
  quantity int not null default 1 check (quantity > 0),
  unit_price_paise bigint not null,
  tax_rate_bps int not null default 0 check (tax_rate_bps >= 0)
);
create index booking_items_booking_idx on public.booking_items (booking_id);

create table public.travellers (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  full_name text not null,
  date_of_birth date,
  gender text,
  nationality text,
  is_lead boolean not null default false,
  -- Encrypted by the application (or Vault) before insert; never store plaintext.
  passport_number_enc text,
  passport_expiry date,
  dietary text,
  notes text,
  created_at timestamptz not null default now()
);
create index travellers_booking_idx on public.travellers (booking_id);

create table public.itinerary_documents (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  version int not null default 1,
  title text not null,
  storage_path text not null unique,
  file_name text not null,
  bytes bigint,
  content_type text not null default 'application/pdf',
  uploaded_by uuid references public.staff (id) on delete set null,
  published_at timestamptz,
  email_sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (booking_id, version)
);

create table public.booking_events (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  type text not null,
  actor_type public.actor_type not null default 'system',
  actor_id uuid,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index booking_events_booking_idx on public.booking_events (booking_id, created_at desc);

-- ---------------------------------------------------------------- payments (Razorpay integration comes later)
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete restrict,
  provider public.payment_provider not null,
  kind public.payment_kind not null default 'full',
  amount_paise bigint not null check (amount_paise > 0),
  currency char(3) not null default 'INR',
  status public.payment_status not null default 'created',
  razorpay_order_id text unique,
  razorpay_payment_id text unique,
  method text,
  receipt text,
  captured_at timestamptz,
  failure_code text,
  failure_reason text,
  offline_reference text,
  recorded_by uuid references public.staff (id) on delete set null,
  raw jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (provider <> 'offline' or recorded_by is not null)
);
create index payments_booking_idx on public.payments (booking_id);

create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments (id) on delete restrict,
  amount_paise bigint not null check (amount_paise > 0),
  razorpay_refund_id text unique,
  status public.refund_status not null default 'pending',
  reason text,
  initiated_by uuid references public.staff (id) on delete set null,
  created_at timestamptz not null default now()
);
create index refunds_payment_idx on public.refunds (payment_id);

create table public.payment_events (
  id uuid primary key default gen_random_uuid(),
  provider_event_id text not null unique,
  type text not null,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  error text
);

-- ---------------------------------------------------------------- system
create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid,
  action text not null,
  entity_type text not null,
  entity_id text,
  before jsonb,
  after jsonb,
  at timestamptz not null default now()
);
create index audit_log_entity_idx on public.audit_log (entity_type, entity_id, at desc);

create table public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  to_email text not null,
  template text not null,
  payload jsonb not null default '{}'::jsonb,
  status public.outbox_status not null default 'pending',
  attempts int not null default 0,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index email_outbox_pending_idx on public.email_outbox (created_at) where status = 'pending';

-- ---------------------------------------------------------------- updated_at triggers
do $$
declare t text;
begin
  foreach t in array array[
    'staff', 'customers', 'destinations', 'packages', 'departures',
    'enquiries', 'bookings', 'payments'
  ] loop
    execute format(
      'create trigger %I_set_updated_at before update on public.%I for each row execute function public.set_updated_at()',
      t, t
    );
  end loop;
end $$;

-- ---------------------------------------------------------------- audit triggers
create function public.audit_row() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_log (actor_id, action, entity_type, entity_id, before, after)
  values (
    auth.uid(),
    lower(tg_op),
    tg_table_name,
    case when tg_op = 'DELETE' then to_jsonb(old) ->> 'id' else to_jsonb(new) ->> 'id' end,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );
  return coalesce(new, old);
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['staff', 'packages', 'bookings', 'payments', 'refunds'] loop
    execute format(
      'create trigger %I_audit after insert or update or delete on public.%I for each row execute function public.audit_row()',
      t, t
    );
  end loop;
end $$;

-- ---------------------------------------------------------------- derived data
-- Seats left is computed from confirmed bookings, never stored.
-- SECURITY DEFINER so anonymous visitors get the aggregate without read access to bookings.
create function public.seats_left(p_departure_id uuid) returns int
language sql stable security definer set search_path = public as $$
  select d.capacity - coalesce((
    select sum(b.adults + b.children)
    from public.bookings b
    where b.departure_id = d.id and b.status in ('confirmed', 'completed')
  ), 0)::int
  from public.departures d
  where d.id = p_departure_id
    and exists (select 1 from public.packages p where p.id = d.package_id and p.status = 'published');
$$;

-- Payment status is derived from the ledger. Respects RLS of the caller.
create view public.booking_payment_summary with (security_invoker = true) as
select
  b.id as booking_id,
  b.total_paise,
  coalesce(p.paid, 0) as paid_paise,
  coalesce(r.refunded, 0) as refunded_paise,
  case
    when coalesce(p.paid, 0) = 0 then 'unpaid'
    when coalesce(r.refunded, 0) >= coalesce(p.paid, 0) then 'refunded'
    when coalesce(p.paid, 0) - coalesce(r.refunded, 0) >= b.total_paise then 'paid'
    else 'partial'
  end as payment_status
from public.bookings b
left join (
  select booking_id, sum(amount_paise) as paid
  from public.payments
  where status in ('captured', 'partially_refunded', 'refunded')
  group by booking_id
) p on p.booking_id = b.id
left join (
  select pay.booking_id, sum(rf.amount_paise) as refunded
  from public.refunds rf
  join public.payments pay on pay.id = rf.payment_id
  where rf.status = 'processed'
  group by pay.booking_id
) r on r.booking_id = b.id;
