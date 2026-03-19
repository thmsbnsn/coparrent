-- Activity Generator tables for Kids Hub

-- Activity folders table
CREATE TABLE public.activity_folders (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  name text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Generated activities table with structured output
CREATE TABLE public.generated_activities (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  folder_id uuid REFERENCES public.activity_folders(id) ON DELETE SET NULL,
  title text NOT NULL,
  age_range text NOT NULL,
  duration_minutes integer,
  indoor_outdoor text CHECK (indoor_outdoor IN ('indoor', 'outdoor', 'both')),
  energy_level text CHECK (energy_level IN ('calm', 'moderate', 'high')),
  mess_level text CHECK (mess_level IN ('none', 'low', 'medium', 'high')),
  supervision_level text CHECK (supervision_level IN ('minimal', 'medium', 'constant')),
  materials jsonb DEFAULT '[]'::jsonb,
  steps jsonb DEFAULT '[]'::jsonb,
  variations jsonb DEFAULT '{}'::jsonb,
  learning_goals jsonb DEFAULT '[]'::jsonb,
  safety_notes text,
  thumbnail_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Activity shares table for sharing with family members
CREATE TABLE public.activity_shares (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  activity_id uuid NOT NULL REFERENCES public.generated_activities(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL,
  shared_with_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  permission text NOT NULL DEFAULT 'view' CHECK (permission IN ('view')),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Unique constraint to prevent duplicate shares
CREATE UNIQUE INDEX idx_activity_shares_unique ON public.activity_shares(activity_id, shared_with_profile_id);

-- Enable RLS on all tables
ALTER TABLE public.activity_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_shares ENABLE ROW LEVEL SECURITY;

-- RLS policies for activity_folders
CREATE POLICY "Users can view their own folders"
ON public.activity_folders FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own folders"
ON public.activity_folders FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own folders"
ON public.activity_folders FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own folders"
ON public.activity_folders FOR DELETE
USING (auth.uid() = user_id);

-- RLS policies for generated_activities
CREATE POLICY "Users can view own activities"
ON public.generated_activities FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can view shared activities"
ON public.generated_activities FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.activity_shares s
    JOIN public.profiles p ON p.id = s.shared_with_profile_id
    WHERE s.activity_id = generated_activities.id
    AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create their own activities"
ON public.generated_activities FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own activities"
ON public.generated_activities FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own activities"
ON public.generated_activities FOR DELETE
USING (auth.uid() = user_id);

-- RLS policies for activity_shares
CREATE POLICY "Owners can view their shares"
ON public.activity_shares FOR SELECT
USING (auth.uid() = owner_user_id);

CREATE POLICY "Shared users can view shares"
ON public.activity_shares FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = activity_shares.shared_with_profile_id
    AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Owners can create shares"
ON public.activity_shares FOR INSERT
WITH CHECK (auth.uid() = owner_user_id);

CREATE POLICY "Owners can delete shares"
ON public.activity_shares FOR DELETE
USING (auth.uid() = owner_user_id);

-- Triggers for updated_at
CREATE TRIGGER update_activity_folders_updated_at
BEFORE UPDATE ON public.activity_folders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_generated_activities_updated_at
BEFORE UPDATE ON public.generated_activities
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();