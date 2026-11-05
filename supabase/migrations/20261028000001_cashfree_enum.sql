-- Cashfree replaces Razorpay as the online gateway. A new enum value can't be used in the migration that adds it,
-- so the columns and policy that rely on it come in the next file.
alter type public.payment_provider add value if not exists 'cashfree';
