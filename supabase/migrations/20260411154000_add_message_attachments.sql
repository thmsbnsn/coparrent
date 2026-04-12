INSERT INTO storage.buckets (id, name, public)
VALUES ('family-media', 'family-media', false)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE public.family_media_assets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.family_media_assets ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_family_media_assets_family_id
  ON public.family_media_assets(family_id, created_at DESC);

CREATE INDEX idx_family_media_assets_uploaded_by
  ON public.family_media_assets(uploaded_by, created_at DESC);

CREATE POLICY "Active family members can view family media assets"
ON public.family_media_assets
FOR SELECT
USING (
  public.is_active_family_member(family_id, auth.uid())
);

CREATE POLICY "Active family members can upload family media assets"
ON public.family_media_assets
FOR INSERT
WITH CHECK (
  public.is_active_family_member(family_id, auth.uid())
  AND EXISTS (
    SELECT 1
    FROM public.family_members fm
    WHERE fm.family_id = family_media_assets.family_id
      AND fm.profile_id = family_media_assets.uploaded_by
      AND fm.user_id = auth.uid()
      AND fm.status = 'active'
  )
);

CREATE POLICY "Uploaders can update their own family media assets"
ON public.family_media_assets
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.family_members fm
    WHERE fm.family_id = family_media_assets.family_id
      AND fm.profile_id = family_media_assets.uploaded_by
      AND fm.user_id = auth.uid()
      AND fm.status = 'active'
  )
);

CREATE POLICY "Uploaders can delete their own family media assets"
ON public.family_media_assets
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM public.family_members fm
    WHERE fm.family_id = family_media_assets.family_id
      AND fm.profile_id = family_media_assets.uploaded_by
      AND fm.user_id = auth.uid()
      AND fm.status = 'active'
  )
);

CREATE POLICY "Active family members can view family media storage objects"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'family-media'
  AND public.is_active_family_member((storage.foldername(name))[1]::uuid, auth.uid())
);

CREATE POLICY "Active family members can upload family media storage objects"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'family-media'
  AND EXISTS (
    SELECT 1
    FROM public.family_members fm
    WHERE fm.family_id = (storage.foldername(name))[1]::uuid
      AND fm.profile_id::text = (storage.foldername(name))[2]
      AND fm.user_id = auth.uid()
      AND fm.status = 'active'
  )
);

CREATE POLICY "Uploaders can delete their own family media storage objects"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'family-media'
  AND EXISTS (
    SELECT 1
    FROM public.family_members fm
    WHERE fm.family_id = (storage.foldername(name))[1]::uuid
      AND fm.profile_id::text = (storage.foldername(name))[2]
      AND fm.user_id = auth.uid()
      AND fm.status = 'active'
  )
);

CREATE TRIGGER update_family_media_assets_updated_at
BEFORE UPDATE ON public.family_media_assets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.message_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  thread_id UUID NOT NULL REFERENCES public.message_threads(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES public.thread_messages(id) ON DELETE CASCADE,
  document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE,
  media_asset_id UUID REFERENCES public.family_media_assets(id) ON DELETE CASCADE,
  attachment_type TEXT NOT NULL CHECK (attachment_type IN ('document', 'image', 'video')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT message_attachments_single_asset_check
    CHECK (num_nonnulls(document_id, media_asset_id) = 1),
  CONSTRAINT message_attachments_asset_type_check
    CHECK (
      (document_id IS NOT NULL AND attachment_type = 'document')
      OR
      (media_asset_id IS NOT NULL AND attachment_type IN ('image', 'video'))
    )
);

CREATE UNIQUE INDEX uq_message_attachments_message_document
  ON public.message_attachments(message_id, document_id)
  WHERE document_id IS NOT NULL;

CREATE UNIQUE INDEX uq_message_attachments_message_media_asset
  ON public.message_attachments(message_id, media_asset_id)
  WHERE media_asset_id IS NOT NULL;

CREATE INDEX idx_message_attachments_thread_id
  ON public.message_attachments(thread_id);

CREATE INDEX idx_message_attachments_message_id
  ON public.message_attachments(message_id);

CREATE INDEX idx_message_attachments_document_id
  ON public.message_attachments(document_id)
  WHERE document_id IS NOT NULL;

CREATE INDEX idx_message_attachments_media_asset_id
  ON public.message_attachments(media_asset_id)
  WHERE media_asset_id IS NOT NULL;

CREATE INDEX idx_message_attachments_family_id
  ON public.message_attachments(family_id);

ALTER TABLE public.message_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Family members can view accessible message attachments"
ON public.message_attachments
FOR SELECT
USING (
  family_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.message_threads mt
    JOIN public.thread_messages tm
      ON tm.thread_id = mt.id
    WHERE mt.id = message_attachments.thread_id
      AND tm.id = message_attachments.message_id
      AND mt.family_id = message_attachments.family_id
      AND public.can_access_thread(auth.uid(), mt.id)
      AND (
        (
          message_attachments.document_id IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM public.documents d
            WHERE d.id = message_attachments.document_id
              AND d.family_id = message_attachments.family_id
          )
        )
        OR
        (
          message_attachments.media_asset_id IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM public.family_media_assets fma
            WHERE fma.id = message_attachments.media_asset_id
              AND fma.family_id = message_attachments.family_id
          )
        )
      )
  )
);

CREATE POLICY "Non-child members can attach family-scoped assets to their own messages"
ON public.message_attachments
FOR INSERT
WITH CHECK (
  family_id IS NOT NULL
  AND attachment_type IN ('document', 'image', 'video')
  AND EXISTS (
    SELECT 1
    FROM public.message_threads mt
    JOIN public.thread_messages tm
      ON tm.thread_id = mt.id
    JOIN public.profiles p
      ON p.id = tm.sender_id
    WHERE mt.id = message_attachments.thread_id
      AND tm.id = message_attachments.message_id
      AND mt.family_id = message_attachments.family_id
      AND p.user_id = auth.uid()
      AND tm.sender_role <> 'child'
      AND public.can_access_thread(auth.uid(), mt.id)
      AND (
        (
          message_attachments.document_id IS NOT NULL
          AND message_attachments.media_asset_id IS NULL
          AND EXISTS (
            SELECT 1
            FROM public.documents d
            WHERE d.id = message_attachments.document_id
              AND d.family_id = message_attachments.family_id
          )
        )
        OR
        (
          message_attachments.media_asset_id IS NOT NULL
          AND message_attachments.document_id IS NULL
          AND EXISTS (
            SELECT 1
            FROM public.family_media_assets fma
            WHERE fma.id = message_attachments.media_asset_id
              AND fma.family_id = message_attachments.family_id
              AND (
                (message_attachments.attachment_type = 'image' AND fma.file_type LIKE 'image/%')
                OR
                (message_attachments.attachment_type = 'video' AND fma.file_type LIKE 'video/%')
              )
          )
        )
      )
  )
);

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.message_attachments;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
