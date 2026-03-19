-- Create table to track known user devices
CREATE TABLE public.user_devices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  device_fingerprint TEXT NOT NULL,
  device_name TEXT,
  browser TEXT,
  os TEXT,
  ip_address TEXT,
  location TEXT,
  first_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_trusted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_devices ENABLE ROW LEVEL SECURITY;

-- Users can view their own devices
CREATE POLICY "Users can view their own devices"
ON public.user_devices
FOR SELECT
USING (user_id = auth.uid());

-- Users can update their own devices
CREATE POLICY "Users can update their own devices"
ON public.user_devices
FOR UPDATE
USING (user_id = auth.uid());

-- Users can delete their own devices
CREATE POLICY "Users can delete their own devices"
ON public.user_devices
FOR DELETE
USING (user_id = auth.uid());

-- Allow inserts via service role only (edge function)
CREATE POLICY "Service role can insert devices"
ON public.user_devices
FOR INSERT
WITH CHECK (true);

-- Create index for faster lookups
CREATE INDEX idx_user_devices_user_id ON public.user_devices(user_id);
CREATE INDEX idx_user_devices_fingerprint ON public.user_devices(user_id, device_fingerprint);