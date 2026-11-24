-- Trip hosts: the people who lead a trip and are shown on it. A host is set per departure.
create table public.hosts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  tagline text,
  bio text,
  city text,
  instagram text check (instagram is null or instagram ~ '^[A-Za-z0-9._]{1,30}$'),
  photo_media_id uuid references public.media (id) on delete set null,
  cover_media_id uuid references public.media (id) on delete set null,
  vibes text[] not null default '{}',
  status public.publish_status not null default 'draft',
  -- Placeholder people used while the app is built; delete or replace them with real hosts.
  is_sample boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index hosts_status_idx on public.hosts (status, sort_order);

create trigger hosts_set_updated_at before update on public.hosts
  for each row execute function public.set_updated_at();

alter table public.hosts enable row level security;

create policy hosts_read on public.hosts for select to anon, authenticated
  using (status = 'published' or public.is_staff());
create policy hosts_write on public.hosts for all to authenticated
  using (public.has_role('owner', 'manager', 'content_editor'))
  with check (public.has_role('owner', 'manager', 'content_editor'));

alter table public.departures add column host_id uuid references public.hosts (id) on delete set null;
create index departures_host_idx on public.departures (host_id);
