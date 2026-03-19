-- Add preferences column to profiles table for user settings
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS preferences jsonb DEFAULT '{"theme": "system"}'::jsonb;

-- Create an index for better query performance
CREATE INDEX IF NOT EXISTS idx_profiles_preferences ON public.profiles USING gin(preferences);