-- Create table for Nurse Nancy chat threads
CREATE TABLE public.nurse_nancy_threads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  profile_id UUID NOT NULL,
  title TEXT DEFAULT 'Health Chat',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for Nurse Nancy chat messages
CREATE TABLE public.nurse_nancy_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  thread_id UUID NOT NULL REFERENCES public.nurse_nancy_threads(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX idx_nurse_nancy_threads_user_id ON public.nurse_nancy_threads(user_id);
CREATE INDEX idx_nurse_nancy_messages_thread_id ON public.nurse_nancy_messages(thread_id);

-- Enable Row Level Security
ALTER TABLE public.nurse_nancy_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nurse_nancy_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for threads: users can only access their own threads
CREATE POLICY "Users can view their own Nurse Nancy threads"
ON public.nurse_nancy_threads
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can create their own Nurse Nancy threads"
ON public.nurse_nancy_threads
FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own Nurse Nancy threads"
ON public.nurse_nancy_threads
FOR DELETE
USING (user_id = auth.uid());

-- RLS Policies for messages: users can only access messages from their threads
CREATE POLICY "Users can view messages from their threads"
ON public.nurse_nancy_messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.nurse_nancy_threads t
    WHERE t.id = nurse_nancy_messages.thread_id
    AND t.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert messages into their threads"
ON public.nurse_nancy_messages
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.nurse_nancy_threads t
    WHERE t.id = nurse_nancy_messages.thread_id
    AND t.user_id = auth.uid()
  )
);

-- Add update trigger for threads
CREATE TRIGGER update_nurse_nancy_threads_updated_at
BEFORE UPDATE ON public.nurse_nancy_threads
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();