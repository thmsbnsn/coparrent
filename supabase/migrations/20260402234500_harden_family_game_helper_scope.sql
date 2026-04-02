-- Harden internal family game helper execution and scope validation:
-- - revoke direct client execution from internal helper functions
-- - require authenticated active family membership for helper execution
-- - require explicit family_id for outcome resolution

CREATE OR REPLACE FUNCTION public.refresh_family_game_session_status(
  p_session_id uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_session public.family_game_sessions%ROWTYPE;
  v_member_count integer;
  v_ready_count integer;
  v_next_status text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  IF p_session_id IS NULL THEN
    RAISE EXCEPTION 'session_id is required.';
  END IF;

  SELECT *
  INTO v_session
  FROM public.family_game_sessions
  WHERE id = p_session_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Game session not found.';
  END IF;

  IF NOT public.is_active_family_member(v_session.family_id, auth.uid()) THEN
    RAISE EXCEPTION 'The authenticated user is not an active member of the requested family.';
  END IF;

  IF v_session.status IN ('active', 'finished', 'cancelled') THEN
    RETURN v_session.status;
  END IF;

  SELECT
    COUNT(*) FILTER (WHERE status <> 'left'),
    COUNT(*) FILTER (WHERE status = 'ready' AND ready_at IS NOT NULL)
  INTO
    v_member_count,
    v_ready_count
  FROM public.family_game_session_members
  WHERE session_id = p_session_id;

  v_next_status := CASE
    WHEN v_member_count > 0 AND v_member_count = v_ready_count THEN 'ready'
    ELSE 'waiting'
  END;

  UPDATE public.family_game_sessions
  SET
    status = v_next_status,
    updated_at = now()
  WHERE id = p_session_id;

  RETURN v_next_status;
END;
$function$;

REVOKE ALL ON FUNCTION public.refresh_family_game_session_status(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.refresh_family_game_session_status(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.refresh_family_game_session_status(uuid) FROM authenticated;

DROP FUNCTION IF EXISTS public.resolve_family_game_session_outcome(uuid);
CREATE FUNCTION public.resolve_family_game_session_outcome(
  p_family_id uuid,
  p_session_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_session public.family_game_sessions%ROWTYPE;
  v_member_count integer;
  v_result_count integer;
  v_winner_profile_id uuid;
  v_next_status text;
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

  SELECT *
  INTO v_session
  FROM public.family_game_sessions
  WHERE id = p_session_id
    AND family_id = p_family_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Game session not found for the requested family.';
  END IF;

  SELECT COUNT(*)
  INTO v_member_count
  FROM public.family_game_session_members
  WHERE session_id = p_session_id
    AND family_id = p_family_id
    AND status <> 'left';

  SELECT COUNT(*)
  INTO v_result_count
  FROM public.family_game_session_results
  WHERE session_id = p_session_id
    AND family_id = p_family_id;

  SELECT result_rows.profile_id
  INTO v_winner_profile_id
  FROM public.family_game_session_results result_rows
  WHERE result_rows.session_id = p_session_id
    AND result_rows.family_id = p_family_id
  ORDER BY
    result_rows.score DESC,
    result_rows.distance DESC,
    result_rows.reported_at DESC,
    result_rows.created_at ASC
  LIMIT 1;

  v_next_status := v_session.status;
  IF v_session.status = 'active'
     AND v_member_count > 0
     AND v_result_count >= v_member_count THEN
    v_next_status := 'finished';
  END IF;

  UPDATE public.family_game_sessions
  SET
    winner_profile_id = v_winner_profile_id,
    status = v_next_status,
    ended_at = CASE
      WHEN v_next_status = 'finished' THEN COALESCE(ended_at, now())
      ELSE ended_at
    END,
    updated_at = now()
  WHERE id = p_session_id
  RETURNING *
  INTO v_session;

  RETURN jsonb_build_object(
    'id', v_session.id,
    'status', v_session.status,
    'winner_profile_id', v_session.winner_profile_id,
    'result_count', v_result_count,
    'member_count', v_member_count,
    'ended_at', v_session.ended_at
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.resolve_family_game_session_outcome(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resolve_family_game_session_outcome(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.resolve_family_game_session_outcome(uuid, uuid) FROM authenticated;

CREATE OR REPLACE FUNCTION public.rpc_report_family_game_session_result(
  p_family_id uuid,
  p_session_id uuid,
  p_score integer,
  p_distance integer,
  p_reported_at timestamptz DEFAULT now()
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
  v_result public.family_game_session_results%ROWTYPE;
  v_outcome jsonb;
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

  IF p_score IS NULL OR p_score < 0 THEN
    RAISE EXCEPTION 'score must be a non-negative integer.';
  END IF;

  IF p_distance IS NULL OR p_distance < 0 THEN
    RAISE EXCEPTION 'distance must be a non-negative integer.';
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

  IF v_session.status NOT IN ('active', 'finished') THEN
    RAISE EXCEPTION 'Results can only be reported for active or finished sessions.';
  END IF;

  SELECT *
  INTO v_member
  FROM public.family_game_session_members
  WHERE session_id = p_session_id
    AND family_id = p_family_id
    AND profile_id = v_actor_profile_id
    AND status <> 'left';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Join the lobby before reporting a result.';
  END IF;

  INSERT INTO public.family_game_session_results (
    session_id,
    family_id,
    profile_id,
    score,
    distance,
    reported_at
  )
  VALUES (
    p_session_id,
    p_family_id,
    v_actor_profile_id,
    p_score,
    p_distance,
    COALESCE(p_reported_at, now())
  )
  ON CONFLICT (session_id, profile_id)
  DO UPDATE SET
    score = EXCLUDED.score,
    distance = EXCLUDED.distance,
    reported_at = EXCLUDED.reported_at,
    updated_at = now()
  RETURNING *
  INTO v_result;

  v_outcome := public.resolve_family_game_session_outcome(p_family_id, p_session_id);

  RETURN jsonb_build_object(
    'session_id', p_session_id,
    'profile_id', v_actor_profile_id,
    'score', v_result.score,
    'distance', v_result.distance,
    'reported_at', v_result.reported_at,
    'outcome', v_outcome
  );
END;
$function$;
