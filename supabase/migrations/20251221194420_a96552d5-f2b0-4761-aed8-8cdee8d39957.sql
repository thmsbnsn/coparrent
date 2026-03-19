-- Fix 1: Drop the overly permissive children INSERT policy (correct name without trailing space)
DROP POLICY IF EXISTS "Parents can insert children" ON public.children;

-- Fix 2: Replace overly permissive receipts storage SELECT policy
DROP POLICY IF EXISTS "Users can view receipts for shared expenses" ON storage.objects;

CREATE POLICY "Users can view their own and co-parent receipts"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'receipts'
  AND (
    -- User uploaded the receipt (user_id is first folder segment)
    auth.uid()::text = (storage.foldername(name))[1]
    -- Or user's co-parent uploaded it
    OR (storage.foldername(name))[1] IN (
      SELECT co_parent_id::text FROM public.profiles 
      WHERE user_id = auth.uid() AND co_parent_id IS NOT NULL
    )
    -- Or uploader is user's co-parent (reverse lookup)
    OR (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.profiles 
      WHERE co_parent_id IN (
        SELECT id FROM public.profiles WHERE user_id = auth.uid()
      )
    )
  )
);