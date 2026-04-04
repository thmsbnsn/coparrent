-- Async family game challenges on the shared game platform.
-- - explicit family_id required on every read/write path
-- - one active challenge per family/game
-- - best-score-only result submission
-- - no cross-family fallback or inference

CREATE TABLE IF NOT EXISTS public.family_game_challenges (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  game_slug text NOT NULL,
  game_display_name text NOT NULL,
  created_by_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'active',
  leading_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CONSTRAINT family_game_challenges_status_check CHECK (
    status IN ('active', 'completed', 'expired', 'cancelled')
  ),
  CONSTRAINT family_game_challenges_game_slug_check CHECK (
    NULLIF(btrim(game_slug), '') IS NOT NULL
  ),
  CONSTRAINT family_game_challenges_game_display_name_check CHECK (
    NULLIF(btrim(game_display_name), '') IS NOT NULL
  )
);

CREATE TABLE IF NOT EXISTS public.family_game_challenge_members (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  challenge_id uuid NOT NULL REFERENCES public.family_game_challenges(id) ON DELETE CASCADE,
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT family_game_challenge_members_unique UNIQUE (challenge_id, profile_id)
);

CREATE TABLE IF NOT EXISTS public.family_game_challenge_results (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  challenge_id uuid NOT NULL REFERENCES public.family_game_challenges(id) ON DELETE CASCADE,
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  score integer NOT NULL DEFAULT 0,
  distance integer NOT NULL DEFAULT 0,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT family_game_challenge_results_unique UNIQUE (challenge_id, profile_id),
  CONSTRAINT family_game_challenge_results_score_check CHECK (score >= 0),
  CONSTRAINT family_game_challenge_results_distance_check CHECK (distance >= 0)
);

ALTER TABLE public.family_game_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_game_challenge_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_game_challenge_results ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_family_game_challenges_family_game_updated
  ON public.family_game_challenges (family_id, game_slug, updated_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_family_game_challenges_one_active
  ON public.family_game_challenges (family_id, game_slug)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_family_game_challenge_members_family_profile
  ON public.family_game_challenge_members (family_id, profile_id);

CREATE INDEX IF NOT EXISTS idx_family_game_challenge_members_challenge_accepted
  ON public.family_game_challenge_members (challenge_id, accepted_at);

CREATE INDEX IF NOT EXISTS idx_family_game_challenge_results_family_profile
  ON public.family_game_challenge_results (family_id, profile_id);

CREATE INDEX IF NOT EXISTS idx_family_game_challenge_results_challenge_order
  ON public.family_game_challenge_results (
    challenge_id,
    score DESC,
    distance DESC,
    submitted_at ASC
  );

DROP TRIGGER IF EXISTS update_family_game_challenges_updated_at ON public.family_game_challenges;
CREATE TRIGGER update_family_game_challenges_updated_at
BEFORE UPDATE ON public.family_game_challenges
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_family_game_challenge_members_updated_at ON public.family_game_challenge_members;
CREATE TRIGGER update_family_game_challenge_members_updated_at
BEFORE UPDATE ON public.family_game_challenge_members
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_family_game_challenge_results_updated_at ON public.family_game_challenge_results;
CREATE TRIGGER update_family_game_challenge_results_updated_at
BEFORE UPDATE ON public.family_game_challenge_results
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.refresh_family_game_challenge_state(
  p_family_id uuid,
  p_challenge_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_challenge public.family_game_challenges%ROWTYPE;
  v_leading_profile_id uuid;
  v_next_status text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  IF p_family_id IS NULL THEN
    RAISE EXCEPTION 'family_id is required.';
  END IF;

  IF p_challenge_id IS NULL THEN
    RAISE EXCEPTION 'challenge_id is required.';
  END IF;

  IF NOT public.is_active_family_member(p_family_id, auth.uid()) THEN
    RAISE EXCEPTION 'The authenticated user is not an active member of the requested family.';
  END IF;

  SELECT *
  INTO v_challenge
  FROM public.family_game_challenges
  WHERE id = p_challenge_id
    AND family_id = p_family_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Game challenge not found for the requested family.';
  END IF;

  SELECT result_rows.profile_id
  INTO v_leading_profile_id
  FROM public.family_game_challenge_results result_rows
  WHERE result_rows.challenge_id = p_challenge_id
    AND result_rows.family_id = p_family_id
  ORDER BY
    result_rows.score DESC,
    result_rows.distance DESC,
    result_rows.submitted_at ASC,
    result_rows.created_at ASC
  LIMIT 1;

  v_next_status := v_challenge.status;
  IF v_challenge.status = 'active'
     AND v_challenge.expires_at IS NOT NULL
     AND v_challenge.expires_at <= now() THEN
    v_next_status := 'expired';
  END IF;

  UPDATE public.family_game_challenges
  SET
    leading_profile_id = v_leading_profile_id,
    status = v_next_status,
    completed_at = CASE
      WHEN v_next_status IN ('completed', 'expired') THEN COALESCE(completed_at, now())
      ELSE completed_at
    END,
    updated_at = now()
  WHERE id = p_challenge_id
  RETURNING *
  INTO v_challenge;

  RETURN jsonb_build_object(
    'id', v_challenge.id,
    'status', v_challenge.status,
    'leading_profile_id', v_challenge.leading_profile_id,
    'completed_at', v_challenge.completed_at,
    'updated_at', v_challenge.updated_at
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.refresh_family_game_challenge_state(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.refresh_family_game_challenge_state(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.refresh_family_game_challenge_state(uuid, uuid) FROM authenticated;

CREATE OR REPLACE FUNCTION public.get_family_game_challenge_overview(
  p_family_id uuid,
  p_game_slug text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_game_slug text;
  v_active_challenge_id uuid;
  v_challenge_json jsonb;
  v_participants_json jsonb;
  v_results_json jsonb;
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

  SELECT challenge_rows.id
  INTO v_active_challenge_id
  FROM public.family_game_challenges challenge_rows
  WHERE challenge_rows.family_id = p_family_id
    AND challenge_rows.game_slug = v_game_slug
    AND challenge_rows.status = 'active'
  ORDER BY challenge_rows.updated_at DESC
  LIMIT 1;

  IF v_active_challenge_id IS NOT NULL THEN
    PERFORM public.refresh_family_game_challenge_state(p_family_id, v_active_challenge_id);
  END IF;

  SELECT jsonb_build_object(
    'id', challenge_rows.id,
    'family_id', challenge_rows.family_id,
    'game_slug', challenge_rows.game_slug,
    'game_display_name', challenge_rows.game_display_name,
    'created_by_profile_id', challenge_rows.created_by_profile_id,
    'created_by_display_name', COALESCE(
      NULLIF(btrim(creator.full_name), ''),
      NULLIF(btrim(creator.email), ''),
      'Family member'
    ),
    'status', challenge_rows.status,
    'leading_profile_id', challenge_rows.leading_profile_id,
    'created_at', challenge_rows.created_at,
    'updated_at', challenge_rows.updated_at,
    'completed_at', challenge_rows.completed_at,
    'expires_at', challenge_rows.expires_at,
    'participant_count', (
      SELECT COUNT(*)
      FROM public.family_game_challenge_members member_rows
      WHERE member_rows.challenge_id = challenge_rows.id
        AND member_rows.family_id = challenge_rows.family_id
    ),
    'result_count', (
      SELECT COUNT(*)
      FROM public.family_game_challenge_results result_rows
      WHERE result_rows.challenge_id = challenge_rows.id
        AND result_rows.family_id = challenge_rows.family_id
    )
  )
  INTO v_challenge_json
  FROM public.family_game_challenges challenge_rows
  JOIN public.profiles creator
    ON creator.id = challenge_rows.created_by_profile_id
  WHERE challenge_rows.family_id = p_family_id
    AND challenge_rows.game_slug = v_game_slug
    AND challenge_rows.status <> 'cancelled'
  ORDER BY
    CASE challenge_rows.status
      WHEN 'active' THEN 0
      WHEN 'completed' THEN 1
      WHEN 'expired' THEN 2
      ELSE 3
    END,
    challenge_rows.updated_at DESC
  LIMIT 1;

  IF v_challenge_json IS NULL THEN
    RETURN jsonb_build_object(
      'challenge', NULL,
      'participants', '[]'::jsonb,
      'leaderboard', '[]'::jsonb
    );
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'profile_id', profiles_rows.id,
        'display_name', COALESCE(
          NULLIF(btrim(profiles_rows.full_name), ''),
          NULLIF(btrim(profiles_rows.email), ''),
          initcap(replace(COALESCE(family_rows.relationship_label, family_rows.role::text), '_', ' '))
        ),
        'avatar_url', profiles_rows.avatar_url,
        'relationship_label', family_rows.relationship_label,
        'role', family_rows.role,
        'accepted_at', member_rows.accepted_at,
        'has_result', EXISTS (
          SELECT 1
          FROM public.family_game_challenge_results result_rows
          WHERE result_rows.challenge_id = member_rows.challenge_id
            AND result_rows.family_id = member_rows.family_id
            AND result_rows.profile_id = member_rows.profile_id
        )
      )
      ORDER BY member_rows.accepted_at ASC, profiles_rows.id
    ),
    '[]'::jsonb
  )
  INTO v_participants_json
  FROM public.family_game_challenge_members member_rows
  JOIN public.profiles profiles_rows
    ON profiles_rows.id = member_rows.profile_id
  JOIN public.family_members family_rows
    ON family_rows.family_id = member_rows.family_id
   AND family_rows.profile_id = member_rows.profile_id
   AND family_rows.status = 'active'
  WHERE member_rows.challenge_id = (v_challenge_json ->> 'id')::uuid
    AND member_rows.family_id = p_family_id;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'profile_id', profiles_rows.id,
        'display_name', COALESCE(
          NULLIF(btrim(profiles_rows.full_name), ''),
          NULLIF(btrim(profiles_rows.email), ''),
          initcap(replace(COALESCE(family_rows.relationship_label, family_rows.role::text), '_', ' '))
        ),
        'avatar_url', profiles_rows.avatar_url,
        'relationship_label', family_rows.relationship_label,
        'role', family_rows.role,
        'score', result_rows.score,
        'distance', result_rows.distance,
        'submitted_at', result_rows.submitted_at,
        'is_leader', profiles_rows.id = NULLIF(v_challenge_json ->> 'leading_profile_id', '')::uuid
      )
      ORDER BY
        result_rows.score DESC,
        result_rows.distance DESC,
        result_rows.submitted_at ASC,
        result_rows.created_at ASC
    ),
    '[]'::jsonb
  )
  INTO v_results_json
  FROM public.family_game_challenge_results result_rows
  JOIN public.profiles profiles_rows
    ON profiles_rows.id = result_rows.profile_id
  JOIN public.family_members family_rows
    ON family_rows.family_id = result_rows.family_id
   AND family_rows.profile_id = result_rows.profile_id
   AND family_rows.status = 'active'
  WHERE result_rows.challenge_id = (v_challenge_json ->> 'id')::uuid
    AND result_rows.family_id = p_family_id;

  RETURN jsonb_build_object(
    'challenge', v_challenge_json,
    'participants', v_participants_json,
    'leaderboard', v_results_json
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_create_family_game_challenge(
  p_family_id uuid,
  p_game_slug text,
  p_game_display_name text,
  p_expires_at timestamptz DEFAULT NULL
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
  v_existing_challenge public.family_game_challenges%ROWTYPE;
  v_challenge public.family_game_challenges%ROWTYPE;
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

  SELECT *
  INTO v_existing_challenge
  FROM public.family_game_challenges
  WHERE family_id = p_family_id
    AND game_slug = v_game_slug
    AND status = 'active'
  ORDER BY updated_at DESC
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'id', v_existing_challenge.id,
      'status', v_existing_challenge.status
    );
  END IF;

  INSERT INTO public.family_game_challenges (
    family_id,
    game_slug,
    game_display_name,
    created_by_profile_id,
    status,
    expires_at
  )
  VALUES (
    p_family_id,
    v_game_slug,
    v_game_display_name,
    v_actor_profile_id,
    'active',
    p_expires_at
  )
  RETURNING *
  INTO v_challenge;

  INSERT INTO public.family_game_challenge_members (
    challenge_id,
    family_id,
    profile_id,
    accepted_at
  )
  VALUES (
    v_challenge.id,
    p_family_id,
    v_actor_profile_id,
    now()
  )
  ON CONFLICT (challenge_id, profile_id) DO NOTHING;

  PERFORM public.refresh_family_game_challenge_state(p_family_id, v_challenge.id);

  RETURN jsonb_build_object(
    'id', v_challenge.id,
    'status', v_challenge.status
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_accept_family_game_challenge(
  p_family_id uuid,
  p_challenge_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_actor_profile_id uuid;
  v_challenge public.family_game_challenges%ROWTYPE;
  v_member public.family_game_challenge_members%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  IF p_family_id IS NULL THEN
    RAISE EXCEPTION 'family_id is required.';
  END IF;

  IF p_challenge_id IS NULL THEN
    RAISE EXCEPTION 'challenge_id is required.';
  END IF;

  IF NOT public.is_active_family_member(p_family_id, auth.uid()) THEN
    RAISE EXCEPTION 'The authenticated user is not an active member of the requested family.';
  END IF;

  v_actor_profile_id := public.get_family_actor_profile_id(p_family_id, auth.uid());
  IF v_actor_profile_id IS NULL THEN
    RAISE EXCEPTION 'Active family profile could not be resolved.';
  END IF;

  PERFORM public.refresh_family_game_challenge_state(p_family_id, p_challenge_id);

  SELECT *
  INTO v_challenge
  FROM public.family_game_challenges
  WHERE id = p_challenge_id
    AND family_id = p_family_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Game challenge not found for the requested family.';
  END IF;

  IF v_challenge.status <> 'active' THEN
    RAISE EXCEPTION 'Only active family challenges can be accepted.';
  END IF;

  INSERT INTO public.family_game_challenge_members (
    challenge_id,
    family_id,
    profile_id,
    accepted_at
  )
  VALUES (
    p_challenge_id,
    p_family_id,
    v_actor_profile_id,
    now()
  )
  ON CONFLICT (challenge_id, profile_id)
  DO UPDATE SET
    accepted_at = COALESCE(public.family_game_challenge_members.accepted_at, now()),
    updated_at = now()
  RETURNING *
  INTO v_member;

  RETURN jsonb_build_object(
    'challenge_id', p_challenge_id,
    'profile_id', v_actor_profile_id,
    'accepted_at', v_member.accepted_at
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_submit_family_game_challenge_result(
  p_family_id uuid,
  p_challenge_id uuid,
  p_score integer,
  p_distance integer,
  p_submitted_at timestamptz DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_actor_profile_id uuid;
  v_challenge public.family_game_challenges%ROWTYPE;
  v_member public.family_game_challenge_members%ROWTYPE;
  v_existing_result public.family_game_challenge_results%ROWTYPE;
  v_result public.family_game_challenge_results%ROWTYPE;
  v_accepted boolean := true;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  IF p_family_id IS NULL THEN
    RAISE EXCEPTION 'family_id is required.';
  END IF;

  IF p_challenge_id IS NULL THEN
    RAISE EXCEPTION 'challenge_id is required.';
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

  PERFORM public.refresh_family_game_challenge_state(p_family_id, p_challenge_id);

  SELECT *
  INTO v_challenge
  FROM public.family_game_challenges
  WHERE id = p_challenge_id
    AND family_id = p_family_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Game challenge not found for the requested family.';
  END IF;

  IF v_challenge.status <> 'active' THEN
    RAISE EXCEPTION 'Results can only be submitted to an active family challenge.';
  END IF;

  SELECT *
  INTO v_member
  FROM public.family_game_challenge_members
  WHERE challenge_id = p_challenge_id
    AND family_id = p_family_id
    AND profile_id = v_actor_profile_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Accept the family challenge before submitting a score.';
  END IF;

  SELECT *
  INTO v_existing_result
  FROM public.family_game_challenge_results
  WHERE challenge_id = p_challenge_id
    AND family_id = p_family_id
    AND profile_id = v_actor_profile_id;

  IF FOUND THEN
    IF p_score < v_existing_result.score
       OR (p_score = v_existing_result.score AND p_distance <= v_existing_result.distance) THEN
      v_accepted := false;
      v_result := v_existing_result;
    END IF;
  END IF;

  IF v_accepted THEN
    INSERT INTO public.family_game_challenge_results (
      challenge_id,
      family_id,
      profile_id,
      score,
      distance,
      submitted_at
    )
    VALUES (
      p_challenge_id,
      p_family_id,
      v_actor_profile_id,
      p_score,
      p_distance,
      COALESCE(p_submitted_at, now())
    )
    ON CONFLICT (challenge_id, profile_id)
    DO UPDATE SET
      score = EXCLUDED.score,
      distance = EXCLUDED.distance,
      submitted_at = EXCLUDED.submitted_at,
      updated_at = now()
    RETURNING *
    INTO v_result;
  END IF;

  PERFORM public.refresh_family_game_challenge_state(p_family_id, p_challenge_id);

  SELECT *
  INTO v_challenge
  FROM public.family_game_challenges
  WHERE id = p_challenge_id
    AND family_id = p_family_id;

  RETURN jsonb_build_object(
    'accepted', v_accepted,
    'challenge_id', p_challenge_id,
    'profile_id', v_actor_profile_id,
    'score', v_result.score,
    'distance', v_result.distance,
    'submitted_at', v_result.submitted_at,
    'leading_profile_id', v_challenge.leading_profile_id,
    'status', v_challenge.status
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_close_family_game_challenge(
  p_family_id uuid,
  p_challenge_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_actor_profile_id uuid;
  v_challenge public.family_game_challenges%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  IF p_family_id IS NULL THEN
    RAISE EXCEPTION 'family_id is required.';
  END IF;

  IF p_challenge_id IS NULL THEN
    RAISE EXCEPTION 'challenge_id is required.';
  END IF;

  IF NOT public.is_active_family_member(p_family_id, auth.uid()) THEN
    RAISE EXCEPTION 'The authenticated user is not an active member of the requested family.';
  END IF;

  v_actor_profile_id := public.get_family_actor_profile_id(p_family_id, auth.uid());
  IF v_actor_profile_id IS NULL THEN
    RAISE EXCEPTION 'Active family profile could not be resolved.';
  END IF;

  PERFORM public.refresh_family_game_challenge_state(p_family_id, p_challenge_id);

  SELECT *
  INTO v_challenge
  FROM public.family_game_challenges
  WHERE id = p_challenge_id
    AND family_id = p_family_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Game challenge not found for the requested family.';
  END IF;

  IF v_challenge.created_by_profile_id <> v_actor_profile_id THEN
    RAISE EXCEPTION 'Only the challenge creator can close this family challenge.';
  END IF;

  IF v_challenge.status <> 'active' THEN
    RAISE EXCEPTION 'Only active family challenges can be closed.';
  END IF;

  UPDATE public.family_game_challenges
  SET
    status = 'completed',
    completed_at = COALESCE(completed_at, now()),
    updated_at = now()
  WHERE id = p_challenge_id
  RETURNING *
  INTO v_challenge;

  PERFORM public.refresh_family_game_challenge_state(p_family_id, p_challenge_id);

  SELECT *
  INTO v_challenge
  FROM public.family_game_challenges
  WHERE id = p_challenge_id
    AND family_id = p_family_id;

  RETURN jsonb_build_object(
    'id', v_challenge.id,
    'status', v_challenge.status,
    'leading_profile_id', v_challenge.leading_profile_id,
    'completed_at', v_challenge.completed_at
  );
END;
$function$;

DROP POLICY IF EXISTS "Family members can read family game challenges" ON public.family_game_challenges;
CREATE POLICY "Family members can read family game challenges"
ON public.family_game_challenges
FOR SELECT
USING (public.is_active_family_member(family_id, auth.uid()));

DROP POLICY IF EXISTS "Family members can read family game challenge members" ON public.family_game_challenge_members;
CREATE POLICY "Family members can read family game challenge members"
ON public.family_game_challenge_members
FOR SELECT
USING (public.is_active_family_member(family_id, auth.uid()));

DROP POLICY IF EXISTS "Family members can read family game challenge results" ON public.family_game_challenge_results;
CREATE POLICY "Family members can read family game challenge results"
ON public.family_game_challenge_results
FOR SELECT
USING (public.is_active_family_member(family_id, auth.uid()));

GRANT SELECT ON public.family_game_challenges TO authenticated;
GRANT SELECT ON public.family_game_challenge_members TO authenticated;
GRANT SELECT ON public.family_game_challenge_results TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_family_game_challenge_overview(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_create_family_game_challenge(uuid, text, text, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_accept_family_game_challenge(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_submit_family_game_challenge_result(uuid, uuid, integer, integer, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_close_family_game_challenge(uuid, uuid) TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'family_game_challenges'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.family_game_challenges;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'family_game_challenge_members'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.family_game_challenge_members;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'family_game_challenge_results'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.family_game_challenge_results;
  END IF;
END
$$;
