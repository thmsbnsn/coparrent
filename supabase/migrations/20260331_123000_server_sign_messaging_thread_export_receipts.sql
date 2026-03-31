ALTER TABLE public.court_exports
  ADD COLUMN IF NOT EXISTS created_by_user_id uuid,
  ADD COLUMN IF NOT EXISTS thread_type text,
  ADD COLUMN IF NOT EXISTS record_range_start timestamptz,
  ADD COLUMN IF NOT EXISTS record_range_end timestamptz,
  ADD COLUMN IF NOT EXISTS signing_key_id text;

COMMENT ON COLUMN public.court_exports.created_by_user_id IS
  'Authenticated user id that generated the export receipt.';
COMMENT ON COLUMN public.court_exports.thread_type IS
  'Authoritative message-thread type recorded with the receipt for audit and verification context.';
COMMENT ON COLUMN public.court_exports.record_range_start IS
  'Earliest canonical record timestamp included in the signed export receipt.';
COMMENT ON COLUMN public.court_exports.record_range_end IS
  'Latest canonical record timestamp included in the signed export receipt.';
COMMENT ON COLUMN public.court_exports.signing_key_id IS
  'Server-held signing key identifier used to sign the export receipt.';

UPDATE public.court_exports ce
SET created_by_user_id = p.user_id
FROM public.profiles p
WHERE ce.created_by_profile_id = p.id
  AND ce.created_by_user_id IS NULL;

UPDATE public.court_exports
SET
  thread_type = COALESCE(
    thread_type,
    NULLIF(receipt_json->>'thread_type', ''),
    NULLIF(manifest_json->>'thread_type', '')
  ),
  record_range_start = COALESCE(
    record_range_start,
    NULLIF(COALESCE(receipt_json->>'record_start', manifest_json->>'record_start'), '')::timestamptz
  ),
  record_range_end = COALESCE(
    record_range_end,
    NULLIF(COALESCE(receipt_json->>'record_end', manifest_json->>'record_end'), '')::timestamptz
  ),
  signing_key_id = COALESCE(
    signing_key_id,
    NULLIF(receipt_json->>'signing_key_id', ''),
    CASE
      WHEN receipt_signature IS NOT NULL
        AND receipt_signature_algorithm = 'hmac-sha256'
        THEN 'legacy-hmac-shared-secret'
      ELSE NULL
    END
  );

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.court_exports'::regclass
      AND conname = 'court_exports_thread_type_check'
  ) THEN
    ALTER TABLE public.court_exports
      DROP CONSTRAINT court_exports_thread_type_check;
  END IF;
END
$$;

ALTER TABLE public.court_exports
  ADD CONSTRAINT court_exports_thread_type_check
  CHECK (
    thread_type IS NULL
    OR thread_type IN ('family_channel', 'direct_message', 'group_chat')
  );

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.court_exports'::regclass
      AND conname = 'court_exports_receipt_signature_algorithm_check'
  ) THEN
    ALTER TABLE public.court_exports
      DROP CONSTRAINT court_exports_receipt_signature_algorithm_check;
  END IF;
END
$$;

ALTER TABLE public.court_exports
  ADD CONSTRAINT court_exports_receipt_signature_algorithm_check
  CHECK (
    receipt_signature_algorithm IS NULL
    OR receipt_signature_algorithm IN ('ed25519', 'hmac-sha256')
  );

DROP TRIGGER IF EXISTS update_court_exports_updated_at ON public.court_exports;

CREATE OR REPLACE FUNCTION public.prevent_court_export_receipt_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'court_exports receipts are immutable and cannot be modified or deleted';
END;
$$;

DROP TRIGGER IF EXISTS prevent_court_exports_update ON public.court_exports;
CREATE TRIGGER prevent_court_exports_update
BEFORE UPDATE ON public.court_exports
FOR EACH ROW
EXECUTE FUNCTION public.prevent_court_export_receipt_mutation();

DROP TRIGGER IF EXISTS prevent_court_exports_delete ON public.court_exports;
CREATE TRIGGER prevent_court_exports_delete
BEFORE DELETE ON public.court_exports
FOR EACH ROW
EXECUTE FUNCTION public.prevent_court_export_receipt_mutation();
