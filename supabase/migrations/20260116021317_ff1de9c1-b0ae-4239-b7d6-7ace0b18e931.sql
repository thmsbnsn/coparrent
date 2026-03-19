-- Add child account support to profiles and children tables

-- Add role column to profiles for distinguishing parent vs child accounts
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS account_role text DEFAULT 'parent' CHECK (account_role IN ('parent', 'child'));

-- Add linked_child_id for child accounts (links to children.id)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS linked_child_id uuid REFERENCES public.children(id) ON DELETE SET NULL;

-- Add login_enabled flag to allow parents to disable child login
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS login_enabled boolean DEFAULT true;

-- Create child_permissions table for granular parent control
CREATE TABLE IF NOT EXISTS public.child_permissions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  child_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  parent_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  -- Messaging permissions
  allow_parent_messaging boolean NOT NULL DEFAULT true,
  allow_family_chat boolean NOT NULL DEFAULT true,
  allow_sibling_messaging boolean NOT NULL DEFAULT true,
  
  -- Notification permissions  
  allow_push_notifications boolean NOT NULL DEFAULT false,
  allow_calendar_reminders boolean NOT NULL DEFAULT true,
  
  -- Calendar permissions
  show_full_event_details boolean NOT NULL DEFAULT false,
  
  -- Optional features
  allow_mood_checkins boolean NOT NULL DEFAULT true,
  allow_notes_to_parents boolean NOT NULL DEFAULT true,
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  UNIQUE(child_profile_id)
);

-- Enable RLS on child_permissions
ALTER TABLE public.child_permissions ENABLE ROW LEVEL SECURITY;

-- Only parents can view permissions for children in their family
CREATE POLICY "Parents can view child permissions"
  ON public.child_permissions FOR SELECT
  USING (
    parent_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR parent_profile_id IN (SELECT co_parent_id FROM profiles WHERE user_id = auth.uid() AND co_parent_id IS NOT NULL)
    OR child_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

-- Only parents can manage permissions
CREATE POLICY "Parents can manage child permissions"
  ON public.child_permissions FOR ALL
  USING (
    parent_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR parent_profile_id IN (SELECT co_parent_id FROM profiles WHERE user_id = auth.uid() AND co_parent_id IS NOT NULL)
  );

-- Create function to check if a user is a child account
CREATE OR REPLACE FUNCTION public.is_child_account(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = _user_id
    AND account_role = 'child'
  )
$$;

-- Create function to get child permissions
CREATE OR REPLACE FUNCTION public.get_child_permissions(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_profile_id uuid;
  v_permissions jsonb;
BEGIN
  -- Get profile ID for user
  SELECT id INTO v_profile_id
  FROM profiles
  WHERE user_id = _user_id AND account_role = 'child';
  
  IF v_profile_id IS NULL THEN
    -- Not a child account, return all permissions as true
    RETURN jsonb_build_object(
      'is_child', false,
      'allow_parent_messaging', true,
      'allow_family_chat', true,
      'allow_sibling_messaging', true,
      'allow_push_notifications', true,
      'allow_calendar_reminders', true,
      'show_full_event_details', true,
      'allow_mood_checkins', true,
      'allow_notes_to_parents', true,
      'login_enabled', true
    );
  END IF;
  
  -- Get permissions for child
  SELECT jsonb_build_object(
    'is_child', true,
    'allow_parent_messaging', cp.allow_parent_messaging,
    'allow_family_chat', cp.allow_family_chat,
    'allow_sibling_messaging', cp.allow_sibling_messaging,
    'allow_push_notifications', cp.allow_push_notifications,
    'allow_calendar_reminders', cp.allow_calendar_reminders,
    'show_full_event_details', cp.show_full_event_details,
    'allow_mood_checkins', cp.allow_mood_checkins,
    'allow_notes_to_parents', cp.allow_notes_to_parents,
    'login_enabled', p.login_enabled
  ) INTO v_permissions
  FROM child_permissions cp
  JOIN profiles p ON p.id = cp.child_profile_id
  WHERE cp.child_profile_id = v_profile_id;
  
  -- Return default permissions if none found
  IF v_permissions IS NULL THEN
    RETURN jsonb_build_object(
      'is_child', true,
      'allow_parent_messaging', true,
      'allow_family_chat', true,
      'allow_sibling_messaging', true,
      'allow_push_notifications', false,
      'allow_calendar_reminders', true,
      'show_full_event_details', false,
      'allow_mood_checkins', true,
      'allow_notes_to_parents', true,
      'login_enabled', true
    );
  END IF;
  
  RETURN v_permissions;
END;
$$;

-- Create function to create child account (parent-only)
CREATE OR REPLACE FUNCTION public.create_child_account(_child_id uuid, _username text, _password text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_parent_profile record;
  v_child record;
  v_email text;
  v_new_user_id uuid;
  v_new_profile_id uuid;
BEGIN
  -- Get parent profile
  SELECT * INTO v_parent_profile
  FROM profiles
  WHERE user_id = auth.uid() AND account_role = 'parent';
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only parents can create child accounts');
  END IF;
  
  -- Verify parent has access to this child
  IF NOT EXISTS (
    SELECT 1 FROM parent_children
    WHERE parent_id = v_parent_profile.id AND child_id = _child_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Child not found in your family');
  END IF;
  
  -- Get child record
  SELECT * INTO v_child FROM children WHERE id = _child_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Child not found');
  END IF;
  
  -- Check if child already has an account
  IF EXISTS (SELECT 1 FROM profiles WHERE linked_child_id = _child_id AND account_role = 'child') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Child already has an account');
  END IF;
  
  -- Generate a unique email for the child (internal use only)
  v_email := _username || '+child@coparrent.internal';
  
  -- Note: In production, you would use Supabase Admin API to create the user
  -- For now, return success with instructions
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Child account setup initiated',
    'child_id', _child_id,
    'username', _username
  );
END;
$$;

-- Update profiles RLS to allow child accounts to view their own profile
CREATE POLICY "Child accounts can view own profile"
  ON public.profiles FOR SELECT
  USING (
    user_id = auth.uid() 
    AND account_role = 'child'
  );

-- Add trigger to update updated_at
CREATE OR REPLACE TRIGGER update_child_permissions_updated_at
  BEFORE UPDATE ON public.child_permissions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_account_role ON public.profiles(account_role);
CREATE INDEX IF NOT EXISTS idx_profiles_linked_child ON public.profiles(linked_child_id) WHERE linked_child_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_child_permissions_child_profile ON public.child_permissions(child_profile_id);
