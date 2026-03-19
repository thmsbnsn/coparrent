-- Create member_role enum
CREATE TYPE public.member_role AS ENUM ('parent', 'guardian', 'third_party');

-- Create family_members table (replaces step_parents concept)
-- Family group is derived from co_parent_id relationship
CREATE TABLE public.family_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- Family group is defined by the parent pair (derived from co_parent_id)
  primary_parent_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role member_role NOT NULL DEFAULT 'third_party',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'invited', 'removed')),
  invited_by UUID REFERENCES public.profiles(id),
  invited_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  accepted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, primary_parent_id)
);

-- Enable RLS
ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;

-- Create thread_type enum
CREATE TYPE public.thread_type AS ENUM ('family_channel', 'direct_message');

-- Create message_threads table
CREATE TABLE public.message_threads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  -- For family channel: primary_parent_id defines the family group
  primary_parent_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  thread_type thread_type NOT NULL,
  -- For DMs: store both participant IDs (null for family channel)
  participant_a_id UUID REFERENCES public.profiles(id),
  participant_b_id UUID REFERENCES public.profiles(id),
  name TEXT, -- Optional name for the thread
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  -- Ensure unique DM threads per pair per family
  CONSTRAINT unique_dm_thread UNIQUE NULLS NOT DISTINCT (primary_parent_id, thread_type, participant_a_id, participant_b_id)
);

-- Enable RLS
ALTER TABLE public.message_threads ENABLE ROW LEVEL SECURITY;

-- Create thread_messages table (immutable, no delete)
CREATE TABLE public.thread_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  thread_id UUID NOT NULL REFERENCES public.message_threads(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id),
  sender_role member_role NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
  -- No updated_at - messages are immutable for court-friendliness
);

-- Enable RLS
ALTER TABLE public.thread_messages ENABLE ROW LEVEL SECURITY;

-- Update invitations table to support third-party invites
ALTER TABLE public.invitations 
ADD COLUMN invitation_type TEXT NOT NULL DEFAULT 'co_parent' CHECK (invitation_type IN ('co_parent', 'third_party')),
ADD COLUMN role member_role DEFAULT 'third_party';

-- Function to check if user is member of a family group
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
    UNION
    -- User is co-parent of primary parent
    SELECT 1 FROM profiles WHERE user_id = _user_id AND co_parent_id = _primary_parent_id
    UNION
    -- User is co-parent that primary_parent_id points to
    SELECT 1 FROM profiles p1 
    JOIN profiles p2 ON p1.co_parent_id = p2.id 
    WHERE p2.user_id = _user_id AND p1.id = _primary_parent_id
    UNION
    -- User is a third-party member
    SELECT 1 FROM family_members 
    WHERE user_id = _user_id 
    AND primary_parent_id = _primary_parent_id 
    AND status = 'active'
  )
$$;

-- Function to get user's primary parent ID (for their family group)
CREATE OR REPLACE FUNCTION public.get_user_family_primary_parent(_user_id UUID)
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    -- If user is a parent: return their profile id or co_parent_id (whichever is "primary")
    (SELECT LEAST(p.id, COALESCE(p.co_parent_id, p.id)) FROM profiles p WHERE p.user_id = _user_id),
    -- If user is third-party: return their linked primary_parent_id
    (SELECT fm.primary_parent_id FROM family_members fm WHERE fm.user_id = _user_id AND fm.status = 'active' LIMIT 1)
  )
$$;

-- Function to check if user can access thread
CREATE OR REPLACE FUNCTION public.can_access_thread(_user_id UUID, _thread_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM message_threads t
    WHERE t.id = _thread_id
    AND is_family_member(_user_id, t.primary_parent_id)
    AND (
      -- Family channel: all family members can access
      t.thread_type = 'family_channel'
      OR
      -- DM: only participants can access
      (t.thread_type = 'direct_message' AND (
        t.participant_a_id IN (SELECT id FROM profiles WHERE user_id = _user_id)
        OR t.participant_b_id IN (SELECT id FROM profiles WHERE user_id = _user_id)
      ))
    )
  )
$$;

-- Function to get user's role in family
CREATE OR REPLACE FUNCTION public.get_user_family_role(_user_id UUID)
RETURNS member_role
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE 
    WHEN EXISTS (SELECT 1 FROM profiles WHERE user_id = _user_id AND co_parent_id IS NOT NULL) THEN 'parent'::member_role
    WHEN EXISTS (SELECT 1 FROM profiles WHERE user_id = _user_id) THEN 'parent'::member_role
    WHEN EXISTS (SELECT 1 FROM family_members WHERE user_id = _user_id AND status = 'active') THEN 
      (SELECT role FROM family_members WHERE user_id = _user_id AND status = 'active' LIMIT 1)
    ELSE NULL
  END
$$;

-- Function to count third-party members for a family
CREATE OR REPLACE FUNCTION public.count_third_party_members(_primary_parent_id UUID)
RETURNS INTEGER
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::INTEGER FROM family_members 
  WHERE primary_parent_id = _primary_parent_id 
  AND role = 'third_party' 
  AND status IN ('active', 'invited')
$$;

-- RLS Policies for family_members
CREATE POLICY "Parents can view their family members"
ON public.family_members FOR SELECT
USING (
  primary_parent_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  OR primary_parent_id IN (SELECT co_parent_id FROM profiles WHERE user_id = auth.uid() AND co_parent_id IS NOT NULL)
  OR user_id = auth.uid()
);

CREATE POLICY "Parents can invite family members"
ON public.family_members FOR INSERT
WITH CHECK (
  invited_by IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  AND role = 'third_party'
);

CREATE POLICY "Parents can update family member status"
ON public.family_members FOR UPDATE
USING (
  primary_parent_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  OR primary_parent_id IN (SELECT co_parent_id FROM profiles WHERE user_id = auth.uid() AND co_parent_id IS NOT NULL)
);

CREATE POLICY "Parents can remove family members"
ON public.family_members FOR DELETE
USING (
  primary_parent_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  OR primary_parent_id IN (SELECT co_parent_id FROM profiles WHERE user_id = auth.uid() AND co_parent_id IS NOT NULL)
);

-- RLS Policies for message_threads
CREATE POLICY "Family members can view their threads"
ON public.message_threads FOR SELECT
USING (can_access_thread(auth.uid(), id));

CREATE POLICY "Family members can create threads"
ON public.message_threads FOR INSERT
WITH CHECK (is_family_member(auth.uid(), primary_parent_id));

-- RLS Policies for thread_messages (no UPDATE or DELETE - immutable)
CREATE POLICY "Family members can view thread messages"
ON public.thread_messages FOR SELECT
USING (can_access_thread(auth.uid(), thread_id));

CREATE POLICY "Family members can send messages"
ON public.thread_messages FOR INSERT
WITH CHECK (
  can_access_thread(auth.uid(), thread_id)
  AND sender_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
);

-- Enable realtime for messaging
ALTER PUBLICATION supabase_realtime ADD TABLE public.thread_messages;

-- Create trigger to update updated_at
CREATE TRIGGER update_family_members_updated_at
BEFORE UPDATE ON public.family_members
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_message_threads_updated_at
BEFORE UPDATE ON public.message_threads
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();