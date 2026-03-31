CREATE TABLE IF NOT EXISTS public.court_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  created_by_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  source_type text NOT NULL CHECK (source_type = 'message_thread'),
  source_id uuid NOT NULL REFERENCES public.message_threads(id) ON DELETE RESTRICT,
  export_format text NOT NULL CHECK (export_format IN ('pdf', 'json_manifest')),
  hash_algorithm text NOT NULL CHECK (hash_algorithm = 'sha256'),
  content_hash text NOT NULL,
  manifest_json jsonb NOT NULL,
  record_count integer NOT NULL CHECK (record_count >= 0),
  exported_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_court_exports_family_source_exported
ON public.court_exports (family_id, source_id, exported_at DESC);

CREATE INDEX IF NOT EXISTS idx_court_exports_content_hash
ON public.court_exports (content_hash);

ALTER TABLE public.court_exports ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS update_court_exports_updated_at ON public.court_exports;
CREATE TRIGGER update_court_exports_updated_at
BEFORE UPDATE ON public.court_exports
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

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
  AND EXISTS (
    SELECT 1
    FROM public.message_threads mt
    WHERE mt.id = court_exports.source_id
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
);

DROP POLICY IF EXISTS "Authorized family members can create court exports" ON public.court_exports;
CREATE POLICY "Authorized family members can create court exports"
ON public.court_exports
FOR INSERT
WITH CHECK (
  family_id IS NOT NULL
  AND source_type = 'message_thread'
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
  AND EXISTS (
    SELECT 1
    FROM public.message_threads mt
    WHERE mt.id = court_exports.source_id
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
);
