CREATE OR REPLACE FUNCTION public.rpc_sync_family_child_links(
  p_family_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid;
  v_inserted_links integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'NOT_AUTHENTICATED',
      'message', 'You must be logged in to sync family children'
    );
  END IF;

  SELECT p.id INTO v_profile_id
  FROM public.profiles p
  WHERE p.user_id = auth.uid()
  LIMIT 1;

  IF v_profile_id IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'NOT_AUTHENTICATED',
      'message', 'Profile not found'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.family_members fm
    WHERE fm.family_id = p_family_id
      AND fm.profile_id = v_profile_id
      AND fm.status = 'active'
      AND fm.role IN ('parent', 'guardian')
  ) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'NOT_PARENT',
      'message', 'Only parents or guardians can sync family children'
    );
  END IF;

  WITH family_parents AS (
    SELECT DISTINCT fm.profile_id
    FROM public.family_members fm
    WHERE fm.family_id = p_family_id
      AND fm.status = 'active'
      AND fm.role IN ('parent', 'guardian')
      AND fm.profile_id IS NOT NULL
  ),
  family_children AS (
    SELECT DISTINCT pc.child_id
    FROM public.parent_children pc
    JOIN family_parents fp ON fp.profile_id = pc.parent_id
  ),
  inserted AS (
    INSERT INTO public.parent_children (parent_id, child_id)
    SELECT fp.profile_id, fc.child_id
    FROM family_parents fp
    CROSS JOIN family_children fc
    ON CONFLICT (parent_id, child_id) DO NOTHING
    RETURNING 1
  )
  SELECT count(*)::integer INTO v_inserted_links
  FROM inserted;

  RETURN jsonb_build_object(
    'ok', true,
    'code', 'SUCCESS',
    'message', 'Family child links synced',
    'data', jsonb_build_object(
      'inserted_links', v_inserted_links
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_sync_family_child_links(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.rpc_add_child_to_family(
  p_family_id uuid,
  p_name text,
  p_dob date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile record;
  v_child record;
  v_usage jsonb;
  v_tier text;
  v_parent_count integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'NOT_AUTHENTICATED',
      'message', 'You must be logged in to add a child'
    );
  END IF;

  SELECT * INTO v_profile
  FROM public.profiles
  WHERE user_id = auth.uid();

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'NOT_AUTHENTICATED',
      'message', 'Profile not found'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.family_members fm
    WHERE fm.family_id = p_family_id
      AND fm.profile_id = v_profile.id
      AND fm.status = 'active'
      AND fm.role IN ('parent', 'guardian')
  ) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'NOT_PARENT',
      'message', 'Only parents or guardians can add children to this family'
    );
  END IF;

  IF p_name IS NULL OR length(trim(p_name)) < 1 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'VALIDATION_ERROR',
      'message', 'Child name is required'
    );
  END IF;

  IF length(trim(p_name)) > 100 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'VALIDATION_ERROR',
      'message', 'Child name must be less than 100 characters'
    );
  END IF;

  v_usage := public.get_plan_usage(v_profile.id);
  v_tier := v_usage->>'tier';

  IF NOT (v_usage->>'can_add_kid')::boolean THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'LIMIT_REACHED',
      'message', format('%s plan allows %s children. Upgrade to Power to add more.',
        initcap(v_tier),
        v_usage->>'max_kids'
      ),
      'meta', jsonb_build_object(
        'tier', v_tier,
        'current', v_usage->>'kids_used',
        'max', v_usage->>'max_kids'
      )
    );
  END IF;

  INSERT INTO public.children (name, date_of_birth)
  VALUES (trim(p_name), p_dob)
  RETURNING * INTO v_child;

  INSERT INTO public.parent_children (parent_id, child_id)
  SELECT DISTINCT fm.profile_id, v_child.id
  FROM public.family_members fm
  WHERE fm.family_id = p_family_id
    AND fm.status = 'active'
    AND fm.role IN ('parent', 'guardian')
    AND fm.profile_id IS NOT NULL
  ON CONFLICT (parent_id, child_id) DO NOTHING;

  GET DIAGNOSTICS v_parent_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'ok', true,
    'code', 'SUCCESS',
    'message', 'Child added successfully',
    'data', jsonb_build_object(
      'id', v_child.id,
      'name', v_child.name,
      'date_of_birth', v_child.date_of_birth,
      'created_at', v_child.created_at,
      'linked_parent_count', v_parent_count
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_add_child_to_family(uuid, text, date) TO authenticated;
