-- Kids portal foundation:
-- - explicit family-scoped child portal settings
-- - under-6 parent approval requests
-- - child calling permissions with append-only history
-- - family-scoped child account context and management RPCs

DO $$
BEGIN
  CREATE TYPE public.kid_portal_mode AS ENUM ('under_6', 'age_6_to_12');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE public.kid_portal_request_status AS ENUM ('pending', 'approved', 'declined', 'expired');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE public.child_call_mode AS ENUM ('audio_only', 'audio_video');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS child_username text;

CREATE TABLE IF NOT EXISTS public.child_portal_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  child_id uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  child_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  portal_mode public.kid_portal_mode NOT NULL DEFAULT 'under_6',
  child_email text,
  reset_via_child_email boolean NOT NULL DEFAULT false,
  created_by_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  updated_by_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT child_portal_settings_family_child_unique UNIQUE (family_id, child_id),
  CONSTRAINT child_portal_settings_child_profile_unique UNIQUE (child_profile_id),
  CONSTRAINT child_portal_settings_child_email_required CHECK (
    reset_via_child_email = false
    OR NULLIF(btrim(child_email), '') IS NOT NULL
  )
);

CREATE TABLE IF NOT EXISTS public.kid_portal_access_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  child_id uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  requested_by_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  resolved_by_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  portal_mode public.kid_portal_mode NOT NULL,
  status public.kid_portal_request_status NOT NULL DEFAULT 'pending',
  requested_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  session_expires_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.child_call_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  child_id uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  child_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  calling_enabled boolean NOT NULL DEFAULT false,
  allowed_outbound_member_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  allowed_inbound_member_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  call_mode public.child_call_mode NOT NULL DEFAULT 'audio_only',
  created_by_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  updated_by_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT child_call_settings_family_child_unique UNIQUE (family_id, child_id),
  CONSTRAINT child_call_settings_child_profile_unique UNIQUE (child_profile_id)
);

CREATE TABLE IF NOT EXISTS public.child_call_settings_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  child_id uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  child_call_settings_id uuid REFERENCES public.child_call_settings(id) ON DELETE SET NULL,
  actor_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  actor_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  previous_setting jsonb NOT NULL DEFAULT '{}'::jsonb,
  new_setting jsonb NOT NULL DEFAULT '{}'::jsonb,
  additional_information text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.child_portal_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kid_portal_access_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.child_call_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.child_call_settings_history ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_child_username_unique
  ON public.profiles (lower(child_username))
  WHERE child_username IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_kid_portal_access_requests_pending
  ON public.kid_portal_access_requests (family_id, child_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_child_portal_settings_family_child
  ON public.child_portal_settings (family_id, child_id);

CREATE INDEX IF NOT EXISTS idx_child_call_settings_family_child
  ON public.child_call_settings (family_id, child_id);

CREATE INDEX IF NOT EXISTS idx_child_call_settings_history_family_child_created
  ON public.child_call_settings_history (family_id, child_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_kid_portal_access_requests_family_status
  ON public.kid_portal_access_requests (family_id, status, requested_at DESC);

CREATE OR REPLACE FUNCTION public.get_family_actor_profile_id(
  p_family_id uuid,
  p_user_id uuid
)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT fm.profile_id
  FROM public.family_members fm
  WHERE fm.family_id = p_family_id
    AND fm.user_id = p_user_id
    AND fm.status = 'active'
  ORDER BY fm.created_at
  LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.can_manage_family_child_settings(
  p_family_id uuid,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.family_members fm
    WHERE fm.family_id = p_family_id
      AND fm.user_id = p_user_id
      AND fm.status = 'active'
      AND fm.role IN ('parent', 'guardian')
  );
$function$;

CREATE OR REPLACE FUNCTION public.get_family_child_ids(
  p_family_id uuid
)
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT COALESCE(
    ARRAY(
      SELECT DISTINCT child_id
      FROM (
        SELECT pc.child_id
        FROM public.parent_children pc
        JOIN public.family_members fm
          ON fm.profile_id = pc.parent_id
        WHERE fm.family_id = p_family_id
          AND fm.status = 'active'
          AND fm.role IN ('parent', 'guardian')

        UNION

        SELECT p.linked_child_id
        FROM public.family_members fm
        JOIN public.profiles p
          ON p.id = fm.profile_id
        WHERE fm.family_id = p_family_id
          AND fm.status = 'active'
          AND fm.role = 'child'
          AND p.linked_child_id IS NOT NULL
      ) AS family_child_ids
    ),
    '{}'::uuid[]
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_child_in_family(
  p_family_id uuid,
  p_child_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT p_child_id = ANY(public.get_family_child_ids(p_family_id));
$function$;

CREATE OR REPLACE FUNCTION public.get_default_kid_portal_mode(
  p_date_of_birth date
)
RETURNS public.kid_portal_mode
LANGUAGE sql
STABLE
SET search_path = public
AS $function$
  SELECT CASE
    WHEN p_date_of_birth IS NULL THEN NULL
    WHEN age(current_date, p_date_of_birth) < interval '6 years' THEN 'under_6'::public.kid_portal_mode
    ELSE 'age_6_to_12'::public.kid_portal_mode
  END;
$function$;

CREATE OR REPLACE FUNCTION public.get_effective_kid_portal_mode(
  p_family_id uuid,
  p_child_id uuid
)
RETURNS public.kid_portal_mode
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_portal_mode public.kid_portal_mode;
BEGIN
  IF p_family_id IS NULL OR p_child_id IS NULL THEN
    RAISE EXCEPTION 'family_id and child_id are required for kid portal mode resolution.';
  END IF;

  IF NOT public.is_child_in_family(p_family_id, p_child_id) THEN
    RAISE EXCEPTION 'The selected child is not part of the requested family.';
  END IF;

  SELECT COALESCE(
    cps.portal_mode,
    public.get_default_kid_portal_mode(c.date_of_birth)
  )
  INTO v_portal_mode
  FROM public.children c
  LEFT JOIN public.child_portal_settings cps
    ON cps.family_id = p_family_id
   AND cps.child_id = c.id
  WHERE c.id = p_child_id;

  IF v_portal_mode IS NULL THEN
    RAISE EXCEPTION 'Portal mode is unavailable until a parent adds the child''s birth date or selects a portal mode explicitly.';
  END IF;

  RETURN v_portal_mode;
END;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_upsert_child_portal_settings(
  p_family_id uuid,
  p_child_id uuid,
  p_portal_mode public.kid_portal_mode DEFAULT NULL,
  p_child_username text DEFAULT NULL,
  p_child_email text DEFAULT NULL,
  p_reset_via_child_email boolean DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_actor_profile_id uuid;
  v_child_profile_id uuid;
  v_before jsonb;
  v_after jsonb;
  v_existing_email text;
  v_next_email text;
  v_next_portal_mode public.kid_portal_mode;
  v_next_reset_via_child_email boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  IF p_family_id IS NULL OR p_child_id IS NULL THEN
    RAISE EXCEPTION 'family_id and child_id are required.';
  END IF;

  IF NOT public.can_manage_family_child_settings(p_family_id, auth.uid()) THEN
    RAISE EXCEPTION 'Only active parents or guardians can manage kid portal settings in this family.';
  END IF;

  IF NOT public.is_child_in_family(p_family_id, p_child_id) THEN
    RAISE EXCEPTION 'The selected child is not part of the requested family.';
  END IF;

  v_actor_profile_id := public.get_family_actor_profile_id(p_family_id, auth.uid());
  IF v_actor_profile_id IS NULL THEN
    RAISE EXCEPTION 'Active family profile could not be resolved.';
  END IF;

  SELECT p.id, cps.child_email
  INTO v_child_profile_id, v_existing_email
  FROM public.profiles p
  LEFT JOIN public.child_portal_settings cps
    ON cps.family_id = p_family_id
   AND cps.child_id = p_child_id
  WHERE p.linked_child_id = p_child_id
    AND p.account_role = 'child'
  ORDER BY p.created_at
  LIMIT 1;

  v_next_portal_mode := COALESCE(
    p_portal_mode,
    public.get_effective_kid_portal_mode(p_family_id, p_child_id)
  );

  IF v_next_portal_mode = 'age_6_to_12' AND v_child_profile_id IS NULL THEN
    RAISE EXCEPTION 'A child account must exist before the credential-based portal can be enabled.';
  END IF;

  v_next_email := CASE
    WHEN p_child_email IS NULL THEN NULLIF(btrim(v_existing_email), '')
    ELSE NULLIF(btrim(p_child_email), '')
  END;

  v_next_reset_via_child_email := COALESCE(
    p_reset_via_child_email,
    (
      SELECT cps.reset_via_child_email
      FROM public.child_portal_settings cps
      WHERE cps.family_id = p_family_id
        AND cps.child_id = p_child_id
    ),
    false
  );

  IF v_next_reset_via_child_email AND v_next_email IS NULL THEN
    RAISE EXCEPTION 'A child email is required before self-service reset can be enabled.';
  END IF;

  IF v_child_profile_id IS NOT NULL AND p_child_username IS NOT NULL THEN
    UPDATE public.profiles
    SET
      child_username = CASE
        WHEN NULLIF(btrim(p_child_username), '') IS NULL THEN NULL
        ELSE lower(btrim(p_child_username))
      END,
      updated_at = now()
    WHERE id = v_child_profile_id;
  END IF;

  SELECT jsonb_build_object(
    'portal_mode', portal_mode,
    'child_email', child_email,
    'reset_via_child_email', reset_via_child_email,
    'child_profile_id', child_profile_id
  )
  INTO v_before
  FROM public.child_portal_settings
  WHERE family_id = p_family_id
    AND child_id = p_child_id;

  INSERT INTO public.child_portal_settings (
    family_id,
    child_id,
    child_profile_id,
    portal_mode,
    child_email,
    reset_via_child_email,
    created_by_profile_id,
    updated_by_profile_id
  )
  VALUES (
    p_family_id,
    p_child_id,
    v_child_profile_id,
    v_next_portal_mode,
    v_next_email,
    v_next_reset_via_child_email,
    v_actor_profile_id,
    v_actor_profile_id
  )
  ON CONFLICT (family_id, child_id)
  DO UPDATE SET
    child_profile_id = EXCLUDED.child_profile_id,
    portal_mode = EXCLUDED.portal_mode,
    child_email = EXCLUDED.child_email,
    reset_via_child_email = EXCLUDED.reset_via_child_email,
    updated_by_profile_id = v_actor_profile_id,
    updated_at = now();

  SELECT jsonb_build_object(
    'portal_mode', cps.portal_mode,
    'child_email', cps.child_email,
    'reset_via_child_email', cps.reset_via_child_email,
    'child_profile_id', cps.child_profile_id,
    'child_username', p.child_username
  )
  INTO v_after
  FROM public.child_portal_settings cps
  LEFT JOIN public.profiles p
    ON p.id = cps.child_profile_id
  WHERE cps.family_id = p_family_id
    AND cps.child_id = p_child_id;

  PERFORM public.log_audit_event(
    _action => 'CHILD_PORTAL_SETTINGS_UPDATE',
    _entity_type => 'child_portal_settings',
    _entity_id => COALESCE(v_child_profile_id, p_child_id),
    _child_id => p_child_id,
    _before => v_before,
    _after => v_after,
    _family_context => jsonb_build_object('family_id', p_family_id)
  );

  RETURN v_after;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_pending_family_kid_portal_requests(
  p_family_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  IF p_family_id IS NULL THEN
    RAISE EXCEPTION 'family_id is required.';
  END IF;

  IF NOT public.can_manage_family_child_settings(p_family_id, auth.uid()) THEN
    RAISE EXCEPTION 'Only active parents or guardians can review child portal access requests in this family.';
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', r.id,
        'child_id', r.child_id,
        'child_name', c.name,
        'portal_mode', r.portal_mode,
        'status', r.status,
        'requested_at', r.requested_at,
        'requested_by_profile_id', r.requested_by_profile_id,
        'requested_by_name', COALESCE(requester.full_name, c.name)
      )
      ORDER BY r.requested_at DESC
    ),
    '[]'::jsonb
  )
  INTO v_result
  FROM public.kid_portal_access_requests r
  JOIN public.children c
    ON c.id = r.child_id
  LEFT JOIN public.profiles requester
    ON requester.id = r.requested_by_profile_id
  WHERE r.family_id = p_family_id
    AND r.status = 'pending';

  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_kid_portal_request_state(
  p_family_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_profile record;
  v_request public.kid_portal_access_requests%ROWTYPE;
  v_effective_status text;
  v_dashboard_unlocked boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  IF p_family_id IS NULL THEN
    RAISE EXCEPTION 'family_id is required.';
  END IF;

  SELECT p.id, p.linked_child_id
  INTO v_profile
  FROM public.profiles p
  WHERE p.user_id = auth.uid()
    AND p.account_role = 'child'
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Child account not found for the authenticated user.';
  END IF;

  IF v_profile.linked_child_id IS NULL THEN
    RAISE EXCEPTION 'The authenticated child account is not linked to a child record.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.family_members fm
    WHERE fm.family_id = p_family_id
      AND fm.user_id = auth.uid()
      AND fm.status = 'active'
      AND fm.role = 'child'
  ) THEN
    RAISE EXCEPTION 'This child account is not an active child member of the requested family.';
  END IF;

  SELECT *
  INTO v_request
  FROM public.kid_portal_access_requests
  WHERE family_id = p_family_id
    AND child_id = v_profile.linked_child_id
  ORDER BY requested_at DESC
  LIMIT 1;

  IF v_request.id IS NULL THEN
    RETURN jsonb_build_object(
      'status', 'idle',
      'dashboard_unlocked', false
    );
  END IF;

  v_dashboard_unlocked := (
    v_request.status = 'approved'
    AND v_request.session_expires_at IS NOT NULL
    AND v_request.session_expires_at > now()
  );

  v_effective_status := CASE
    WHEN v_request.status = 'approved'
      AND v_request.session_expires_at IS NOT NULL
      AND v_request.session_expires_at <= now() THEN 'expired'
    ELSE v_request.status::text
  END;

  RETURN jsonb_build_object(
    'id', v_request.id,
    'status', v_effective_status,
    'requested_at', v_request.requested_at,
    'resolved_at', v_request.resolved_at,
    'session_expires_at', v_request.session_expires_at,
    'dashboard_unlocked', v_dashboard_unlocked
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_request_kid_portal_access(
  p_family_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_profile record;
  v_child public.children%ROWTYPE;
  v_existing_request public.kid_portal_access_requests%ROWTYPE;
  v_request public.kid_portal_access_requests%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  IF p_family_id IS NULL THEN
    RAISE EXCEPTION 'family_id is required.';
  END IF;

  SELECT p.id, p.linked_child_id, p.login_enabled
  INTO v_profile
  FROM public.profiles p
  WHERE p.user_id = auth.uid()
    AND p.account_role = 'child'
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Child account not found for the authenticated user.';
  END IF;

  IF COALESCE(v_profile.login_enabled, true) = false THEN
    RAISE EXCEPTION 'This child login is disabled.';
  END IF;

  IF v_profile.linked_child_id IS NULL THEN
    RAISE EXCEPTION 'The authenticated child account is not linked to a child record.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.family_members fm
    WHERE fm.family_id = p_family_id
      AND fm.user_id = auth.uid()
      AND fm.status = 'active'
      AND fm.role = 'child'
  ) THEN
    RAISE EXCEPTION 'This child account is not an active child member of the requested family.';
  END IF;

  IF public.get_effective_kid_portal_mode(p_family_id, v_profile.linked_child_id) <> 'under_6' THEN
    RAISE EXCEPTION 'Only under-6 child portal accounts can request live approval access.';
  END IF;

  SELECT *
  INTO v_child
  FROM public.children
  WHERE id = v_profile.linked_child_id;

  SELECT *
  INTO v_existing_request
  FROM public.kid_portal_access_requests
  WHERE family_id = p_family_id
    AND child_id = v_profile.linked_child_id
    AND status = 'pending'
  ORDER BY requested_at DESC
  LIMIT 1;

  IF v_existing_request.id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'id', v_existing_request.id,
      'status', v_existing_request.status,
      'requested_at', v_existing_request.requested_at,
      'session_expires_at', v_existing_request.session_expires_at
    );
  END IF;

  INSERT INTO public.kid_portal_access_requests (
    family_id,
    child_id,
    requested_by_profile_id,
    portal_mode,
    status
  )
  VALUES (
    p_family_id,
    v_profile.linked_child_id,
    v_profile.id,
    'under_6'::public.kid_portal_mode,
    'pending'::public.kid_portal_request_status
  )
  RETURNING *
  INTO v_request;

  INSERT INTO public.notifications (
    user_id,
    type,
    title,
    message,
    related_id
  )
  SELECT
    fm.profile_id,
    'kid_portal_access_request',
    'Kids portal access request',
    COALESCE(v_child.name, 'A child') || ' wants to open the Kids Dashboard.',
    v_request.id
  FROM public.family_members fm
  WHERE fm.family_id = p_family_id
    AND fm.status = 'active'
    AND fm.role IN ('parent', 'guardian');

  PERFORM public.log_audit_event(
    _action => 'KID_PORTAL_ACCESS_REQUESTED',
    _entity_type => 'kid_portal_access_requests',
    _entity_id => v_request.id,
    _child_id => v_profile.linked_child_id,
    _family_context => jsonb_build_object('family_id', p_family_id)
  );

  RETURN jsonb_build_object(
    'id', v_request.id,
    'status', v_request.status,
    'requested_at', v_request.requested_at,
    'session_expires_at', v_request.session_expires_at
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_decide_kid_portal_access_request(
  p_family_id uuid,
  p_request_id uuid,
  p_decision text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_actor_profile_id uuid;
  v_before jsonb;
  v_request public.kid_portal_access_requests%ROWTYPE;
  v_updated_request public.kid_portal_access_requests%ROWTYPE;
  v_child public.children%ROWTYPE;
  v_status public.kid_portal_request_status;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  IF p_family_id IS NULL OR p_request_id IS NULL THEN
    RAISE EXCEPTION 'family_id and request_id are required.';
  END IF;

  IF p_decision IS NULL OR lower(btrim(p_decision)) NOT IN ('approve', 'decline') THEN
    RAISE EXCEPTION 'decision must be approve or decline.';
  END IF;

  IF NOT public.can_manage_family_child_settings(p_family_id, auth.uid()) THEN
    RAISE EXCEPTION 'Only active parents or guardians can approve or decline kid portal requests in this family.';
  END IF;

  v_actor_profile_id := public.get_family_actor_profile_id(p_family_id, auth.uid());
  IF v_actor_profile_id IS NULL THEN
    RAISE EXCEPTION 'Active family profile could not be resolved.';
  END IF;

  SELECT *
  INTO v_request
  FROM public.kid_portal_access_requests
  WHERE id = p_request_id
    AND family_id = p_family_id
  LIMIT 1;

  IF v_request.id IS NULL THEN
    RAISE EXCEPTION 'The selected kid portal request could not be found in the requested family.';
  END IF;

  IF v_request.status <> 'pending' THEN
    RAISE EXCEPTION 'Only pending kid portal requests can be decided.';
  END IF;

  SELECT *
  INTO v_child
  FROM public.children
  WHERE id = v_request.child_id;

  SELECT jsonb_build_object(
    'status', v_request.status,
    'resolved_at', v_request.resolved_at,
    'session_expires_at', v_request.session_expires_at
  )
  INTO v_before;

  v_status := CASE
    WHEN lower(btrim(p_decision)) = 'approve' THEN 'approved'::public.kid_portal_request_status
    ELSE 'declined'::public.kid_portal_request_status
  END;

  UPDATE public.kid_portal_access_requests
  SET
    status = v_status,
    resolved_at = now(),
    resolved_by_profile_id = v_actor_profile_id,
    session_expires_at = CASE
      WHEN v_status = 'approved' THEN now() + interval '30 minutes'
      ELSE NULL
    END
  WHERE id = p_request_id
  RETURNING *
  INTO v_updated_request;

  IF v_updated_request.requested_by_profile_id IS NOT NULL THEN
    INSERT INTO public.notifications (
      user_id,
      type,
      title,
      message,
      related_id
    )
    VALUES (
      v_updated_request.requested_by_profile_id,
      'kid_portal_access_decision',
      CASE
        WHEN v_status = 'approved' THEN 'Kids portal unlocked'
        ELSE 'Kids portal request declined'
      END,
      CASE
        WHEN v_status = 'approved' THEN COALESCE(v_child.name, 'The child') || ' can open the Kids Dashboard now.'
        ELSE COALESCE(v_child.name, 'The child') || '''s request was declined.'
      END,
      v_updated_request.id
    );
  END IF;

  PERFORM public.log_audit_event(
    _action => CASE
      WHEN v_status = 'approved' THEN 'KID_PORTAL_ACCESS_APPROVED'
      ELSE 'KID_PORTAL_ACCESS_DECLINED'
    END,
    _entity_type => 'kid_portal_access_requests',
    _entity_id => v_updated_request.id,
    _child_id => v_updated_request.child_id,
    _before => v_before,
    _after => jsonb_build_object(
      'status', v_updated_request.status,
      'resolved_at', v_updated_request.resolved_at,
      'session_expires_at', v_updated_request.session_expires_at
    ),
    _family_context => jsonb_build_object('family_id', p_family_id)
  );

  RETURN jsonb_build_object(
    'id', v_updated_request.id,
    'status', v_updated_request.status,
    'requested_at', v_updated_request.requested_at,
    'resolved_at', v_updated_request.resolved_at,
    'session_expires_at', v_updated_request.session_expires_at
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_upsert_child_call_settings(
  p_family_id uuid,
  p_child_id uuid,
  p_calling_enabled boolean,
  p_allowed_outbound_member_ids uuid[] DEFAULT '{}'::uuid[],
  p_allowed_inbound_member_ids uuid[] DEFAULT '{}'::uuid[],
  p_call_mode public.child_call_mode DEFAULT 'audio_only',
  p_additional_information text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_actor_profile_id uuid;
  v_child_profile_id uuid;
  v_settings_id uuid;
  v_before jsonb;
  v_after jsonb;
  v_outbound_ids uuid[];
  v_inbound_ids uuid[];
  v_expected_count integer;
  v_actual_count integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  IF p_family_id IS NULL OR p_child_id IS NULL THEN
    RAISE EXCEPTION 'family_id and child_id are required.';
  END IF;

  IF p_calling_enabled IS NULL THEN
    RAISE EXCEPTION 'calling_enabled is required.';
  END IF;

  IF NOT public.can_manage_family_child_settings(p_family_id, auth.uid()) THEN
    RAISE EXCEPTION 'Only active parents or guardians can manage child calling settings in this family.';
  END IF;

  IF NOT public.is_child_in_family(p_family_id, p_child_id) THEN
    RAISE EXCEPTION 'The selected child is not part of the requested family.';
  END IF;

  v_actor_profile_id := public.get_family_actor_profile_id(p_family_id, auth.uid());
  IF v_actor_profile_id IS NULL THEN
    RAISE EXCEPTION 'Active family profile could not be resolved.';
  END IF;

  v_outbound_ids := COALESCE(
    (
      SELECT array_agg(DISTINCT member_id)
      FROM unnest(COALESCE(p_allowed_outbound_member_ids, '{}'::uuid[])) AS member_id
    ),
    '{}'::uuid[]
  );

  v_inbound_ids := COALESCE(
    (
      SELECT array_agg(DISTINCT member_id)
      FROM unnest(COALESCE(p_allowed_inbound_member_ids, '{}'::uuid[])) AS member_id
    ),
    '{}'::uuid[]
  );

  v_expected_count := COALESCE(array_length(v_outbound_ids, 1), 0);
  IF v_expected_count > 0 THEN
    SELECT count(*)
    INTO v_actual_count
    FROM public.family_members fm
    WHERE fm.family_id = p_family_id
      AND fm.status = 'active'
      AND fm.role IN ('parent', 'guardian', 'third_party')
      AND fm.id = ANY(v_outbound_ids);

    IF v_actual_count <> v_expected_count THEN
      RAISE EXCEPTION 'Every outbound callable family member must be an active non-child member of the requested family.';
    END IF;
  END IF;

  v_expected_count := COALESCE(array_length(v_inbound_ids, 1), 0);
  IF v_expected_count > 0 THEN
    SELECT count(*)
    INTO v_actual_count
    FROM public.family_members fm
    WHERE fm.family_id = p_family_id
      AND fm.status = 'active'
      AND fm.role IN ('parent', 'guardian', 'third_party')
      AND fm.id = ANY(v_inbound_ids);

    IF v_actual_count <> v_expected_count THEN
      RAISE EXCEPTION 'Every inbound callable family member must be an active non-child member of the requested family.';
    END IF;
  END IF;

  SELECT id
  INTO v_child_profile_id
  FROM public.profiles
  WHERE linked_child_id = p_child_id
    AND account_role = 'child'
  ORDER BY created_at
  LIMIT 1;

  SELECT jsonb_build_object(
    'calling_enabled', calling_enabled,
    'allowed_outbound_member_ids', COALESCE(to_jsonb(allowed_outbound_member_ids), '[]'::jsonb),
    'allowed_inbound_member_ids', COALESCE(to_jsonb(allowed_inbound_member_ids), '[]'::jsonb),
    'call_mode', call_mode
  )
  INTO v_before
  FROM public.child_call_settings
  WHERE family_id = p_family_id
    AND child_id = p_child_id;

  INSERT INTO public.child_call_settings (
    family_id,
    child_id,
    child_profile_id,
    calling_enabled,
    allowed_outbound_member_ids,
    allowed_inbound_member_ids,
    call_mode,
    created_by_profile_id,
    updated_by_profile_id
  )
  VALUES (
    p_family_id,
    p_child_id,
    v_child_profile_id,
    p_calling_enabled,
    v_outbound_ids,
    v_inbound_ids,
    p_call_mode,
    v_actor_profile_id,
    v_actor_profile_id
  )
  ON CONFLICT (family_id, child_id)
  DO UPDATE SET
    child_profile_id = EXCLUDED.child_profile_id,
    calling_enabled = EXCLUDED.calling_enabled,
    allowed_outbound_member_ids = EXCLUDED.allowed_outbound_member_ids,
    allowed_inbound_member_ids = EXCLUDED.allowed_inbound_member_ids,
    call_mode = EXCLUDED.call_mode,
    updated_by_profile_id = v_actor_profile_id,
    updated_at = now()
  RETURNING id
  INTO v_settings_id;

  SELECT jsonb_build_object(
    'calling_enabled', calling_enabled,
    'allowed_outbound_member_ids', COALESCE(to_jsonb(allowed_outbound_member_ids), '[]'::jsonb),
    'allowed_inbound_member_ids', COALESCE(to_jsonb(allowed_inbound_member_ids), '[]'::jsonb),
    'call_mode', call_mode
  )
  INTO v_after
  FROM public.child_call_settings
  WHERE family_id = p_family_id
    AND child_id = p_child_id;

  INSERT INTO public.child_call_settings_history (
    family_id,
    child_id,
    child_call_settings_id,
    actor_profile_id,
    actor_user_id,
    previous_setting,
    new_setting,
    additional_information
  )
  VALUES (
    p_family_id,
    p_child_id,
    v_settings_id,
    v_actor_profile_id,
    auth.uid(),
    COALESCE(v_before, '{}'::jsonb),
    COALESCE(v_after, '{}'::jsonb),
    NULLIF(btrim(p_additional_information), '')
  );

  PERFORM public.log_audit_event(
    _action => 'CHILD_CALL_SETTINGS_UPDATE',
    _entity_type => 'child_call_settings',
    _entity_id => v_settings_id,
    _child_id => p_child_id,
    _before => v_before,
    _after => v_after,
    _family_context => jsonb_build_object('family_id', p_family_id),
    _metadata => jsonb_build_object(
      'additional_information', NULLIF(btrim(p_additional_information), '')
    )
  );

  RETURN v_after;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_child_call_settings_history(
  p_family_id uuid,
  p_child_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  IF p_family_id IS NULL OR p_child_id IS NULL THEN
    RAISE EXCEPTION 'family_id and child_id are required.';
  END IF;

  IF NOT public.can_manage_family_child_settings(p_family_id, auth.uid()) THEN
    RAISE EXCEPTION 'Only active parents or guardians can review child calling history in this family.';
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', h.id,
        'created_at', h.created_at,
        'actor_profile_id', h.actor_profile_id,
        'actor_name', actor.full_name,
        'previous_setting', h.previous_setting,
        'new_setting', h.new_setting,
        'additional_information', h.additional_information
      )
      ORDER BY h.created_at DESC
    ),
    '[]'::jsonb
  )
  INTO v_result
  FROM public.child_call_settings_history h
  LEFT JOIN public.profiles actor
    ON actor.id = h.actor_profile_id
  WHERE h.family_id = p_family_id
    AND h.child_id = p_child_id;

  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.resolve_child_login_identifier(
  p_child_username text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_identifier text;
  v_result record;
  v_portal_mode public.kid_portal_mode;
BEGIN
  v_identifier := NULLIF(lower(btrim(p_child_username)), '');

  IF v_identifier IS NULL THEN
    RAISE EXCEPTION 'child_username is required.';
  END IF;

  SELECT
    p.id,
    p.email,
    p.login_enabled,
    p.linked_child_id,
    c.name AS child_name,
    cps.portal_mode
  INTO v_result
  FROM public.profiles p
  LEFT JOIN public.children c
    ON c.id = p.linked_child_id
  LEFT JOIN public.child_portal_settings cps
    ON cps.child_profile_id = p.id
  WHERE p.account_role = 'child'
    AND lower(p.child_username) = v_identifier
  ORDER BY p.created_at
  LIMIT 1;

  IF v_result.id IS NULL THEN
    RAISE EXCEPTION 'Child username not found.';
  END IF;

  v_portal_mode := COALESCE(
    v_result.portal_mode,
    public.get_default_kid_portal_mode(
      (
        SELECT date_of_birth
        FROM public.children
        WHERE id = v_result.linked_child_id
      )
    )
  );

  IF COALESCE(v_result.login_enabled, true) = false THEN
    RAISE EXCEPTION 'This child login is disabled.';
  END IF;

  IF v_portal_mode <> 'age_6_to_12' THEN
    RAISE EXCEPTION 'This child account uses parent approval instead of username and password.';
  END IF;

  IF NULLIF(btrim(v_result.email), '') IS NULL THEN
    RAISE EXCEPTION 'This child account is missing an email identifier and cannot sign in yet.';
  END IF;

  RETURN jsonb_build_object(
    'child_name', v_result.child_name,
    'email', v_result.email,
    'portal_mode', v_portal_mode,
    'username', v_identifier
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.resolve_child_password_reset_target(
  p_identifier text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_identifier text;
  v_result record;
  v_portal_mode public.kid_portal_mode;
  v_reset_email text;
BEGIN
  v_identifier := NULLIF(lower(btrim(p_identifier)), '');

  IF v_identifier IS NULL THEN
    RAISE EXCEPTION 'identifier is required.';
  END IF;

  IF position('@' IN v_identifier) > 0 THEN
    SELECT
      p.id,
      p.account_role,
      p.email,
      p.linked_child_id,
      c.name AS child_name,
      cps.portal_mode,
      cps.child_email,
      cps.reset_via_child_email
    INTO v_result
    FROM public.profiles p
    LEFT JOIN public.children c
      ON c.id = p.linked_child_id
    LEFT JOIN public.child_portal_settings cps
      ON cps.child_profile_id = p.id
    WHERE lower(COALESCE(cps.child_email, p.email, '')) = v_identifier
       OR lower(COALESCE(p.email, '')) = v_identifier
    ORDER BY p.created_at
    LIMIT 1;

    IF v_result.id IS NULL OR v_result.account_role <> 'child' THEN
      RETURN jsonb_build_object(
        'mode', 'self_service_email',
        'email', v_identifier
      );
    END IF;
  ELSE
    SELECT
      p.id,
      p.account_role,
      p.email,
      p.linked_child_id,
      c.name AS child_name,
      cps.portal_mode,
      cps.child_email,
      cps.reset_via_child_email
    INTO v_result
    FROM public.profiles p
    LEFT JOIN public.children c
      ON c.id = p.linked_child_id
    LEFT JOIN public.child_portal_settings cps
      ON cps.child_profile_id = p.id
    WHERE p.account_role = 'child'
      AND lower(p.child_username) = v_identifier
    ORDER BY p.created_at
    LIMIT 1;

    IF v_result.id IS NULL THEN
      RAISE EXCEPTION 'Child username not found.';
    END IF;
  END IF;

  v_portal_mode := COALESCE(
    v_result.portal_mode,
    public.get_default_kid_portal_mode(
      (
        SELECT date_of_birth
        FROM public.children
        WHERE id = v_result.linked_child_id
      )
    )
  );

  v_reset_email := CASE
    WHEN COALESCE(v_result.reset_via_child_email, false)
      THEN COALESCE(NULLIF(btrim(v_result.child_email), ''), NULLIF(btrim(v_result.email), ''))
    ELSE NULL
  END;

  IF v_portal_mode = 'age_6_to_12' AND v_reset_email IS NOT NULL THEN
    RETURN jsonb_build_object(
      'mode', 'self_service_email',
      'email', v_reset_email,
      'child_name', v_result.child_name
    );
  END IF;

  RETURN jsonb_build_object(
    'mode', 'parent_managed',
    'child_name', v_result.child_name,
    'message', 'A parent or guardian needs to reset this child password from the family settings screen.'
  );
END;
$function$;

DROP FUNCTION IF EXISTS public.get_callable_family_members(uuid) CASCADE;
CREATE FUNCTION public.get_callable_family_members(
  p_family_id uuid
)
RETURNS TABLE (
  membership_id uuid,
  profile_id uuid,
  role public.member_role,
  relationship_label text,
  full_name text,
  email text,
  avatar_url text,
  allowed_call_mode public.child_call_mode
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_viewer_profile public.profiles%ROWTYPE;
  v_viewer_membership public.family_members%ROWTYPE;
  v_child_settings public.child_call_settings%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  IF p_family_id IS NULL THEN
    RAISE EXCEPTION 'family_id is required.';
  END IF;

  SELECT *
  INTO v_viewer_profile
  FROM public.profiles
  WHERE user_id = auth.uid()
  LIMIT 1;

  IF v_viewer_profile.id IS NULL THEN
    RAISE EXCEPTION 'Profile not found.';
  END IF;

  SELECT *
  INTO v_viewer_membership
  FROM public.family_members
  WHERE family_id = p_family_id
    AND user_id = auth.uid()
    AND status = 'active'
  ORDER BY created_at
  LIMIT 1;

  IF v_viewer_membership.id IS NULL THEN
    RAISE EXCEPTION 'You do not have access to that family.';
  END IF;

  IF v_viewer_membership.role = 'child' THEN
    IF v_viewer_profile.linked_child_id IS NULL THEN
      RAISE EXCEPTION 'The authenticated child account is not linked to a child record.';
    END IF;

    SELECT *
    INTO v_child_settings
    FROM public.child_call_settings
    WHERE family_id = p_family_id
      AND child_id = v_viewer_profile.linked_child_id
    LIMIT 1;

    IF v_child_settings.id IS NULL OR v_child_settings.calling_enabled = false THEN
      RETURN;
    END IF;

    RETURN QUERY
    SELECT
      fm.id AS membership_id,
      fm.profile_id,
      fm.role,
      fm.relationship_label,
      p.full_name,
      p.email,
      p.avatar_url,
      v_child_settings.call_mode AS allowed_call_mode
    FROM public.family_members fm
    JOIN public.profiles p
      ON p.id = fm.profile_id
    WHERE fm.family_id = p_family_id
      AND fm.status = 'active'
      AND fm.role IN ('parent', 'guardian', 'third_party')
      AND fm.id = ANY(COALESCE(v_child_settings.allowed_outbound_member_ids, '{}'::uuid[]))
      AND fm.profile_id <> v_viewer_profile.id
    ORDER BY lower(COALESCE(p.full_name, p.email, 'family member'));

    RETURN;
  END IF;

  RETURN QUERY
  WITH adult_members AS (
    SELECT
      fm.id AS membership_id,
      fm.profile_id,
      fm.role,
      fm.relationship_label,
      p.full_name,
      p.email,
      p.avatar_url,
      'audio_video'::public.child_call_mode AS allowed_call_mode
    FROM public.family_members fm
    JOIN public.profiles p
      ON p.id = fm.profile_id
    WHERE fm.family_id = p_family_id
      AND fm.status = 'active'
      AND fm.role IN ('parent', 'guardian', 'third_party')
      AND fm.profile_id <> v_viewer_profile.id
  ),
  child_members AS (
    SELECT
      fm.id AS membership_id,
      fm.profile_id,
      fm.role,
      fm.relationship_label,
      p.full_name,
      p.email,
      p.avatar_url,
      ccs.call_mode AS allowed_call_mode
    FROM public.family_members fm
    JOIN public.profiles p
      ON p.id = fm.profile_id
    JOIN public.child_call_settings ccs
      ON ccs.family_id = p_family_id
     AND ccs.child_profile_id = p.id
     AND ccs.calling_enabled = true
    WHERE fm.family_id = p_family_id
      AND fm.status = 'active'
      AND fm.role = 'child'
      AND v_viewer_membership.id = ANY(COALESCE(ccs.allowed_inbound_member_ids, '{}'::uuid[]))
      AND fm.profile_id <> v_viewer_profile.id
  )
  SELECT *
  FROM (
    SELECT * FROM adult_members
    UNION ALL
    SELECT * FROM child_members
  ) callable_members
  ORDER BY lower(COALESCE(full_name, email, 'family member'));
END;
$function$;

DROP TRIGGER IF EXISTS update_child_portal_settings_updated_at ON public.child_portal_settings;
CREATE TRIGGER update_child_portal_settings_updated_at
BEFORE UPDATE ON public.child_portal_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_child_call_settings_updated_at ON public.child_call_settings;
CREATE TRIGGER update_child_call_settings_updated_at
BEFORE UPDATE ON public.child_call_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Parents can view child portal settings"
ON public.child_portal_settings
FOR SELECT
USING (public.can_manage_family_child_settings(family_id, auth.uid()));

CREATE POLICY "Parents can view kid portal access requests"
ON public.kid_portal_access_requests
FOR SELECT
USING (public.can_manage_family_child_settings(family_id, auth.uid()));

CREATE POLICY "Parents can view child call settings"
ON public.child_call_settings
FOR SELECT
USING (public.can_manage_family_child_settings(family_id, auth.uid()));

CREATE POLICY "Parents can view child call settings history"
ON public.child_call_settings_history
FOR SELECT
USING (public.can_manage_family_child_settings(family_id, auth.uid()));

CREATE OR REPLACE FUNCTION public.get_child_account_context(
  p_family_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_profile record;
  v_permissions public.child_permissions%ROWTYPE;
  v_portal_settings public.child_portal_settings%ROWTYPE;
  v_call_settings public.child_call_settings%ROWTYPE;
  v_child public.children%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  IF p_family_id IS NULL THEN
    RAISE EXCEPTION 'family_id is required.';
  END IF;

  SELECT p.*
  INTO v_profile
  FROM public.profiles p
  WHERE p.user_id = auth.uid()
    AND p.account_role = 'child'
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Child account not found for the authenticated user.';
  END IF;

  IF v_profile.linked_child_id IS NULL THEN
    RAISE EXCEPTION 'The authenticated child account is not linked to a child record.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.family_members fm
    WHERE fm.family_id = p_family_id
      AND fm.user_id = auth.uid()
      AND fm.status = 'active'
      AND fm.role = 'child'
  ) THEN
    RAISE EXCEPTION 'This child account is not an active child member of the requested family.';
  END IF;

  IF NOT public.is_child_in_family(p_family_id, v_profile.linked_child_id) THEN
    RAISE EXCEPTION 'The linked child is not part of the requested family.';
  END IF;

  SELECT *
  INTO v_child
  FROM public.children
  WHERE id = v_profile.linked_child_id;

  SELECT *
  INTO v_permissions
  FROM public.child_permissions
  WHERE child_profile_id = v_profile.id;

  SELECT *
  INTO v_portal_settings
  FROM public.child_portal_settings
  WHERE family_id = p_family_id
    AND child_id = v_profile.linked_child_id;

  SELECT *
  INTO v_call_settings
  FROM public.child_call_settings
  WHERE family_id = p_family_id
    AND child_id = v_profile.linked_child_id;

  RETURN jsonb_build_object(
    'child_id', v_profile.linked_child_id,
    'child_name', v_child.name,
    'child_profile_id', v_profile.id,
    'portal_mode', public.get_effective_kid_portal_mode(p_family_id, v_profile.linked_child_id),
    'is_child', true,
    'allow_parent_messaging', COALESCE(v_permissions.allow_parent_messaging, true),
    'allow_family_chat', COALESCE(v_permissions.allow_family_chat, true),
    'allow_sibling_messaging', COALESCE(v_permissions.allow_sibling_messaging, true),
    'allow_push_notifications', COALESCE(v_permissions.allow_push_notifications, false),
    'allow_calendar_reminders', COALESCE(v_permissions.allow_calendar_reminders, true),
    'show_full_event_details', COALESCE(v_permissions.show_full_event_details, false),
    'allow_mood_checkins', COALESCE(v_permissions.allow_mood_checkins, true),
    'allow_notes_to_parents', COALESCE(v_permissions.allow_notes_to_parents, true),
    'login_enabled', COALESCE(v_profile.login_enabled, true),
    'calling_enabled', COALESCE(v_call_settings.calling_enabled, false),
    'call_mode', COALESCE(v_call_settings.call_mode, 'audio_only'::public.child_call_mode)
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_family_child_portal_overview(
  p_family_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  IF p_family_id IS NULL THEN
    RAISE EXCEPTION 'family_id is required.';
  END IF;

  IF NOT public.can_manage_family_child_settings(p_family_id, auth.uid()) THEN
    RAISE EXCEPTION 'Only active parents or guardians can view child portal settings for this family.';
  END IF;

  WITH family_children AS (
    SELECT DISTINCT c.id, c.name, c.date_of_birth
    FROM public.children c
    WHERE public.is_child_in_family(p_family_id, c.id)
  ),
  child_profiles AS (
    SELECT
      p.id,
      p.linked_child_id,
      p.login_enabled,
      p.child_username,
      p.email
    FROM public.profiles p
    WHERE p.account_role = 'child'
      AND p.linked_child_id IN (SELECT id FROM family_children)
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'child_id', fc.id,
        'child_name', fc.name,
        'date_of_birth', fc.date_of_birth,
        'portal_mode', public.get_effective_kid_portal_mode(p_family_id, fc.id),
        'child_profile_id', cp.id,
        'child_username', cp.child_username,
        'child_email', COALESCE(cps.child_email, cp.email),
        'reset_via_child_email', COALESCE(cps.reset_via_child_email, false),
        'has_account', cp.id IS NOT NULL,
        'login_enabled', COALESCE(cp.login_enabled, false),
        'permissions', jsonb_build_object(
          'allow_parent_messaging', COALESCE(perm.allow_parent_messaging, true),
          'allow_family_chat', COALESCE(perm.allow_family_chat, true),
          'allow_sibling_messaging', COALESCE(perm.allow_sibling_messaging, true),
          'allow_push_notifications', COALESCE(perm.allow_push_notifications, false),
          'allow_calendar_reminders', COALESCE(perm.allow_calendar_reminders, true),
          'show_full_event_details', COALESCE(perm.show_full_event_details, false),
          'allow_mood_checkins', COALESCE(perm.allow_mood_checkins, true),
          'allow_notes_to_parents', COALESCE(perm.allow_notes_to_parents, true)
        ),
        'call_settings', jsonb_build_object(
          'calling_enabled', COALESCE(ccs.calling_enabled, false),
          'allowed_outbound_member_ids', COALESCE(to_jsonb(ccs.allowed_outbound_member_ids), '[]'::jsonb),
          'allowed_inbound_member_ids', COALESCE(to_jsonb(ccs.allowed_inbound_member_ids), '[]'::jsonb),
          'call_mode', COALESCE(ccs.call_mode, 'audio_only'::public.child_call_mode)
        )
      )
      ORDER BY fc.name
    ),
    '[]'::jsonb
  )
  INTO v_result
  FROM family_children fc
  LEFT JOIN child_profiles cp
    ON cp.linked_child_id = fc.id
  LEFT JOIN public.child_permissions perm
    ON perm.child_profile_id = cp.id
  LEFT JOIN public.child_portal_settings cps
    ON cps.family_id = p_family_id
   AND cps.child_id = fc.id
  LEFT JOIN public.child_call_settings ccs
    ON ccs.family_id = p_family_id
   AND ccs.child_id = fc.id;

  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_upsert_child_permissions(
  p_family_id uuid,
  p_child_profile_id uuid,
  p_permissions jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_actor_profile_id uuid;
  v_linked_child_id uuid;
  v_before jsonb;
  v_after jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  IF p_family_id IS NULL OR p_child_profile_id IS NULL THEN
    RAISE EXCEPTION 'family_id and child_profile_id are required.';
  END IF;

  IF p_permissions IS NULL THEN
    RAISE EXCEPTION 'permissions payload is required.';
  END IF;

  IF NOT public.can_manage_family_child_settings(p_family_id, auth.uid()) THEN
    RAISE EXCEPTION 'Only active parents or guardians can manage child permissions in this family.';
  END IF;

  v_actor_profile_id := public.get_family_actor_profile_id(p_family_id, auth.uid());
  IF v_actor_profile_id IS NULL THEN
    RAISE EXCEPTION 'Active family profile could not be resolved.';
  END IF;

  SELECT linked_child_id
  INTO v_linked_child_id
  FROM public.profiles
  WHERE id = p_child_profile_id
    AND account_role = 'child';

  IF v_linked_child_id IS NULL THEN
    RAISE EXCEPTION 'The selected child profile does not exist.';
  END IF;

  IF NOT public.is_child_in_family(p_family_id, v_linked_child_id) THEN
    RAISE EXCEPTION 'The selected child profile is not part of the requested family.';
  END IF;

  SELECT jsonb_build_object(
    'allow_parent_messaging', allow_parent_messaging,
    'allow_family_chat', allow_family_chat,
    'allow_sibling_messaging', allow_sibling_messaging,
    'allow_push_notifications', allow_push_notifications,
    'allow_calendar_reminders', allow_calendar_reminders,
    'show_full_event_details', show_full_event_details,
    'allow_mood_checkins', allow_mood_checkins,
    'allow_notes_to_parents', allow_notes_to_parents
  )
  INTO v_before
  FROM public.child_permissions
  WHERE child_profile_id = p_child_profile_id;

  INSERT INTO public.child_permissions (
    child_profile_id,
    parent_profile_id,
    allow_parent_messaging,
    allow_family_chat,
    allow_sibling_messaging,
    allow_push_notifications,
    allow_calendar_reminders,
    show_full_event_details,
    allow_mood_checkins,
    allow_notes_to_parents
  )
  VALUES (
    p_child_profile_id,
    v_actor_profile_id,
    COALESCE((p_permissions ->> 'allow_parent_messaging')::boolean, true),
    COALESCE((p_permissions ->> 'allow_family_chat')::boolean, true),
    COALESCE((p_permissions ->> 'allow_sibling_messaging')::boolean, true),
    COALESCE((p_permissions ->> 'allow_push_notifications')::boolean, false),
    COALESCE((p_permissions ->> 'allow_calendar_reminders')::boolean, true),
    COALESCE((p_permissions ->> 'show_full_event_details')::boolean, false),
    COALESCE((p_permissions ->> 'allow_mood_checkins')::boolean, true),
    COALESCE((p_permissions ->> 'allow_notes_to_parents')::boolean, true)
  )
  ON CONFLICT (child_profile_id)
  DO UPDATE SET
    parent_profile_id = v_actor_profile_id,
    allow_parent_messaging = COALESCE((p_permissions ->> 'allow_parent_messaging')::boolean, public.child_permissions.allow_parent_messaging),
    allow_family_chat = COALESCE((p_permissions ->> 'allow_family_chat')::boolean, public.child_permissions.allow_family_chat),
    allow_sibling_messaging = COALESCE((p_permissions ->> 'allow_sibling_messaging')::boolean, public.child_permissions.allow_sibling_messaging),
    allow_push_notifications = COALESCE((p_permissions ->> 'allow_push_notifications')::boolean, public.child_permissions.allow_push_notifications),
    allow_calendar_reminders = COALESCE((p_permissions ->> 'allow_calendar_reminders')::boolean, public.child_permissions.allow_calendar_reminders),
    show_full_event_details = COALESCE((p_permissions ->> 'show_full_event_details')::boolean, public.child_permissions.show_full_event_details),
    allow_mood_checkins = COALESCE((p_permissions ->> 'allow_mood_checkins')::boolean, public.child_permissions.allow_mood_checkins),
    allow_notes_to_parents = COALESCE((p_permissions ->> 'allow_notes_to_parents')::boolean, public.child_permissions.allow_notes_to_parents),
    updated_at = now();

  SELECT jsonb_build_object(
    'allow_parent_messaging', allow_parent_messaging,
    'allow_family_chat', allow_family_chat,
    'allow_sibling_messaging', allow_sibling_messaging,
    'allow_push_notifications', allow_push_notifications,
    'allow_calendar_reminders', allow_calendar_reminders,
    'show_full_event_details', show_full_event_details,
    'allow_mood_checkins', allow_mood_checkins,
    'allow_notes_to_parents', allow_notes_to_parents
  )
  INTO v_after
  FROM public.child_permissions
  WHERE child_profile_id = p_child_profile_id;

  PERFORM public.log_audit_event(
    _action => 'CHILD_PERMISSION_UPDATE',
    _entity_type => 'child_permissions',
    _entity_id => p_child_profile_id::text,
    _child_id => v_linked_child_id,
    _before => v_before,
    _after => v_after,
    _family_context => jsonb_build_object('family_id', p_family_id),
    _metadata => jsonb_build_object('source', 'rpc_upsert_child_permissions')
  );

  RETURN v_after;
END;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_set_child_login_enabled(
  p_family_id uuid,
  p_child_profile_id uuid,
  p_enabled boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_linked_child_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  IF p_family_id IS NULL OR p_child_profile_id IS NULL THEN
    RAISE EXCEPTION 'family_id and child_profile_id are required.';
  END IF;

  IF NOT public.can_manage_family_child_settings(p_family_id, auth.uid()) THEN
    RAISE EXCEPTION 'Only active parents or guardians can change child login access in this family.';
  END IF;

  SELECT linked_child_id
  INTO v_linked_child_id
  FROM public.profiles
  WHERE id = p_child_profile_id
    AND account_role = 'child';

  IF v_linked_child_id IS NULL THEN
    RAISE EXCEPTION 'The selected child profile does not exist.';
  END IF;

  IF NOT public.is_child_in_family(p_family_id, v_linked_child_id) THEN
    RAISE EXCEPTION 'The selected child profile is not part of the requested family.';
  END IF;

  UPDATE public.profiles
  SET
    login_enabled = p_enabled,
    updated_at = now()
  WHERE id = p_child_profile_id;

  PERFORM public.log_audit_event(
    _action => 'CHILD_LOGIN_ENABLED_UPDATE',
    _entity_type => 'profiles',
    _entity_id => p_child_profile_id::text,
    _child_id => v_linked_child_id,
    _family_context => jsonb_build_object('family_id', p_family_id),
    _metadata => jsonb_build_object('login_enabled', p_enabled)
  );

  RETURN jsonb_build_object(
    'child_profile_id', p_child_profile_id,
    'login_enabled', p_enabled
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_child_account_context(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_family_child_portal_overview(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_upsert_child_permissions(uuid, uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_set_child_login_enabled(uuid, uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_upsert_child_portal_settings(uuid, uuid, public.kid_portal_mode, text, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_pending_family_kid_portal_requests(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_kid_portal_request_state(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_request_kid_portal_access(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_decide_kid_portal_access_request(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_upsert_child_call_settings(uuid, uuid, boolean, uuid[], uuid[], public.child_call_mode, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_child_call_settings_history(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_callable_family_members(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_child_login_identifier(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_child_password_reset_target(text) TO anon, authenticated;
