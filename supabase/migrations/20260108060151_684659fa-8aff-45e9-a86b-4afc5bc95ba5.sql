-- Create a private storage bucket for child avatars
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'child-avatars', 
  'child-avatars', 
  false,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for child-avatars bucket
-- Only authenticated users who are parents linked to the child can access

-- Policy: Parents can view avatars of their children
CREATE POLICY "Parents can view child avatars"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'child-avatars'
  AND auth.role() = 'authenticated'
  AND EXISTS (
    SELECT 1 FROM public.parent_children pc
    JOIN public.profiles p ON p.id = pc.parent_id
    WHERE p.user_id = auth.uid()
    AND pc.child_id::text = (storage.foldername(name))[1]
  )
);

-- Policy: Parents can upload avatars for their children
CREATE POLICY "Parents can upload child avatars"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'child-avatars'
  AND auth.role() = 'authenticated'
  AND EXISTS (
    SELECT 1 FROM public.parent_children pc
    JOIN public.profiles p ON p.id = pc.parent_id
    WHERE p.user_id = auth.uid()
    AND pc.child_id::text = (storage.foldername(name))[1]
  )
);

-- Policy: Parents can update avatars for their children
CREATE POLICY "Parents can update child avatars"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'child-avatars'
  AND auth.role() = 'authenticated'
  AND EXISTS (
    SELECT 1 FROM public.parent_children pc
    JOIN public.profiles p ON p.id = pc.parent_id
    WHERE p.user_id = auth.uid()
    AND pc.child_id::text = (storage.foldername(name))[1]
  )
);

-- Policy: Parents can delete avatars for their children
CREATE POLICY "Parents can delete child avatars"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'child-avatars'
  AND auth.role() = 'authenticated'
  AND EXISTS (
    SELECT 1 FROM public.parent_children pc
    JOIN public.profiles p ON p.id = pc.parent_id
    WHERE p.user_id = auth.uid()
    AND pc.child_id::text = (storage.foldername(name))[1]
  )
);