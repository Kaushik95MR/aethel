-- Leads who tap "Request a callback" on a trip card arrive with their own source, so staff can ring them first.
alter type public.enquiry_source add value if not exists 'callback';
