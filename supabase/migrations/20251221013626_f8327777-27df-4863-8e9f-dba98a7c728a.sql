-- Enable realtime for children table
ALTER PUBLICATION supabase_realtime ADD TABLE public.children;

-- Enable realtime for custody_schedules table  
ALTER PUBLICATION supabase_realtime ADD TABLE public.custody_schedules;

-- Enable realtime for parent_children table (for linking)
ALTER PUBLICATION supabase_realtime ADD TABLE public.parent_children;

-- Add notification_preferences column to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS notification_preferences jsonb DEFAULT '{
  "enabled": true,
  "schedule_changes": true,
  "new_messages": true,
  "upcoming_exchanges": true,
  "document_uploads": true,
  "child_info_updates": true
}'::jsonb;