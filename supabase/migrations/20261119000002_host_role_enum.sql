-- A host is a vendor who arranges and looks after a trip. Added on its own so the new value is committed before it is used.
alter type public.staff_role add value if not exists 'host';
