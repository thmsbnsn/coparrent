-- Create group chat participants table
CREATE TABLE public.group_chat_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  thread_id UUID NOT NULL REFERENCES public.message_threads(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(thread_id, profile_id)
);

-- Enable RLS
ALTER TABLE public.group_chat_participants ENABLE ROW LEVEL SECURITY;

-- RLS policies for group chat participants
CREATE POLICY "Family members can view group participants"
ON public.group_chat_participants
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM message_threads t
    WHERE t.id = thread_id
    AND is_family_member(auth.uid(), t.primary_parent_id)
  )
);

CREATE POLICY "Family members can add group participants"
ON public.group_chat_participants
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM message_threads t
    WHERE t.id = thread_id
    AND is_family_member(auth.uid(), t.primary_parent_id)
  )
);

-- Create message read receipts table
CREATE TABLE public.message_read_receipts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID NOT NULL REFERENCES public.thread_messages(id) ON DELETE CASCADE,
  reader_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  read_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(message_id, reader_id)
);

-- Enable RLS
ALTER TABLE public.message_read_receipts ENABLE ROW LEVEL SECURITY;

-- RLS policies for read receipts
CREATE POLICY "Users can view read receipts for accessible messages"
ON public.message_read_receipts
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM thread_messages m
    JOIN message_threads t ON t.id = m.thread_id
    WHERE m.id = message_id
    AND can_access_thread(auth.uid(), t.id)
  )
);

CREATE POLICY "Users can create read receipts"
ON public.message_read_receipts
FOR INSERT
WITH CHECK (
  reader_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  AND EXISTS (
    SELECT 1 FROM thread_messages m
    JOIN message_threads t ON t.id = m.thread_id
    WHERE m.id = message_id
    AND can_access_thread(auth.uid(), t.id)
  )
);

-- Update can_access_thread function to include group chats
CREATE OR REPLACE FUNCTION public.can_access_thread(_user_id uuid, _thread_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
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
      OR
      -- Group chat: only participants can access
      (t.thread_type = 'group_chat' AND EXISTS (
        SELECT 1 FROM group_chat_participants gcp
        WHERE gcp.thread_id = _thread_id
        AND gcp.profile_id IN (SELECT id FROM profiles WHERE user_id = _user_id)
      ))
    )
  )
$$;

-- Enable realtime for read receipts
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_read_receipts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_chat_participants;