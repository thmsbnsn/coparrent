-- Recover rpc_add_child for environments that drifted away from the
-- server-enforced plan-limits migration.

CREATE OR REPLACE FUNCTION public.rpc_add_child(
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
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'NOT_AUTHENTICATED',
      'message', 'You must be logged in to add a child'
    );
  END IF;

  SELECT * INTO v_profile
  FROM profiles
  WHERE user_id = auth.uid();

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'NOT_AUTHENTICATED',
      'message', 'Profile not found'
    );
  END IF;

  IF NOT public.is_parent_or_guardian(auth.uid()) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'NOT_PARENT',
      'message', 'Only parents or guardians can add children'
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

  INSERT INTO public.parent_children (parent_id, child_id, relationship_type)
  VALUES (v_profile.id, v_child.id, 'parent');

  RETURN jsonb_build_object(
    'ok', true,
    'code', 'SUCCESS',
    'message', 'Child added successfully',
    'data', jsonb_build_object(
      'id', v_child.id,
      'name', v_child.name,
      'date_of_birth', v_child.date_of_birth,
      'created_at', v_child.created_at
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_add_child(text, date) TO authenticated;
