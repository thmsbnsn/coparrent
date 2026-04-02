-- Backfill the explicit family-scope baseline that later 2026 migrations assume.
-- This bridges the older primary_parent/co-parent-era schema into the newer
-- families/family_id model so clean staging replays can succeed.

CREATE TABLE IF NOT EXISTS public.families (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.families ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.family_members
ADD COLUMN IF NOT EXISTS family_id uuid REFERENCES public.families(id) ON DELETE CASCADE;

ALTER TABLE public.family_members
ADD COLUMN IF NOT EXISTS relationship_label text;

ALTER TABLE public.message_threads
ADD COLUMN IF NOT EXISTS family_id uuid REFERENCES public.families(id) ON DELETE CASCADE;

ALTER TABLE public.invitations
ADD COLUMN IF NOT EXISTS family_id uuid REFERENCES public.families(id) ON DELETE SET NULL;

DO $$
BEGIN
  ALTER TYPE public.member_role ADD VALUE IF NOT EXISTS 'child';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'update_families_updated_at'
  ) THEN
    CREATE TRIGGER update_families_updated_at
    BEFORE UPDATE ON public.families
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
      AND tablename = 'families'
      AND policyname = 'Family members can view families'
  ) THEN
    CREATE POLICY "Family members can view families"
    ON public.families
    FOR SELECT
    USING (
      created_by_user_id = auth.uid()
      OR EXISTS (
        SELECT 1
        FROM public.family_members fm
        WHERE fm.family_id = families.id
          AND fm.user_id = auth.uid()
          AND fm.status IN ('active', 'invited')
      )
    );
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_families_created_by_user_id
  ON public.families (created_by_user_id);

CREATE INDEX IF NOT EXISTS idx_family_members_family_id
  ON public.family_members (family_id);

CREATE INDEX IF NOT EXISTS idx_family_members_family_user
  ON public.family_members (family_id, user_id);

CREATE INDEX IF NOT EXISTS idx_message_threads_family_id
  ON public.message_threads (family_id);

CREATE INDEX IF NOT EXISTS idx_invitations_family_id
  ON public.invitations (family_id);

WITH legacy_primary_parents AS (
  SELECT DISTINCT
    fm.primary_parent_id,
    p.user_id,
    COALESCE(
      NULLIF(btrim(p.full_name), ''),
      split_part(COALESCE(p.email, 'Family'), '@', 1) || '''s Family'
    ) AS display_name
  FROM public.family_members fm
  JOIN public.profiles p
    ON p.id = fm.primary_parent_id
  WHERE fm.primary_parent_id IS NOT NULL
    AND fm.family_id IS NULL
)
INSERT INTO public.families (
  created_by_user_id,
  display_name
)
SELECT
  legacy_primary_parents.user_id,
  legacy_primary_parents.display_name
FROM legacy_primary_parents
WHERE NOT EXISTS (
  SELECT 1
  FROM public.families f
  WHERE f.created_by_user_id = legacy_primary_parents.user_id
)
ON CONFLICT DO NOTHING;

UPDATE public.family_members fm
SET family_id = family_lookup.family_id
FROM (
  SELECT DISTINCT ON (p.id)
    p.id AS primary_parent_id,
    f.id AS family_id
  FROM public.profiles p
  JOIN public.families f
    ON f.created_by_user_id = p.user_id
  ORDER BY p.id, f.created_at, f.id
) AS family_lookup
WHERE fm.family_id IS NULL
  AND fm.primary_parent_id = family_lookup.primary_parent_id;

UPDATE public.message_threads mt
SET family_id = family_lookup.family_id
FROM (
  SELECT DISTINCT ON (p.id)
    p.id AS primary_parent_id,
    f.id AS family_id
  FROM public.profiles p
  JOIN public.families f
    ON f.created_by_user_id = p.user_id
  ORDER BY p.id, f.created_at, f.id
) AS family_lookup
WHERE mt.family_id IS NULL
  AND mt.primary_parent_id = family_lookup.primary_parent_id;

UPDATE public.invitations i
SET family_id = family_lookup.family_id
FROM (
  SELECT DISTINCT ON (fm.profile_id)
    fm.profile_id,
    fm.family_id
  FROM public.family_members fm
  WHERE fm.family_id IS NOT NULL
  ORDER BY fm.profile_id, fm.accepted_at NULLS LAST, fm.created_at, fm.id
) AS family_lookup
WHERE i.family_id IS NULL
  AND i.inviter_id = family_lookup.profile_id;
