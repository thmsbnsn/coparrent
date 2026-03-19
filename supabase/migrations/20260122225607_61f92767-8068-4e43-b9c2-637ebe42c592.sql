-- Add 'creations' to document categories enum if needed
-- First, create a table to store coloring page metadata
CREATE TABLE public.coloring_pages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  prompt TEXT NOT NULL,
  difficulty TEXT NOT NULL CHECK (difficulty IN ('simple', 'medium', 'detailed')),
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.coloring_pages ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only view their own coloring pages
CREATE POLICY "Users can view their own coloring pages"
  ON public.coloring_pages
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can create their own coloring pages  
CREATE POLICY "Users can create their own coloring pages"
  ON public.coloring_pages
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own coloring pages
CREATE POLICY "Users can delete their own coloring pages"
  ON public.coloring_pages
  FOR DELETE
  USING (auth.uid() = user_id);

-- Add index for faster queries
CREATE INDEX idx_coloring_pages_user_id ON public.coloring_pages(user_id);
CREATE INDEX idx_coloring_pages_created_at ON public.coloring_pages(created_at DESC);