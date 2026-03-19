-- Recover the production access-code system into source control.
-- This migration is intentionally idempotent so it can be applied safely
-- when reconciling an environment that may already have the live objects.

CREATE TABLE IF NOT EXISTS public.access_pass_codes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code_hash text NOT NULL,
    code_preview text NOT NULL,
    label text NOT NULL,
    audience_tag text NOT NULL DEFAULT 'custom'::text,
    access_reason text NOT NULL,
    grant_tier text NOT NULL DEFAULT 'power'::text,
    max_redemptions integer NOT NULL DEFAULT 1,
    redeemed_count integer NOT NULL DEFAULT 0,
    active boolean NOT NULL DEFAULT true,
    expires_at timestamp with time zone,
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT access_pass_codes_audience_tag_check
        CHECK (audience_tag = ANY (ARRAY['friend'::text, 'family'::text, 'promoter'::text, 'partner'::text, 'custom'::text])),
    CONSTRAINT access_pass_codes_code_hash_key UNIQUE (code_hash),
    CONSTRAINT access_pass_codes_grant_tier_check CHECK (grant_tier = 'power'::text),
    CONSTRAINT access_pass_codes_max_redemptions_check CHECK (max_redemptions > 0),
    CONSTRAINT access_pass_codes_redeemed_count_check CHECK (redeemed_count >= 0)
);

CREATE TABLE IF NOT EXISTS public.access_pass_redemptions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    access_pass_code_id uuid NOT NULL REFERENCES public.access_pass_codes(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    redeemed_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT access_pass_redemptions_access_pass_code_id_profile_id_key
        UNIQUE (access_pass_code_id, profile_id),
    CONSTRAINT access_pass_redemptions_access_pass_code_id_user_id_key
        UNIQUE (access_pass_code_id, user_id)
);

ALTER TABLE public.access_pass_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_pass_redemptions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_access_pass_codes_active
    ON public.access_pass_codes USING btree (active);

CREATE INDEX IF NOT EXISTS idx_access_pass_codes_audience
    ON public.access_pass_codes USING btree (audience_tag);

CREATE INDEX IF NOT EXISTS idx_access_pass_codes_expires_at
    ON public.access_pass_codes USING btree (expires_at);

CREATE INDEX IF NOT EXISTS idx_access_pass_redemptions_code
    ON public.access_pass_redemptions USING btree (access_pass_code_id);

CREATE INDEX IF NOT EXISTS idx_access_pass_redemptions_user
    ON public.access_pass_redemptions USING btree (user_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'update_access_pass_codes_updated_at'
  ) THEN
    CREATE TRIGGER update_access_pass_codes_updated_at
    BEFORE UPDATE ON public.access_pass_codes
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'access_pass_codes'
      AND policyname = 'Admins can view access pass codes'
  ) THEN
    CREATE POLICY "Admins can view access pass codes"
    ON public.access_pass_codes
    FOR SELECT
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin'::public.app_role));
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'access_pass_redemptions'
      AND policyname = 'Admins can view access pass redemptions'
  ) THEN
    CREATE POLICY "Admins can view access pass redemptions"
    ON public.access_pass_redemptions
    FOR SELECT
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin'::public.app_role));
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'access_pass_redemptions'
      AND policyname = 'Users can view own access pass redemptions'
  ) THEN
    CREATE POLICY "Users can view own access pass redemptions"
    ON public.access_pass_redemptions
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.rpc_redeem_access_code(p_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID := auth.uid();
  v_profile_id UUID;
  v_code_hash TEXT;
  v_code public.access_pass_codes%ROWTYPE;
  v_existing_redemption UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'AUTH_REQUIRED',
      'message', 'Please sign in to redeem an access code.'
    );
  END IF;

  IF p_code IS NULL OR btrim(p_code) = '' THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'INVALID_CODE',
      'message', 'Please enter a valid access code.'
    );
  END IF;

  SELECT id
  INTO v_profile_id
  FROM public.profiles
  WHERE user_id = v_user_id
  LIMIT 1;

  IF v_profile_id IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'PROFILE_NOT_FOUND',
      'message', 'Profile not found for this account.'
    );
  END IF;

  v_code_hash := encode(extensions.digest(upper(btrim(p_code)), 'sha256'), 'hex');

  SELECT *
  INTO v_code
  FROM public.access_pass_codes
  WHERE code_hash = v_code_hash
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'INVALID_CODE',
      'message', 'That access code is not valid.'
    );
  END IF;

  IF v_code.active IS NOT TRUE THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'INACTIVE_CODE',
      'message', 'That access code is no longer active.'
    );
  END IF;

  IF v_code.expires_at IS NOT NULL AND v_code.expires_at <= now() THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'EXPIRED_CODE',
      'message', 'That access code has expired.'
    );
  END IF;

  SELECT id
  INTO v_existing_redemption
  FROM public.access_pass_redemptions
  WHERE access_pass_code_id = v_code.id
    AND user_id = v_user_id
  LIMIT 1;

  IF v_existing_redemption IS NOT NULL THEN
    RETURN jsonb_build_object(
      'ok', true,
      'code', 'ALREADY_REDEEMED',
      'message', 'This code has already been redeemed on your account.',
      'data', jsonb_build_object(
        'tier', v_code.grant_tier,
        'access_reason', v_code.access_reason
      )
    );
  END IF;

  IF v_code.redeemed_count >= v_code.max_redemptions THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'CODE_EXHAUSTED',
      'message', 'That access code has reached its redemption limit.'
    );
  END IF;

  INSERT INTO public.access_pass_redemptions (
    access_pass_code_id,
    user_id,
    profile_id
  )
  VALUES (
    v_code.id,
    v_user_id,
    v_profile_id
  );

  UPDATE public.access_pass_codes
  SET redeemed_count = redeemed_count + 1
  WHERE id = v_code.id;

  UPDATE public.profiles
  SET
    free_premium_access = true,
    access_reason = v_code.access_reason,
    subscription_status = 'active',
    subscription_tier = 'power'
  WHERE id = v_profile_id;

  RETURN jsonb_build_object(
    'ok', true,
    'code', 'REDEEMED',
    'message', 'Power access is now active on your account.',
    'data', jsonb_build_object(
      'tier', v_code.grant_tier,
      'access_reason', v_code.access_reason,
      'label', v_code.label
    )
  );
END;
$function$;
