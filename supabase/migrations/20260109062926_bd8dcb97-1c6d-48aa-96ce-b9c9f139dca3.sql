-- Add tags column to child_photos table
ALTER TABLE public.child_photos 
ADD COLUMN tags TEXT[] DEFAULT '{}';

-- Create index for faster tag-based queries
CREATE INDEX idx_child_photos_tags ON public.child_photos USING GIN(tags);