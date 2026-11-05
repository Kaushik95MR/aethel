-- Photos found automatically come from Wikimedia Commons and must be credited. Uploaded photos leave this empty.
alter table public.media add column credit jsonb;
comment on column public.media.credit is 'Attribution for found photos: {title, author, license, licenseUrl, source}';
