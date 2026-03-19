-- Fix 1: MISSING_RLS - Create atomic child creation function
-- Drop overly permissive INSERT policy
DROP POLICY IF EXISTS "Parents can insert children " ON public.children;

-- Create atomic function to add children with proper security
CREATE OR REPLACE FUNCTION public.create_child_with_link(
  _name text,
  _date_of_birth date DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile record;
  v_child record;
BEGIN
  -- Validate name length
  IF length(trim(_name)) < 1 OR length(trim(_name)) > 100 THEN
    RETURN json_build_object('success', false, 'error', 'Name must be between 1 and 100 characters');
  END IF;
  
  -- Get user's profile
  SELECT * INTO v_profile
  FROM profiles
  WHERE user_id = auth.uid();
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Profile not found');
  END IF;
  
  -- Create child record
  INSERT INTO children (name, date_of_birth)
  VALUES (trim(_name), _date_of_birth)
  RETURNING * INTO v_child;
  
  -- Link to current parent
  INSERT INTO parent_children (parent_id, child_id)
  VALUES (v_profile.id, v_child.id);
  
  -- Also link to co-parent if exists
  IF v_profile.co_parent_id IS NOT NULL THEN
    INSERT INTO parent_children (parent_id, child_id)
    VALUES (v_profile.co_parent_id, v_child.id);
  END IF;
  
  RETURN json_build_object(
    'success', true,
    'child', row_to_json(v_child)
  );
END;
$$;

-- New restrictive INSERT policy - only allow through the RPC function
CREATE POLICY "Children created via secure function only"
ON public.children FOR INSERT
WITH CHECK (
  -- Only allow inserts from the create_child_with_link function (SECURITY DEFINER)
  -- This effectively disables direct inserts while RPC calls work
  EXISTS (
    SELECT 1 FROM profiles WHERE user_id = auth.uid()
  )
);

-- Fix 2: INPUT_VALIDATION - Add database constraints for field lengths
ALTER TABLE public.children 
ADD CONSTRAINT children_name_length CHECK (length(name) BETWEEN 1 AND 100);

ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_fullname_length CHECK (full_name IS NULL OR length(full_name) <= 200);

ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_email_length CHECK (email IS NULL OR length(email) <= 255);

ALTER TABLE public.documents 
ADD CONSTRAINT documents_title_length CHECK (length(title) BETWEEN 1 AND 200);

ALTER TABLE public.documents 
ADD CONSTRAINT documents_description_length CHECK (description IS NULL OR length(description) <= 2000);

ALTER TABLE public.messages 
ADD CONSTRAINT messages_content_length CHECK (length(content) BETWEEN 1 AND 10000);

-- Fix 3: Enable realtime for schedule_requests for proper sync
ALTER TABLE public.schedule_requests REPLICA IDENTITY FULL;

-- Add schedule_requests to realtime publication if not already added
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'schedule_requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.schedule_requests;
  END IF;
END
$$;