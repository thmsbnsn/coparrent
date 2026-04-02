ALTER TABLE public.activity_folders
ADD COLUMN IF NOT EXISTS family_id uuid REFERENCES public.families(id) ON DELETE CASCADE;

ALTER TABLE public.generated_activities
ADD COLUMN IF NOT EXISTS family_id uuid REFERENCES public.families(id) ON DELETE CASCADE;

ALTER TABLE public.activity_shares
ADD COLUMN IF NOT EXISTS family_id uuid REFERENCES public.families(id) ON DELETE CASCADE;

ALTER TABLE public.coloring_pages
ADD COLUMN IF NOT EXISTS family_id uuid REFERENCES public.families(id) ON DELETE CASCADE;

WITH activity_folder_family_candidates AS (
  SELECT af.id, fm.family_id
  FROM public.activity_folders af
  JOIN public.family_members fm
    ON fm.user_id = af.user_id
   AND fm.status = 'active'
   AND fm.family_id IS NOT NULL
  WHERE af.family_id IS NULL
),
unambiguous_activity_folder_families AS (
  SELECT id, min(family_id::text)::uuid AS family_id
  FROM activity_folder_family_candidates
  GROUP BY id
  HAVING count(DISTINCT family_id) = 1
)
UPDATE public.activity_folders af
SET family_id = uaff.family_id
FROM unambiguous_activity_folder_families uaff
WHERE af.id = uaff.id
  AND af.family_id IS NULL;

WITH generated_activity_folder_candidates AS (
  SELECT ga.id, af.family_id
  FROM public.generated_activities ga
  JOIN public.activity_folders af
    ON af.id = ga.folder_id
   AND af.family_id IS NOT NULL
  WHERE ga.family_id IS NULL
),
unambiguous_generated_activity_folder_families AS (
  SELECT id, min(family_id::text)::uuid AS family_id
  FROM generated_activity_folder_candidates
  GROUP BY id
  HAVING count(DISTINCT family_id) = 1
),
generated_activity_user_candidates AS (
  SELECT ga.id, fm.family_id
  FROM public.generated_activities ga
  JOIN public.family_members fm
    ON fm.user_id = ga.user_id
   AND fm.status = 'active'
   AND fm.family_id IS NOT NULL
  WHERE ga.family_id IS NULL
),
unambiguous_generated_activity_user_families AS (
  SELECT id, min(family_id::text)::uuid AS family_id
  FROM generated_activity_user_candidates
  GROUP BY id
  HAVING count(DISTINCT family_id) = 1
),
generated_activity_resolved_families AS (
  SELECT
    COALESCE(ugaff.id, ugauf.id) AS id,
    CASE
      WHEN ugaff.family_id IS NOT NULL AND ugauf.family_id IS NOT NULL AND ugaff.family_id = ugauf.family_id THEN ugaff.family_id
      WHEN ugaff.family_id IS NOT NULL AND ugauf.family_id IS NULL THEN ugaff.family_id
      WHEN ugaff.family_id IS NULL AND ugauf.family_id IS NOT NULL THEN ugauf.family_id
      ELSE NULL
    END AS family_id
  FROM unambiguous_generated_activity_folder_families ugaff
  FULL OUTER JOIN unambiguous_generated_activity_user_families ugauf
    ON ugaff.id = ugauf.id
)
UPDATE public.generated_activities ga
SET family_id = garf.family_id
FROM generated_activity_resolved_families garf
WHERE ga.id = garf.id
  AND ga.family_id IS NULL
  AND garf.family_id IS NOT NULL;

UPDATE public.activity_shares ash
SET family_id = ga.family_id
FROM public.generated_activities ga
WHERE ash.activity_id = ga.id
  AND ash.family_id IS NULL
  AND ga.family_id IS NOT NULL;

WITH coloring_page_family_candidates AS (
  SELECT cp.id, fm.family_id
  FROM public.coloring_pages cp
  JOIN public.family_members fm
    ON fm.user_id = cp.user_id
   AND fm.status = 'active'
   AND fm.family_id IS NOT NULL
  WHERE cp.family_id IS NULL
),
unambiguous_coloring_page_families AS (
  SELECT id, min(family_id::text)::uuid AS family_id
  FROM coloring_page_family_candidates
  GROUP BY id
  HAVING count(DISTINCT family_id) = 1
)
UPDATE public.coloring_pages cp
SET family_id = ucpf.family_id
FROM unambiguous_coloring_page_families ucpf
WHERE cp.id = ucpf.id
  AND cp.family_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_activity_folders_family_id_created_at
ON public.activity_folders (family_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_generated_activities_family_id_created_at
ON public.generated_activities (family_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_shares_family_id_shared_with
ON public.activity_shares (family_id, shared_with_profile_id);

CREATE INDEX IF NOT EXISTS idx_coloring_pages_family_id_created_at
ON public.coloring_pages (family_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.enforce_activity_folder_family_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid := public.get_current_profile_id();
BEGIN
  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'Authenticated profile required for activity folders';
  END IF;

  IF NEW.family_id IS NULL THEN
    RAISE EXCEPTION 'activity_folders.family_id is required';
  END IF;

  IF NEW.user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'activity_folders.user_id must match the authenticated user';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.family_members fm
    WHERE fm.family_id = NEW.family_id
      AND fm.profile_id = v_profile_id
      AND fm.status = 'active'
      AND fm.role IN ('parent', 'guardian')
  ) THEN
    RAISE EXCEPTION 'Not authorized for this activity folder family';
  END IF;

  IF TG_OP <> 'INSERT' THEN
    IF NEW.family_id IS DISTINCT FROM OLD.family_id THEN
      RAISE EXCEPTION 'activity_folders.family_id is immutable';
    END IF;

    IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
      RAISE EXCEPTION 'activity_folders.user_id is immutable';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_activity_folder_family_scope ON public.activity_folders;
CREATE TRIGGER enforce_activity_folder_family_scope
BEFORE INSERT OR UPDATE ON public.activity_folders
FOR EACH ROW
EXECUTE FUNCTION public.enforce_activity_folder_family_scope();

CREATE OR REPLACE FUNCTION public.enforce_generated_activity_family_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid := public.get_current_profile_id();
BEGIN
  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'Authenticated profile required for generated activities';
  END IF;

  IF NEW.family_id IS NULL THEN
    RAISE EXCEPTION 'generated_activities.family_id is required';
  END IF;

  IF NEW.user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'generated_activities.user_id must match the authenticated user';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.family_members fm
    WHERE fm.family_id = NEW.family_id
      AND fm.profile_id = v_profile_id
      AND fm.status = 'active'
      AND fm.role IN ('parent', 'guardian')
  ) THEN
    RAISE EXCEPTION 'Not authorized for this generated activity family';
  END IF;

  IF NEW.folder_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.activity_folders af
    WHERE af.id = NEW.folder_id
      AND af.family_id = NEW.family_id
      AND af.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'generated_activities.folder_id must reference an owned folder in the same family';
  END IF;

  IF TG_OP <> 'INSERT' THEN
    IF NEW.family_id IS DISTINCT FROM OLD.family_id THEN
      RAISE EXCEPTION 'generated_activities.family_id is immutable';
    END IF;

    IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
      RAISE EXCEPTION 'generated_activities.user_id is immutable';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_generated_activity_family_scope ON public.generated_activities;
CREATE TRIGGER enforce_generated_activity_family_scope
BEFORE INSERT OR UPDATE ON public.generated_activities
FOR EACH ROW
EXECUTE FUNCTION public.enforce_generated_activity_family_scope();

CREATE OR REPLACE FUNCTION public.enforce_activity_share_family_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid := public.get_current_profile_id();
BEGIN
  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'Authenticated profile required for activity sharing';
  END IF;

  IF NEW.family_id IS NULL THEN
    RAISE EXCEPTION 'activity_shares.family_id is required';
  END IF;

  IF NEW.owner_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'activity_shares.owner_user_id must match the authenticated user';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.family_members fm
    WHERE fm.family_id = NEW.family_id
      AND fm.profile_id = v_profile_id
      AND fm.status = 'active'
      AND fm.role IN ('parent', 'guardian')
  ) THEN
    RAISE EXCEPTION 'Not authorized to share activities in this family';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.generated_activities ga
    WHERE ga.id = NEW.activity_id
      AND ga.family_id = NEW.family_id
      AND ga.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'activity_shares.activity_id must reference an owned activity in the same family';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.family_members fm
    WHERE fm.family_id = NEW.family_id
      AND fm.profile_id = NEW.shared_with_profile_id
      AND fm.status = 'active'
  ) THEN
    RAISE EXCEPTION 'activity_shares.shared_with_profile_id must be an active member of the same family';
  END IF;

  IF TG_OP <> 'INSERT' THEN
    IF NEW.family_id IS DISTINCT FROM OLD.family_id THEN
      RAISE EXCEPTION 'activity_shares.family_id is immutable';
    END IF;

    IF NEW.activity_id IS DISTINCT FROM OLD.activity_id THEN
      RAISE EXCEPTION 'activity_shares.activity_id is immutable';
    END IF;

    IF NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id THEN
      RAISE EXCEPTION 'activity_shares.owner_user_id is immutable';
    END IF;

    IF NEW.shared_with_profile_id IS DISTINCT FROM OLD.shared_with_profile_id THEN
      RAISE EXCEPTION 'activity_shares.shared_with_profile_id is immutable';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_activity_share_family_scope ON public.activity_shares;
CREATE TRIGGER enforce_activity_share_family_scope
BEFORE INSERT OR UPDATE ON public.activity_shares
FOR EACH ROW
EXECUTE FUNCTION public.enforce_activity_share_family_scope();

CREATE OR REPLACE FUNCTION public.enforce_coloring_page_update_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid := public.get_current_profile_id();
BEGIN
  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'Authenticated profile required for coloring page updates';
  END IF;

  IF NEW.family_id IS NULL THEN
    RAISE EXCEPTION 'coloring_pages.family_id is required';
  END IF;

  IF NEW.user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'coloring_pages.user_id must match the authenticated user';
  END IF;

  IF NEW.family_id IS DISTINCT FROM OLD.family_id THEN
    RAISE EXCEPTION 'coloring_pages.family_id is immutable';
  END IF;

  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'coloring_pages.user_id is immutable';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.family_members fm
    WHERE fm.family_id = NEW.family_id
      AND fm.profile_id = v_profile_id
      AND fm.status = 'active'
      AND fm.role IN ('parent', 'guardian')
  ) THEN
    RAISE EXCEPTION 'Not authorized for this coloring page family';
  END IF;

  IF NEW.document_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.documents d
    WHERE d.id = NEW.document_id
      AND d.family_id = NEW.family_id
  ) THEN
    RAISE EXCEPTION 'coloring_pages.document_id must reference a document in the same family';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_coloring_page_update_scope ON public.coloring_pages;
CREATE TRIGGER enforce_coloring_page_update_scope
BEFORE UPDATE ON public.coloring_pages
FOR EACH ROW
EXECUTE FUNCTION public.enforce_coloring_page_update_scope();

DROP POLICY IF EXISTS "Users can view their own folders" ON public.activity_folders;
DROP POLICY IF EXISTS "Users can create their own folders" ON public.activity_folders;
DROP POLICY IF EXISTS "Users can update their own folders" ON public.activity_folders;
DROP POLICY IF EXISTS "Users can delete their own folders" ON public.activity_folders;

CREATE POLICY "Users can view their family-scoped activity folders"
ON public.activity_folders
FOR SELECT
USING (
  family_id IS NOT NULL
  AND user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.family_members fm
    WHERE fm.family_id = activity_folders.family_id
      AND fm.profile_id = public.get_current_profile_id()
      AND fm.status = 'active'
      AND fm.role IN ('parent', 'guardian')
  )
);

CREATE POLICY "Users can create family-scoped activity folders"
ON public.activity_folders
FOR INSERT
WITH CHECK (
  family_id IS NOT NULL
  AND user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.family_members fm
    WHERE fm.family_id = activity_folders.family_id
      AND fm.profile_id = public.get_current_profile_id()
      AND fm.status = 'active'
      AND fm.role IN ('parent', 'guardian')
  )
);

CREATE POLICY "Users can update family-scoped activity folders"
ON public.activity_folders
FOR UPDATE
USING (
  family_id IS NOT NULL
  AND user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.family_members fm
    WHERE fm.family_id = activity_folders.family_id
      AND fm.profile_id = public.get_current_profile_id()
      AND fm.status = 'active'
      AND fm.role IN ('parent', 'guardian')
  )
)
WITH CHECK (
  family_id IS NOT NULL
  AND user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.family_members fm
    WHERE fm.family_id = activity_folders.family_id
      AND fm.profile_id = public.get_current_profile_id()
      AND fm.status = 'active'
      AND fm.role IN ('parent', 'guardian')
  )
);

CREATE POLICY "Users can delete family-scoped activity folders"
ON public.activity_folders
FOR DELETE
USING (
  family_id IS NOT NULL
  AND user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.family_members fm
    WHERE fm.family_id = activity_folders.family_id
      AND fm.profile_id = public.get_current_profile_id()
      AND fm.status = 'active'
      AND fm.role IN ('parent', 'guardian')
  )
);

DROP POLICY IF EXISTS "Users can view own activities" ON public.generated_activities;
DROP POLICY IF EXISTS "Users can view shared activities" ON public.generated_activities;
DROP POLICY IF EXISTS "Users can create their own activities" ON public.generated_activities;
DROP POLICY IF EXISTS "Users can update their own activities" ON public.generated_activities;
DROP POLICY IF EXISTS "Users can delete their own activities" ON public.generated_activities;

CREATE POLICY "Users can view family-scoped generated activities"
ON public.generated_activities
FOR SELECT
USING (
  family_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.family_members fm
    WHERE fm.family_id = generated_activities.family_id
      AND fm.profile_id = public.get_current_profile_id()
      AND fm.status = 'active'
  )
  AND (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.activity_shares ash
      WHERE ash.activity_id = generated_activities.id
        AND ash.family_id = generated_activities.family_id
        AND ash.shared_with_profile_id = public.get_current_profile_id()
    )
  )
);

CREATE POLICY "Users can create family-scoped generated activities"
ON public.generated_activities
FOR INSERT
WITH CHECK (
  family_id IS NOT NULL
  AND user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.family_members fm
    WHERE fm.family_id = generated_activities.family_id
      AND fm.profile_id = public.get_current_profile_id()
      AND fm.status = 'active'
      AND fm.role IN ('parent', 'guardian')
  )
);

CREATE POLICY "Users can update family-scoped generated activities"
ON public.generated_activities
FOR UPDATE
USING (
  family_id IS NOT NULL
  AND user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.family_members fm
    WHERE fm.family_id = generated_activities.family_id
      AND fm.profile_id = public.get_current_profile_id()
      AND fm.status = 'active'
      AND fm.role IN ('parent', 'guardian')
  )
)
WITH CHECK (
  family_id IS NOT NULL
  AND user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.family_members fm
    WHERE fm.family_id = generated_activities.family_id
      AND fm.profile_id = public.get_current_profile_id()
      AND fm.status = 'active'
      AND fm.role IN ('parent', 'guardian')
  )
);

CREATE POLICY "Users can delete family-scoped generated activities"
ON public.generated_activities
FOR DELETE
USING (
  family_id IS NOT NULL
  AND user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.family_members fm
    WHERE fm.family_id = generated_activities.family_id
      AND fm.profile_id = public.get_current_profile_id()
      AND fm.status = 'active'
      AND fm.role IN ('parent', 'guardian')
  )
);

DROP POLICY IF EXISTS "Owners can view their shares" ON public.activity_shares;
DROP POLICY IF EXISTS "Shared users can view shares" ON public.activity_shares;
DROP POLICY IF EXISTS "Owners can create shares" ON public.activity_shares;
DROP POLICY IF EXISTS "Owners can delete shares" ON public.activity_shares;

CREATE POLICY "Owners can view family-scoped activity shares"
ON public.activity_shares
FOR SELECT
USING (
  family_id IS NOT NULL
  AND owner_user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.family_members fm
    WHERE fm.family_id = activity_shares.family_id
      AND fm.profile_id = public.get_current_profile_id()
      AND fm.status = 'active'
      AND fm.role IN ('parent', 'guardian')
  )
);

CREATE POLICY "Shared users can view family-scoped activity shares"
ON public.activity_shares
FOR SELECT
USING (
  family_id IS NOT NULL
  AND shared_with_profile_id = public.get_current_profile_id()
  AND EXISTS (
    SELECT 1
    FROM public.family_members fm
    WHERE fm.family_id = activity_shares.family_id
      AND fm.profile_id = public.get_current_profile_id()
      AND fm.status = 'active'
  )
);

CREATE POLICY "Owners can create family-scoped activity shares"
ON public.activity_shares
FOR INSERT
WITH CHECK (
  family_id IS NOT NULL
  AND owner_user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.family_members fm
    WHERE fm.family_id = activity_shares.family_id
      AND fm.profile_id = public.get_current_profile_id()
      AND fm.status = 'active'
      AND fm.role IN ('parent', 'guardian')
  )
);

CREATE POLICY "Owners can delete family-scoped activity shares"
ON public.activity_shares
FOR DELETE
USING (
  family_id IS NOT NULL
  AND owner_user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.family_members fm
    WHERE fm.family_id = activity_shares.family_id
      AND fm.profile_id = public.get_current_profile_id()
      AND fm.status = 'active'
      AND fm.role IN ('parent', 'guardian')
  )
);

DROP POLICY IF EXISTS "Users can view their own coloring pages" ON public.coloring_pages;
DROP POLICY IF EXISTS "Users can create their own coloring pages" ON public.coloring_pages;
DROP POLICY IF EXISTS "Users can delete their own coloring pages" ON public.coloring_pages;

CREATE POLICY "Users can view their family-scoped coloring pages"
ON public.coloring_pages
FOR SELECT
USING (
  family_id IS NOT NULL
  AND user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.family_members fm
    WHERE fm.family_id = coloring_pages.family_id
      AND fm.profile_id = public.get_current_profile_id()
      AND fm.status = 'active'
      AND fm.role IN ('parent', 'guardian')
  )
);

CREATE POLICY "Users can create their family-scoped coloring pages"
ON public.coloring_pages
FOR INSERT
WITH CHECK (
  family_id IS NOT NULL
  AND user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.family_members fm
    WHERE fm.family_id = coloring_pages.family_id
      AND fm.profile_id = public.get_current_profile_id()
      AND fm.status = 'active'
      AND fm.role IN ('parent', 'guardian')
  )
);

CREATE POLICY "Users can update their family-scoped coloring pages"
ON public.coloring_pages
FOR UPDATE
USING (
  family_id IS NOT NULL
  AND user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.family_members fm
    WHERE fm.family_id = coloring_pages.family_id
      AND fm.profile_id = public.get_current_profile_id()
      AND fm.status = 'active'
      AND fm.role IN ('parent', 'guardian')
  )
)
WITH CHECK (
  family_id IS NOT NULL
  AND user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.family_members fm
    WHERE fm.family_id = coloring_pages.family_id
      AND fm.profile_id = public.get_current_profile_id()
      AND fm.status = 'active'
      AND fm.role IN ('parent', 'guardian')
  )
);

CREATE POLICY "Users can delete their family-scoped coloring pages"
ON public.coloring_pages
FOR DELETE
USING (
  family_id IS NOT NULL
  AND user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.family_members fm
    WHERE fm.family_id = coloring_pages.family_id
      AND fm.profile_id = public.get_current_profile_id()
      AND fm.status = 'active'
      AND fm.role IN ('parent', 'guardian')
  )
);
