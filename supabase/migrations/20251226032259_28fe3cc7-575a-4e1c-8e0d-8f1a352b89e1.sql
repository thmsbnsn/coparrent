-- Add DELETE policy for custody_schedules table
-- This allows either parent to delete their custody schedules
CREATE POLICY "Parents can delete their custody schedules"
ON public.custody_schedules
FOR DELETE
USING (
  parent_a_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()) OR
  parent_b_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
);