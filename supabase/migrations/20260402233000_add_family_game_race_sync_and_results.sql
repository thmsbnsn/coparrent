-- Shared family game race synchronization and result handling:
-- - reusable session seed/start_time fields
-- - generic per-session result storage
-- - server-authoritative winner resolution

ALTER TABLE public.family_game_sessions
  ADD COLUMN IF NOT EXISTS seed bigint,
  ADD COLUMN IF NOT EXISTS start_time timestamptz,
  ADD COLUMN IF NOT EXISTS winner_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

UPDATE public.family_game_sessions
SET seed = floor(random() * 2147483646 + 1)::bigint
WHERE seed IS NULL;

ALTER TABLE public.family_game_sessions
  ALTER COLUMN seed SET DEFAULT floor(random() * 2147483646 + 1)::bigint;

ALTER TABLE public.family_game_sessions
  ALTER COLUMN seed SET NOT NULL;

ALTER TABLE public.family_game_sessions
  DROP CONSTRAINT IF EXISTS family_game_sessions_seed_check;

ALTER TABLE public.family_game_sessions
  ADD CONSTRAINT family_game_sessions_seed_check CHECK (seed > 0);

CREATE TABLE IF NOT EXISTS public.family_game_session_results (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES public.family_game_sessions(id) ON DELETE CASCADE,
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  score integer NOT NULL DEFAULT 0,
  distance integer NOT NULL DEFAULT 0,
  reported_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT family_game_session_results_session_profile_unique UNIQUE (session_id, profile_id),
  CONSTRAINT family_game_session_results_score_check CHECK (score >= 0),
  CONSTRAINT family_game_session_results_distance_check CHECK (distance >= 0)
);

ALTER TABLE public.family_game_session_results ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_family_game_session_results_session_reported
  ON public.family_game_session_results (session_id, reported_at DESC);

CREATE INDEX IF NOT EXISTS idx_family_game_session_results_family_profile
  ON public.family_game_session_results (family_id, profile_id);

DROP TRIGGER IF EXISTS update_family_game_session_results_updated_at ON public.family_game_session_results;
CREATE TRIGGER update_family_game_session_results_updated_at
BEFORE UPDATE ON public.family_game_session_results
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.resolve_family_game_session_outcome(
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
  IF p_session_id IS NULL THEN
    RAISE EXCEPTION 'session_id is required.';
  END IF;

  SELECT *
  INTO v_session
  FROM public.family_game_sessions
  WHERE id = p_session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Game session not found.';
  END IF;

  SELECT COUNT(*)
  INTO v_member_count
  FROM public.family_game_session_members
  WHERE session_id = p_session_id
    AND status <> 'left';

  SELECT COUNT(*)
  INTO v_result_count
  FROM public.family_game_session_results
  WHERE session_id = p_session_id;

  SELECT result_rows.profile_id
  INTO v_winner_profile_id
  FROM public.family_game_session_results result_rows
  WHERE result_rows.session_id = p_session_id
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

DROP FUNCTION IF EXISTS public.get_family_game_sessions_overview(uuid, text);
CREATE FUNCTION public.get_family_game_sessions_overview(
  p_family_id uuid,
  p_game_slug text
)
RETURNS TABLE (
  id uuid,
  family_id uuid,
  game_slug text,
  game_display_name text,
  created_by_profile_id uuid,
  created_by_display_name text,
  status text,
  max_players integer,
  created_at timestamptz,
  updated_at timestamptz,
  started_at timestamptz,
  start_time timestamptz,
  ended_at timestamptz,
  seed bigint,
  winner_profile_id uuid,
  member_count bigint,
  ready_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_game_slug text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  IF p_family_id IS NULL THEN
    RAISE EXCEPTION 'family_id is required.';
  END IF;

  v_game_slug := NULLIF(lower(btrim(p_game_slug)), '');
  IF v_game_slug IS NULL THEN
    RAISE EXCEPTION 'game_slug is required.';
  END IF;

  IF NOT public.is_active_family_member(p_family_id, auth.uid()) THEN
    RAISE EXCEPTION 'The authenticated user is not an active member of the requested family.';
  END IF;

  RETURN QUERY
  SELECT
    s.id,
    s.family_id,
    s.game_slug,
    s.game_display_name,
    s.created_by_profile_id,
    COALESCE(
      NULLIF(btrim(creator.full_name), ''),
      NULLIF(btrim(creator.email), ''),
      'Family member'
    ) AS created_by_display_name,
    s.status,
    s.max_players,
    s.created_at,
    s.updated_at,
    s.started_at,
    s.start_time,
    s.ended_at,
    s.seed,
    s.winner_profile_id,
    COUNT(m.id) FILTER (WHERE m.status <> 'left') AS member_count,
    COUNT(m.id) FILTER (WHERE m.status = 'ready' AND m.ready_at IS NOT NULL) AS ready_count
  FROM public.family_game_sessions s
  JOIN public.profiles creator
    ON creator.id = s.created_by_profile_id
  LEFT JOIN public.family_game_session_members m
    ON m.session_id = s.id
  WHERE s.family_id = p_family_id
    AND s.game_slug = v_game_slug
    AND s.status IN ('waiting', 'ready')
  GROUP BY s.id, creator.full_name, creator.email
  ORDER BY
    CASE WHEN s.status = 'ready' THEN 0 ELSE 1 END,
    s.updated_at DESC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_family_game_lobby(
  p_family_id uuid,
  p_session_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_session_json jsonb;
  v_members_json jsonb;
  v_results_json jsonb;
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

  SELECT jsonb_build_object(
    'id', s.id,
    'family_id', s.family_id,
    'game_slug', s.game_slug,
    'game_display_name', s.game_display_name,
    'created_by_profile_id', s.created_by_profile_id,
    'created_by_display_name', COALESCE(
      NULLIF(btrim(creator.full_name), ''),
      NULLIF(btrim(creator.email), ''),
      'Family member'
    ),
    'status', s.status,
    'max_players', s.max_players,
    'created_at', s.created_at,
    'updated_at', s.updated_at,
    'started_at', s.started_at,
    'start_time', s.start_time,
    'ended_at', s.ended_at,
    'seed', s.seed,
    'winner_profile_id', s.winner_profile_id,
    'member_count', (
      SELECT COUNT(*)
      FROM public.family_game_session_members gm
      WHERE gm.session_id = s.id
        AND gm.status <> 'left'
    ),
    'ready_count', (
      SELECT COUNT(*)
      FROM public.family_game_session_members gm
      WHERE gm.session_id = s.id
        AND gm.status = 'ready'
        AND gm.ready_at IS NOT NULL
    )
  )
  INTO v_session_json
  FROM public.family_game_sessions s
  JOIN public.profiles creator
    ON creator.id = s.created_by_profile_id
  WHERE s.id = p_session_id
    AND s.family_id = p_family_id;

  IF v_session_json IS NULL THEN
    RAISE EXCEPTION 'Game session not found for the requested family.';
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'profile_id', p.id,
        'display_name', COALESCE(
          NULLIF(btrim(p.full_name), ''),
          NULLIF(btrim(p.email), ''),
          initcap(replace(COALESCE(fm.relationship_label, fm.role::text), '_', ' '))
        ),
        'avatar_url', p.avatar_url,
        'relationship_label', fm.relationship_label,
        'role', fm.role,
        'joined_at', m.joined_at,
        'ready_at', m.ready_at,
        'seat_order', m.seat_order,
        'status', m.status,
        'is_creator', p.id = (v_session_json ->> 'created_by_profile_id')::uuid
      )
      ORDER BY m.seat_order NULLS LAST, m.joined_at
    ),
    '[]'::jsonb
  )
  INTO v_members_json
  FROM public.family_game_session_members m
  JOIN public.profiles p
    ON p.id = m.profile_id
  JOIN public.family_members fm
    ON fm.family_id = m.family_id
   AND fm.profile_id = m.profile_id
   AND fm.status = 'active'
  WHERE m.session_id = p_session_id
    AND m.family_id = p_family_id
    AND m.status <> 'left';

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'profile_id', p.id,
        'display_name', COALESCE(
          NULLIF(btrim(p.full_name), ''),
          NULLIF(btrim(p.email), ''),
          initcap(replace(COALESCE(fm.relationship_label, fm.role::text), '_', ' '))
        ),
        'avatar_url', p.avatar_url,
        'score', result_rows.score,
        'distance', result_rows.distance,
        'reported_at', result_rows.reported_at,
        'is_winner', p.id = (v_session_json ->> 'winner_profile_id')::uuid
      )
      ORDER BY
        result_rows.score DESC,
        result_rows.distance DESC,
        result_rows.reported_at DESC
    ),
    '[]'::jsonb
  )
  INTO v_results_json
  FROM public.family_game_session_results result_rows
  JOIN public.profiles p
    ON p.id = result_rows.profile_id
  JOIN public.family_members fm
    ON fm.family_id = result_rows.family_id
   AND fm.profile_id = result_rows.profile_id
   AND fm.status = 'active'
  WHERE result_rows.session_id = p_session_id
    AND result_rows.family_id = p_family_id;

  RETURN jsonb_build_object(
    'session', v_session_json,
    'members', v_members_json,
    'results', v_results_json
  );
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
      'seed', v_existing_session.seed,
      'status', v_existing_session.status
    );
  END IF;

  INSERT INTO public.family_game_sessions (
    family_id,
    game_slug,
    game_display_name,
    created_by_profile_id,
    status,
    max_players,
    seed
  )
  VALUES (
    p_family_id,
    v_game_slug,
    v_game_display_name,
    v_actor_profile_id,
    'waiting',
    v_max_players,
    floor(random() * 2147483646 + 1)::bigint
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
    'seed', v_session.seed,
    'status', v_session.status
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_start_family_game_session(
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
    AND family_id = p_family_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Game session not found for the requested family.';
  END IF;

  IF v_session.created_by_profile_id <> v_actor_profile_id THEN
    RAISE EXCEPTION 'Only the lobby host can start this session.';
  END IF;

  IF v_session.status <> 'ready' THEN
    RAISE EXCEPTION 'This session is not ready to start yet.';
  END IF;

  UPDATE public.family_game_sessions
  SET
    status = 'active',
    started_at = COALESCE(started_at, now()),
    start_time = now() + interval '3 seconds',
    ended_at = NULL,
    winner_profile_id = NULL,
    updated_at = now()
  WHERE id = p_session_id
  RETURNING *
  INTO v_session;

  DELETE FROM public.family_game_session_results
  WHERE session_id = p_session_id;

  RETURN jsonb_build_object(
    'id', v_session.id,
    'seed', v_session.seed,
    'start_time', v_session.start_time,
    'started_at', v_session.started_at,
    'status', v_session.status
  );
END;
$function$;

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

  v_outcome := public.resolve_family_game_session_outcome(p_session_id);

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

DROP POLICY IF EXISTS "Family members can read family game session results" ON public.family_game_session_results;
CREATE POLICY "Family members can read family game session results"
ON public.family_game_session_results
FOR SELECT
USING (public.is_active_family_member(family_id, auth.uid()));

GRANT SELECT ON public.family_game_session_results TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_family_game_sessions_overview(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_family_game_lobby(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_family_game_session_outcome(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_report_family_game_session_result(uuid, uuid, integer, integer, timestamptz) TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'family_game_session_results'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.family_game_session_results;
  END IF;
END
$$;
