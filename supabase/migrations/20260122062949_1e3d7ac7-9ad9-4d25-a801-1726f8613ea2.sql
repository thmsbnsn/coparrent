-- =============================================================================
-- SERVER-ENFORCED PLAN LIMITS: RPC + RLS WRITE-THROUGH
-- =============================================================================

-- A) CANONICAL PLAN + LIMITS FUNCTIONS
-- =============================================================================

-- Helper: Get current authenticated user's profile ID
CREATE OR REPLACE FUNCTION public.get_current_profile_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

-- Get normalized plan tier for a profile
-- Returns 'free' or 'power' (treats legacy premium/mvp as power)
CREATE OR REPLACE FUNCTION public.get_plan_tier(p_profile_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    CASE 
      -- Power tier: active subscription with power/premium/mvp tier
      WHEN p.subscription_status IN ('active', 'trialing') 
           AND p.subscription_tier IN ('power', 'premium', 'mvp') 
      THEN 'power'
      -- Trial: treat as power
      WHEN p.subscription_status = 'trialing' THEN 'power'
      -- Everything else: free
      ELSE 'free'
    END
  FROM profiles p
  WHERE p.id = p_profile_id;
$$;

-- Get plan limits as JSON
CREATE OR REPLACE FUNCTION public.get_plan_limits(p_profile_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    CASE public.get_plan_tier(p_profile_id)
      WHEN 'power' THEN jsonb_build_object(
        'tier', 'power',
        'max_kids', 6,
        'max_third_party', 6
      )
      ELSE jsonb_build_object(
        'tier', 'free',
        'max_kids', 4,
        'max_third_party', 4
      )
    END;
$$;

-- Get plan usage and limits combined
-- kids_used: count distinct children linked via parent_children
-- third_party_used: count active/pending family_members + pending invitations
CREATE OR REPLACE FUNCTION public.get_plan_usage(p_profile_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tier text;
  v_max_kids int;
  v_max_third_party int;
  v_kids_used int;
  v_third_party_used int;
  v_co_parent_id uuid;
  v_primary_parent_id uuid;
BEGIN
  -- Get tier
  v_tier := public.get_plan_tier(p_profile_id);
  
  -- Set limits based on tier
  IF v_tier = 'power' THEN
    v_max_kids := 6;
    v_max_third_party := 6;
  ELSE
    v_max_kids := 4;
    v_max_third_party := 4;
  END IF;
  
  -- Get co-parent if exists
  SELECT co_parent_id INTO v_co_parent_id
  FROM profiles WHERE id = p_profile_id;
  
  -- Determine primary parent ID (lower ID for consistency in family)
  IF v_co_parent_id IS NOT NULL THEN
    v_primary_parent_id := LEAST(p_profile_id, v_co_parent_id);
  ELSE
    v_primary_parent_id := p_profile_id;
  END IF;
  
  -- Count kids: distinct children linked to this parent
  SELECT COUNT(DISTINCT child_id) INTO v_kids_used
  FROM parent_children
  WHERE parent_id = p_profile_id;
  
  -- Count third-party: active/invited family_members + pending unexpired invitations
  -- Family members with status 'active' or 'invited' (not removed)
  SELECT COUNT(*) INTO v_third_party_used
  FROM family_members
  WHERE primary_parent_id = v_primary_parent_id
    AND role = 'third_party'
    AND status IN ('active', 'invited');
  
  -- Also count pending third_party invitations not yet accepted/expired
  v_third_party_used := v_third_party_used + (
    SELECT COUNT(*)
    FROM invitations
    WHERE inviter_id = p_profile_id
      AND invitation_type = 'third_party'
      AND status = 'pending'
      AND expires_at > now()
  );
  
  RETURN jsonb_build_object(
    'tier', v_tier,
    'kids_used', v_kids_used,
    'kids_remaining', GREATEST(0, v_max_kids - v_kids_used),
    'max_kids', v_max_kids,
    'third_party_used', v_third_party_used,
    'third_party_remaining', GREATEST(0, v_max_third_party - v_third_party_used),
    'max_third_party', v_max_third_party,
    'can_add_kid', v_kids_used < v_max_kids,
    'can_invite_third_party', v_third_party_used < v_max_third_party
  );
END;
$$;

-- Check if user is parent or guardian (not third-party or child account)
-- Uses account_role column to identify child accounts
CREATE OR REPLACE FUNCTION public.is_parent_or_guardian(p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = p_user_id
      -- Not a child account (account_role = 'child')
      AND (p.account_role IS NULL OR p.account_role != 'child')
      -- Not a third-party member
      AND NOT EXISTS (
        SELECT 1 FROM family_members fm
        JOIN profiles prof ON prof.id = fm.profile_id
        WHERE prof.user_id = p_user_id
          AND fm.role = 'third_party'
          AND fm.status = 'active'
      )
  );
$$;


-- =============================================================================
-- B) RPC WRITE-THROUGH FUNCTIONS
-- =============================================================================

-- Enhanced child creation with limit enforcement
-- Replaces existing create_child_with_link but returns structured response
CREATE OR REPLACE FUNCTION public.rpc_add_child(
  p_name text,
  p_dob date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile record;
  v_child record;
  v_usage jsonb;
  v_tier text;
BEGIN
  -- Check authentication
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'NOT_AUTHENTICATED',
      'message', 'You must be logged in to add a child'
    );
  END IF;
  
  -- Get user's profile
  SELECT * INTO v_profile
  FROM profiles
  WHERE user_id = auth.uid();
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'NOT_AUTHENTICATED',
      'message', 'Profile not found'
    );
  END IF;
  
  -- Check if parent/guardian (not third-party or child account)
  IF NOT public.is_parent_or_guardian(auth.uid()) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'NOT_PARENT',
      'message', 'Only parents or guardians can add children'
    );
  END IF;
  
  -- Validate name
  IF p_name IS NULL OR length(trim(p_name)) < 1 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'VALIDATION_ERROR',
      'message', 'Child name is required'
    );
  END IF;
  
  IF length(trim(p_name)) > 100 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'VALIDATION_ERROR',
      'message', 'Child name must be less than 100 characters'
    );
  END IF;
  
  -- Get usage and check limits
  v_usage := public.get_plan_usage(v_profile.id);
  v_tier := v_usage->>'tier';
  
  IF NOT (v_usage->>'can_add_kid')::boolean THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'LIMIT_REACHED',
      'message', format('%s plan allows %s children. Upgrade to Power to add more.',
        initcap(v_tier),
        v_usage->>'max_kids'
      ),
      'meta', jsonb_build_object(
        'tier', v_tier,
        'current', v_usage->>'kids_used',
        'max', v_usage->>'max_kids'
      )
    );
  END IF;
  
  -- Create child record
  INSERT INTO children (name, date_of_birth)
  VALUES (trim(p_name), p_dob)
  RETURNING * INTO v_child;
  
  -- Link to current parent
  INSERT INTO parent_children (parent_id, child_id)
  VALUES (v_profile.id, v_child.id);
  
  -- Also link to co-parent if exists
  IF v_profile.co_parent_id IS NOT NULL THEN
    INSERT INTO parent_children (parent_id, child_id)
    VALUES (v_profile.co_parent_id, v_child.id);
  END IF;
  
  RETURN jsonb_build_object(
    'ok', true,
    'data', jsonb_build_object(
      'id', v_child.id,
      'name', v_child.name,
      'date_of_birth', v_child.date_of_birth,
      'created_at', v_child.created_at
    )
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'ok', false,
    'code', 'UNKNOWN_ERROR',
    'message', 'An unexpected error occurred'
  );
END;
$$;


-- Third-party invitation with limit enforcement
CREATE OR REPLACE FUNCTION public.rpc_create_third_party_invite(
  p_invitee_email text,
  p_relationship text DEFAULT NULL,
  p_child_ids uuid[] DEFAULT NULL,
  p_expires_at timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile record;
  v_usage jsonb;
  v_tier text;
  v_invitation record;
  v_primary_parent_id uuid;
  v_email text;
BEGIN
  -- Check authentication
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'NOT_AUTHENTICATED',
      'message', 'You must be logged in to invite family members'
    );
  END IF;
  
  -- Get user's profile
  SELECT * INTO v_profile
  FROM profiles
  WHERE user_id = auth.uid();
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'NOT_AUTHENTICATED',
      'message', 'Profile not found'
    );
  END IF;
  
  -- Check if parent/guardian
  IF NOT public.is_parent_or_guardian(auth.uid()) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'NOT_PARENT',
      'message', 'Only parents or guardians can invite third-party members'
    );
  END IF;
  
  -- Validate email format
  v_email := lower(trim(p_invitee_email));
  IF v_email IS NULL OR v_email = '' OR v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'VALIDATION_ERROR',
      'message', 'Please enter a valid email address'
    );
  END IF;
  
  -- Get usage and check limits
  v_usage := public.get_plan_usage(v_profile.id);
  v_tier := v_usage->>'tier';
  
  IF NOT (v_usage->>'can_invite_third_party')::boolean THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'LIMIT_REACHED',
      'message', format('%s plan allows %s third-party members. Upgrade to Power to add more.',
        initcap(v_tier),
        v_usage->>'max_third_party'
      ),
      'meta', jsonb_build_object(
        'tier', v_tier,
        'current', v_usage->>'third_party_used',
        'max', v_usage->>'max_third_party'
      )
    );
  END IF;
  
  -- Determine primary parent ID
  IF v_profile.co_parent_id IS NOT NULL THEN
    v_primary_parent_id := LEAST(v_profile.id, v_profile.co_parent_id);
  ELSE
    v_primary_parent_id := v_profile.id;
  END IF;
  
  -- Check for existing pending invitation to same email
  IF EXISTS (
    SELECT 1 FROM invitations
    WHERE inviter_id = v_profile.id
      AND invitee_email = v_email
      AND status = 'pending'
      AND expires_at > now()
  ) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'VALIDATION_ERROR',
      'message', 'An invitation has already been sent to this email address'
    );
  END IF;
  
  -- Create invitation
  INSERT INTO invitations (
    inviter_id,
    invitee_email,
    invitation_type,
    role,
    relationship,
    child_ids,
    expires_at
  )
  VALUES (
    v_profile.id,
    v_email,
    'third_party',
    'third_party',
    COALESCE(p_relationship, 'other'),
    COALESCE(p_child_ids, '{}'),
    COALESCE(p_expires_at, now() + interval '7 days')
  )
  RETURNING * INTO v_invitation;
  
  RETURN jsonb_build_object(
    'ok', true,
    'data', jsonb_build_object(
      'id', v_invitation.id,
      'token', v_invitation.token,
      'invitee_email', v_invitation.invitee_email,
      'status', v_invitation.status,
      'expires_at', v_invitation.expires_at
    )
  );
  
EXCEPTION WHEN unique_violation THEN
  RETURN jsonb_build_object(
    'ok', false,
    'code', 'VALIDATION_ERROR',
    'message', 'An invitation already exists for this email address'
  );
WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'ok', false,
    'code', 'UNKNOWN_ERROR',
    'message', 'An unexpected error occurred'
  );
END;
$$;


-- Revoke third-party access
CREATE OR REPLACE FUNCTION public.rpc_revoke_third_party(
  p_member_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile record;
  v_member record;
  v_primary_parent_id uuid;
BEGIN
  -- Check authentication
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'NOT_AUTHENTICATED',
      'message', 'You must be logged in'
    );
  END IF;
  
  -- Get user's profile
  SELECT * INTO v_profile
  FROM profiles
  WHERE user_id = auth.uid();
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'NOT_AUTHENTICATED',
      'message', 'Profile not found'
    );
  END IF;
  
  -- Check if parent/guardian
  IF NOT public.is_parent_or_guardian(auth.uid()) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'NOT_PARENT',
      'message', 'Only parents or guardians can manage third-party access'
    );
  END IF;
  
  -- Determine primary parent ID
  IF v_profile.co_parent_id IS NOT NULL THEN
    v_primary_parent_id := LEAST(v_profile.id, v_profile.co_parent_id);
  ELSE
    v_primary_parent_id := v_profile.id;
  END IF;
  
  -- Find the member
  SELECT * INTO v_member
  FROM family_members
  WHERE id = p_member_id
    AND primary_parent_id = v_primary_parent_id
    AND role = 'third_party';
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'VALIDATION_ERROR',
      'message', 'Member not found or you do not have permission to remove them'
    );
  END IF;
  
  -- Mark as removed
  UPDATE family_members
  SET status = 'removed', updated_at = now()
  WHERE id = p_member_id;
  
  RETURN jsonb_build_object(
    'ok', true,
    'data', jsonb_build_object(
      'id', p_member_id,
      'status', 'removed'
    )
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'ok', false,
    'code', 'UNKNOWN_ERROR',
    'message', 'An unexpected error occurred'
  );
END;
$$;


-- =============================================================================
-- C) RLS WRITE-THROUGH ENFORCEMENT
-- =============================================================================

-- Drop existing insert policy on children if exists and recreate to block direct inserts
DROP POLICY IF EXISTS "Children created via secure function only" ON children;

-- Block direct inserts on children table - only RPC can write
CREATE POLICY "Children created via RPC only" ON children
FOR INSERT
WITH CHECK (false);

-- Keep existing update policy for parents
-- Keep existing select policy for parents

-- Drop and recreate parent_children insert policy to block direct inserts
DROP POLICY IF EXISTS "Parents can insert child links for self or co-parent" ON parent_children;

-- Block direct inserts on parent_children - only RPC can write
CREATE POLICY "Parent children links created via RPC only" ON parent_children
FOR INSERT
WITH CHECK (false);

-- Update invitations insert policy to restrict third_party type to RPC only
-- First drop the existing policy
DROP POLICY IF EXISTS "Users can create invitations" ON invitations;

-- Allow co_parent invitations directly (backward compat), block third_party
CREATE POLICY "Users can create co_parent invitations only" ON invitations
FOR INSERT
WITH CHECK (
  inviter_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  AND invitation_type = 'co_parent'
);


-- =============================================================================
-- GRANT EXECUTE PERMISSIONS
-- =============================================================================

GRANT EXECUTE ON FUNCTION public.get_current_profile_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_plan_tier(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_plan_limits(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_plan_usage(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_parent_or_guardian(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_add_child(text, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_create_third_party_invite(text, text, uuid[], timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_revoke_third_party(uuid) TO authenticated;