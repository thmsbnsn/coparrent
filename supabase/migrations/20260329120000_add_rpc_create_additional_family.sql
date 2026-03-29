CREATE OR REPLACE FUNCTION public.rpc_create_additional_family(
  p_display_name text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_family_id uuid;
  v_member_role public.member_role;
  v_label text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Authentication required'
    );
  END IF;

  SELECT *
  INTO v_profile
  FROM public.profiles
  WHERE user_id = auth.uid()
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Profile not found'
    );
  END IF;

  IF COALESCE(v_profile.account_role, 'parent') NOT IN ('parent', 'guardian') THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Only parent or guardian accounts can create another family workspace'
    );
  END IF;

  v_member_role := CASE
    WHEN v_profile.account_role = 'guardian' THEN 'guardian'::public.member_role
    ELSE 'parent'::public.member_role
  END;

  v_label := NULLIF(btrim(p_display_name), '');
  IF v_label IS NULL THEN
    v_label := split_part(COALESCE(v_profile.email, 'Family'), '@', 1) || '''s Family';
  END IF;

  INSERT INTO public.families (
    created_by_user_id,
    display_name
  )
  VALUES (
    auth.uid(),
    v_label
  )
  RETURNING id INTO v_family_id;

  INSERT INTO public.family_members (
    family_id,
    user_id,
    profile_id,
    primary_parent_id,
    role,
    status,
    accepted_at,
    relationship_label
  )
  VALUES (
    v_family_id,
    auth.uid(),
    v_profile.id,
    v_profile.id,
    v_member_role,
    'active',
    now(),
    CASE
      WHEN v_member_role = 'guardian'::public.member_role THEN 'Guardian'
      ELSE 'Parent'
    END
  );

  RETURN json_build_object(
    'success', true,
    'family_id', v_family_id,
    'display_name', v_label,
    'role', v_member_role
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.rpc_create_additional_family(text) TO authenticated;
