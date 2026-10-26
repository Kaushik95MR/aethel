-- Advisor fixes: pin search_path on the updated_at trigger, and stop the audit trigger function being callable over RPC.
alter function public.set_updated_at() set search_path = '';
revoke all on function public.audit_row() from public, anon, authenticated;
