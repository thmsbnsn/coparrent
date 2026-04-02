-- Family-scoped game session and lobby foundation:
-- - Toy Plane Dash lobby/session storage
-- - server-authoritative create/join/ready/start RPCs
-- - family-scoped reads only
-- - lobby-aware presence state

CREATE TABLE IF NOT EXISTS public.family_game_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  game_slug text NOT NULL,
  game_display_name text NOT NULL,
  created_by_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'waiting',
  max_players integer NOT NULL DEFAULT 4,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  ended_at timestamptz,
  CONSTRAINT family_game_sessions_status_check CHECK (
    status IN ('waiting', 'ready', 'active', 'finished', 'cancelled')
  ),
  CONSTRAINT family_game_sessions_game_slug_check CHECK (
    NULLIF(btrim(game_slug), '') IS NOT NULL
  ),
  CONSTRAINT family_game_sessions_game_display_name_check CHECK (
    NULLIF(btrim(game_display_name), '') IS NOT NULL
  ),
  CONSTRAINT family_game_sessions_max_players_check CHECK (
    max_players BETWEEN 1 AND 6
  )
);

CREATE TABLE IF NOT EXISTS public.family_game_session_members (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES public.family_game_sessions(id) ON DELETE CASCADE,
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  ready_at timestamptz,
  seat_order integer,
  status text NOT NULL DEFAULT 'joined',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT family_game_session_members_session_profile_unique UNIQUE (session_id, profile_id),
  CONSTRAINT family_game_session_members_status_check CHECK (
    status IN ('joined', 'ready', 'left')
  ),
  CONSTRAINT family_game_session_members_seat_order_check CHECK (
    seat_order IS NULL OR seat_order > 0
  )
);

ALTER TABLE public.family_game_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_game_session_members ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_family_game_sessions_family_game_created
  ON public.family_game_sessions (family_id, game_slug, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_family_game_sessions_open_family_game
  ON public.family_game_sessions (family_id, game_slug, updated_at DESC)
  WHERE status IN ('waiting', 'ready');

CREATE INDEX IF NOT EXISTS idx_family_game_session_members_session_joined
  ON public.family_game_session_members (session_id, joined_at);

CREATE INDEX IF NOT EXISTS idx_family_game_session_members_family_profile
  ON public.family_game_session_members (family_id, profile_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_family_game_sessions_one_open_lobby
  ON public.family_game_sessions (family_id, game_slug)
  WHERE status IN ('waiting', 'ready');

DROP TRIGGER IF EXISTS update_family_game_sessions_updated_at ON public.family_game_sessions;
CREATE TRIGGER update_family_game_sessions_updated_at
BEFORE UPDATE ON public.family_game_sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_family_game_session_members_updated_at ON public.family_game_session_members;
CREATE TRIGGER update_family_game_session_members_updated_at
BEFORE UPDATE ON public.family_game_session_members
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

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

CREATE OR REPLACE FUNCTION public.get_family_game_sessions_overview(
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
  ended_at timestamptz,
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
    s.ended_at,
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
    'ended_at', s.ended_at,
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

  RETURN jsonb_build_object(
    'session', v_session_json,
    'members', v_members_json
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

CREATE OR REPLACE FUNCTION public.rpc_set_family_game_session_ready(
  p_family_id uuid,
  p_session_id uuid,
  p_is_ready boolean
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
  v_status text;
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

  IF v_session.status NOT IN ('waiting', 'ready') THEN
    RAISE EXCEPTION 'Ready state can only be updated while the session is waiting or ready.';
  END IF;

  UPDATE public.family_game_session_members
  SET
    ready_at = CASE WHEN COALESCE(p_is_ready, false) THEN now() ELSE NULL END,
    status = CASE WHEN COALESCE(p_is_ready, false) THEN 'ready' ELSE 'joined' END,
    updated_at = now()
  WHERE session_id = p_session_id
    AND family_id = p_family_id
    AND profile_id = v_actor_profile_id
    AND status <> 'left'
  RETURNING *
  INTO v_member;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Join the lobby before updating ready state.';
  END IF;

  v_status := public.refresh_family_game_session_status(p_session_id);

  RETURN jsonb_build_object(
    'session_id', p_session_id,
    'profile_id', v_actor_profile_id,
    'status', v_member.status,
    'ready_at', v_member.ready_at,
    'session_status', v_status
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
    updated_at = now()
  WHERE id = p_session_id
  RETURNING *
  INTO v_session;

  RETURN jsonb_build_object(
    'id', v_session.id,
    'status', v_session.status,
    'started_at', v_session.started_at
  );
END;
$function$;

DROP POLICY IF EXISTS "Family members can read family game sessions" ON public.family_game_sessions;
CREATE POLICY "Family members can read family game sessions"
ON public.family_game_sessions
FOR SELECT
USING (public.is_active_family_member(family_id, auth.uid()));

DROP POLICY IF EXISTS "Family members can read family game session members" ON public.family_game_session_members;
CREATE POLICY "Family members can read family game session members"
ON public.family_game_session_members
FOR SELECT
USING (public.is_active_family_member(family_id, auth.uid()));

GRANT SELECT ON public.family_game_sessions TO authenticated;
GRANT SELECT ON public.family_game_session_members TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_family_game_session_status(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_family_game_sessions_overview(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_family_game_lobby(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_create_family_game_session(uuid, text, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_join_family_game_session(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_set_family_game_session_ready(uuid, uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_start_family_game_session(uuid, uuid) TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'family_game_sessions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.family_game_sessions;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'family_game_session_members'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.family_game_session_members;
  END IF;
END
$$;

ALTER TABLE public.family_presence
  DROP CONSTRAINT IF EXISTS family_presence_location_type_check;

ALTER TABLE public.family_presence
  ADD CONSTRAINT family_presence_location_type_check CHECK (
    location_type IS NULL OR location_type IN ('dashboard', 'lobby', 'game')
  );

ALTER TABLE public.family_presence
  DROP CONSTRAINT IF EXISTS family_presence_game_fields_check;

ALTER TABLE public.family_presence
  ADD CONSTRAINT family_presence_game_fields_check CHECK (
    (
      location_type IN ('game', 'lobby')
      AND NULLIF(btrim(game_slug), '') IS NOT NULL
      AND NULLIF(btrim(game_display_name), '') IS NOT NULL
    )
    OR location_type IS NULL
    OR location_type = 'dashboard'
  );

CREATE OR REPLACE FUNCTION public.get_family_presence_overview(
  p_family_id uuid
)
RETURNS TABLE (
  membership_id uuid,
  profile_id uuid,
  display_name text,
  avatar_url text,
  relationship_label text,
  role public.member_role,
  presence_status text,
  location_type text,
  game_slug text,
  game_display_name text,
  last_seen_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
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

  RETURN QUERY
  WITH member_rows AS (
    SELECT
      fm.id AS membership_id,
      fm.profile_id,
      COALESCE(
        NULLIF(btrim(p.full_name), ''),
        NULLIF(btrim(p.email), ''),
        initcap(replace(COALESCE(fm.relationship_label, fm.role::text), '_', ' '))
      ) AS display_name,
      p.avatar_url,
      fm.relationship_label,
      fm.role,
      fp.presence_status,
      fp.location_type,
      fp.game_slug,
      fp.game_display_name,
      fp.last_seen_at,
      CASE
        WHEN fp.presence_status = 'active'
          AND fp.last_seen_at >= now() - interval '90 seconds' THEN 'active'
        ELSE 'inactive'
      END AS effective_presence_status
    FROM public.family_members fm
    JOIN public.profiles p
      ON p.id = fm.profile_id
    LEFT JOIN public.family_presence fp
      ON fp.family_id = fm.family_id
     AND fp.profile_id = fm.profile_id
    WHERE fm.family_id = p_family_id
      AND fm.status = 'active'
  )
  SELECT
    member_rows.membership_id,
    member_rows.profile_id,
    member_rows.display_name,
    member_rows.avatar_url,
    member_rows.relationship_label,
    member_rows.role,
    member_rows.effective_presence_status AS presence_status,
    CASE
      WHEN member_rows.effective_presence_status = 'active' THEN member_rows.location_type
      ELSE NULL
    END AS location_type,
    CASE
      WHEN member_rows.effective_presence_status = 'active'
        AND member_rows.location_type IN ('game', 'lobby')
        THEN member_rows.game_slug
      ELSE NULL
    END AS game_slug,
    CASE
      WHEN member_rows.effective_presence_status = 'active'
        AND member_rows.location_type IN ('game', 'lobby')
        THEN member_rows.game_display_name
      ELSE NULL
    END AS game_display_name,
    member_rows.last_seen_at
  FROM member_rows
  ORDER BY
    CASE WHEN member_rows.effective_presence_status = 'active' THEN 0 ELSE 1 END,
    lower(member_rows.display_name),
    member_rows.profile_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_upsert_family_presence(
  p_family_id uuid,
  p_presence_status text,
  p_location_type text DEFAULT NULL,
  p_game_slug text DEFAULT NULL,
  p_game_display_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_actor_profile_id uuid;
  v_presence_status text;
  v_location_type text;
  v_game_slug text;
  v_game_display_name text;
  v_row public.family_presence%ROWTYPE;
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

  v_presence_status := lower(btrim(COALESCE(p_presence_status, '')));
  IF v_presence_status NOT IN ('active', 'inactive') THEN
    RAISE EXCEPTION 'presence_status must be active or inactive.';
  END IF;

  IF v_presence_status = 'inactive' THEN
    v_location_type := NULL;
    v_game_slug := NULL;
    v_game_display_name := NULL;
  ELSE
    v_location_type := lower(btrim(COALESCE(p_location_type, '')));
    IF v_location_type NOT IN ('dashboard', 'lobby', 'game') THEN
      RAISE EXCEPTION 'location_type must be dashboard, lobby, or game when presence is active.';
    END IF;

    IF v_location_type IN ('game', 'lobby') THEN
      v_game_slug := NULLIF(btrim(p_game_slug), '');
      v_game_display_name := NULLIF(btrim(p_game_display_name), '');

      IF v_game_slug IS NULL OR v_game_display_name IS NULL THEN
        RAISE EXCEPTION 'game_slug and game_display_name are required for game or lobby presence.';
      END IF;
    ELSE
      v_game_slug := NULL;
      v_game_display_name := NULL;
    END IF;
  END IF;

  INSERT INTO public.family_presence (
    family_id,
    profile_id,
    presence_status,
    location_type,
    game_slug,
    game_display_name,
    last_seen_at
  )
  VALUES (
    p_family_id,
    v_actor_profile_id,
    v_presence_status,
    v_location_type,
    v_game_slug,
    v_game_display_name,
    now()
  )
  ON CONFLICT (family_id, profile_id)
  DO UPDATE SET
    presence_status = EXCLUDED.presence_status,
    location_type = EXCLUDED.location_type,
    game_slug = EXCLUDED.game_slug,
    game_display_name = EXCLUDED.game_display_name,
    last_seen_at = EXCLUDED.last_seen_at,
    updated_at = now()
  RETURNING *
  INTO v_row;

  RETURN jsonb_build_object(
    'family_id', v_row.family_id,
    'profile_id', v_row.profile_id,
    'presence_status', v_row.presence_status,
    'location_type', v_row.location_type,
    'game_slug', v_row.game_slug,
    'game_display_name', v_row.game_display_name,
    'last_seen_at', v_row.last_seen_at,
    'updated_at', v_row.updated_at
  );
END;
$function$;
