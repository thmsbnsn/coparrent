-- Create a public storage bucket for law library documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('law-library', 'law-library', true)
ON CONFLICT (id) DO NOTHING;

-- Create a table to manage law library resources metadata
CREATE TABLE IF NOT EXISTS public.law_library_resources (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  state TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT NOT NULL DEFAULT 0,
  file_type TEXT NOT NULL DEFAULT 'application/pdf',
  source_url TEXT,
  last_verified_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on the table
ALTER TABLE public.law_library_resources ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access (anyone can view law library resources)
CREATE POLICY "Anyone can view law library resources" 
ON public.law_library_resources 
FOR SELECT 
USING (true);

-- Only admins can manage law library resources
CREATE POLICY "Admins can manage law library resources" 
ON public.law_library_resources 
FOR ALL 
USING (is_admin());

-- Create policy for public read access to law-library bucket
CREATE POLICY "Public read access for law library files"
ON storage.objects
FOR SELECT
USING (bucket_id = 'law-library');

-- Only admins can upload to law-library bucket
CREATE POLICY "Admins can upload law library files"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'law-library' AND is_admin());

-- Admins can update law library files
CREATE POLICY "Admins can update law library files"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'law-library' AND is_admin());

-- Admins can delete law library files
CREATE POLICY "Admins can delete law library files"
ON storage.objects
FOR DELETE
USING (bucket_id = 'law-library' AND is_admin());

-- Create trigger for updated_at
CREATE TRIGGER update_law_library_resources_updated_at
BEFORE UPDATE ON public.law_library_resources
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();