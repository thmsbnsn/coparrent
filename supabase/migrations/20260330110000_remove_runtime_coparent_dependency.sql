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
  v_inviter_membership record;
BEGIN
  SELECT email
  INTO v_acceptor_email
  FROM auth.users
  WHERE id = _acceptor_user_id;

  IF v_acceptor_email IS NULL THEN
    RETURN json_build_object('success', false, 'code', 'USER_NOT_FOUND', 'error', 'User not found');
  END IF;

  SELECT *
  INTO v_invitation
  FROM public.invitations
  WHERE token = _token
    AND status = 'pending';

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'code', 'INVITATION_NOT_FOUND', 'error', 'Invitation not found or already accepted');
  END IF;

  IF v_invitation.expires_at < now() THEN
    RETURN json_build_object('success', false, 'code', 'INVITATION_EXPIRED', 'error', 'Invitation has expired');
  END IF;

  IF lower(v_invitation.invitee_email) <> lower(v_acceptor_email) THEN
    RETURN json_build_object('success', false, 'code', 'EMAIL_MISMATCH', 'error', 'This invitation was sent to a different email address');
  END IF;

  IF v_invitation.family_id IS NULL THEN
    RETURN json_build_object('success', false, 'code', 'FAMILY_ID_REQUIRED', 'error', 'Invitation is missing family_id');
  END IF;

  v_family_id := v_invitation.family_id;

  SELECT *
  INTO v_acceptor_profile
  FROM public.profiles
  WHERE user_id = _acceptor_user_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'code', 'PROFILE_NOT_FOUND', 'error', 'Profile not found');
  END IF;

  SELECT *
  INTO v_inviter_profile
  FROM public.profiles
  WHERE id = v_invitation.inviter_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'code', 'INVITER_PROFILE_NOT_FOUND', 'error', 'Inviter profile not found');
  END IF;

  SELECT fm.*
  INTO v_inviter_membership
  FROM public.family_members fm
  WHERE fm.family_id = v_family_id
    AND fm.user_id = v_inviter_profile.user_id
    AND fm.status IN ('active', 'invited')
    AND fm.role IN ('parent', 'guardian')
  ORDER BY
    CASE WHEN fm.status = 'active' THEN 0 ELSE 1 END,
    fm.accepted_at NULLS LAST,
    fm.created_at
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'code', 'INVITER_NOT_IN_FAMILY', 'error', 'Inviting parent is not active in the invitation family');
  END IF;

  v_primary_parent_id := COALESCE(v_inviter_membership.primary_parent_id, v_inviter_membership.profile_id, v_inviter_profile.id);

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

  UPDATE public.invitations
  SET family_id = v_family_id,
      status = 'accepted',
      updated_at = now()
  WHERE token = _token;

  RETURN json_build_object('success', true, 'family_id', v_family_id, 'role', 'parent');
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
  v_inviter_membership record;
BEGIN
  SELECT email
  INTO v_acceptor_email
  FROM auth.users
  WHERE id = _acceptor_user_id;

  IF v_acceptor_email IS NULL THEN
    RETURN json_build_object('success', false, 'code', 'USER_NOT_FOUND', 'error', 'User not found');
  END IF;

  SELECT *
  INTO v_invitation
  FROM public.invitations
  WHERE token = _token
    AND status = 'pending';

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'code', 'INVITATION_NOT_FOUND', 'error', 'Invitation not found or already accepted');
  END IF;

  IF v_invitation.expires_at < now() THEN
    RETURN json_build_object('success', false, 'code', 'INVITATION_EXPIRED', 'error', 'Invitation has expired');
  END IF;

  IF lower(v_invitation.invitee_email) <> lower(v_acceptor_email) THEN
    RETURN json_build_object('success', false, 'code', 'EMAIL_MISMATCH', 'error', 'This invitation was sent to a different email address');
  END IF;

  IF v_invitation.family_id IS NULL THEN
    RETURN json_build_object('success', false, 'code', 'FAMILY_ID_REQUIRED', 'error', 'Invitation is missing family_id');
  END IF;

  v_family_id := v_invitation.family_id;

  SELECT *
  INTO v_acceptor_profile
  FROM public.profiles
  WHERE user_id = _acceptor_user_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'code', 'PROFILE_NOT_FOUND', 'error', 'Profile not found');
  END IF;

  SELECT *
  INTO v_inviter_profile
  FROM public.profiles
  WHERE id = v_invitation.inviter_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'code', 'INVITER_PROFILE_NOT_FOUND', 'error', 'Inviter profile not found');
  END IF;

  SELECT fm.*
  INTO v_inviter_membership
  FROM public.family_members fm
  WHERE fm.family_id = v_family_id
    AND fm.user_id = v_inviter_profile.user_id
    AND fm.status IN ('active', 'invited')
    AND fm.role IN ('parent', 'guardian')
  ORDER BY
    CASE WHEN fm.status = 'active' THEN 0 ELSE 1 END,
    fm.accepted_at NULLS LAST,
    fm.created_at
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'code', 'INVITER_NOT_IN_FAMILY', 'error', 'Inviting parent is not active in the invitation family');
  END IF;

  v_primary_parent_id := COALESCE(v_inviter_membership.primary_parent_id, v_inviter_membership.profile_id, v_inviter_profile.id);

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
  SET family_id = v_family_id,
      status = 'accepted',
      updated_at = now()
  WHERE token = _token;

  RETURN json_build_object('success', true, 'family_id', v_family_id, 'role', 'third_party');
END;
$function$;
