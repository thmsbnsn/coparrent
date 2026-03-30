-- Safe backfill for legacy gift lists where family scope can be resolved
WITH family_candidates AS (
  SELECT gl.id, fm.family_id
  FROM public.gift_lists gl
  JOIN public.family_members fm
    ON fm.profile_id = gl.primary_parent_id
   AND fm.status = 'active'
   AND fm.role IN ('parent', 'guardian')
   AND fm.family_id IS NOT NULL
  JOIN public.parent_children pc
    ON pc.parent_id = fm.profile_id
   AND pc.child_id = gl.child_id
  WHERE gl.family_id IS NULL
),
unambiguous_candidates AS (
  SELECT id, min(family_id) AS family_id
  FROM family_candidates
  GROUP BY id
  HAVING count(DISTINCT family_id) = 1
)
UPDATE public.gift_lists gl
SET family_id = uc.family_id
FROM unambiguous_candidates uc
WHERE gl.id = uc.id
  AND gl.family_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_gift_lists_family_id_event_date
ON public.gift_lists (family_id, event_date);

CREATE OR REPLACE FUNCTION public.enforce_gift_list_family_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid := public.get_current_profile_id();
BEGIN
  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'Authenticated profile required for gift lists';
  END IF;

  IF NEW.family_id IS NULL THEN
    RAISE EXCEPTION 'gift_lists.family_id is required';
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.primary_parent_id IS DISTINCT FROM v_profile_id THEN
      RAISE EXCEPTION 'gift_lists.primary_parent_id must match the authenticated profile';
    END IF;

    RETURN NEW;
  END IF;

  IF NEW.family_id IS DISTINCT FROM OLD.family_id THEN
    RAISE EXCEPTION 'gift_lists.family_id is immutable';
  END IF;

  IF NEW.primary_parent_id IS DISTINCT FROM OLD.primary_parent_id THEN
    RAISE EXCEPTION 'gift_lists.primary_parent_id is immutable';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_gift_list_family_scope ON public.gift_lists;
CREATE TRIGGER enforce_gift_list_family_scope
BEFORE INSERT OR UPDATE ON public.gift_lists
FOR EACH ROW
EXECUTE FUNCTION public.enforce_gift_list_family_scope();

CREATE OR REPLACE FUNCTION public.enforce_gift_item_family_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid := public.get_current_profile_id();
BEGIN
  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'Authenticated profile required for gift items';
  END IF;

  IF NEW.gift_list_id IS NULL THEN
    RAISE EXCEPTION 'gift_items.gift_list_id is required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.gift_lists gl
    WHERE gl.id = NEW.gift_list_id
      AND gl.family_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'gift_items.gift_list_id must reference a family-scoped gift list';
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.created_by IS DISTINCT FROM v_profile_id THEN
      RAISE EXCEPTION 'gift_items.created_by must match the authenticated profile';
    END IF;

    RETURN NEW;
  END IF;

  IF NEW.gift_list_id IS DISTINCT FROM OLD.gift_list_id THEN
    RAISE EXCEPTION 'gift_items.gift_list_id is immutable';
  END IF;

  IF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'gift_items.created_by is immutable';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_gift_item_family_scope ON public.gift_items;
CREATE TRIGGER enforce_gift_item_family_scope
BEFORE INSERT OR UPDATE ON public.gift_items
FOR EACH ROW
EXECUTE FUNCTION public.enforce_gift_item_family_scope();

DROP POLICY IF EXISTS "Parents can create gift lists" ON public.gift_lists;
DROP POLICY IF EXISTS "Family members can view gift lists" ON public.gift_lists;
DROP POLICY IF EXISTS "Parents can update gift lists" ON public.gift_lists;
DROP POLICY IF EXISTS "Parents can delete gift lists" ON public.gift_lists;

CREATE POLICY "Family members can view gift lists"
ON public.gift_lists
FOR SELECT
USING (
  family_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.family_members fm
    WHERE fm.family_id = gift_lists.family_id
      AND fm.profile_id = public.get_current_profile_id()
      AND fm.status = 'active'
  )
);

CREATE POLICY "Parents can create gift lists"
ON public.gift_lists
FOR INSERT
WITH CHECK (
  family_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.family_members fm
    WHERE fm.family_id = gift_lists.family_id
      AND fm.profile_id = public.get_current_profile_id()
      AND fm.status = 'active'
      AND fm.role IN ('parent', 'guardian')
  )
  AND EXISTS (
    SELECT 1
    FROM public.parent_children pc
    JOIN public.family_members fm
      ON fm.profile_id = pc.parent_id
     AND fm.family_id = gift_lists.family_id
     AND fm.status = 'active'
     AND fm.role IN ('parent', 'guardian')
    WHERE pc.child_id = gift_lists.child_id
  )
);

CREATE POLICY "Parents can update gift lists"
ON public.gift_lists
FOR UPDATE
USING (
  family_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.family_members fm
    WHERE fm.family_id = gift_lists.family_id
      AND fm.profile_id = public.get_current_profile_id()
      AND fm.status = 'active'
      AND fm.role IN ('parent', 'guardian')
  )
)
WITH CHECK (
  family_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.family_members fm
    WHERE fm.family_id = gift_lists.family_id
      AND fm.profile_id = public.get_current_profile_id()
      AND fm.status = 'active'
      AND fm.role IN ('parent', 'guardian')
  )
  AND EXISTS (
    SELECT 1
    FROM public.parent_children pc
    JOIN public.family_members fm
      ON fm.profile_id = pc.parent_id
     AND fm.family_id = gift_lists.family_id
     AND fm.status = 'active'
     AND fm.role IN ('parent', 'guardian')
    WHERE pc.child_id = gift_lists.child_id
  )
);

CREATE POLICY "Parents can delete gift lists"
ON public.gift_lists
FOR DELETE
USING (
  family_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.family_members fm
    WHERE fm.family_id = gift_lists.family_id
      AND fm.profile_id = public.get_current_profile_id()
      AND fm.status = 'active'
      AND fm.role IN ('parent', 'guardian')
  )
);

DROP POLICY IF EXISTS "Family members can view gift items" ON public.gift_items;
DROP POLICY IF EXISTS "Parents can create gift items" ON public.gift_items;
DROP POLICY IF EXISTS "Parents can update gift items" ON public.gift_items;
DROP POLICY IF EXISTS "Family members can claim gifts" ON public.gift_items;
DROP POLICY IF EXISTS "Parents can delete gift items" ON public.gift_items;

CREATE POLICY "Family members can view gift items"
ON public.gift_items
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.gift_lists gl
    JOIN public.family_members fm
      ON fm.family_id = gl.family_id
    WHERE gl.id = gift_items.gift_list_id
      AND gl.family_id IS NOT NULL
      AND fm.profile_id = public.get_current_profile_id()
      AND fm.status = 'active'
  )
);

CREATE POLICY "Parents can create gift items"
ON public.gift_items
FOR INSERT
WITH CHECK (
  created_by = public.get_current_profile_id()
  AND EXISTS (
    SELECT 1
    FROM public.gift_lists gl
    JOIN public.family_members fm
      ON fm.family_id = gl.family_id
    WHERE gl.id = gift_items.gift_list_id
      AND gl.family_id IS NOT NULL
      AND fm.profile_id = public.get_current_profile_id()
      AND fm.status = 'active'
      AND fm.role IN ('parent', 'guardian')
  )
);

CREATE POLICY "Parents can update gift items"
ON public.gift_items
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.gift_lists gl
    JOIN public.family_members fm
      ON fm.family_id = gl.family_id
    WHERE gl.id = gift_items.gift_list_id
      AND gl.family_id IS NOT NULL
      AND fm.profile_id = public.get_current_profile_id()
      AND fm.status = 'active'
      AND fm.role IN ('parent', 'guardian')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.gift_lists gl
    JOIN public.family_members fm
      ON fm.family_id = gl.family_id
    WHERE gl.id = gift_items.gift_list_id
      AND gl.family_id IS NOT NULL
      AND fm.profile_id = public.get_current_profile_id()
      AND fm.status = 'active'
      AND fm.role IN ('parent', 'guardian')
  )
);

CREATE POLICY "Family members can claim gifts"
ON public.gift_items
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.gift_lists gl
    JOIN public.family_members fm
      ON fm.family_id = gl.family_id
    WHERE gl.id = gift_items.gift_list_id
      AND gl.family_id IS NOT NULL
      AND fm.profile_id = public.get_current_profile_id()
      AND fm.status = 'active'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.gift_lists gl
    JOIN public.family_members fm
      ON fm.family_id = gl.family_id
    WHERE gl.id = gift_items.gift_list_id
      AND gl.family_id IS NOT NULL
      AND fm.profile_id = public.get_current_profile_id()
      AND fm.status = 'active'
  )
  AND (
    claimed_by IS NULL
    OR claimed_by = public.get_current_profile_id()
  )
);

CREATE POLICY "Parents can delete gift items"
ON public.gift_items
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM public.gift_lists gl
    JOIN public.family_members fm
      ON fm.family_id = gl.family_id
    WHERE gl.id = gift_items.gift_list_id
      AND gl.family_id IS NOT NULL
      AND fm.profile_id = public.get_current_profile_id()
      AND fm.status = 'active'
      AND fm.role IN ('parent', 'guardian')
  )
);
