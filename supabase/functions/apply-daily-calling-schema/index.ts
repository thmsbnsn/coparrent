import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";
import { strictCors, getCorsHeaders } from "../_shared/cors.ts";

const APPLY_SQL = [
  `
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'call_type') THEN
        CREATE TYPE public.call_type AS ENUM ('audio', 'video');
      END IF;

      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'call_status') THEN
        CREATE TYPE public.call_status AS ENUM (
          'ringing',
          'accepted',
          'declined',
          'missed',
          'cancelled',
          'ended',
          'failed'
        );
      END IF;

      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'call_event_type') THEN
        CREATE TYPE public.call_event_type AS ENUM (
          'created',
          'ringing',
          'accepted',
          'declined',
          'missed',
          'cancelled',
          'joined',
          'left',
          'ended',
          'failed'
        );
      END IF;
    END
    $$;
  `,
  `
    CREATE TABLE IF NOT EXISTS public.call_sessions (
      id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
      family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
      thread_id uuid REFERENCES public.message_threads(id) ON DELETE SET NULL,
      initiator_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
      callee_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
      initiator_role_snapshot public.member_role NOT NULL,
      callee_role_snapshot public.member_role NOT NULL,
      initiator_display_name text,
      callee_display_name text,
      call_type public.call_type NOT NULL,
      status public.call_status NOT NULL DEFAULT 'ringing',
      source text NOT NULL DEFAULT 'messaging_hub',
      daily_room_name text NOT NULL UNIQUE,
      daily_room_url text NOT NULL,
      room_expires_at timestamp with time zone,
      started_at timestamp with time zone,
      answered_at timestamp with time zone,
      ended_at timestamp with time zone,
      ended_by_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
      failed_reason text,
      created_at timestamp with time zone NOT NULL DEFAULT now(),
      updated_at timestamp with time zone NOT NULL DEFAULT now(),
      CONSTRAINT call_sessions_distinct_participants CHECK (initiator_profile_id <> callee_profile_id),
      CONSTRAINT call_sessions_source_check CHECK (source IN ('messaging_hub', 'dashboard'))
    );

    ALTER TABLE public.call_sessions
      ADD COLUMN IF NOT EXISTS family_id uuid REFERENCES public.families(id) ON DELETE CASCADE,
      ADD COLUMN IF NOT EXISTS thread_id uuid REFERENCES public.message_threads(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS initiator_profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
      ADD COLUMN IF NOT EXISTS callee_profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
      ADD COLUMN IF NOT EXISTS initiator_role_snapshot public.member_role,
      ADD COLUMN IF NOT EXISTS callee_role_snapshot public.member_role,
      ADD COLUMN IF NOT EXISTS initiator_display_name text,
      ADD COLUMN IF NOT EXISTS callee_display_name text,
      ADD COLUMN IF NOT EXISTS call_type public.call_type,
      ADD COLUMN IF NOT EXISTS status public.call_status DEFAULT 'ringing',
      ADD COLUMN IF NOT EXISTS source text DEFAULT 'messaging_hub',
      ADD COLUMN IF NOT EXISTS daily_room_name text,
      ADD COLUMN IF NOT EXISTS daily_room_url text,
      ADD COLUMN IF NOT EXISTS room_expires_at timestamp with time zone,
      ADD COLUMN IF NOT EXISTS started_at timestamp with time zone,
      ADD COLUMN IF NOT EXISTS answered_at timestamp with time zone,
      ADD COLUMN IF NOT EXISTS ended_at timestamp with time zone,
      ADD COLUMN IF NOT EXISTS ended_by_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS failed_reason text,
      ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now(),
      ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();
  `,
  `
    CREATE TABLE IF NOT EXISTS public.call_participants (
      id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
      call_session_id uuid NOT NULL REFERENCES public.call_sessions(id) ON DELETE CASCADE,
      profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
      member_role_snapshot public.member_role NOT NULL,
      display_name_snapshot text,
      joined_at timestamp with time zone,
      left_at timestamp with time zone,
      created_at timestamp with time zone NOT NULL DEFAULT now(),
      CONSTRAINT call_participants_unique_member UNIQUE (call_session_id, profile_id)
    );

    ALTER TABLE public.call_participants
      ADD COLUMN IF NOT EXISTS call_session_id uuid REFERENCES public.call_sessions(id) ON DELETE CASCADE,
      ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
      ADD COLUMN IF NOT EXISTS member_role_snapshot public.member_role,
      ADD COLUMN IF NOT EXISTS display_name_snapshot text,
      ADD COLUMN IF NOT EXISTS joined_at timestamp with time zone,
      ADD COLUMN IF NOT EXISTS left_at timestamp with time zone,
      ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
  `,
  `
    CREATE TABLE IF NOT EXISTS public.call_events (
      id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
      call_session_id uuid NOT NULL REFERENCES public.call_sessions(id) ON DELETE CASCADE,
      actor_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
      actor_role_snapshot public.member_role,
      actor_display_name text,
      event_type public.call_event_type NOT NULL,
      payload jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamp with time zone NOT NULL DEFAULT now()
    );

    ALTER TABLE public.call_events
      ADD COLUMN IF NOT EXISTS call_session_id uuid REFERENCES public.call_sessions(id) ON DELETE CASCADE,
      ADD COLUMN IF NOT EXISTS actor_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS actor_role_snapshot public.member_role,
      ADD COLUMN IF NOT EXISTS actor_display_name text,
      ADD COLUMN IF NOT EXISTS event_type public.call_event_type,
      ADD COLUMN IF NOT EXISTS payload jsonb DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
  `,
  `
    CREATE INDEX IF NOT EXISTS idx_call_sessions_family_id_created_at
      ON public.call_sessions (family_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_call_sessions_thread_id
      ON public.call_sessions (thread_id);
    CREATE INDEX IF NOT EXISTS idx_call_sessions_initiator_status
      ON public.call_sessions (initiator_profile_id, status, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_call_sessions_callee_status
      ON public.call_sessions (callee_profile_id, status, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_call_participants_call_session_id
      ON public.call_participants (call_session_id);
    CREATE INDEX IF NOT EXISTS idx_call_participants_profile_id
      ON public.call_participants (profile_id);
    CREATE INDEX IF NOT EXISTS idx_call_events_call_session_id_created_at
      ON public.call_events (call_session_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_call_events_actor_profile_id
      ON public.call_events (actor_profile_id);
  `,
  `
    ALTER TABLE public.call_sessions ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.call_participants ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.call_events ENABLE ROW LEVEL SECURITY;

    CREATE OR REPLACE FUNCTION public.can_access_call_session(_user_id uuid, _call_session_id uuid)
    RETURNS boolean
    LANGUAGE sql
    STABLE
    SECURITY DEFINER
    SET search_path = public
    AS $function$
      SELECT EXISTS (
        SELECT 1
        FROM public.call_sessions cs
        JOIN public.profiles viewer
          ON viewer.user_id = _user_id
        JOIN public.family_members fm
          ON fm.family_id = cs.family_id
         AND fm.user_id = _user_id
         AND fm.status = 'active'
        WHERE cs.id = _call_session_id
          AND viewer.id IN (cs.initiator_profile_id, cs.callee_profile_id)
      );
    $function$;

    GRANT EXECUTE ON FUNCTION public.can_access_call_session(uuid, uuid) TO authenticated;

    CREATE OR REPLACE FUNCTION public.get_callable_family_members(p_family_id uuid)
    RETURNS TABLE (
      membership_id uuid,
      profile_id uuid,
      role public.member_role,
      relationship_label text,
      full_name text,
      email text,
      avatar_url text
    )
    LANGUAGE sql
    STABLE
    SECURITY DEFINER
    SET search_path = public
    AS $function$
      WITH viewer AS (
        SELECT p.id AS profile_id
        FROM public.profiles p
        WHERE p.user_id = auth.uid()
        LIMIT 1
      )
      SELECT
        fm.id AS membership_id,
        fm.profile_id,
        fm.role,
        fm.relationship_label,
        p.full_name,
        p.email,
        p.avatar_url
      FROM public.family_members fm
      JOIN public.profiles p
        ON p.id = fm.profile_id
      CROSS JOIN viewer
      WHERE fm.family_id = p_family_id
        AND fm.status = 'active'
        AND fm.role = ANY (ARRAY[
          'parent'::public.member_role,
          'guardian'::public.member_role,
          'third_party'::public.member_role
        ])
        AND fm.profile_id <> viewer.profile_id
        AND EXISTS (
          SELECT 1
          FROM public.family_members viewer_member
          WHERE viewer_member.family_id = p_family_id
            AND viewer_member.user_id = auth.uid()
            AND viewer_member.status = 'active'
        )
      ORDER BY lower(COALESCE(p.full_name, p.email, 'family member'));
    $function$;

    GRANT EXECUTE ON FUNCTION public.get_callable_family_members(uuid) TO authenticated;
  `,
  `
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'call_sessions'
          AND policyname = 'Call participants can view call sessions'
      ) THEN
        CREATE POLICY "Call participants can view call sessions"
        ON public.call_sessions
        FOR SELECT
        USING (public.can_access_call_session(auth.uid(), id));
      END IF;

      IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'call_participants'
          AND policyname = 'Call participants can view participant presence'
      ) THEN
        CREATE POLICY "Call participants can view participant presence"
        ON public.call_participants
        FOR SELECT
        USING (public.can_access_call_session(auth.uid(), call_session_id));
      END IF;

      IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'call_events'
          AND policyname = 'Call participants can view call events'
      ) THEN
        CREATE POLICY "Call participants can view call events"
        ON public.call_events
        FOR SELECT
        USING (public.can_access_call_session(auth.uid(), call_session_id));
      END IF;
    END
    $$;
  `,
  `
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'call_sessions'
      ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.call_sessions;
      END IF;

      IF NOT EXISTS (
        SELECT 1
        FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'call_participants'
      ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.call_participants;
      END IF;

      IF NOT EXISTS (
        SELECT 1
        FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'call_events'
      ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.call_events;
      END IF;
    END
    $$;
  `,
  `
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgname = 'update_call_sessions_updated_at'
      ) THEN
        CREATE TRIGGER update_call_sessions_updated_at
        BEFORE UPDATE ON public.call_sessions
        FOR EACH ROW
        EXECUTE FUNCTION public.update_updated_at_column();
      END IF;
    END
    $$;
  `,
  `
    NOTIFY pgrst, 'reload schema';
  `,
];

function jsonResponse(
  body: Record<string, unknown>,
  corsHeaders: Record<string, string>,
  status = 200,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders,
    },
  });
}

serve(async (req) => {
  const corsResponse = strictCors(req);
  if (corsResponse) return corsResponse;

  const corsHeaders = getCorsHeaders(req);

  if (req.method !== "POST") {
    return jsonResponse({ success: false, error: "Method not allowed" }, corsHeaders, 405);
  }

  const adminKey = Deno.env.get("CALL_SCHEMA_ADMIN_KEY")?.trim() ?? "";
  const providedKey = req.headers.get("x-call-schema-key")?.trim() ?? "";

  if (!adminKey || !providedKey || providedKey !== adminKey) {
    return jsonResponse({ success: false, error: "Forbidden" }, corsHeaders, 403);
  }

  const dbUrl = Deno.env.get("SUPABASE_DB_URL");
  if (!dbUrl) {
    return jsonResponse({ success: false, error: "SUPABASE_DB_URL is not configured" }, corsHeaders, 500);
  }

  const client = new Client(dbUrl);

  try {
    await client.connect();
    await client.queryArray("BEGIN");

    for (const statement of APPLY_SQL) {
      await client.queryArray(statement);
    }

    await client.queryArray("COMMIT");

    return jsonResponse(
      {
        success: true,
        statements_applied: APPLY_SQL.length,
      },
      corsHeaders,
    );
  } catch (error) {
    try {
      await client.queryArray("ROLLBACK");
    } catch {
      // Ignore rollback failures after the primary error.
    }

    return jsonResponse(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      corsHeaders,
      500,
    );
  } finally {
    await client.end();
  }
});
