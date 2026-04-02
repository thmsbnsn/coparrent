ALTER TABLE public.creation_folders
ADD COLUMN IF NOT EXISTS family_id uuid REFERENCES public.families(id) ON DELETE CASCADE;

ALTER TABLE public.creations
ADD COLUMN IF NOT EXISTS family_id uuid REFERENCES public.families(id) ON DELETE CASCADE;

ALTER TABLE public.creation_shares
ADD COLUMN IF NOT EXISTS family_id uuid REFERENCES public.families(id) ON DELETE CASCADE;

ALTER TABLE public.activity_details
ADD COLUMN IF NOT EXISTS family_id uuid REFERENCES public.families(id) ON DELETE CASCADE;

ALTER TABLE public.coloring_page_details
ADD COLUMN IF NOT EXISTS family_id uuid REFERENCES public.families(id) ON DELETE CASCADE;

WITH creation_family_candidates AS (
  SELECT c.id, fm.family_id
  FROM public.creations c
  JOIN public.family_members fm
    ON fm.profile_id = c.owner_profile_id
   AND fm.status = 'active'
   AND fm.family_id IS NOT NULL
  WHERE c.family_id IS NULL
),
unambiguous_creation_families AS (
  SELECT id, min(family_id::text)::uuid AS family_id
  FROM creation_family_candidates
  GROUP BY id
  HAVING count(DISTINCT family_id) = 1
)
UPDATE public.creations c
SET family_id = ucf.family_id
FROM unambiguous_creation_families ucf
WHERE c.id = ucf.id
  AND c.family_id IS NULL;

WITH folder_family_candidates AS (
  SELECT c.folder_id AS id, c.family_id
  FROM public.creations c
  WHERE c.folder_id IS NOT NULL
    AND c.family_id IS NOT NULL
),
unambiguous_folder_families AS (
  SELECT id, min(family_id::text)::uuid AS family_id
  FROM folder_family_candidates
  GROUP BY id
  HAVING count(DISTINCT family_id) = 1
)
UPDATE public.creation_folders cf
SET family_id = uff.family_id
FROM unambiguous_folder_families uff
WHERE cf.id = uff.id
  AND cf.family_id IS NULL;

WITH folder_owner_family_candidates AS (
  SELECT cf.id, fm.family_id
  FROM public.creation_folders cf
  JOIN public.profiles p
    ON p.user_id = cf.owner_user_id
  JOIN public.family_members fm
    ON fm.profile_id = p.id
   AND fm.status = 'active'
   AND fm.family_id IS NOT NULL
  WHERE cf.family_id IS NULL
),
unambiguous_owner_folder_families AS (
  SELECT id, min(family_id::text)::uuid AS family_id
  FROM folder_owner_family_candidates
  GROUP BY id
  HAVING count(DISTINCT family_id) = 1
)
UPDATE public.creation_folders cf
SET family_id = uoff.family_id
FROM unambiguous_owner_folder_families uoff
WHERE cf.id = uoff.id
  AND cf.family_id IS NULL;

UPDATE public.creations c
SET family_id = cf.family_id
FROM public.creation_folders cf
WHERE c.folder_id = cf.id
  AND c.family_id IS NULL
  AND cf.family_id IS NOT NULL;

UPDATE public.creation_shares cs
SET family_id = c.family_id
FROM public.creations c
WHERE cs.creation_id = c.id
  AND cs.family_id IS NULL
  AND c.family_id IS NOT NULL;

UPDATE public.activity_details ad
SET family_id = c.family_id
FROM public.creations c
WHERE c.type = 'activity'
  AND c.detail_id = ad.id
  AND ad.family_id IS NULL
  AND c.family_id IS NOT NULL;

UPDATE public.coloring_page_details cpd
SET family_id = c.family_id
FROM public.creations c
WHERE c.type = 'coloring_page'
  AND c.detail_id = cpd.id
  AND cpd.family_id IS NULL
  AND c.family_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_creation_folders_family_id_name
ON public.creation_folders (family_id, name);

CREATE INDEX IF NOT EXISTS idx_creations_family_id_created_at
ON public.creations (family_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_creation_shares_family_id_shared_with
ON public.creation_shares (family_id, shared_with_profile_id);

CREATE INDEX IF NOT EXISTS idx_activity_details_family_id
ON public.activity_details (family_id);

CREATE INDEX IF NOT EXISTS idx_coloring_page_details_family_id
ON public.coloring_page_details (family_id);

CREATE OR REPLACE FUNCTION public.enforce_creation_folder_family_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid := public.get_current_profile_id();
BEGIN
  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'Authenticated profile required for creation folders';
  END IF;

  IF NEW.family_id IS NULL THEN
    RAISE EXCEPTION 'creation_folders.family_id is required';
  END IF;

  IF NEW.owner_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'creation_folders.owner_user_id must match the authenticated user';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.family_members fm
    WHERE fm.family_id = NEW.family_id
      AND fm.profile_id = v_profile_id
      AND fm.status = 'active'
      AND fm.role IN ('parent', 'guardian')
  ) THEN
    RAISE EXCEPTION 'Not authorized for this creation folder family';
  END IF;

  IF TG_OP <> 'INSERT' THEN
    IF NEW.family_id IS DISTINCT FROM OLD.family_id THEN
      RAISE EXCEPTION 'creation_folders.family_id is immutable';
    END IF;

    IF NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id THEN
      RAISE EXCEPTION 'creation_folders.owner_user_id is immutable';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_creation_folder_family_scope ON public.creation_folders;
CREATE TRIGGER enforce_creation_folder_family_scope
BEFORE INSERT OR UPDATE ON public.creation_folders
FOR EACH ROW
EXECUTE FUNCTION public.enforce_creation_folder_family_scope();

CREATE OR REPLACE FUNCTION public.enforce_activity_detail_family_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid := public.get_current_profile_id();
BEGIN
  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'Authenticated profile required for activity details';
  END IF;

  IF NEW.family_id IS NULL THEN
    RAISE EXCEPTION 'activity_details.family_id is required';
  END IF;

  IF NEW.owner_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'activity_details.owner_user_id must match the authenticated user';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.family_members fm
    WHERE fm.family_id = NEW.family_id
      AND fm.profile_id = v_profile_id
      AND fm.status = 'active'
      AND fm.role IN ('parent', 'guardian')
  ) THEN
    RAISE EXCEPTION 'Not authorized for this activity detail family';
  END IF;

  IF TG_OP <> 'INSERT' THEN
    IF NEW.family_id IS DISTINCT FROM OLD.family_id THEN
      RAISE EXCEPTION 'activity_details.family_id is immutable';
    END IF;

    IF NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id THEN
      RAISE EXCEPTION 'activity_details.owner_user_id is immutable';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_activity_detail_family_scope ON public.activity_details;
CREATE TRIGGER enforce_activity_detail_family_scope
BEFORE INSERT OR UPDATE ON public.activity_details
FOR EACH ROW
EXECUTE FUNCTION public.enforce_activity_detail_family_scope();

CREATE OR REPLACE FUNCTION public.enforce_coloring_page_detail_family_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid := public.get_current_profile_id();
BEGIN
  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'Authenticated profile required for coloring page details';
  END IF;

  IF NEW.family_id IS NULL THEN
    RAISE EXCEPTION 'coloring_page_details.family_id is required';
  END IF;

  IF NEW.owner_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'coloring_page_details.owner_user_id must match the authenticated user';
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

  IF TG_OP <> 'INSERT' THEN
    IF NEW.family_id IS DISTINCT FROM OLD.family_id THEN
      RAISE EXCEPTION 'coloring_page_details.family_id is immutable';
    END IF;

    IF NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id THEN
      RAISE EXCEPTION 'coloring_page_details.owner_user_id is immutable';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_coloring_page_detail_family_scope ON public.coloring_page_details;
CREATE TRIGGER enforce_coloring_page_detail_family_scope
BEFORE INSERT OR UPDATE ON public.coloring_page_details
FOR EACH ROW
EXECUTE FUNCTION public.enforce_coloring_page_detail_family_scope();

CREATE OR REPLACE FUNCTION public.enforce_creation_family_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid := public.get_current_profile_id();
BEGIN
  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'Authenticated profile required for creations';
  END IF;

  IF NEW.family_id IS NULL THEN
    RAISE EXCEPTION 'creations.family_id is required';
  END IF;

  IF NEW.owner_profile_id IS NULL THEN
    RAISE EXCEPTION 'creations.owner_profile_id is required';
  END IF;

  IF NEW.owner_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'creations.owner_user_id must match the authenticated user';
  END IF;

  IF NEW.owner_profile_id IS DISTINCT FROM v_profile_id THEN
    RAISE EXCEPTION 'creations.owner_profile_id must match the authenticated profile';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.family_members fm
    WHERE fm.family_id = NEW.family_id
      AND fm.profile_id = v_profile_id
      AND fm.status = 'active'
      AND fm.role IN ('parent', 'guardian')
  ) THEN
    RAISE EXCEPTION 'Not authorized for this creation family';
  END IF;

  IF NEW.folder_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.creation_folders cf
    WHERE cf.id = NEW.folder_id
      AND cf.family_id = NEW.family_id
      AND cf.owner_user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'creations.folder_id must reference an owned folder in the same family';
  END IF;

  IF NEW.type = 'activity' THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.activity_details ad
      WHERE ad.id = NEW.detail_id
        AND ad.family_id = NEW.family_id
        AND ad.owner_user_id = auth.uid()
    ) THEN
      RAISE EXCEPTION 'activity creations must reference an activity detail in the same family';
    END IF;
  ELSIF NEW.type = 'coloring_page' THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.coloring_page_details cpd
      WHERE cpd.id = NEW.detail_id
        AND cpd.family_id = NEW.family_id
        AND cpd.owner_user_id = auth.uid()
    ) THEN
      RAISE EXCEPTION 'coloring page creations must reference a coloring page detail in the same family';
    END IF;
  ELSE
    RAISE EXCEPTION 'Unsupported creation type: %', NEW.type;
  END IF;

  IF TG_OP <> 'INSERT' THEN
    IF NEW.family_id IS DISTINCT FROM OLD.family_id THEN
      RAISE EXCEPTION 'creations.family_id is immutable';
    END IF;

    IF NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id THEN
      RAISE EXCEPTION 'creations.owner_user_id is immutable';
    END IF;

    IF NEW.owner_profile_id IS DISTINCT FROM OLD.owner_profile_id THEN
      RAISE EXCEPTION 'creations.owner_profile_id is immutable';
    END IF;

    IF NEW.type IS DISTINCT FROM OLD.type THEN
      RAISE EXCEPTION 'creations.type is immutable';
    END IF;

    IF NEW.detail_id IS DISTINCT FROM OLD.detail_id THEN
      RAISE EXCEPTION 'creations.detail_id is immutable';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_creation_family_scope ON public.creations;
CREATE TRIGGER enforce_creation_family_scope
BEFORE INSERT OR UPDATE ON public.creations
FOR EACH ROW
EXECUTE FUNCTION public.enforce_creation_family_scope();

CREATE OR REPLACE FUNCTION public.enforce_creation_share_family_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid := public.get_current_profile_id();
BEGIN
  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'Authenticated profile required for creation sharing';
  END IF;

  IF NEW.family_id IS NULL THEN
    RAISE EXCEPTION 'creation_shares.family_id is required';
  END IF;

  IF NEW.owner_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'creation_shares.owner_user_id must match the authenticated user';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.family_members fm
    WHERE fm.family_id = NEW.family_id
      AND fm.profile_id = v_profile_id
      AND fm.status = 'active'
      AND fm.role IN ('parent', 'guardian')
  ) THEN
    RAISE EXCEPTION 'Not authorized to share creations in this family';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.creations c
    WHERE c.id = NEW.creation_id
      AND c.family_id = NEW.family_id
      AND c.owner_user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'creation_shares.creation_id must reference an owned creation in the same family';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.family_members fm
    WHERE fm.family_id = NEW.family_id
      AND fm.profile_id = NEW.shared_with_profile_id
      AND fm.status = 'active'
  ) THEN
    RAISE EXCEPTION 'creation_shares.shared_with_profile_id must be an active member of the same family';
  END IF;

  IF TG_OP <> 'INSERT' THEN
    IF NEW.family_id IS DISTINCT FROM OLD.family_id THEN
      RAISE EXCEPTION 'creation_shares.family_id is immutable';
    END IF;

    IF NEW.creation_id IS DISTINCT FROM OLD.creation_id THEN
      RAISE EXCEPTION 'creation_shares.creation_id is immutable';
    END IF;

    IF NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id THEN
      RAISE EXCEPTION 'creation_shares.owner_user_id is immutable';
    END IF;

    IF NEW.shared_with_profile_id IS DISTINCT FROM OLD.shared_with_profile_id THEN
      RAISE EXCEPTION 'creation_shares.shared_with_profile_id is immutable';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_creation_share_family_scope ON public.creation_shares;
CREATE TRIGGER enforce_creation_share_family_scope
BEFORE INSERT OR UPDATE ON public.creation_shares
FOR EACH ROW
EXECUTE FUNCTION public.enforce_creation_share_family_scope();

DROP POLICY IF EXISTS "Owners can view their folders" ON public.creation_folders;
DROP POLICY IF EXISTS "Owners can create folders" ON public.creation_folders;
DROP POLICY IF EXISTS "Owners can update their folders" ON public.creation_folders;
DROP POLICY IF EXISTS "Owners can delete their folders" ON public.creation_folders;

CREATE POLICY "Owners can view their family-scoped folders"
ON public.creation_folders
FOR SELECT
USING (
  family_id IS NOT NULL
  AND owner_user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.family_members fm
    WHERE fm.family_id = creation_folders.family_id
      AND fm.profile_id = public.get_current_profile_id()
      AND fm.status = 'active'
      AND fm.role IN ('parent', 'guardian')
  )
);

CREATE POLICY "Owners can create family-scoped folders"
ON public.creation_folders
FOR INSERT
WITH CHECK (
  family_id IS NOT NULL
  AND owner_user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.family_members fm
    WHERE fm.family_id = creation_folders.family_id
      AND fm.profile_id = public.get_current_profile_id()
      AND fm.status = 'active'
      AND fm.role IN ('parent', 'guardian')
  )
);

CREATE POLICY "Owners can update their family-scoped folders"
ON public.creation_folders
FOR UPDATE
USING (
  family_id IS NOT NULL
  AND owner_user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.family_members fm
    WHERE fm.family_id = creation_folders.family_id
      AND fm.profile_id = public.get_current_profile_id()
      AND fm.status = 'active'
      AND fm.role IN ('parent', 'guardian')
  )
)
WITH CHECK (
  family_id IS NOT NULL
  AND owner_user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.family_members fm
    WHERE fm.family_id = creation_folders.family_id
      AND fm.profile_id = public.get_current_profile_id()
      AND fm.status = 'active'
      AND fm.role IN ('parent', 'guardian')
  )
);

CREATE POLICY "Owners can delete their family-scoped folders"
ON public.creation_folders
FOR DELETE
USING (
  family_id IS NOT NULL
  AND owner_user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.family_members fm
    WHERE fm.family_id = creation_folders.family_id
      AND fm.profile_id = public.get_current_profile_id()
      AND fm.status = 'active'
      AND fm.role IN ('parent', 'guardian')
  )
);

DROP POLICY IF EXISTS "Users can view owned or shared creations" ON public.creations;
DROP POLICY IF EXISTS "Users can create their own creations" ON public.creations;
DROP POLICY IF EXISTS "Owners can update their creations" ON public.creations;
DROP POLICY IF EXISTS "Owners can delete their creations" ON public.creations;

CREATE POLICY "Users can view owned or shared family-scoped creations"
ON public.creations
FOR SELECT
USING (
  family_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.family_members fm
    WHERE fm.family_id = creations.family_id
      AND fm.profile_id = public.get_current_profile_id()
      AND fm.status = 'active'
  )
  AND (
    owner_user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.creation_shares cs
      WHERE cs.creation_id = creations.id
        AND cs.family_id = creations.family_id
        AND cs.shared_with_profile_id = public.get_current_profile_id()
    )
  )
);

CREATE POLICY "Users can create family-scoped creations"
ON public.creations
FOR INSERT
WITH CHECK (
  family_id IS NOT NULL
  AND owner_user_id = auth.uid()
  AND owner_profile_id = public.get_current_profile_id()
  AND EXISTS (
    SELECT 1
    FROM public.family_members fm
    WHERE fm.family_id = creations.family_id
      AND fm.profile_id = public.get_current_profile_id()
      AND fm.status = 'active'
      AND fm.role IN ('parent', 'guardian')
  )
);

CREATE POLICY "Owners can update their family-scoped creations"
ON public.creations
FOR UPDATE
USING (
  family_id IS NOT NULL
  AND owner_user_id = auth.uid()
  AND owner_profile_id = public.get_current_profile_id()
  AND EXISTS (
    SELECT 1
    FROM public.family_members fm
    WHERE fm.family_id = creations.family_id
      AND fm.profile_id = public.get_current_profile_id()
      AND fm.status = 'active'
      AND fm.role IN ('parent', 'guardian')
  )
)
WITH CHECK (
  family_id IS NOT NULL
  AND owner_user_id = auth.uid()
  AND owner_profile_id = public.get_current_profile_id()
  AND EXISTS (
    SELECT 1
    FROM public.family_members fm
    WHERE fm.family_id = creations.family_id
      AND fm.profile_id = public.get_current_profile_id()
      AND fm.status = 'active'
      AND fm.role IN ('parent', 'guardian')
  )
);

CREATE POLICY "Owners can delete their family-scoped creations"
ON public.creations
FOR DELETE
USING (
  family_id IS NOT NULL
  AND owner_user_id = auth.uid()
  AND owner_profile_id = public.get_current_profile_id()
  AND EXISTS (
    SELECT 1
    FROM public.family_members fm
    WHERE fm.family_id = creations.family_id
      AND fm.profile_id = public.get_current_profile_id()
      AND fm.status = 'active'
      AND fm.role IN ('parent', 'guardian')
  )
);

DROP POLICY IF EXISTS "Owners can view shares of their creations" ON public.creation_shares;
DROP POLICY IF EXISTS "Shared users can view their shares" ON public.creation_shares;
DROP POLICY IF EXISTS "Owners can create shares" ON public.creation_shares;
DROP POLICY IF EXISTS "Owners can delete shares" ON public.creation_shares;

CREATE POLICY "Owners can view family-scoped creation shares"
ON public.creation_shares
FOR SELECT
USING (
  family_id IS NOT NULL
  AND owner_user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.family_members fm
    WHERE fm.family_id = creation_shares.family_id
      AND fm.profile_id = public.get_current_profile_id()
      AND fm.status = 'active'
      AND fm.role IN ('parent', 'guardian')
  )
);

CREATE POLICY "Shared users can view their family-scoped shares"
ON public.creation_shares
FOR SELECT
USING (
  family_id IS NOT NULL
  AND shared_with_profile_id = public.get_current_profile_id()
  AND EXISTS (
    SELECT 1
    FROM public.family_members fm
    WHERE fm.family_id = creation_shares.family_id
      AND fm.profile_id = public.get_current_profile_id()
      AND fm.status = 'active'
  )
);

CREATE POLICY "Owners can create family-scoped shares"
ON public.creation_shares
FOR INSERT
WITH CHECK (
  family_id IS NOT NULL
  AND owner_user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.family_members fm
    WHERE fm.family_id = creation_shares.family_id
      AND fm.profile_id = public.get_current_profile_id()
      AND fm.status = 'active'
      AND fm.role IN ('parent', 'guardian')
  )
);

CREATE POLICY "Owners can delete family-scoped shares"
ON public.creation_shares
FOR DELETE
USING (
  family_id IS NOT NULL
  AND owner_user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.family_members fm
    WHERE fm.family_id = creation_shares.family_id
      AND fm.profile_id = public.get_current_profile_id()
      AND fm.status = 'active'
      AND fm.role IN ('parent', 'guardian')
  )
);

DROP POLICY IF EXISTS "Owners can manage their activity details" ON public.activity_details;
DROP POLICY IF EXISTS "Shared users can view activity details" ON public.activity_details;

CREATE POLICY "Authorized family members can view activity details"
ON public.activity_details
FOR SELECT
USING (
  family_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.family_members fm
    WHERE fm.family_id = activity_details.family_id
      AND fm.profile_id = public.get_current_profile_id()
      AND fm.status = 'active'
  )
  AND (
    owner_user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.creations c
      JOIN public.creation_shares cs
        ON cs.creation_id = c.id
       AND cs.family_id = c.family_id
      WHERE c.type = 'activity'
        AND c.detail_id = activity_details.id
        AND c.family_id = activity_details.family_id
        AND cs.shared_with_profile_id = public.get_current_profile_id()
    )
  )
);

CREATE POLICY "Owners can insert family-scoped activity details"
ON public.activity_details
FOR INSERT
WITH CHECK (
  family_id IS NOT NULL
  AND owner_user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.family_members fm
    WHERE fm.family_id = activity_details.family_id
      AND fm.profile_id = public.get_current_profile_id()
      AND fm.status = 'active'
      AND fm.role IN ('parent', 'guardian')
  )
);

CREATE POLICY "Owners can update family-scoped activity details"
ON public.activity_details
FOR UPDATE
USING (
  family_id IS NOT NULL
  AND owner_user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.family_members fm
    WHERE fm.family_id = activity_details.family_id
      AND fm.profile_id = public.get_current_profile_id()
      AND fm.status = 'active'
      AND fm.role IN ('parent', 'guardian')
  )
)
WITH CHECK (
  family_id IS NOT NULL
  AND owner_user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.family_members fm
    WHERE fm.family_id = activity_details.family_id
      AND fm.profile_id = public.get_current_profile_id()
      AND fm.status = 'active'
      AND fm.role IN ('parent', 'guardian')
  )
);

CREATE POLICY "Owners can delete family-scoped activity details"
ON public.activity_details
FOR DELETE
USING (
  family_id IS NOT NULL
  AND owner_user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.family_members fm
    WHERE fm.family_id = activity_details.family_id
      AND fm.profile_id = public.get_current_profile_id()
      AND fm.status = 'active'
      AND fm.role IN ('parent', 'guardian')
  )
);

DROP POLICY IF EXISTS "Owners can manage their coloring page details" ON public.coloring_page_details;
DROP POLICY IF EXISTS "Shared users can view coloring page details" ON public.coloring_page_details;

CREATE POLICY "Authorized family members can view coloring page details"
ON public.coloring_page_details
FOR SELECT
USING (
  family_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.family_members fm
    WHERE fm.family_id = coloring_page_details.family_id
      AND fm.profile_id = public.get_current_profile_id()
      AND fm.status = 'active'
  )
  AND (
    owner_user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.creations c
      JOIN public.creation_shares cs
        ON cs.creation_id = c.id
       AND cs.family_id = c.family_id
      WHERE c.type = 'coloring_page'
        AND c.detail_id = coloring_page_details.id
        AND c.family_id = coloring_page_details.family_id
        AND cs.shared_with_profile_id = public.get_current_profile_id()
    )
  )
);

CREATE POLICY "Owners can insert family-scoped coloring page details"
ON public.coloring_page_details
FOR INSERT
WITH CHECK (
  family_id IS NOT NULL
  AND owner_user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.family_members fm
    WHERE fm.family_id = coloring_page_details.family_id
      AND fm.profile_id = public.get_current_profile_id()
      AND fm.status = 'active'
      AND fm.role IN ('parent', 'guardian')
  )
);

CREATE POLICY "Owners can update family-scoped coloring page details"
ON public.coloring_page_details
FOR UPDATE
USING (
  family_id IS NOT NULL
  AND owner_user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.family_members fm
    WHERE fm.family_id = coloring_page_details.family_id
      AND fm.profile_id = public.get_current_profile_id()
      AND fm.status = 'active'
      AND fm.role IN ('parent', 'guardian')
  )
)
WITH CHECK (
  family_id IS NOT NULL
  AND owner_user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.family_members fm
    WHERE fm.family_id = coloring_page_details.family_id
      AND fm.profile_id = public.get_current_profile_id()
      AND fm.status = 'active'
      AND fm.role IN ('parent', 'guardian')
  )
);

CREATE POLICY "Owners can delete family-scoped coloring page details"
ON public.coloring_page_details
FOR DELETE
USING (
  family_id IS NOT NULL
  AND owner_user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.family_members fm
    WHERE fm.family_id = coloring_page_details.family_id
      AND fm.profile_id = public.get_current_profile_id()
      AND fm.status = 'active'
      AND fm.role IN ('parent', 'guardian')
  )
);
