-- Add a family-scoped rematch reset RPC for reusable multiplayer sessions.
-- - explicit family_id required
-- - host-only reset
-- - no cross-family fallback
-- - fresh shared seed for the next synchronized round

CREATE OR REPLACE FUNCTION public.rpc_prepare_family_game_session_rematch(
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
    AND family_id = p_family_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Game session not found for the requested family.';
  END IF;

  IF v_session.created_by_profile_id <> v_actor_profile_id THEN
    RAISE EXCEPTION 'Only the lobby host can prepare a rematch.';
  END IF;

  IF v_session.status <> 'finished' THEN
    RAISE EXCEPTION 'Only finished sessions can be reset for a rematch.';
  END IF;

  UPDATE public.family_game_session_members
  SET
    ready_at = NULL,
    status = CASE
      WHEN status = 'left' THEN 'left'
      ELSE 'joined'
    END,
    updated_at = now()
  WHERE session_id = p_session_id
    AND family_id = p_family_id;

  DELETE FROM public.family_game_session_results
  WHERE session_id = p_session_id
    AND family_id = p_family_id;

  UPDATE public.family_game_sessions
  SET
    status = 'waiting',
    seed = floor(random() * 2147483646 + 1)::bigint,
    started_at = NULL,
    start_time = NULL,
    ended_at = NULL,
    winner_profile_id = NULL,
    updated_at = now()
  WHERE id = p_session_id
  RETURNING *
  INTO v_session;

  RETURN jsonb_build_object(
    'id', v_session.id,
    'family_id', v_session.family_id,
    'status', v_session.status,
    'seed', v_session.seed,
    'start_time', v_session.start_time,
    'started_at', v_session.started_at,
    'ended_at', v_session.ended_at,
    'winner_profile_id', v_session.winner_profile_id
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.rpc_prepare_family_game_session_rematch(uuid, uuid) TO authenticated;
