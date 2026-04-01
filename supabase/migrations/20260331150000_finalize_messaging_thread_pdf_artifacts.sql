ALTER TABLE public.court_exports
  ADD COLUMN IF NOT EXISTS pdf_hash_algorithm text
    CHECK (pdf_hash_algorithm IS NULL OR pdf_hash_algorithm = 'sha256'),
  ADD COLUMN IF NOT EXISTS pdf_artifact_hash text,
  ADD COLUMN IF NOT EXISTS pdf_bytes_size integer
    CHECK (pdf_bytes_size IS NULL OR pdf_bytes_size >= 0),
  ADD COLUMN IF NOT EXISTS pdf_generated_at timestamptz;

COMMENT ON COLUMN public.court_exports.pdf_hash_algorithm IS
  'Hash algorithm used for the exact final server-generated PDF artifact bytes.';
COMMENT ON COLUMN public.court_exports.pdf_artifact_hash IS
  'SHA-256 hash of the final server-generated PDF artifact bytes linked by the signed export receipt.';
COMMENT ON COLUMN public.court_exports.pdf_bytes_size IS
  'Exact byte size of the stored server-generated PDF artifact.';
COMMENT ON COLUMN public.court_exports.pdf_generated_at IS
  'Timestamp recorded for the final server-generated PDF artifact linked to the receipt.';

CREATE INDEX IF NOT EXISTS idx_court_exports_pdf_artifact_hash
ON public.court_exports (pdf_artifact_hash);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'court-export-artifacts',
  'court-export-artifacts',
  false,
  52428800,
  ARRAY['application/pdf', 'application/json']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Intentionally no authenticated storage-object policies:
-- these evidence artifacts remain private and are only fetched through the
-- family-scoped messaging-thread-export Edge Function using service-role access.
