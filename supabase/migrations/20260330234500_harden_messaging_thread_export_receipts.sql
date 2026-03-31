ALTER TABLE public.court_exports
  ADD COLUMN IF NOT EXISTS integrity_model_version text
    NOT NULL DEFAULT 'coparrent.messaging-thread-export-receipt/v2',
  ADD COLUMN IF NOT EXISTS canonicalization_version text
    NOT NULL DEFAULT 'coparrent.messaging-thread-export-canonical/v2',
  ADD COLUMN IF NOT EXISTS manifest_hash_algorithm text
    CHECK (manifest_hash_algorithm IS NULL OR manifest_hash_algorithm = 'sha256'),
  ADD COLUMN IF NOT EXISTS manifest_hash text,
  ADD COLUMN IF NOT EXISTS artifact_hash_algorithm text
    CHECK (artifact_hash_algorithm IS NULL OR artifact_hash_algorithm = 'sha256'),
  ADD COLUMN IF NOT EXISTS artifact_hash text,
  ADD COLUMN IF NOT EXISTS artifact_type text
    CHECK (artifact_type IS NULL OR artifact_type = 'json_evidence_package'),
  ADD COLUMN IF NOT EXISTS receipt_signature_algorithm text
    CHECK (receipt_signature_algorithm IS NULL OR receipt_signature_algorithm = 'hmac-sha256'),
  ADD COLUMN IF NOT EXISTS receipt_signature text,
  ADD COLUMN IF NOT EXISTS receipt_json jsonb
    NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_court_exports_manifest_hash
ON public.court_exports (manifest_hash);

CREATE INDEX IF NOT EXISTS idx_court_exports_artifact_hash
ON public.court_exports (artifact_hash);

UPDATE public.court_exports
SET
  integrity_model_version = COALESCE(
    integrity_model_version,
    'coparrent.messaging-thread-export-receipt/v2'
  ),
  canonicalization_version = COALESCE(
    canonicalization_version,
    manifest_json->>'canonicalization_version',
    'coparrent.messaging-thread-export-canonical/v2'
  ),
  receipt_json = CASE
    WHEN receipt_json = '{}'::jsonb THEN jsonb_strip_nulls(
      jsonb_build_object(
        'schema_version', COALESCE(manifest_json->>'schema_version', 'coparrent.messaging-thread-export/v3'),
        'integrity_model_version', COALESCE(
          integrity_model_version,
          'coparrent.messaging-thread-export-receipt/v2'
        ),
        'canonicalization_version', COALESCE(
          canonicalization_version,
          manifest_json->>'canonicalization_version',
          'coparrent.messaging-thread-export-canonical/v2'
        ),
        'source_type', source_type,
        'source_id', source_id,
        'thread_id', COALESCE(manifest_json->>'thread_id', source_id::text),
        'thread_type', COALESCE(manifest_json->>'thread_type', 'direct_message'),
        'thread_display_name', COALESCE(manifest_json->>'thread_display_name', 'Recorded thread'),
        'family_id', family_id,
        'export_format', export_format,
        'exported_at', exported_at,
        'created_by_profile_id', created_by_profile_id,
        'application_build_id', manifest_json->>'application_build_id',
        'record_count', record_count,
        'total_messages', COALESCE((manifest_json->>'total_messages')::integer, record_count),
        'total_system_events', COALESCE((manifest_json->>'total_system_events')::integer, 0),
        'record_start', manifest_json->>'record_start',
        'record_end', manifest_json->>'record_end',
        'canonical_hash_algorithm', hash_algorithm,
        'canonical_content_hash', content_hash,
        'manifest_hash_algorithm', manifest_hash_algorithm,
        'manifest_hash', manifest_hash,
        'artifact_hash_algorithm', artifact_hash_algorithm,
        'artifact_hash', artifact_hash,
        'artifact_type', artifact_type,
        'receipt_signature_algorithm', receipt_signature_algorithm,
        'receipt_signature', receipt_signature
      )
    )
    ELSE receipt_json
  END;
