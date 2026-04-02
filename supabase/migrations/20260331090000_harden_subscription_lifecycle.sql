ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS access_grace_until timestamptz;

COMMENT ON COLUMN public.profiles.trial_ends_at IS
  'Timestamp when the current subscription trial ends. Authoritative checks downgrade expired trials to free access immediately.';

COMMENT ON COLUMN public.profiles.access_grace_until IS
  'Timestamp until which a past_due subscriber retains paid access during the Stripe retry grace period.';

CREATE INDEX IF NOT EXISTS idx_profiles_subscription_status_trial_ends_at
  ON public.profiles (subscription_status, trial_ends_at);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_subscription_status_check'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles DROP CONSTRAINT profiles_subscription_status_check;
  END IF;

  ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_subscription_status_check
    CHECK (subscription_status IN ('none', 'trial', 'active', 'past_due', 'canceled', 'expired'));
END
$$;

CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
  id text PRIMARY KEY,
  event_type text NOT NULL,
  customer_email text,
  metadata jsonb,
  processed_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'processing'
);

COMMENT ON TABLE public.stripe_webhook_events IS
  'Idempotency receipts for Stripe webhook events. Each Stripe event id is processed at most once.';

COMMENT ON COLUMN public.stripe_webhook_events.status IS
  'Processing lifecycle for Stripe webhook events: processing, success, or failed.';
