-- Just recreate the function without dropping (CREATE OR REPLACE)
CREATE OR REPLACE FUNCTION public.is_family_member(_user_id UUID, _primary_parent_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    -- User is the primary parent
    SELECT 1 FROM profiles WHERE user_id = _user_id AND id = _primary_parent_id
    UNION ALL
    -- User is co-parent of primary parent
    SELECT 1 FROM profiles WHERE user_id = _user_id AND co_parent_id = _primary_parent_id
    UNION ALL
    -- User is co-parent that primary_parent_id points to
    SELECT 1 FROM profiles p1 
    JOIN profiles p2 ON p1.co_parent_id = p2.id 
    WHERE p2.user_id = _user_id AND p1.id = _primary_parent_id
    UNION ALL
    -- User is a third-party member
    SELECT 1 FROM family_members 
    WHERE user_id = _user_id 
    AND primary_parent_id = _primary_parent_id 
    AND status = 'active'
  )
$$;