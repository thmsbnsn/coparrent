-- ============================================
-- Youth Sports Hub Tables
-- ============================================

-- Sports/Activities table
CREATE TABLE public.child_activities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  child_id UUID NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  primary_parent_id UUID NOT NULL REFERENCES public.profiles(id),
  name TEXT NOT NULL,
  sport_type TEXT NOT NULL, -- soccer, basketball, baseball, swimming, dance, gymnastics, etc.
  team_name TEXT,
  coach_name TEXT,
  coach_phone TEXT,
  coach_email TEXT,
  season_start DATE,
  season_end DATE,
  notes TEXT,
  equipment_checklist JSONB DEFAULT '[]',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Events table (games, practices, tournaments)
CREATE TABLE public.activity_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  activity_id UUID NOT NULL REFERENCES public.child_activities(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- game, practice, tournament, meeting, other
  title TEXT NOT NULL,
  event_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME,
  location_name TEXT,
  location_address TEXT,
  venue_notes TEXT, -- parking info, field number, entrance tips
  dropoff_parent_id UUID REFERENCES public.profiles(id),
  pickup_parent_id UUID REFERENCES public.profiles(id),
  equipment_needed JSONB DEFAULT '[]',
  notes TEXT,
  is_cancelled BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- User map preferences table
CREATE TABLE public.user_map_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  preferred_map_provider TEXT NOT NULL DEFAULT 'system', -- google, apple, waze, system
  remember_choice BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Activity audit logs for future reporting
CREATE TABLE public.activity_audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  activity_id UUID REFERENCES public.child_activities(id) ON DELETE SET NULL,
  event_id UUID REFERENCES public.activity_events(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  action TEXT NOT NULL, -- created, updated, deleted, viewed
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.child_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_map_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for child_activities
CREATE POLICY "Parents can view their children's activities"
ON public.child_activities
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.parent_children pc
    JOIN public.profiles p ON pc.parent_id = p.id
    WHERE pc.child_id = child_activities.child_id
    AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Parents can create activities for their children"
ON public.child_activities
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.parent_children pc
    JOIN public.profiles p ON pc.parent_id = p.id
    WHERE pc.child_id = child_activities.child_id
    AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Parents can update their children's activities"
ON public.child_activities
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.parent_children pc
    JOIN public.profiles p ON pc.parent_id = p.id
    WHERE pc.child_id = child_activities.child_id
    AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Parents can delete their children's activities"
ON public.child_activities
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.parent_children pc
    JOIN public.profiles p ON pc.parent_id = p.id
    WHERE pc.child_id = child_activities.child_id
    AND p.user_id = auth.uid()
  )
);

-- RLS Policies for activity_events
CREATE POLICY "Parents can view activity events"
ON public.activity_events
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.child_activities ca
    JOIN public.parent_children pc ON pc.child_id = ca.child_id
    JOIN public.profiles p ON pc.parent_id = p.id
    WHERE ca.id = activity_events.activity_id
    AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Parents can create activity events"
ON public.activity_events
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.child_activities ca
    JOIN public.parent_children pc ON pc.child_id = ca.child_id
    JOIN public.profiles p ON pc.parent_id = p.id
    WHERE ca.id = activity_events.activity_id
    AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Parents can update activity events"
ON public.activity_events
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.child_activities ca
    JOIN public.parent_children pc ON pc.child_id = ca.child_id
    JOIN public.profiles p ON pc.parent_id = p.id
    WHERE ca.id = activity_events.activity_id
    AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Parents can delete activity events"
ON public.activity_events
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.child_activities ca
    JOIN public.parent_children pc ON pc.child_id = ca.child_id
    JOIN public.profiles p ON pc.parent_id = p.id
    WHERE ca.id = activity_events.activity_id
    AND p.user_id = auth.uid()
  )
);

-- RLS for user_map_preferences
CREATE POLICY "Users can view their own map preferences"
ON public.user_map_preferences
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own map preferences"
ON public.user_map_preferences
FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own map preferences"
ON public.user_map_preferences
FOR UPDATE
USING (user_id = auth.uid());

-- RLS for audit logs (read-only for parents)
CREATE POLICY "Parents can view their activity audit logs"
ON public.activity_audit_logs
FOR SELECT
USING (
  user_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.child_activities ca
    JOIN public.parent_children pc ON pc.child_id = ca.child_id
    JOIN public.profiles p ON pc.parent_id = p.id
    WHERE ca.id = activity_audit_logs.activity_id
    AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create audit logs"
ON public.activity_audit_logs
FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Add triggers for updated_at
CREATE TRIGGER update_child_activities_updated_at
BEFORE UPDATE ON public.child_activities
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_activity_events_updated_at
BEFORE UPDATE ON public.activity_events
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_map_preferences_updated_at
BEFORE UPDATE ON public.user_map_preferences
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for activity events
ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_events;