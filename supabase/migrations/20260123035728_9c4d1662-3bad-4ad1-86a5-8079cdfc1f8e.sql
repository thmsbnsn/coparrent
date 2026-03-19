-- =====================================================
-- AUDIT LOG COMPLETENESS & TAMPER RESISTANCE
-- Court-defensible = immutable, complete, unforgeable
-- =====================================================

-- 1. Add actor_role_at_action column to capture role at time of action
ALTER TABLE public.audit_logs 
ADD COLUMN IF NOT EXISTS actor_role_at_action text;

-- Add comment for documentation
COMMENT ON COLUMN public.audit_logs.actor_role_at_action IS 'Role of the actor at the time of action (parent, co_parent, third_party, child, admin, system). Immutable snapshot for court use.';

-- 2. Ensure no UPDATE policy exists (tamper prevention)
-- Drop any existing UPDATE policies
DROP POLICY IF EXISTS "No updates allowed" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_update_policy" ON public.audit_logs;

-- Create explicit DENY policy for UPDATE
CREATE POLICY "Audit logs are immutable - no updates"
  ON public.audit_logs
  FOR UPDATE
  USING (false)
  WITH CHECK (false);

-- 3. Ensure no DELETE policy exists (tamper prevention)
DROP POLICY IF EXISTS "No deletes allowed" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_delete_policy" ON public.audit_logs;

-- Create explicit DENY policy for DELETE
CREATE POLICY "Audit logs are immutable - no deletes"
  ON public.audit_logs
  FOR DELETE
  USING (false);

-- 4. Update log_audit_event function to capture role
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
  v_actor_role text;
  v_log_id uuid;
BEGIN
  -- Get current user (cannot be spoofed)
  v_actor_user_id := auth.uid();
  
  IF v_actor_user_id IS NULL THEN
    -- For trigger context or edge function with service role
    v_actor_user_id := '00000000-0000-0000-0000-000000000000'::uuid;
    v_actor_role := 'system';
  ELSE
    -- Get profile ID and determine role
    SELECT 
      p.id,
      CASE
        -- Check if admin first
        WHEN public.has_role(v_actor_user_id, 'admin') THEN 'admin'
        -- Check if child account
        WHEN p.account_role = 'child' THEN 'child'
        -- Check if third-party
        WHEN EXISTS (
          SELECT 1 FROM family_members fm 
          WHERE fm.profile_id = p.id 
          AND fm.role = 'third_party' 
          AND fm.status = 'active'
        ) THEN 'third_party'
        -- Otherwise parent (includes co-parent)
        ELSE 'parent'
      END
    INTO v_actor_profile_id, v_actor_role
    FROM profiles p
    WHERE p.user_id = v_actor_user_id;
  END IF;
  
  -- Insert audit log with role snapshot
  INSERT INTO audit_logs (
    actor_user_id,
    actor_profile_id,
    actor_role_at_action,
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
    v_actor_role,
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

-- 5. Create helper function for edge functions to log with explicit role
CREATE OR REPLACE FUNCTION public.log_audit_event_system(
  _actor_user_id uuid,
  _actor_profile_id uuid,
  _action text, 
  _entity_type text, 
  _entity_id uuid DEFAULT NULL, 
  _child_id uuid DEFAULT NULL, 
  _metadata jsonb DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_role text;
  v_log_id uuid;
BEGIN
  -- Determine role at time of action
  IF _actor_user_id IS NULL OR _actor_user_id = '00000000-0000-0000-0000-000000000000'::uuid THEN
    v_actor_role := 'system';
  ELSE
    SELECT 
      CASE
        WHEN public.has_role(_actor_user_id, 'admin') THEN 'admin'
        WHEN p.account_role = 'child' THEN 'child'
        WHEN EXISTS (
          SELECT 1 FROM family_members fm 
          WHERE fm.profile_id = p.id 
          AND fm.role = 'third_party' 
          AND fm.status = 'active'
        ) THEN 'third_party'
        ELSE 'parent'
      END
    INTO v_actor_role
    FROM profiles p
    WHERE p.user_id = _actor_user_id;
  END IF;
  
  -- Insert with explicit values (bypasses RLS via SECURITY DEFINER)
  INSERT INTO audit_logs (
    actor_user_id,
    actor_profile_id,
    actor_role_at_action,
    action,
    entity_type,
    entity_id,
    child_id,
    metadata
  ) VALUES (
    COALESCE(_actor_user_id, '00000000-0000-0000-0000-000000000000'::uuid),
    _actor_profile_id,
    v_actor_role,
    _action,
    _entity_type,
    _entity_id,
    _child_id,
    _metadata
  )
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$;

-- 6. Update SELECT policy for third-party to prevent metadata inference
-- Third-party should ONLY see their own actions, not aggregate data about the family
DROP POLICY IF EXISTS "Parents can view their children's audit logs" ON public.audit_logs;

CREATE POLICY "Family members can view relevant audit logs"
  ON public.audit_logs
  FOR SELECT
  USING (
    -- User is the actor (can always see their own actions)
    actor_user_id = auth.uid()
    OR
    -- Parents/co-parents can see logs for children they have access to
    (
      child_id IS NOT NULL 
      AND public.is_parent_or_guardian(auth.uid())
      AND EXISTS (
        SELECT 1 FROM parent_children pc
        JOIN profiles p ON pc.parent_id = p.id
        WHERE pc.child_id = audit_logs.child_id
        AND p.user_id = auth.uid()
      )
    )
  );

-- Note: Third-party users can ONLY see their own actions (first clause)
-- They cannot see other family members' actions on children they have access to
-- This prevents metadata inference attacks (seeing when other users accessed data)