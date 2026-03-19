-- Create child_photos table for storing photo metadata
CREATE TABLE public.child_photos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  child_id UUID NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES public.profiles(id),
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  caption TEXT,
  taken_at DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.child_photos ENABLE ROW LEVEL SECURITY;

-- Create index for faster lookups
CREATE INDEX idx_child_photos_child_id ON public.child_photos(child_id);

-- RLS Policy: Users can view photos of children they're linked to
CREATE POLICY "Users can view photos of their children"
ON public.child_photos
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.parent_children pc
    JOIN public.profiles p ON p.id = pc.parent_id
    WHERE pc.child_id = child_photos.child_id
    AND p.user_id = auth.uid()
  )
);

-- RLS Policy: Users can insert photos for children they're linked to
CREATE POLICY "Users can upload photos for their children"
ON public.child_photos
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.parent_children pc
    JOIN public.profiles p ON p.id = pc.parent_id
    WHERE pc.child_id = child_photos.child_id
    AND p.user_id = auth.uid()
  )
  AND uploaded_by IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
);

-- RLS Policy: Users can update their own photos
CREATE POLICY "Users can update their own photos"
ON public.child_photos
FOR UPDATE
USING (uploaded_by IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

-- RLS Policy: Users can delete their own photos
CREATE POLICY "Users can delete their own photos"
ON public.child_photos
FOR DELETE
USING (uploaded_by IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

-- Create trigger for updated_at
CREATE TRIGGER update_child_photos_updated_at
BEFORE UPDATE ON public.child_photos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for child photos (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('child-photos', 'child-photos', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for child-photos bucket
CREATE POLICY "Users can view photos of their children"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'child-photos'
  AND EXISTS (
    SELECT 1 FROM public.parent_children pc
    JOIN public.profiles p ON p.id = pc.parent_id
    WHERE pc.child_id::text = (storage.foldername(name))[1]
    AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Users can upload photos for their children"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'child-photos'
  AND EXISTS (
    SELECT 1 FROM public.parent_children pc
    JOIN public.profiles p ON p.id = pc.parent_id
    WHERE pc.child_id::text = (storage.foldername(name))[1]
    AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete photos for their children"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'child-photos'
  AND EXISTS (
    SELECT 1 FROM public.parent_children pc
    JOIN public.profiles p ON p.id = pc.parent_id
    WHERE pc.child_id::text = (storage.foldername(name))[1]
    AND p.user_id = auth.uid()
  )
);