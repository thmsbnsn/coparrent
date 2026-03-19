-- Create storage bucket for documents (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false);

-- Create documents table with audit metadata
CREATE TABLE public.documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  child_id UUID REFERENCES public.children(id) ON DELETE SET NULL,
  uploaded_by UUID NOT NULL,
  category TEXT NOT NULL DEFAULT 'other',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create document access logs for legal audit trail
CREATE TABLE public.document_access_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  accessed_by UUID NOT NULL,
  action TEXT NOT NULL, -- 'upload', 'view', 'download', 'delete'
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_access_logs ENABLE ROW LEVEL SECURITY;

-- Helper function to check if user is document owner or co-parent
CREATE OR REPLACE FUNCTION public.can_access_document(_user_id UUID, _document_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.documents d
    JOIN public.profiles p ON p.user_id = _user_id
    WHERE d.id = _document_id
    AND (
      -- User uploaded the document
      d.uploaded_by = p.id
      -- Or user is co-parent of uploader
      OR d.uploaded_by = p.co_parent_id
      -- Or uploader is user's co-parent
      OR EXISTS (
        SELECT 1 FROM public.profiles uploader 
        WHERE uploader.id = d.uploaded_by 
        AND uploader.co_parent_id = p.id
      )
    )
  )
$$;

-- Documents RLS policies
CREATE POLICY "Users can view documents they or co-parent uploaded"
ON public.documents FOR SELECT
USING (
  uploaded_by IN (
    SELECT id FROM public.profiles WHERE user_id = auth.uid()
  )
  OR uploaded_by IN (
    SELECT co_parent_id FROM public.profiles WHERE user_id = auth.uid() AND co_parent_id IS NOT NULL
  )
  OR uploaded_by IN (
    SELECT id FROM public.profiles WHERE co_parent_id IN (
      SELECT id FROM public.profiles WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "Users can upload documents"
ON public.documents FOR INSERT
WITH CHECK (
  uploaded_by IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
);

CREATE POLICY "Users can update their own documents"
ON public.documents FOR UPDATE
USING (
  uploaded_by IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
);

CREATE POLICY "Users can delete their own documents"
ON public.documents FOR DELETE
USING (
  uploaded_by IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
);

-- Document access logs RLS policies
CREATE POLICY "Users can view access logs for accessible documents"
ON public.document_access_logs FOR SELECT
USING (
  public.can_access_document(auth.uid(), document_id)
);

CREATE POLICY "Users can create access logs"
ON public.document_access_logs FOR INSERT
WITH CHECK (
  accessed_by IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
);

-- Storage policies for documents bucket
CREATE POLICY "Users can upload documents"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'documents'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR (storage.foldername(name))[1] IN (
      SELECT co_parent_id::text FROM public.profiles WHERE user_id = auth.uid() AND co_parent_id IS NOT NULL
    )
    OR (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.profiles WHERE co_parent_id IN (
        SELECT id FROM public.profiles WHERE user_id = auth.uid()
      )
    )
  )
);

CREATE POLICY "Users can delete their documents"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Trigger for updated_at
CREATE TRIGGER update_documents_updated_at
BEFORE UPDATE ON public.documents
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();