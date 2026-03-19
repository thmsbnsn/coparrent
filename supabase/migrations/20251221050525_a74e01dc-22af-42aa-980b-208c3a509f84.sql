-- Fix 1: PUBLIC_DATA_EXPOSURE - Remove overly permissive invitation policy
-- Drop the dangerous "Anyone can view invitation by token" policy
DROP POLICY IF EXISTS "Anyone can view invitation by token" ON public.invitations;

-- Create a secure function to look up invitations by token
-- This prevents enumeration attacks while still allowing token-based lookups
CREATE OR REPLACE FUNCTION public.get_invitation_by_token(_token uuid)
RETURNS TABLE (
  id uuid,
  inviter_id uuid,
  invitee_email text,
  status text,
  expires_at timestamptz,
  created_at timestamptz,
  inviter_name text,
  inviter_email text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    i.id,
    i.inviter_id,
    i.invitee_email,
    i.status,
    i.expires_at,
    i.created_at,
    p.full_name as inviter_name,
    p.email as inviter_email
  FROM public.invitations i
  LEFT JOIN public.profiles p ON p.id = i.inviter_id
  WHERE i.token = _token
  LIMIT 1;
$$;

-- Fix 2: CLIENT_SIDE_AUTH - Create a secure function to accept invitations with email verification
CREATE OR REPLACE FUNCTION public.accept_coparent_invitation(
  _token uuid,
  _acceptor_user_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invitation record;
  v_acceptor_profile record;
  v_acceptor_email text;
BEGIN
  -- Get acceptor's email from auth.users
  SELECT email INTO v_acceptor_email
  FROM auth.users
  WHERE id = _acceptor_user_id;
  
  IF v_acceptor_email IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'User not found');
  END IF;
  
  -- Get invitation
  SELECT * INTO v_invitation
  FROM invitations
  WHERE token = _token
  AND status = 'pending';
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Invalid or already used invitation');
  END IF;
  
  -- Check if expired
  IF v_invitation.expires_at < now() THEN
    RETURN json_build_object('success', false, 'error', 'Invitation has expired');
  END IF;
  
  -- CRITICAL: Verify email matches the invitation
  IF LOWER(v_invitation.invitee_email) != LOWER(v_acceptor_email) THEN
    RETURN json_build_object('success', false, 'error', 'This invitation was sent to a different email address');
  END IF;
  
  -- Get acceptor profile
  SELECT * INTO v_acceptor_profile
  FROM profiles
  WHERE user_id = _acceptor_user_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Profile not found');
  END IF;
  
  -- Update acceptor's profile to link to inviter
  UPDATE profiles
  SET co_parent_id = v_invitation.inviter_id
  WHERE id = v_acceptor_profile.id;
  
  -- Update inviter's profile to link to acceptor
  UPDATE profiles
  SET co_parent_id = v_acceptor_profile.id
  WHERE id = v_invitation.inviter_id;
  
  -- Mark invitation as accepted
  UPDATE invitations
  SET status = 'accepted', updated_at = now()
  WHERE token = _token;
  
  RETURN json_build_object('success', true);
END;
$$;

-- Fix 3: MISSING_RLS - Add DELETE policy to parent_children table
CREATE POLICY "Parents can delete their child links"
ON public.parent_children
FOR DELETE
USING (
  parent_id IN (
    SELECT id FROM public.profiles WHERE user_id = auth.uid()
  )
);

-- Fix 4: INPUT_VALIDATION for step_parents - Add email column to track invitations properly
-- Make user_id nullable so we can store pending invitations without a user
ALTER TABLE public.step_parents ALTER COLUMN user_id DROP NOT NULL;

-- Add email and invitation tracking columns
ALTER TABLE public.step_parents 
ADD COLUMN IF NOT EXISTS invitee_email text,
ADD COLUMN IF NOT EXISTS invitation_token uuid DEFAULT gen_random_uuid(),
ADD COLUMN IF NOT EXISTS expires_at timestamptz DEFAULT (now() + interval '7 days');