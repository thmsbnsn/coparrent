ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS stripe_customer_id text;

COMMENT ON COLUMN public.profiles.stripe_customer_id IS
  'Authoritative Stripe customer identifier for server-side billing synchronization. This link must be explicit and must not be inferred across accounts.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_stripe_customer_id
  ON public.profiles (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;
