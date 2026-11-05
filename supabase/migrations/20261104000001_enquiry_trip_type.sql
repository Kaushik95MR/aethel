-- The kind of trip an enquirer wants (family, seniors, trekking, social). Matches the category slugs on packages.tags.
alter table public.enquiries add column if not exists trip_type text;
