-- Child-side device access settings and future child app mode foundation
-- Family scope is always explicit:
-- - client: activeFamilyId
-- - server: p_family_id
-- Missing family scope must fail closed.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typnamespace = 'public'::regnamespace
      AND typname = 'child_device_sign_in_mode'
  ) THEN
    CREATE TYPE public.child_device_sign_in_mode AS ENUM ('standard_sign_in');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.child_device_access_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  child_id uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  quick_unlock_enabled boolean NOT NULL DEFAULT false,
  allowed_sign_in_mode public.child_device_sign_in_mode NOT NULL DEFAULT 'standard_sign_in',
  screen_time_enabled boolean NOT NULL DEFAULT false,
  screen_time_daily_minutes integer NULL,
  communication_enabled boolean NOT NULL DEFAULT true,
  games_enabled boolean NOT NULL DEFAULT true,
  multiplayer_enabled boolean NOT NULL DEFAULT true,
  allowed_game_slugs text[] NOT NULL DEFAULT ARRAY['flappy-plane']::text[],
  updated_by_profile_id uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (family_id, child_id),
  CONSTRAINT child_device_access_settings_screen_time_minutes_check
    CHECK (
      screen_time_daily_minutes IS NULL
      OR screen_time_daily_minutes BETWEEN 1 AND 1440
    )
);

CREATE INDEX IF NOT EXISTS idx_child_device_access_settings_family_child
  ON public.child_device_access_settings (family_id, child_id);

DROP TRIGGER IF EXISTS update_child_device_access_settings_updated_at
  ON public.child_device_access_settings;
CREATE TRIGGER update_child_device_access_settings_updated_at
BEFORE UPDATE ON public.child_device_access_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.child_device_access_settings ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.assert_child_family_game_access(
  p_family_id uuid,
  p_profile_id uuid,
  p_game_slug text,
  p_requires_multiplayer boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_allowed_game_slugs text[] := ARRAY['flappy-plane']::text[];
  v_child_id uuid;
  v_games_enabled boolean := true;
  v_multiplayer_enabled boolean := true;
  v_profile record;
  v_requested_game_slug text;
BEGIN
  IF p_family_id IS NULL THEN
    RAISE EXCEPTION 'family_id is required.';
  END IF;

  IF p_profile_id IS NULL THEN
    RAISE EXCEPTION 'profile_id is required.';
  END IF;

  v_requested_game_slug := NULLIF(lower(btrim(p_game_slug)), '');
  IF v_requested_game_slug IS NULL THEN
    RAISE EXCEPTION 'game_slug is required.';
  END IF;

  SELECT id, account_role, linked_child_id
  INTO v_profile
  FROM public.profiles
  WHERE id = p_profile_id
  LIMIT 1;

  IF NOT FOUND OR v_profile.account_role IS DISTINCT FROM 'child' THEN
    RETURN;
  END IF;

  v_child_id := v_profile.linked_child_id;
  IF v_child_id IS NULL THEN
    RAISE EXCEPTION 'The authenticated child account is not linked to a child record.';
  END IF;

  IF NOT public.is_child_in_family(p_family_id, v_child_id) THEN
    RAISE EXCEPTION 'This child account is not an active child member of the requested family.';
  END IF;

  SELECT
    COALESCE(cdas.games_enabled, true),
    COALESCE(cdas.multiplayer_enabled, true),
    COALESCE(cdas.allowed_game_slugs, ARRAY['flappy-plane']::text[])
  INTO
    v_games_enabled,
    v_multiplayer_enabled,
    v_allowed_game_slugs
  FROM public.child_device_access_settings cdas
  WHERE cdas.family_id = p_family_id
    AND cdas.child_id = v_child_id;

  IF NOT v_games_enabled THEN
    RAISE EXCEPTION 'Games are disabled for this child account.';
  END IF;

  IF NOT (v_requested_game_slug = ANY(v_allowed_game_slugs)) THEN
    RAISE EXCEPTION 'That game is not enabled for this child account.';
  END IF;

  IF COALESCE(p_requires_multiplayer, false) AND NOT v_multiplayer_enabled THEN
    RAISE EXCEPTION 'Multiplayer is disabled for this child account.';
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_upsert_child_device_access_settings(
  p_family_id uuid,
  p_child_id uuid,
  p_quick_unlock_enabled boolean DEFAULT NULL,
  p_allowed_sign_in_mode public.child_device_sign_in_mode DEFAULT NULL,
  p_screen_time_enabled boolean DEFAULT NULL,
  p_screen_time_daily_minutes integer DEFAULT NULL,
  p_communication_enabled boolean DEFAULT NULL,
  p_games_enabled boolean DEFAULT NULL,
  p_multiplayer_enabled boolean DEFAULT NULL,
  p_allowed_game_slugs text[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_actor_profile_id uuid;
  v_allowed_game_slugs text[];
  v_existing public.child_device_access_settings%ROWTYPE;
  v_row public.child_device_access_settings%ROWTYPE;
  v_screen_time_daily_minutes integer;
  v_screen_time_enabled boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  IF p_family_id IS NULL OR p_child_id IS NULL THEN
    RAISE EXCEPTION 'family_id and child_id are required.';
  END IF;

  IF NOT public.can_manage_family_child_settings(p_family_id, auth.uid()) THEN
    RAISE EXCEPTION 'Only active parents or guardians can manage child device access settings in this family.';
  END IF;

  IF NOT public.is_child_in_family(p_family_id, p_child_id) THEN
    RAISE EXCEPTION 'The selected child is not part of the requested family.';
  END IF;

  v_actor_profile_id := public.get_family_actor_profile_id(p_family_id, auth.uid());
  IF v_actor_profile_id IS NULL THEN
    RAISE EXCEPTION 'Active family profile could not be resolved.';
  END IF;

  IF p_screen_time_daily_minutes IS NOT NULL
     AND (p_screen_time_daily_minutes < 1 OR p_screen_time_daily_minutes > 1440) THEN
    RAISE EXCEPTION 'screen_time_daily_minutes must be between 1 and 1440 when provided.';
  END IF;

  SELECT *
  INTO v_existing
  FROM public.child_device_access_settings
  WHERE family_id = p_family_id
    AND child_id = p_child_id;

  IF p_allowed_game_slugs IS NULL THEN
    v_allowed_game_slugs := COALESCE(v_existing.allowed_game_slugs, ARRAY['flappy-plane']::text[]);
  ELSE
    SELECT COALESCE(array_agg(slug ORDER BY slug), ARRAY[]::text[])
    INTO v_allowed_game_slugs
    FROM (
      SELECT DISTINCT lower(btrim(value)) AS slug
      FROM unnest(p_allowed_game_slugs) AS value
      WHERE NULLIF(btrim(value), '') IS NOT NULL
    ) normalized_games;
  END IF;

  v_screen_time_enabled := COALESCE(
    p_screen_time_enabled,
    v_existing.screen_time_enabled,
    false
  );

  v_screen_time_daily_minutes := CASE
    WHEN v_screen_time_enabled THEN COALESCE(
      p_screen_time_daily_minutes,
      v_existing.screen_time_daily_minutes,
      NULL
    )
    ELSE NULL
  END;

  INSERT INTO public.child_device_access_settings (
    family_id,
    child_id,
    quick_unlock_enabled,
    allowed_sign_in_mode,
    screen_time_enabled,
    screen_time_daily_minutes,
    communication_enabled,
    games_enabled,
    multiplayer_enabled,
    allowed_game_slugs,
    updated_by_profile_id
  )
  VALUES (
    p_family_id,
    p_child_id,
    COALESCE(p_quick_unlock_enabled, v_existing.quick_unlock_enabled, false),
    COALESCE(
      p_allowed_sign_in_mode,
      v_existing.allowed_sign_in_mode,
      'standard_sign_in'::public.child_device_sign_in_mode
    ),
    v_screen_time_enabled,
    v_screen_time_daily_minutes,
    COALESCE(p_communication_enabled, v_existing.communication_enabled, true),
    COALESCE(p_games_enabled, v_existing.games_enabled, true),
    COALESCE(p_multiplayer_enabled, v_existing.multiplayer_enabled, true),
    COALESCE(v_allowed_game_slugs, ARRAY['flappy-plane']::text[]),
    v_actor_profile_id
  )
  ON CONFLICT (family_id, child_id)
  DO UPDATE SET
    quick_unlock_enabled = EXCLUDED.quick_unlock_enabled,
    allowed_sign_in_mode = EXCLUDED.allowed_sign_in_mode,
    screen_time_enabled = EXCLUDED.screen_time_enabled,
    screen_time_daily_minutes = EXCLUDED.screen_time_daily_minutes,
    communication_enabled = EXCLUDED.communication_enabled,
    games_enabled = EXCLUDED.games_enabled,
    multiplayer_enabled = EXCLUDED.multiplayer_enabled,
    allowed_game_slugs = EXCLUDED.allowed_game_slugs,
    updated_by_profile_id = EXCLUDED.updated_by_profile_id,
    updated_at = now()
  RETURNING *
  INTO v_row;

  RETURN jsonb_build_object(
    'child_id', v_row.child_id,
    'quick_unlock_enabled', v_row.quick_unlock_enabled,
    'allowed_sign_in_mode', v_row.allowed_sign_in_mode,
    'screen_time_enabled', v_row.screen_time_enabled,
    'screen_time_daily_minutes', v_row.screen_time_daily_minutes,
    'communication_enabled', v_row.communication_enabled,
    'games_enabled', v_row.games_enabled,
    'multiplayer_enabled', v_row.multiplayer_enabled,
    'allowed_game_slugs', to_jsonb(v_row.allowed_game_slugs),
    'updated_by_profile_id', v_row.updated_by_profile_id,
    'updated_at', v_row.updated_at
  );
END;
$function$;

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
  v_access public.child_device_access_settings%ROWTYPE;
  v_call public.child_call_settings%ROWTYPE;
  v_child public.children%ROWTYPE;
  v_permissions public.child_permissions%ROWTYPE;
  v_portal public.child_portal_settings%ROWTYPE;
  v_profile record;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  IF p_family_id IS NULL THEN
    RAISE EXCEPTION 'family_id is required.';
  END IF;

  SELECT
    p.id,
    p.linked_child_id,
    p.login_enabled
  INTO v_profile
  FROM public.profiles p
  WHERE p.user_id = auth.uid()
    AND p.account_role = 'child'
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'is_child', false,
      'login_enabled', true
    );
  END IF;

  IF v_profile.linked_child_id IS NULL THEN
    RAISE EXCEPTION 'The authenticated child account is not linked to a child record.';
  END IF;

  IF NOT public.is_child_in_family(p_family_id, v_profile.linked_child_id) THEN
    RAISE EXCEPTION 'This child account is not an active child member of the requested family.';
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
  INTO v_portal
  FROM public.child_portal_settings
  WHERE family_id = p_family_id
    AND child_id = v_profile.linked_child_id;

  SELECT *
  INTO v_call
  FROM public.child_call_settings
  WHERE family_id = p_family_id
    AND child_profile_id = v_profile.id;

  SELECT *
  INTO v_access
  FROM public.child_device_access_settings
  WHERE family_id = p_family_id
    AND child_id = v_profile.linked_child_id;

  RETURN jsonb_build_object(
    'child_id', v_profile.linked_child_id,
    'child_name', v_child.name,
    'child_profile_id', v_profile.id,
    'portal_mode', COALESCE(
      v_portal.portal_mode,
      public.get_default_kid_portal_mode(v_child.date_of_birth)
    ),
    'calling_enabled', COALESCE(v_call.calling_enabled, false),
    'call_mode', COALESCE(v_call.call_mode, 'audio_only'::public.child_call_mode),
    'allow_parent_messaging', COALESCE(v_permissions.allow_parent_messaging, true),
    'allow_family_chat', COALESCE(v_permissions.allow_family_chat, true),
    'allow_sibling_messaging', COALESCE(v_permissions.allow_sibling_messaging, true),
    'allow_push_notifications', COALESCE(v_permissions.allow_push_notifications, false),
    'allow_calendar_reminders', COALESCE(v_permissions.allow_calendar_reminders, true),
    'show_full_event_details', COALESCE(v_permissions.show_full_event_details, false),
    'allow_mood_checkins', COALESCE(v_permissions.allow_mood_checkins, true),
    'allow_notes_to_parents', COALESCE(v_permissions.allow_notes_to_parents, true),
    'allowed_game_slugs', to_jsonb(COALESCE(v_access.allowed_game_slugs, ARRAY['flappy-plane']::text[])),
    'allowed_sign_in_mode', COALESCE(
      v_access.allowed_sign_in_mode,
      'standard_sign_in'::public.child_device_sign_in_mode
    ),
    'child_email_reset_enabled', COALESCE(v_portal.reset_via_child_email, false),
    'communication_enabled', COALESCE(v_access.communication_enabled, true),
    'games_enabled', COALESCE(v_access.games_enabled, true),
    'is_child', true,
    'login_enabled', COALESCE(v_profile.login_enabled, true),
    'multiplayer_enabled', COALESCE(v_access.multiplayer_enabled, true),
    'quick_unlock_enabled', COALESCE(v_access.quick_unlock_enabled, false),
    'screen_time_daily_minutes', v_access.screen_time_daily_minutes,
    'screen_time_enabled', COALESCE(v_access.screen_time_enabled, false)
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
        ),
        'device_access', jsonb_build_object(
          'allowed_game_slugs', COALESCE(to_jsonb(cdas.allowed_game_slugs), to_jsonb(ARRAY['flappy-plane']::text[])),
          'allowed_sign_in_mode', COALESCE(
            cdas.allowed_sign_in_mode,
            'standard_sign_in'::public.child_device_sign_in_mode
          ),
          'child_email_reset_enabled', COALESCE(cps.reset_via_child_email, false),
          'communication_enabled', COALESCE(cdas.communication_enabled, true),
          'games_enabled', COALESCE(cdas.games_enabled, true),
          'multiplayer_enabled', COALESCE(cdas.multiplayer_enabled, true),
          'quick_unlock_enabled', COALESCE(cdas.quick_unlock_enabled, false),
          'screen_time_daily_minutes', cdas.screen_time_daily_minutes,
          'screen_time_enabled', COALESCE(cdas.screen_time_enabled, false),
          'updated_at', cdas.updated_at
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
   AND ccs.child_profile_id = cp.id
  LEFT JOIN public.child_device_access_settings cdas
    ON cdas.family_id = p_family_id
   AND cdas.child_id = fc.id;

  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_create_family_game_session(
  p_family_id uuid,
  p_game_slug text,
  p_game_display_name text,
  p_max_players integer DEFAULT 4
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_actor_profile_id uuid;
  v_game_slug text;
  v_game_display_name text;
  v_max_players integer;
  v_existing_session public.family_game_sessions%ROWTYPE;
  v_session public.family_game_sessions%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  IF p_family_id IS NULL THEN
    RAISE EXCEPTION 'family_id is required.';
  END IF;

  IF NOT public.is_active_family_member(p_family_id, auth.uid()) THEN
    RAISE EXCEPTION 'The authenticated user is not an active member of the requested family.';
  END IF;

  v_actor_profile_id := public.get_family_actor_profile_id(p_family_id, auth.uid());
  IF v_actor_profile_id IS NULL THEN
    RAISE EXCEPTION 'Active family profile could not be resolved.';
  END IF;

  v_game_slug := NULLIF(lower(btrim(p_game_slug)), '');
  IF v_game_slug IS NULL THEN
    RAISE EXCEPTION 'game_slug is required.';
  END IF;

  v_game_display_name := NULLIF(btrim(p_game_display_name), '');
  IF v_game_display_name IS NULL THEN
    RAISE EXCEPTION 'game_display_name is required.';
  END IF;

  PERFORM public.assert_child_family_game_access(
    p_family_id,
    v_actor_profile_id,
    v_game_slug,
    true
  );

  v_max_players := COALESCE(p_max_players, 4);
  IF v_max_players < 1 OR v_max_players > 6 THEN
    RAISE EXCEPTION 'max_players must be between 1 and 6.';
  END IF;

  SELECT *
  INTO v_existing_session
  FROM public.family_game_sessions
  WHERE family_id = p_family_id
    AND game_slug = v_game_slug
    AND status IN ('waiting', 'ready')
  ORDER BY updated_at DESC
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'id', v_existing_session.id,
      'status', v_existing_session.status
    );
  END IF;

  INSERT INTO public.family_game_sessions (
    family_id,
    game_slug,
    game_display_name,
    created_by_profile_id,
    status,
    max_players
  )
  VALUES (
    p_family_id,
    v_game_slug,
    v_game_display_name,
    v_actor_profile_id,
    'waiting',
    v_max_players
  )
  RETURNING *
  INTO v_session;

  INSERT INTO public.family_game_session_members (
    session_id,
    family_id,
    profile_id,
    ready_at,
    seat_order,
    status
  )
  VALUES (
    v_session.id,
    p_family_id,
    v_actor_profile_id,
    NULL,
    1,
    'joined'
  )
  ON CONFLICT (session_id, profile_id) DO NOTHING;

  PERFORM public.refresh_family_game_session_status(v_session.id);

  RETURN jsonb_build_object(
    'id', v_session.id,
    'status', v_session.status
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_join_family_game_session(
  p_family_id uuid,
  p_session_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_actor_profile_id uuid;
  v_session public.family_game_sessions%ROWTYPE;
  v_member public.family_game_session_members%ROWTYPE;
  v_next_seat integer;
  v_member_count integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  IF p_family_id IS NULL THEN
    RAISE EXCEPTION 'family_id is required.';
  END IF;

  IF p_session_id IS NULL THEN
    RAISE EXCEPTION 'session_id is required.';
  END IF;

  IF NOT public.is_active_family_member(p_family_id, auth.uid()) THEN
    RAISE EXCEPTION 'The authenticated user is not an active member of the requested family.';
  END IF;

  v_actor_profile_id := public.get_family_actor_profile_id(p_family_id, auth.uid());
  IF v_actor_profile_id IS NULL THEN
    RAISE EXCEPTION 'Active family profile could not be resolved.';
  END IF;

  SELECT *
  INTO v_session
  FROM public.family_game_sessions
  WHERE id = p_session_id
    AND family_id = p_family_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Game session not found for the requested family.';
  END IF;

  PERFORM public.assert_child_family_game_access(
    p_family_id,
    v_actor_profile_id,
    v_session.game_slug,
    true
  );

  IF v_session.status NOT IN ('waiting', 'ready') THEN
    RAISE EXCEPTION 'Only waiting or ready sessions can be joined.';
  END IF;

  SELECT *
  INTO v_member
  FROM public.family_game_session_members
  WHERE session_id = p_session_id
    AND profile_id = v_actor_profile_id;

  IF FOUND AND v_member.status <> 'left' THEN
    PERFORM public.refresh_family_game_session_status(p_session_id);
    RETURN jsonb_build_object(
      'session_id', p_session_id,
      'profile_id', v_actor_profile_id,
      'status', v_member.status,
      'ready_at', v_member.ready_at
    );
  END IF;

  SELECT COUNT(*)
  INTO v_member_count
  FROM public.family_game_session_members
  WHERE session_id = p_session_id
    AND status <> 'left';

  IF v_member_count >= v_session.max_players THEN
    RAISE EXCEPTION 'This lobby is already full.';
  END IF;

  SELECT COALESCE(MAX(seat_order), 0) + 1
  INTO v_next_seat
  FROM public.family_game_session_members
  WHERE session_id = p_session_id;

  INSERT INTO public.family_game_session_members (
    session_id,
    family_id,
    profile_id,
    joined_at,
    ready_at,
    seat_order,
    status
  )
  VALUES (
    p_session_id,
    p_family_id,
    v_actor_profile_id,
    now(),
    NULL,
    v_next_seat,
    'joined'
  )
  ON CONFLICT (session_id, profile_id)
  DO UPDATE SET
    family_id = EXCLUDED.family_id,
    joined_at = now(),
    ready_at = NULL,
    seat_order = COALESCE(public.family_game_session_members.seat_order, EXCLUDED.seat_order),
    status = 'joined',
    updated_at = now()
  RETURNING *
  INTO v_member;

  PERFORM public.refresh_family_game_session_status(p_session_id);

  RETURN jsonb_build_object(
    'session_id', p_session_id,
    'profile_id', v_actor_profile_id,
    'status', v_member.status,
    'ready_at', v_member.ready_at
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.rpc_upsert_child_device_access_settings(
  uuid,
  uuid,
  boolean,
  public.child_device_sign_in_mode,
  boolean,
  integer,
  boolean,
  boolean,
  boolean,
  text[]
) TO authenticated;
