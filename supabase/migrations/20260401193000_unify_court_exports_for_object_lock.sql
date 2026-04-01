ALTER TABLE public.court_exports
  ADD COLUMN IF NOT EXISTS export_scope text,
  ADD COLUMN IF NOT EXISTS thread_id uuid REFERENCES public.message_threads(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS included_sections jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS artifact_storage_provider text,
  ADD COLUMN IF NOT EXISTS artifact_storage_bucket text,
  ADD COLUMN IF NOT EXISTS artifact_storage_key text,
  ADD COLUMN IF NOT EXISTS artifact_storage_version_id text,
  ADD COLUMN IF NOT EXISTS artifact_object_lock_mode text,
  ADD COLUMN IF NOT EXISTS artifact_retain_until timestamptz,
  ADD COLUMN IF NOT EXISTS pdf_storage_provider text,
  ADD COLUMN IF NOT EXISTS pdf_storage_bucket text,
  ADD COLUMN IF NOT EXISTS pdf_storage_key text,
  ADD COLUMN IF NOT EXISTS pdf_storage_version_id text,
  ADD COLUMN IF NOT EXISTS pdf_object_lock_mode text,
  ADD COLUMN IF NOT EXISTS pdf_retain_until timestamptz;

UPDATE public.court_exports
SET
  export_scope = COALESCE(export_scope, 'message_thread'),
  thread_id = COALESCE(thread_id, source_id),
  artifact_storage_provider = COALESCE(artifact_storage_provider, 'supabase_storage'),
  artifact_storage_bucket = COALESCE(
    artifact_storage_bucket,
    NULLIF(receipt_json->>'artifact_storage_bucket', ''),
    NULLIF(manifest_json->>'artifact_storage_bucket', ''),
    'court-export-artifacts'
  ),
  artifact_storage_key = COALESCE(
    artifact_storage_key,
    NULLIF(receipt_json->>'artifact_storage_path', ''),
    NULLIF(manifest_json->>'artifact_storage_path', '')
  ),
  pdf_storage_provider = COALESCE(
    pdf_storage_provider,
    CASE
      WHEN COALESCE(
        NULLIF(receipt_json->>'pdf_storage_path', ''),
        NULLIF(manifest_json->>'pdf_storage_path', '')
      ) IS NOT NULL
        THEN 'supabase_storage'
      ELSE NULL
    END
  ),
  pdf_storage_bucket = COALESCE(
    pdf_storage_bucket,
    NULLIF(receipt_json->>'pdf_storage_bucket', ''),
    NULLIF(manifest_json->>'pdf_storage_bucket', ''),
    CASE
      WHEN COALESCE(
        NULLIF(receipt_json->>'pdf_storage_path', ''),
        NULLIF(manifest_json->>'pdf_storage_path', '')
      ) IS NOT NULL
        THEN 'court-export-artifacts'
      ELSE NULL
    END
  ),
  pdf_storage_key = COALESCE(
    pdf_storage_key,
    NULLIF(receipt_json->>'pdf_storage_path', ''),
    NULLIF(manifest_json->>'pdf_storage_path', '')
  )
WHERE export_scope IS NULL
   OR thread_id IS NULL
   OR artifact_storage_provider IS NULL
   OR artifact_storage_bucket IS NULL
   OR artifact_storage_key IS NULL
   OR pdf_storage_provider IS NULL
   OR pdf_storage_bucket IS NULL
   OR pdf_storage_key IS NULL;

ALTER TABLE public.court_exports
  ALTER COLUMN export_scope SET DEFAULT 'message_thread',
  ALTER COLUMN export_scope SET NOT NULL,
  ALTER COLUMN source_id DROP NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.court_exports'::regclass
      AND conname = 'court_exports_source_type_check'
  ) THEN
    ALTER TABLE public.court_exports
      DROP CONSTRAINT court_exports_source_type_check;
  END IF;
END
$$;

ALTER TABLE public.court_exports
  ADD CONSTRAINT court_exports_source_type_check
  CHECK (
    source_type IN ('message_thread', 'family_unified')
  );

ALTER TABLE public.court_exports
  ADD CONSTRAINT court_exports_export_scope_check
  CHECK (
    export_scope IN ('message_thread', 'family_unified')
  );

ALTER TABLE public.court_exports
  ADD CONSTRAINT court_exports_thread_scope_check
  CHECK (
    (export_scope = 'message_thread' AND COALESCE(thread_id, source_id) IS NOT NULL)
    OR (export_scope = 'family_unified' AND thread_id IS NULL AND source_id IS NULL)
  );

ALTER TABLE public.court_exports
  ADD CONSTRAINT court_exports_artifact_storage_provider_check
  CHECK (
    artifact_storage_provider IS NULL
    OR artifact_storage_provider IN ('supabase_storage', 'aws_s3_object_lock')
  );

ALTER TABLE public.court_exports
  ADD CONSTRAINT court_exports_pdf_storage_provider_check
  CHECK (
    pdf_storage_provider IS NULL
    OR pdf_storage_provider IN ('supabase_storage', 'aws_s3_object_lock')
  );

ALTER TABLE public.court_exports
  ADD CONSTRAINT court_exports_artifact_object_lock_mode_check
  CHECK (
    artifact_object_lock_mode IS NULL
    OR artifact_object_lock_mode IN ('GOVERNANCE', 'COMPLIANCE')
  );

ALTER TABLE public.court_exports
  ADD CONSTRAINT court_exports_pdf_object_lock_mode_check
  CHECK (
    pdf_object_lock_mode IS NULL
    OR pdf_object_lock_mode IN ('GOVERNANCE', 'COMPLIANCE')
  );

CREATE INDEX IF NOT EXISTS idx_court_exports_family_scope_exported
ON public.court_exports (family_id, export_scope, exported_at DESC);

CREATE INDEX IF NOT EXISTS idx_court_exports_thread_id_exported
ON public.court_exports (thread_id, exported_at DESC);

COMMENT ON COLUMN public.court_exports.export_scope IS
  'Primary export scope: message_thread for Messaging Hub receipts or family_unified for broader court-record bundles.';
COMMENT ON COLUMN public.court_exports.thread_id IS
  'Authoritative thread pointer for thread-scoped exports. Null for family-wide court-record exports.';
COMMENT ON COLUMN public.court_exports.included_sections IS
  'Ordered list of sections intentionally included in the export package.';
COMMENT ON COLUMN public.court_exports.artifact_storage_provider IS
  'Storage backend used for the JSON evidence package artifact.';
COMMENT ON COLUMN public.court_exports.artifact_storage_bucket IS
  'Bucket or container name storing the JSON evidence package artifact.';
COMMENT ON COLUMN public.court_exports.artifact_storage_key IS
  'Immutable object key for the JSON evidence package artifact.';
COMMENT ON COLUMN public.court_exports.artifact_storage_version_id IS
  'Storage-layer object version identifier for the JSON evidence package artifact.';
COMMENT ON COLUMN public.court_exports.artifact_object_lock_mode IS
  'Object Lock mode recorded for the JSON evidence package artifact when stored in immutable object storage.';
COMMENT ON COLUMN public.court_exports.artifact_retain_until IS
  'Object-retention timestamp recorded for the JSON evidence package artifact.';
COMMENT ON COLUMN public.court_exports.pdf_storage_provider IS
  'Storage backend used for the final server-generated PDF artifact.';
COMMENT ON COLUMN public.court_exports.pdf_storage_bucket IS
  'Bucket or container name storing the final server-generated PDF artifact.';
COMMENT ON COLUMN public.court_exports.pdf_storage_key IS
  'Immutable object key for the final server-generated PDF artifact.';
COMMENT ON COLUMN public.court_exports.pdf_storage_version_id IS
  'Storage-layer object version identifier for the final server-generated PDF artifact.';
COMMENT ON COLUMN public.court_exports.pdf_object_lock_mode IS
  'Object Lock mode recorded for the final server-generated PDF artifact when stored in immutable object storage.';
COMMENT ON COLUMN public.court_exports.pdf_retain_until IS
  'Object-retention timestamp recorded for the final server-generated PDF artifact.';

DROP POLICY IF EXISTS "Authorized family members can view court exports" ON public.court_exports;
CREATE POLICY "Authorized family members can view court exports"
ON public.court_exports
FOR SELECT
USING (
  family_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.family_members fm
    WHERE fm.family_id = court_exports.family_id
      AND fm.profile_id = public.get_current_profile_id()
      AND fm.status = 'active'
  )
  AND (
    export_scope = 'family_unified'
    OR EXISTS (
      SELECT 1
      FROM public.message_threads mt
      WHERE mt.id = COALESCE(court_exports.thread_id, court_exports.source_id)
        AND mt.family_id = court_exports.family_id
        AND (
          mt.thread_type = 'family_channel'
          OR (
            mt.thread_type = 'direct_message'
            AND public.get_current_profile_id() IN (mt.participant_a_id, mt.participant_b_id)
          )
          OR (
            mt.thread_type = 'group_chat'
            AND EXISTS (
              SELECT 1
              FROM public.group_chat_participants gcp
              WHERE gcp.thread_id = mt.id
                AND gcp.profile_id = public.get_current_profile_id()
            )
          )
        )
    )
  )
);

DROP POLICY IF EXISTS "Authorized family members can create court exports" ON public.court_exports;
CREATE POLICY "Authorized family members can create court exports"
ON public.court_exports
FOR INSERT
WITH CHECK (
  family_id IS NOT NULL
  AND export_scope IN ('message_thread', 'family_unified')
  AND export_format IN ('pdf', 'json_manifest')
  AND hash_algorithm = 'sha256'
  AND created_by_profile_id = public.get_current_profile_id()
  AND EXISTS (
    SELECT 1
    FROM public.family_members fm
    WHERE fm.family_id = court_exports.family_id
      AND fm.profile_id = public.get_current_profile_id()
      AND fm.status = 'active'
  )
  AND (
    export_scope = 'family_unified'
    OR EXISTS (
      SELECT 1
      FROM public.message_threads mt
      WHERE mt.id = COALESCE(court_exports.thread_id, court_exports.source_id)
        AND mt.family_id = court_exports.family_id
        AND (
          mt.thread_type = 'family_channel'
          OR (
            mt.thread_type = 'direct_message'
            AND public.get_current_profile_id() IN (mt.participant_a_id, mt.participant_b_id)
          )
          OR (
            mt.thread_type = 'group_chat'
            AND EXISTS (
              SELECT 1
              FROM public.group_chat_participants gcp
              WHERE gcp.thread_id = mt.id
                AND gcp.profile_id = public.get_current_profile_id()
            )
          )
        )
    )
  )
);
