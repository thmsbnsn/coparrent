-- Fix the overly permissive INSERT policy on user_devices table
-- The current policy allows any authenticated user to insert device records
-- Service role operations bypass RLS entirely, so we can block direct client inserts

-- Drop the existing overly permissive INSERT policy
DROP POLICY IF EXISTS "Service role can insert devices" ON public.user_devices;

-- Create a restrictive policy that blocks direct client-side inserts
-- Service role will continue to work as it bypasses RLS entirely
CREATE POLICY "Block direct device inserts"
ON public.user_devices
FOR INSERT
WITH CHECK (false);

-- Note: The edge function login-notification uses service_role which bypasses RLS,
-- so device inserts will still work through the proper channel (edge functions)