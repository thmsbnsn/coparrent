-- Drop the old restrictive INSERT policy on parent_children
DROP POLICY IF EXISTS "Parents can insert child links" ON parent_children;

-- Create a new policy that allows inserting for self or for co-parent when adding a shared child
CREATE POLICY "Parents can insert child links for self or co-parent" 
ON parent_children 
FOR INSERT 
WITH CHECK (
  parent_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  )
  OR parent_id IN (
    SELECT co_parent_id FROM profiles WHERE user_id = auth.uid() AND co_parent_id IS NOT NULL
  )
);