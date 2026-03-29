CREATE OR REPLACE FUNCTION public.rpc_update_family_display_name(
  p_family_id uuid,
  p_display_name text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_role public.member_role;
  v_label text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Authentication required'
    );
  END IF;

  v_label := NULLIF(btrim(p_display_name), '');

  IF v_label IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Family label is required'
    );
  END IF;

  IF char_length(v_label) > 80 THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Family label must be 80 characters or fewer'
    );
  END IF;

  SELECT fm.role
  INTO v_role
  FROM public.family_members fm
  WHERE fm.family_id = p_family_id
    AND fm.user_id = auth.uid()
    AND fm.status = 'active'
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Family not found'
    );
  END IF;

  IF v_role NOT IN ('parent'::public.member_role, 'guardian'::public.member_role) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Only parent or guardian members can edit the family label'
    );
  END IF;

  UPDATE public.families
  SET
    display_name = v_label,
    updated_at = now()
  WHERE id = p_family_id;

  RETURN json_build_object(
    'success', true,
    'family_id', p_family_id,
    'display_name', v_label
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.rpc_update_family_display_name(uuid, text) TO authenticated;
