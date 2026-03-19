-- Create AI usage daily tracking table for rate limiting
CREATE TABLE public.ai_usage_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  usage_date date NOT NULL DEFAULT CURRENT_DATE,
  request_count integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, usage_date)
);

-- Enable RLS
ALTER TABLE public.ai_usage_daily ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own usage data
CREATE POLICY "Users can view their own AI usage"
ON public.ai_usage_daily
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own AI usage"
ON public.ai_usage_daily
FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own AI usage"
ON public.ai_usage_daily
FOR UPDATE
USING (user_id = auth.uid());

-- Service role can manage all records (for edge functions)
CREATE POLICY "Service role can manage all AI usage"
ON public.ai_usage_daily
FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');

-- Create index for efficient lookups
CREATE INDEX idx_ai_usage_daily_user_date ON public.ai_usage_daily (user_id, usage_date);

-- Trigger for updated_at
CREATE TRIGGER update_ai_usage_daily_updated_at
BEFORE UPDATE ON public.ai_usage_daily
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();