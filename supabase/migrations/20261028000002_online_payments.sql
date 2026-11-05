-- Online payments: staff create a payment link, the customer pays on the gateway, a webhook settles the ledger.
alter table public.payments
  add column pay_token text unique,
  add column pay_expires_at timestamptz,
  add column provider_order_id text unique,
  add column provider_payment_id text;

-- Staff may only create a cashfree row as a fresh link. Settling it (captured, failed) is done by the server
-- with the service role after the gateway confirms, never by hand.
drop policy payments_staff_write on public.payments;
create policy payments_staff_update on public.payments for update to authenticated
  using (public.has_role('owner', 'manager', 'accounts'))
  with check (public.has_role('owner', 'manager', 'accounts') and provider = 'offline');
create policy payments_staff_delete on public.payments for delete to authenticated
  using (public.has_role('owner', 'manager', 'accounts') and provider = 'offline');
create policy payments_staff_insert on public.payments for insert to authenticated
  with check (
    public.has_role('owner', 'manager', 'accounts')
    and (provider = 'offline' or (provider = 'cashfree' and status = 'created' and pay_token is not null))
  );
