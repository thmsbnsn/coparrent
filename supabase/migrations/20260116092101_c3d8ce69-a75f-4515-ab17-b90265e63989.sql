-- Drop the old function signature first, then recreate with new return type
DROP FUNCTION IF EXISTS public.get_invitation_by_token(uuid);

-- Recreate get_invitation_by_token with new fields
CREATE OR REPLACE FUNCTION public.get_invitation_by_token(_token uuid)
RETURNS TABLE (
  id uuid,
  inviter_id uuid,
  invitee_email text,
  status text,
  expires_at timestamptz,
  created_at timestamptz,
  inviter_name text,
  inviter_email text,
  invitation_type text,
  role text,
  relationship text,
  child_ids uuid[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    i.id,
    i.inviter_id,
    i.invitee_email,
    i.status,
    i.expires_at,
    i.created_at,
    p.full_name as inviter_name,
    p.email as inviter_email,
    i.invitation_type,
    i.role::text,
    i.relationship,
    i.child_ids
  FROM invitations i
  JOIN profiles p ON i.inviter_id = p.id
  WHERE i.token = _token;
END;
$$;