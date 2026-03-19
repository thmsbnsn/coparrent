-- Drop the problematic policy that causes infinite recursion
DROP POLICY IF EXISTS "Users can view their co-parent profile" ON public.profiles;

-- Create a fixed policy using a security definer function to avoid recursion
CREATE OR REPLACE FUNCTION public.get_user_co_parent_id(user_uuid uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT co_parent_id FROM public.profiles WHERE user_id = user_uuid LIMIT 1;
$$;

-- Create new policy that uses the function instead of subquery
CREATE POLICY "Users can view their co-parent profile" 
ON public.profiles 
FOR SELECT 
USING (
  id = public.get_user_co_parent_id(auth.uid())
);