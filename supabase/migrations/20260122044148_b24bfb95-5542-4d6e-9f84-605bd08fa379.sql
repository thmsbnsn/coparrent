-- Create child_mood_logs table for mood check-ins
CREATE TABLE public.child_mood_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  child_profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  linked_child_id UUID REFERENCES public.children(id) ON DELETE SET NULL,
  mood TEXT NOT NULL,
  emoji TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.child_mood_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Child can insert their own mood logs
CREATE POLICY "Children can insert own mood logs"
ON public.child_mood_logs
FOR INSERT
WITH CHECK (
  child_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
);

-- Policy: Child can view their own mood logs
CREATE POLICY "Children can view own mood logs"
ON public.child_mood_logs
FOR SELECT
USING (
  child_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
);

-- Policy: Parents can view mood logs of their linked children
CREATE POLICY "Parents can view linked child mood logs"
ON public.child_mood_logs
FOR SELECT
USING (
  linked_child_id IN (
    SELECT pc.child_id FROM parent_children pc
    JOIN profiles p ON p.id = pc.parent_id
    WHERE p.user_id = auth.uid()
  )
);

-- Add index for faster lookups
CREATE INDEX idx_child_mood_logs_profile ON public.child_mood_logs(child_profile_id);
CREATE INDEX idx_child_mood_logs_child ON public.child_mood_logs(linked_child_id);
CREATE INDEX idx_child_mood_logs_created ON public.child_mood_logs(created_at DESC);