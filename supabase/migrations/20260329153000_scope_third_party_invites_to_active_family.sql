DROP FUNCTION IF EXISTS public.rpc_create_third_party_invite(text, text, uuid[], timestamptz);

CREATE OR REPLACE FUNCTION public.rpc_create_third_party_invite(
  p_family_id uuid,
  p_invitee_email text,
  p_relationship text DEFAULT NULL,
  p_child_ids uuid[] DEFAULT NULL,
  p_expires_at timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_profile record;
  v_usage jsonb;
  v_tier text;
  v_invitation record;
  v_email text;
  v_parent_profile_ids uuid[];
  v_requested_child_count integer := 0;
  v_valid_child_count integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'NOT_AUTHENTICATED',
      'message', 'You must be logged in to invite family members'
    );
  END IF;

  IF p_family_id IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'VALIDATION_ERROR',
      'message', 'Select a family before inviting a third-party member'
    );
  END IF;

  SELECT *
  INTO v_profile
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
      AND fm.user_id = auth.uid()
      AND fm.status = 'active'
      AND fm.role IN ('parent'::public.member_role, 'guardian'::public.member_role)
  ) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'NOT_PARENT',
      'message', 'Only parents or guardians in the active family can invite third-party members'
    );
  END IF;

  v_email := lower(trim(p_invitee_email));
  IF v_email IS NULL OR v_email = '' OR v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'VALIDATION_ERROR',
      'message', 'Please enter a valid email address'
    );
  END IF;

  v_usage := public.get_plan_usage(v_profile.id);
  v_tier := v_usage->>'tier';

  IF NOT (v_usage->>'can_invite_third_party')::boolean THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'LIMIT_REACHED',
      'message', format('%s plan allows %s third-party members. Upgrade to Power to add more.',
        initcap(v_tier),
        v_usage->>'max_third_party'
      ),
      'meta', jsonb_build_object(
        'tier', v_tier,
        'current', v_usage->>'third_party_used',
        'max', v_usage->>'max_third_party'
      )
    );
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.invitations
    WHERE family_id = p_family_id
      AND invitation_type = 'third_party'
      AND invitee_email = v_email
      AND status = 'pending'
      AND expires_at > now()
  ) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'VALIDATION_ERROR',
      'message', 'An invitation has already been sent to this email address for the active family'
    );
  END IF;

  SELECT array_agg(DISTINCT fm.profile_id)
  INTO v_parent_profile_ids
  FROM public.family_members fm
  WHERE fm.family_id = p_family_id
    AND fm.status = 'active'
    AND fm.profile_id IS NOT NULL
    AND fm.role IN ('parent'::public.member_role, 'guardian'::public.member_role);

  IF COALESCE(array_length(p_child_ids, 1), 0) > 0 THEN
    SELECT COUNT(*)
    INTO v_requested_child_count
    FROM (
      SELECT DISTINCT child_id
      FROM unnest(p_child_ids) AS child_id
    ) requested_children;

    SELECT COUNT(DISTINCT pc.child_id)
    INTO v_valid_child_count
    FROM public.parent_children pc
    WHERE pc.parent_id = ANY(COALESCE(v_parent_profile_ids, ARRAY[]::uuid[]))
      AND pc.child_id = ANY(p_child_ids);

    IF v_valid_child_count <> v_requested_child_count THEN
      RETURN jsonb_build_object(
        'ok', false,
        'code', 'VALIDATION_ERROR',
        'message', 'Selected children must belong to the active family'
      );
    END IF;
  END IF;

  INSERT INTO public.invitations (
    inviter_id,
    family_id,
    invitee_email,
    invitation_type,
    role,
    relationship,
    child_ids,
    expires_at
  )
  VALUES (
    v_profile.id,
    p_family_id,
    v_email,
    'third_party',
    'third_party',
    COALESCE(p_relationship, 'other'),
    COALESCE(
      (
        SELECT array_agg(DISTINCT child_id)
        FROM unnest(COALESCE(p_child_ids, ARRAY[]::uuid[])) AS child_id
      ),
      ARRAY[]::uuid[]
    ),
    COALESCE(p_expires_at, now() + interval '7 days')
  )
  RETURNING * INTO v_invitation;

  RETURN jsonb_build_object(
    'ok', true,
    'data', jsonb_build_object(
      'id', v_invitation.id,
      'token', v_invitation.token,
      'invitee_email', v_invitation.invitee_email,
      'status', v_invitation.status,
      'family_id', v_invitation.family_id,
      'expires_at', v_invitation.expires_at
    )
  );
EXCEPTION WHEN unique_violation THEN
  RETURN jsonb_build_object(
    'ok', false,
    'code', 'VALIDATION_ERROR',
    'message', 'An invitation already exists for this email address'
  );
WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'ok', false,
    'code', 'UNKNOWN_ERROR',
    'message', 'An unexpected error occurred'
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.rpc_create_third_party_invite(uuid, text, text, uuid[], timestamptz) TO authenticated;
