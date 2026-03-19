-- Exchange check-ins table for arrival confirmations
CREATE TABLE public.exchange_checkins (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  schedule_id UUID REFERENCES public.custody_schedules(id) ON DELETE CASCADE,
  checked_in_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  exchange_date DATE NOT NULL,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Private journal entries table
CREATE TABLE public.journal_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT,
  content TEXT NOT NULL,
  mood TEXT CHECK (mood IN ('calm', 'happy', 'neutral', 'frustrated', 'anxious')),
  child_id UUID REFERENCES public.children(id) ON DELETE SET NULL,
  tags TEXT[] DEFAULT '{}',
  exchange_checkin_id UUID REFERENCES public.exchange_checkins(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.exchange_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;

-- STRICT RLS for exchange_checkins - only user can see their own
CREATE POLICY "Users can view their own check-ins"
ON public.exchange_checkins FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can create their own check-ins"
ON public.exchange_checkins FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own check-ins"
ON public.exchange_checkins FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own check-ins"
ON public.exchange_checkins FOR DELETE
USING (user_id = auth.uid());

-- STRICT RLS for journal_entries - COMPLETELY PRIVATE to user only
CREATE POLICY "Users can view their own journal entries"
ON public.journal_entries FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can create their own journal entries"
ON public.journal_entries FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own journal entries"
ON public.journal_entries FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own journal entries"
ON public.journal_entries FOR DELETE
USING (user_id = auth.uid());

-- Trigger for updated_at on journal entries
CREATE TRIGGER update_journal_entries_updated_at
BEFORE UPDATE ON public.journal_entries
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();