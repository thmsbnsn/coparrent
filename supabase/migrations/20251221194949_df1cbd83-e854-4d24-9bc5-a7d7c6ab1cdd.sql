-- Fix notifications INSERT bypass vulnerability
-- Edge functions use service_role which bypasses RLS, so they will continue to work
-- This blocks direct client-side inserts while allowing service_role operations

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;

-- Create restrictive policy that blocks all direct client inserts
-- Service role (used by edge functions) bypasses RLS entirely
CREATE POLICY "Block direct notification inserts"
ON public.notifications
FOR INSERT
WITH CHECK (false);