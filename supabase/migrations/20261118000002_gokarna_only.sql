-- Gokarna becomes the only published trip. The other trips are hidden (draft), not deleted.
-- Price, dates, inclusions and the host below are placeholders for staff to edit in the admin.
update public.packages set status = 'draft' where slug in ('kumara-parvatha-trek-3d', 'netravathi');
update public.destinations set status = 'draft' where slug = 'kumara-parvatha';

with dest as (
  insert into public.destinations (slug, name, country, region, summary, lat, lng, status, sort_order)
  values (
    'gokarna', 'Gokarna', 'India', 'Karnataka',
    'A quiet beach town on the Karnataka coast with wide beaches, warm sea and long nights.',
    14.5479, 74.3188, 'published', 1
  )
  returning id
), pkg as (
  insert into public.packages (
    slug, title, summary, description, duration_days, base_price_paise, price_note,
    inclusions, exclusions, highlights, tags, is_domestic, status, seo_title, seo_description
  )
  values (
    'gokarna-beach-party-weekend',
    'Gokarna beach party weekend',
    'Two nights on the Karnataka coast with a beach party, a bonfire and a group of new friends.',
    E'Leave Bengaluru on Friday night and wake up by the sea. Saturday is for beaches, kayaking and a long lazy afternoon. When the sun goes down the party starts on the sand: music, lights and a bonfire.\n\nYou travel with a small group and a host who stays with you all weekend, so nobody is on their own.',
    3, 649900, 'per person',
    array['Overnight bus from Bengaluru and back', '2 nights stay by the beach', 'Breakfast and dinner', 'Kayaking session', 'Beach party and bonfire night', 'A trip host with the group all weekend'],
    array['Lunch', 'Personal expenses'],
    array['Beach party under string lights', 'Bonfire night', 'Sunrise walk on the beach', 'A host who travels with you'],
    array['social', 'beach', 'party', 'weekend', 'karnataka'],
    true, 'published',
    'Gokarna beach party weekend from Bengaluru',
    'A two-night beach party trip from Bengaluru with a bonfire, kayaking and a hosted group.'
  )
  returning id
), link as (
  insert into public.package_destinations (package_id, destination_id)
  select pkg.id, dest.id from pkg, dest
), days as (
  insert into public.package_days (package_id, day_no, title, description, location, meals, stay)
  select pkg.id, v.day_no, v.title, v.description, v.location, v.meals, v.stay
  from pkg, (values
    (1, 'Friday night: bus from Bengaluru', 'Meet your host and the group at the pick-up point and settle in for the overnight ride to the coast.', 'Bengaluru', null, 'Overnight bus'),
    (2, 'Saturday: beach, kayaking and party night', 'Breakfast, then beach time and a kayaking session. After dinner the party starts on the sand, with a bonfire to finish.', 'Gokarna', 'Breakfast, dinner', 'Beach stay'),
    (3, 'Sunday: sunrise walk and the ride home', 'A slow sunrise walk along the beach, breakfast, then the bus back to Bengaluru.', 'Gokarna', 'Breakfast', null)
  ) as v(day_no, title, description, location, meals, stay)
), host as (
  insert into public.hosts (slug, name, tagline, bio, city, vibes, status, is_sample, sort_order)
  values (
    'meera', 'Meera', 'Beach person. Sunset chaser.',
    'I plan trips for people who say they are not the group-trip type. Beaches, bonfires and good playlists.',
    'Bengaluru',
    array['Beach parties', 'Bonfire nights', 'Music', 'Solo friendly'],
    'published', true, 1
  )
  returning id
)
insert into public.departures (package_id, start_date, end_date, capacity, status, host_id)
select pkg.id, v.s, v.e, 16, 'open', host.id
from pkg, host, (values (date '2026-12-18', date '2026-12-20'), (date '2027-01-08', date '2027-01-10')) as v(s, e);
