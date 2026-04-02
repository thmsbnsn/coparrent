-- Family-scoped live presence:
-- - explicit family member presence rows
-- - server-validated presence writes
-- - family-scoped presence overview reads

CREATE TABLE IF NOT EXISTS public.family_presence (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  presence_status text NOT NULL DEFAULT 'inactive',
  location_type text,
  game_slug text,
  game_display_name text,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT family_presence_family_profile_unique UNIQUE (family_id, profile_id),
  CONSTRAINT family_presence_status_check CHECK (presence_status IN ('active', 'inactive')),
  CONSTRAINT family_presence_location_type_check CHECK (
    location_type IS NULL OR location_type IN ('dashboard', 'game')
  ),
  CONSTRAINT family_presence_game_fields_check CHECK (
    (location_type = 'game' AND NULLIF(btrim(game_slug), '') IS NOT NULL AND NULLIF(btrim(game_display_name), '') IS NOT NULL)
    OR
    (location_type IS DISTINCT FROM 'game')
  )
);

ALTER TABLE public.family_presence ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_family_presence_family_last_seen
  ON public.family_presence (family_id, last_seen_at DESC);

CREATE INDEX IF NOT EXISTS idx_family_presence_profile_family
  ON public.family_presence (profile_id, family_id);

CREATE OR REPLACE FUNCTION public.is_active_family_member(
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
  );
$function$;

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
      WHEN member_rows.effective_presence_status = 'active' AND member_rows.location_type = 'game'
        THEN member_rows.game_slug
      ELSE NULL
    END AS game_slug,
    CASE
      WHEN member_rows.effective_presence_status = 'active' AND member_rows.location_type = 'game'
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
    IF v_location_type NOT IN ('dashboard', 'game') THEN
      RAISE EXCEPTION 'location_type must be dashboard or game when presence is active.';
    END IF;

    IF v_location_type = 'game' THEN
      v_game_slug := NULLIF(btrim(p_game_slug), '');
      v_game_display_name := NULLIF(btrim(p_game_display_name), '');

      IF v_game_slug IS NULL OR v_game_display_name IS NULL THEN
        RAISE EXCEPTION 'game_slug and game_display_name are required for game presence.';
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

DROP TRIGGER IF EXISTS update_family_presence_updated_at ON public.family_presence;
CREATE TRIGGER update_family_presence_updated_at
BEFORE UPDATE ON public.family_presence
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP POLICY IF EXISTS "Family members can read family presence" ON public.family_presence;
CREATE POLICY "Family members can read family presence"
ON public.family_presence
FOR SELECT
USING (public.is_active_family_member(family_id, auth.uid()));

GRANT SELECT ON public.family_presence TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_active_family_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_family_presence_overview(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_upsert_family_presence(uuid, text, text, text, text) TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'family_presence'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.family_presence;
  END IF;
END
$$;
