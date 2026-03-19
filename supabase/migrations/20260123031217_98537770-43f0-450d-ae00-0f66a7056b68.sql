-- =============================================
-- UNIFIED CREATIONS ARCHITECTURE
-- =============================================

-- Create creation type enum
CREATE TYPE creation_type AS ENUM ('activity', 'coloring_page');

-- =============================================
-- CREATION FOLDERS TABLE
-- =============================================
CREATE TABLE public.creation_folders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.creation_folders ENABLE ROW LEVEL SECURITY;

-- Folder policies: Owner-only CRUD
CREATE POLICY "Owners can view their folders"
  ON public.creation_folders FOR SELECT
  USING (owner_user_id = auth.uid());

CREATE POLICY "Owners can create folders"
  ON public.creation_folders FOR INSERT
  WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY "Owners can update their folders"
  ON public.creation_folders FOR UPDATE
  USING (owner_user_id = auth.uid());

CREATE POLICY "Owners can delete their folders"
  ON public.creation_folders FOR DELETE
  USING (owner_user_id = auth.uid());

-- =============================================
-- CREATIONS INDEX TABLE (Single source of truth)
-- =============================================
CREATE TABLE public.creations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  owner_profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  type creation_type NOT NULL,
  title TEXT NOT NULL,
  folder_id UUID REFERENCES public.creation_folders(id) ON DELETE SET NULL,
  thumbnail_url TEXT,
  meta JSONB DEFAULT '{}'::jsonb,
  detail_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.creations ENABLE ROW LEVEL SECURITY;

-- Index for faster queries
CREATE INDEX idx_creations_owner ON public.creations(owner_user_id);
CREATE INDEX idx_creations_type ON public.creations(type);
CREATE INDEX idx_creations_folder ON public.creations(folder_id);
CREATE INDEX idx_creations_detail ON public.creations(detail_id);

-- =============================================
-- CREATION SHARES TABLE
-- =============================================
CREATE TABLE public.creation_shares (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  creation_id UUID NOT NULL REFERENCES public.creations(id) ON DELETE CASCADE,
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shared_with_profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  permission TEXT NOT NULL DEFAULT 'view' CHECK (permission IN ('view')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(creation_id, shared_with_profile_id)
);

-- Enable RLS
ALTER TABLE public.creation_shares ENABLE ROW LEVEL SECURITY;

-- Index for faster queries
CREATE INDEX idx_creation_shares_creation ON public.creation_shares(creation_id);
CREATE INDEX idx_creation_shares_shared_with ON public.creation_shares(shared_with_profile_id);

-- Share policies
CREATE POLICY "Owners can view shares of their creations"
  ON public.creation_shares FOR SELECT
  USING (owner_user_id = auth.uid());

CREATE POLICY "Shared users can view their shares"
  ON public.creation_shares FOR SELECT
  USING (shared_with_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Owners can create shares"
  ON public.creation_shares FOR INSERT
  WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY "Owners can delete shares"
  ON public.creation_shares FOR DELETE
  USING (owner_user_id = auth.uid());

-- =============================================
-- ACTIVITY DETAILS TABLE
-- =============================================
CREATE TABLE public.activity_details (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL DEFAULT 'activity',
  age_range TEXT,
  duration TEXT,
  energy_level TEXT,
  materials JSONB DEFAULT '[]'::jsonb,
  steps JSONB DEFAULT '[]'::jsonb,
  variations JSONB DEFAULT '[]'::jsonb,
  learning_goals JSONB DEFAULT '[]'::jsonb,
  safety_notes JSONB DEFAULT '[]'::jsonb,
  raw_response JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.activity_details ENABLE ROW LEVEL SECURITY;

-- Activity detail policies (owner-only, but shared users can read via creations join)
CREATE POLICY "Owners can manage their activity details"
  ON public.activity_details FOR ALL
  USING (owner_user_id = auth.uid());

CREATE POLICY "Shared users can view activity details"
  ON public.activity_details FOR SELECT
  USING (
    id IN (
      SELECT c.detail_id FROM public.creations c
      WHERE c.type = 'activity'
      AND (
        c.owner_user_id = auth.uid()
        OR c.id IN (
          SELECT cs.creation_id FROM public.creation_shares cs
          WHERE cs.shared_with_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
        )
      )
    )
  );

-- =============================================
-- COLORING PAGE DETAILS TABLE
-- =============================================
CREATE TABLE public.coloring_page_details (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prompt TEXT NOT NULL,
  difficulty TEXT NOT NULL DEFAULT 'medium',
  image_url TEXT,
  thumbnail_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.coloring_page_details ENABLE ROW LEVEL SECURITY;

-- Coloring page detail policies
CREATE POLICY "Owners can manage their coloring page details"
  ON public.coloring_page_details FOR ALL
  USING (owner_user_id = auth.uid());

CREATE POLICY "Shared users can view coloring page details"
  ON public.coloring_page_details FOR SELECT
  USING (
    id IN (
      SELECT c.detail_id FROM public.creations c
      WHERE c.type = 'coloring_page'
      AND (
        c.owner_user_id = auth.uid()
        OR c.id IN (
          SELECT cs.creation_id FROM public.creation_shares cs
          WHERE cs.shared_with_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
        )
      )
    )
  );

-- =============================================
-- CREATIONS RLS POLICIES
-- =============================================

-- SELECT: Owner OR shared with user
CREATE POLICY "Users can view owned or shared creations"
  ON public.creations FOR SELECT
  USING (
    owner_user_id = auth.uid()
    OR id IN (
      SELECT creation_id FROM public.creation_shares
      WHERE shared_with_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    )
  );

-- INSERT: Owner only
CREATE POLICY "Users can create their own creations"
  ON public.creations FOR INSERT
  WITH CHECK (owner_user_id = auth.uid());

-- UPDATE: Owner only
CREATE POLICY "Owners can update their creations"
  ON public.creations FOR UPDATE
  USING (owner_user_id = auth.uid());

-- DELETE: Owner only
CREATE POLICY "Owners can delete their creations"
  ON public.creations FOR DELETE
  USING (owner_user_id = auth.uid());

-- =============================================
-- UPDATED_AT TRIGGERS
-- =============================================
CREATE TRIGGER update_creation_folders_updated_at
  BEFORE UPDATE ON public.creation_folders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_creations_updated_at
  BEFORE UPDATE ON public.creations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_activity_details_updated_at
  BEFORE UPDATE ON public.activity_details
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_coloring_page_details_updated_at
  BEFORE UPDATE ON public.coloring_page_details
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();