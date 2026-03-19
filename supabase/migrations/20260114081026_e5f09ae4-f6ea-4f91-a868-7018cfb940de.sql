-- =====================================================
-- TASK 1: AUDIT LOGGING SYSTEM FOR CHILD DATA
-- =====================================================

-- 1) Create audit_logs table
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  actor_user_id uuid NOT NULL,
  actor_profile_id uuid NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NULL,
  child_id uuid NULL,
  family_context jsonb NULL,
  metadata jsonb NULL,
  before jsonb NULL,
  after jsonb NULL
);

-- Create indexes for efficient querying
CREATE INDEX idx_audit_logs_actor ON public.audit_logs(actor_user_id);
CREATE INDEX idx_audit_logs_child ON public.audit_logs(child_id);
CREATE INDEX idx_audit_logs_created ON public.audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_action ON public.audit_logs(action);

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 2) RLS Policies for audit_logs
-- Parents can view audit logs for children they are linked to
CREATE POLICY "Parents can view their children's audit logs"
  ON public.audit_logs
  FOR SELECT
  USING (
    -- User is the actor
    actor_user_id = auth.uid()
    OR
    -- User has access to the child through parent_children
    (child_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM parent_children pc
      JOIN profiles p ON pc.parent_id = p.id
      WHERE pc.child_id = audit_logs.child_id
      AND p.user_id = auth.uid()
    ))
  );

-- Only system can insert (via SECURITY DEFINER function)
CREATE POLICY "System can insert audit logs"
  ON public.audit_logs
  FOR INSERT
  WITH CHECK (false);

-- Admins can view all audit logs
CREATE POLICY "Admins can view all audit logs"
  ON public.audit_logs
  FOR SELECT
  USING (is_admin());

-- 3) SECURITY DEFINER function to log audit events (tamper-proof)
CREATE OR REPLACE FUNCTION public.log_audit_event(
  _action text,
  _entity_type text,
  _entity_id uuid DEFAULT NULL,
  _child_id uuid DEFAULT NULL,
  _family_context jsonb DEFAULT NULL,
  _metadata jsonb DEFAULT NULL,
  _before jsonb DEFAULT NULL,
  _after jsonb DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_user_id uuid;
  v_actor_profile_id uuid;
  v_log_id uuid;
BEGIN
  -- Get current user (cannot be spoofed)
  v_actor_user_id := auth.uid();
  
  IF v_actor_user_id IS NULL THEN
    -- For trigger context, use a system user indicator
    v_actor_user_id := '00000000-0000-0000-0000-000000000000'::uuid;
  END IF;
  
  -- Get profile ID if exists
  SELECT id INTO v_actor_profile_id
  FROM profiles
  WHERE user_id = v_actor_user_id;
  
  -- Insert audit log
  INSERT INTO audit_logs (
    actor_user_id,
    actor_profile_id,
    action,
    entity_type,
    entity_id,
    child_id,
    family_context,
    metadata,
    before,
    after
  ) VALUES (
    v_actor_user_id,
    v_actor_profile_id,
    _action,
    _entity_type,
    _entity_id,
    _child_id,
    _family_context,
    _metadata,
    _before,
    _after
  )
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$;

-- 4) Trigger function for children table audit
CREATE OR REPLACE FUNCTION public.audit_children_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action text;
  v_before jsonb;
  v_after jsonb;
  v_child_id uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := 'CHILD_INSERT';
    v_before := NULL;
    v_after := to_jsonb(NEW);
    v_child_id := NEW.id;
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'CHILD_UPDATE';
    v_before := to_jsonb(OLD);
    v_after := to_jsonb(NEW);
    v_child_id := NEW.id;
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'CHILD_DELETE';
    v_before := to_jsonb(OLD);
    v_after := NULL;
    v_child_id := OLD.id;
  END IF;
  
  -- Log the audit event
  PERFORM log_audit_event(
    v_action,
    'child',
    v_child_id,
    v_child_id,
    NULL,
    NULL,
    v_before,
    v_after
  );
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- Create triggers on children table
CREATE TRIGGER audit_children_insert
  AFTER INSERT ON public.children
  FOR EACH ROW
  EXECUTE FUNCTION audit_children_changes();

CREATE TRIGGER audit_children_update
  AFTER UPDATE ON public.children
  FOR EACH ROW
  EXECUTE FUNCTION audit_children_changes();

CREATE TRIGGER audit_children_delete
  AFTER DELETE ON public.children
  FOR EACH ROW
  EXECUTE FUNCTION audit_children_changes();

-- 5) RPC function for viewing child details with audit logging
CREATE OR REPLACE FUNCTION public.get_child_details(p_child_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_profile_id uuid;
  v_child jsonb;
  v_has_access boolean := false;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required');
  END IF;
  
  -- Get profile ID
  SELECT id INTO v_profile_id
  FROM profiles
  WHERE user_id = v_user_id;
  
  IF v_profile_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Profile not found');
  END IF;
  
  -- Check if user has access to this child
  SELECT EXISTS (
    SELECT 1 FROM parent_children pc
    WHERE pc.child_id = p_child_id
    AND pc.parent_id = v_profile_id
  ) INTO v_has_access;
  
  IF NOT v_has_access THEN
    RETURN jsonb_build_object('success', false, 'error', 'Access denied');
  END IF;
  
  -- Get child data
  SELECT to_jsonb(c.*) INTO v_child
  FROM children c
  WHERE c.id = p_child_id;
  
  IF v_child IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Child not found');
  END IF;
  
  -- Log the view event
  PERFORM log_audit_event(
    'CHILD_VIEW',
    'child',
    p_child_id,
    p_child_id,
    NULL,
    NULL,
    NULL,
    NULL
  );
  
  RETURN jsonb_build_object('success', true, 'child', v_child);
END;
$$;

-- =====================================================
-- TASK 2: MESSAGE FULL-TEXT SEARCH
-- =====================================================

-- 1) Add tsvector column to thread_messages
ALTER TABLE public.thread_messages
ADD COLUMN IF NOT EXISTS search_vector tsvector
GENERATED ALWAYS AS (to_tsvector('english', content)) STORED;

-- 2) Create GIN index for full-text search
CREATE INDEX IF NOT EXISTS idx_thread_messages_search 
ON public.thread_messages USING GIN(search_vector);

-- 3) RPC function for searching messages (respects RLS)
CREATE OR REPLACE FUNCTION public.search_messages(
  p_query text,
  p_thread_id uuid DEFAULT NULL,
  p_limit int DEFAULT 30
)
RETURNS TABLE (
  id uuid,
  thread_id uuid,
  sender_id uuid,
  sender_name text,
  sender_role text,
  content text,
  created_at timestamptz,
  snippet text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_tsquery tsquery;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN;
  END IF;
  
  -- Convert search query to tsquery
  v_tsquery := plainto_tsquery('english', p_query);
  
  RETURN QUERY
  SELECT 
    tm.id,
    tm.thread_id,
    tm.sender_id,
    p.full_name AS sender_name,
    tm.sender_role::text,
    tm.content,
    tm.created_at,
    ts_headline('english', tm.content, v_tsquery, 'MaxWords=30, MinWords=15') AS snippet
  FROM thread_messages tm
  JOIN message_threads mt ON mt.id = tm.thread_id
  LEFT JOIN profiles p ON p.id = tm.sender_id
  WHERE tm.search_vector @@ v_tsquery
    AND can_access_thread(v_user_id, tm.thread_id)
    AND (p_thread_id IS NULL OR tm.thread_id = p_thread_id)
  ORDER BY tm.created_at DESC
  LIMIT LEAST(p_limit, 100);
END;
$$;

-- =====================================================
-- TASK 3: FUNCTION RATE LIMITING
-- =====================================================

-- 1) Create function_usage_daily table
CREATE TABLE public.function_usage_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  function_name text NOT NULL,
  usage_date date NOT NULL DEFAULT CURRENT_DATE,
  request_count integer NOT NULL DEFAULT 0,
  minute_window timestamptz NOT NULL DEFAULT date_trunc('minute', now()),
  minute_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, function_name, usage_date)
);

-- Create indexes
CREATE INDEX idx_function_usage_user_date ON public.function_usage_daily(user_id, usage_date);
CREATE INDEX idx_function_usage_function ON public.function_usage_daily(function_name);

-- Enable RLS
ALTER TABLE public.function_usage_daily ENABLE ROW LEVEL SECURITY;

-- RLS Policies - users can view their own, service role can manage all
CREATE POLICY "Users can view their own function usage"
  ON public.function_usage_daily
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Service role can manage function usage"
  ON public.function_usage_daily
  FOR ALL
  USING ((auth.jwt() ->> 'role'::text) = 'service_role'::text);

-- Enable realtime for audit_logs
ALTER PUBLICATION supabase_realtime ADD TABLE public.audit_logs;