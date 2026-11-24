-- The party of a trip, in a few words ("Beach party under string lights"). Shown on the trip card on the website.
alter table public.packages add column party text check (party is null or char_length(party) <= 120);
