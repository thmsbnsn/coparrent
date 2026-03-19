-- Ensure every parent/guardian account has a real family membership before
-- family-scoped gates run, and stamp invitations with the target family.

CREATE OR REPLACE FUNCTION public.ensure_parent_family_membership(
  p_user_id uuid,
  p_display_name text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_profile record;
  v_existing_family_id uuid;
  v_family_id uuid;
  v_member_role public.member_role;
  v_label text;
BEGIN
  SELECT id, user_id, full_name, email, account_role
  INTO v_profile
  FROM public.profiles
  WHERE user_id = p_user_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT fm.family_id
  INTO v_existing_family_id
  FROM public.family_members fm
  WHERE fm.user_id = p_user_id
    AND fm.family_id IS NOT NULL
    AND fm.status IN ('active', 'invited')
  ORDER BY
    CASE WHEN fm.status = 'active' THEN 0 ELSE 1 END,
    fm.accepted_at NULLS LAST,
    fm.created_at
  LIMIT 1;

  IF v_existing_family_id IS NOT NULL THEN
    RETURN v_existing_family_id;
  END IF;

  IF COALESCE(v_profile.account_role, 'parent') NOT IN ('parent', 'guardian') THEN
    RETURN NULL;
  END IF;

  v_member_role := CASE
    WHEN v_profile.account_role = 'guardian' THEN 'guardian'::public.member_role
    ELSE 'parent'::public.member_role
  END;

  v_label := NULLIF(btrim(COALESCE(p_display_name, v_profile.full_name)), '');
  IF v_label IS NULL THEN
    v_label := split_part(COALESCE(v_profile.email, 'Family'), '@', 1) || '''s Family';
  END IF;

  INSERT INTO public.families (
    created_by_user_id,
    display_name
  )
  VALUES (
    p_user_id,
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
    accepted_at
  )
  VALUES (
    v_family_id,
    p_user_id,
    v_profile.id,
    v_profile.id,
    v_member_role,
    'active',
    now()
  );

  RETURN v_family_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.ensure_family_member_record(
  p_family_id uuid,
  p_user_id uuid,
  p_profile_id uuid,
  p_primary_parent_id uuid,
  p_role public.member_role,
  p_relationship_label text DEFAULT NULL,
  p_invited_by uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_member_id uuid;
BEGIN
  SELECT id
  INTO v_member_id
  FROM public.family_members
  WHERE family_id = p_family_id
    AND user_id = p_user_id
  LIMIT 1;

  IF v_member_id IS NULL THEN
    INSERT INTO public.family_members (
      family_id,
      user_id,
      profile_id,
      primary_parent_id,
      role,
      relationship_label,
      status,
      invited_by,
      invited_at,
      accepted_at
    )
    VALUES (
      p_family_id,
      p_user_id,
      p_profile_id,
      p_primary_parent_id,
      p_role,
      p_relationship_label,
      'active',
      p_invited_by,
      CASE WHEN p_invited_by IS NOT NULL THEN now() ELSE NULL END,
      now()
    )
    RETURNING id INTO v_member_id;
  ELSE
    UPDATE public.family_members
    SET
      profile_id = p_profile_id,
      primary_parent_id = p_primary_parent_id,
      role = p_role,
      relationship_label = COALESCE(p_relationship_label, relationship_label),
      status = 'active',
      invited_by = COALESCE(p_invited_by, invited_by),
      accepted_at = COALESCE(accepted_at, now()),
      updated_at = now()
    WHERE id = v_member_id;
  END IF;

  RETURN v_member_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_ensure_family_membership(
  p_display_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_profile record;
  v_existing_family_id uuid;
  v_family_id uuid;
  v_role public.member_role;
  v_created boolean := false;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'NOT_AUTHENTICATED',
      'message', 'You must be signed in to continue.'
    );
  END IF;

  SELECT id, account_role
  INTO v_profile
  FROM public.profiles
  WHERE user_id = auth.uid()
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'PROFILE_NOT_FOUND',
      'message', 'Profile not found for this account.'
    );
  END IF;

  SELECT fm.family_id, fm.role
  INTO v_existing_family_id, v_role
  FROM public.family_members fm
  WHERE fm.user_id = auth.uid()
    AND fm.family_id IS NOT NULL
    AND fm.status IN ('active', 'invited')
  ORDER BY
    CASE WHEN fm.status = 'active' THEN 0 ELSE 1 END,
    fm.accepted_at NULLS LAST,
    fm.created_at
  LIMIT 1;

  IF v_existing_family_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'ok', true,
      'data', jsonb_build_object(
        'family_id', v_existing_family_id,
        'role', v_role,
        'created', false
      )
    );
  END IF;

  IF COALESCE(v_profile.account_role, 'parent') NOT IN ('parent', 'guardian') THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'INVITE_REQUIRED',
      'message', 'This account must join an existing family by invitation.'
    );
  END IF;

  v_family_id := public.ensure_parent_family_membership(auth.uid(), p_display_name);
  v_created := v_family_id IS NOT NULL;

  IF v_family_id IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'FAMILY_SETUP_FAILED',
      'message', 'Unable to create a family for this account.'
    );
  END IF;

  SELECT fm.role
  INTO v_role
  FROM public.family_members fm
  WHERE fm.user_id = auth.uid()
    AND fm.family_id = v_family_id
  LIMIT 1;

  RETURN jsonb_build_object(
    'ok', true,
    'data', jsonb_build_object(
      'family_id', v_family_id,
      'role', v_role,
      'created', v_created
    )
  );
END;
$function$;

DROP FUNCTION IF EXISTS public.get_invitation_by_token(uuid);

CREATE OR REPLACE FUNCTION public.get_invitation_by_token(_token uuid)
RETURNS TABLE (
  id uuid,
  inviter_id uuid,
  invitee_email text,
  status text,
  expires_at timestamptz,
  created_at timestamptz,
  inviter_name text,
  inviter_email text,
  family_id uuid,
  invitation_type text,
  role text,
  relationship text,
  child_ids uuid[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    i.id,
    i.inviter_id,
    i.invitee_email,
    i.status,
    i.expires_at,
    i.created_at,
    p.full_name AS inviter_name,
    p.email AS inviter_email,
    i.family_id,
    i.invitation_type,
    i.role::text,
    i.relationship,
    i.child_ids
  FROM public.invitations i
  JOIN public.profiles p ON p.id = i.inviter_id
  WHERE i.token = _token;
END;
$function$;

CREATE OR REPLACE FUNCTION public.accept_coparent_invitation(
  _token uuid,
  _acceptor_user_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_invitation record;
  v_acceptor_profile record;
  v_acceptor_email text;
  v_inviter_profile record;
  v_family_id uuid;
  v_primary_parent_id uuid;
BEGIN
  SELECT email
  INTO v_acceptor_email
  FROM auth.users
  WHERE id = _acceptor_user_id;

  IF v_acceptor_email IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'User not found');
  END IF;

  SELECT *
  INTO v_invitation
  FROM public.invitations
  WHERE token = _token
    AND status = 'pending';

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Invalid or already used invitation');
  END IF;

  IF v_invitation.expires_at < now() THEN
    RETURN json_build_object('success', false, 'error', 'Invitation has expired');
  END IF;

  IF lower(v_invitation.invitee_email) <> lower(v_acceptor_email) THEN
    RETURN json_build_object('success', false, 'error', 'This invitation was sent to a different email address');
  END IF;

  SELECT *
  INTO v_acceptor_profile
  FROM public.profiles
  WHERE user_id = _acceptor_user_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Profile not found');
  END IF;

  SELECT *
  INTO v_inviter_profile
  FROM public.profiles
  WHERE id = v_invitation.inviter_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Inviter profile not found');
  END IF;

  v_family_id := COALESCE(
    v_invitation.family_id,
    public.ensure_parent_family_membership(v_inviter_profile.user_id, v_inviter_profile.full_name)
  );

  IF v_family_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Invitation family not found');
  END IF;

  v_primary_parent_id := LEAST(v_invitation.inviter_id, v_acceptor_profile.id);

  PERFORM public.ensure_family_member_record(
    v_family_id,
    v_inviter_profile.user_id,
    v_inviter_profile.id,
    v_primary_parent_id,
    'parent'::public.member_role,
    NULL,
    NULL
  );

  PERFORM public.ensure_family_member_record(
    v_family_id,
    _acceptor_user_id,
    v_acceptor_profile.id,
    v_primary_parent_id,
    'parent'::public.member_role,
    NULL,
    v_invitation.inviter_id
  );

  UPDATE public.family_members
  SET primary_parent_id = v_primary_parent_id,
      updated_at = now()
  WHERE family_id = v_family_id
    AND role IN ('parent', 'guardian');

  UPDATE public.profiles
  SET co_parent_id = v_invitation.inviter_id
  WHERE id = v_acceptor_profile.id;

  UPDATE public.profiles
  SET co_parent_id = v_acceptor_profile.id
  WHERE id = v_invitation.inviter_id;

  UPDATE public.invitations
  SET
    family_id = v_family_id,
    status = 'accepted',
    updated_at = now()
  WHERE token = _token;

  RETURN json_build_object('success', true, 'family_id', v_family_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.accept_third_party_invitation(
  _token uuid,
  _acceptor_user_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_invitation record;
  v_acceptor_profile record;
  v_acceptor_email text;
  v_inviter_profile record;
  v_family_id uuid;
  v_primary_parent_id uuid;
BEGIN
  SELECT email
  INTO v_acceptor_email
  FROM auth.users
  WHERE id = _acceptor_user_id;

  IF v_acceptor_email IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'User not found');
  END IF;

  SELECT *
  INTO v_invitation
  FROM public.invitations
  WHERE token = _token
    AND status = 'pending';

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Invalid or already used invitation');
  END IF;

  IF v_invitation.expires_at < now() THEN
    RETURN json_build_object('success', false, 'error', 'Invitation has expired');
  END IF;

  IF lower(v_invitation.invitee_email) <> lower(v_acceptor_email) THEN
    RETURN json_build_object('success', false, 'error', 'This invitation was sent to a different email address');
  END IF;

  SELECT *
  INTO v_acceptor_profile
  FROM public.profiles
  WHERE user_id = _acceptor_user_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Profile not found');
  END IF;

  SELECT *
  INTO v_inviter_profile
  FROM public.profiles
  WHERE id = v_invitation.inviter_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Inviter profile not found');
  END IF;

  v_family_id := COALESCE(
    v_invitation.family_id,
    public.ensure_parent_family_membership(v_inviter_profile.user_id, v_inviter_profile.full_name)
  );

  IF v_family_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Invitation family not found');
  END IF;

  SELECT fm.primary_parent_id
  INTO v_primary_parent_id
  FROM public.family_members fm
  WHERE fm.family_id = v_family_id
    AND fm.primary_parent_id IS NOT NULL
  ORDER BY fm.created_at
  LIMIT 1;

  v_primary_parent_id := COALESCE(v_primary_parent_id, v_invitation.inviter_id);

  PERFORM public.ensure_family_member_record(
    v_family_id,
    _acceptor_user_id,
    v_acceptor_profile.id,
    v_primary_parent_id,
    'third_party'::public.member_role,
    COALESCE(v_invitation.relationship, 'other'),
    v_invitation.inviter_id
  );

  UPDATE public.invitations
  SET
    family_id = v_family_id,
    status = 'accepted',
    updated_at = now()
  WHERE token = _token;

  RETURN json_build_object('success', true, 'family_id', v_family_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_create_third_party_invite(
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
  v_primary_parent_id uuid;
  v_family_id uuid;
  v_email text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'NOT_AUTHENTICATED',
      'message', 'You must be logged in to invite family members'
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

  IF NOT public.is_parent_or_guardian(auth.uid()) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'NOT_PARENT',
      'message', 'Only parents or guardians can invite third-party members'
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

  IF v_profile.co_parent_id IS NOT NULL THEN
    v_primary_parent_id := LEAST(v_profile.id, v_profile.co_parent_id);
  ELSE
    v_primary_parent_id := v_profile.id;
  END IF;

  v_family_id := public.ensure_parent_family_membership(auth.uid(), v_profile.full_name);
  IF v_family_id IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'FAMILY_SETUP_FAILED',
      'message', 'Unable to determine the family for this invitation'
    );
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.invitations
    WHERE inviter_id = v_profile.id
      AND invitee_email = v_email
      AND status = 'pending'
      AND expires_at > now()
  ) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'VALIDATION_ERROR',
      'message', 'An invitation has already been sent to this email address'
    );
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
    v_family_id,
    v_email,
    'third_party',
    'third_party',
    COALESCE(p_relationship, 'other'),
    COALESCE(p_child_ids, '{}'),
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

GRANT EXECUTE ON FUNCTION public.rpc_ensure_family_membership(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_third_party_invitation(uuid, uuid) TO authenticated;
