-- Create table for recovery codes (encrypted storage)
CREATE TABLE public.user_recovery_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL, -- SHA-256 hash of the recovery code
  used_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '1 year')
);

-- Enable RLS
ALTER TABLE public.user_recovery_codes ENABLE ROW LEVEL SECURITY;

-- Only the user can view their own recovery codes (but not the hashes)
CREATE POLICY "Users can view their own recovery code metadata"
ON public.user_recovery_codes
FOR SELECT
USING (user_id = auth.uid());

-- Only service role can insert/update (done via edge function)
CREATE POLICY "Service role can manage recovery codes"
ON public.user_recovery_codes
FOR ALL
USING ((auth.jwt() ->> 'role'::text) = 'service_role'::text);

-- Index for quick lookup
CREATE INDEX idx_recovery_codes_user_id ON public.user_recovery_codes(user_id);
CREATE INDEX idx_recovery_codes_unused ON public.user_recovery_codes(user_id) WHERE used_at IS NULL;

-- Create table for 2FA settings persistence
CREATE TABLE public.user_2fa_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  enabled_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  last_verified_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  recovery_codes_generated_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  recovery_codes_remaining INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_2fa_settings ENABLE ROW LEVEL SECURITY;

-- Users can view their own 2FA settings
CREATE POLICY "Users can view their own 2FA settings"
ON public.user_2fa_settings
FOR SELECT
USING (user_id = auth.uid());

-- Users can insert their own 2FA settings
CREATE POLICY "Users can insert their own 2FA settings"
ON public.user_2fa_settings
FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Users can update their own 2FA settings
CREATE POLICY "Users can update their own 2FA settings"
ON public.user_2fa_settings
FOR UPDATE
USING (user_id = auth.uid());

-- Service role can manage all 2FA settings
CREATE POLICY "Service role can manage 2FA settings"
ON public.user_2fa_settings
FOR ALL
USING ((auth.jwt() ->> 'role'::text) = 'service_role'::text);

-- Index for quick lookup
CREATE INDEX idx_2fa_settings_user_id ON public.user_2fa_settings(user_id);

-- Trigger to update updated_at
CREATE TRIGGER update_2fa_settings_updated_at
BEFORE UPDATE ON public.user_2fa_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();