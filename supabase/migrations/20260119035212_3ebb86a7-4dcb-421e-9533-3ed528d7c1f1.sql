-- Create message reactions table
CREATE TABLE public.message_reactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID NOT NULL REFERENCES public.thread_messages(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(message_id, profile_id, emoji)
);

-- Enable RLS
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

-- Index for faster lookups
CREATE INDEX idx_message_reactions_message_id ON public.message_reactions(message_id);
CREATE INDEX idx_message_reactions_profile_id ON public.message_reactions(profile_id);

-- RLS Policies for message_reactions
-- Users can view reactions on messages they can access (via thread access)
CREATE POLICY "Users can view reactions on accessible messages"
  ON public.message_reactions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.thread_messages tm
      JOIN public.message_threads mt ON tm.thread_id = mt.id
      WHERE tm.id = message_reactions.message_id
      AND (
        mt.thread_type = 'family_channel'
        OR mt.participant_a_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
        OR mt.participant_b_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
        OR EXISTS (
          SELECT 1 FROM public.group_chat_participants gcp
          WHERE gcp.thread_id = mt.id
          AND gcp.profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
        )
      )
    )
  );

-- Users can add reactions to messages they can access
CREATE POLICY "Users can add reactions to accessible messages"
  ON public.message_reactions
  FOR INSERT
  WITH CHECK (
    profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.thread_messages tm
      JOIN public.message_threads mt ON tm.thread_id = mt.id
      WHERE tm.id = message_reactions.message_id
      AND (
        mt.thread_type = 'family_channel'
        OR mt.participant_a_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
        OR mt.participant_b_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
        OR EXISTS (
          SELECT 1 FROM public.group_chat_participants gcp
          WHERE gcp.thread_id = mt.id
          AND gcp.profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
        )
      )
    )
  );

-- Users can delete their own reactions
CREATE POLICY "Users can delete their own reactions"
  ON public.message_reactions
  FOR DELETE
  USING (profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

-- Enable realtime for reactions
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;