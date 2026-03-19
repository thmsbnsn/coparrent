
-- Phase 6: Harden RLS policies to explicitly block third-party and child accounts from parent-only mutations
-- This ensures server-side enforcement even if UI gating fails

-- ===========================================
-- 1. EXPENSES TABLE - Add parent/guardian check for INSERT
-- ===========================================

-- Drop existing INSERT policy
DROP POLICY IF EXISTS "Users can create their own expenses" ON public.expenses;

-- Create new INSERT policy that requires parent/guardian status
CREATE POLICY "Parents can create expenses" 
ON public.expenses 
FOR INSERT 
WITH CHECK (
  -- User must be a parent/guardian (not third-party or child)
  is_parent_or_guardian(auth.uid())
  AND created_by IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  )
);

-- ===========================================
-- 2. DOCUMENTS TABLE - Add parent/guardian check for INSERT, UPDATE, DELETE
-- ===========================================

-- Drop existing mutation policies
DROP POLICY IF EXISTS "Users can upload documents" ON public.documents;
DROP POLICY IF EXISTS "Users can update their own documents" ON public.documents;
DROP POLICY IF EXISTS "Users can delete their own documents" ON public.documents;

-- Create new INSERT policy
CREATE POLICY "Parents can upload documents" 
ON public.documents 
FOR INSERT 
WITH CHECK (
  is_parent_or_guardian(auth.uid())
  AND uploaded_by IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  )
);

-- Create new UPDATE policy
CREATE POLICY "Parents can update their own documents" 
ON public.documents 
FOR UPDATE 
USING (
  is_parent_or_guardian(auth.uid())
  AND uploaded_by IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  )
);

-- Create new DELETE policy
CREATE POLICY "Parents can delete their own documents" 
ON public.documents 
FOR DELETE 
USING (
  is_parent_or_guardian(auth.uid())
  AND uploaded_by IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  )
);

-- ===========================================
-- 3. CUSTODY_SCHEDULES TABLE - Add parent/guardian check
-- ===========================================

-- Drop existing mutation policies
DROP POLICY IF EXISTS "Parents can insert custody schedules" ON public.custody_schedules;
DROP POLICY IF EXISTS "Parents can update their custody schedules" ON public.custody_schedules;
DROP POLICY IF EXISTS "Parents can delete their custody schedules" ON public.custody_schedules;

-- Create new INSERT policy with parent/guardian check
CREATE POLICY "Parents can insert custody schedules" 
ON public.custody_schedules 
FOR INSERT 
WITH CHECK (
  is_parent_or_guardian(auth.uid())
  AND (
    parent_a_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR parent_b_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  )
);

-- Create new UPDATE policy with parent/guardian check
CREATE POLICY "Parents can update their custody schedules" 
ON public.custody_schedules 
FOR UPDATE 
USING (
  is_parent_or_guardian(auth.uid())
  AND (
    parent_a_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR parent_b_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  )
);

-- Create new DELETE policy with parent/guardian check
CREATE POLICY "Parents can delete their custody schedules" 
ON public.custody_schedules 
FOR DELETE 
USING (
  is_parent_or_guardian(auth.uid())
  AND (
    parent_a_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR parent_b_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  )
);

-- ===========================================
-- 4. SCHEDULE_REQUESTS TABLE - Add parent/guardian check for INSERT
-- ===========================================

-- Check existing policies and add parent/guardian check
DROP POLICY IF EXISTS "Users can create schedule requests" ON public.schedule_requests;

-- Create new INSERT policy
CREATE POLICY "Parents can create schedule requests" 
ON public.schedule_requests 
FOR INSERT 
WITH CHECK (
  is_parent_or_guardian(auth.uid())
  AND requester_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  )
);

-- ===========================================
-- 5. CHILD_ACTIVITIES TABLE - Add explicit parent/guardian check
-- ===========================================

-- Drop existing INSERT policy
DROP POLICY IF EXISTS "Parents can create activities for their children" ON public.child_activities;

-- Create new INSERT policy with parent/guardian check
CREATE POLICY "Parents can create activities for their children" 
ON public.child_activities 
FOR INSERT 
WITH CHECK (
  is_parent_or_guardian(auth.uid())
  AND EXISTS (
    SELECT 1 FROM parent_children pc
    JOIN profiles p ON pc.parent_id = p.id
    WHERE pc.child_id = child_activities.child_id 
    AND p.user_id = auth.uid()
  )
);

-- Drop and recreate UPDATE policy
DROP POLICY IF EXISTS "Parents can update their children's activities" ON public.child_activities;

CREATE POLICY "Parents can update their children's activities" 
ON public.child_activities 
FOR UPDATE 
USING (
  is_parent_or_guardian(auth.uid())
  AND EXISTS (
    SELECT 1 FROM parent_children pc
    JOIN profiles p ON pc.parent_id = p.id
    WHERE pc.child_id = child_activities.child_id 
    AND p.user_id = auth.uid()
  )
);

-- Drop and recreate DELETE policy
DROP POLICY IF EXISTS "Parents can delete their children's activities" ON public.child_activities;

CREATE POLICY "Parents can delete their children's activities" 
ON public.child_activities 
FOR DELETE 
USING (
  is_parent_or_guardian(auth.uid())
  AND EXISTS (
    SELECT 1 FROM parent_children pc
    JOIN profiles p ON pc.parent_id = p.id
    WHERE pc.child_id = child_activities.child_id 
    AND p.user_id = auth.uid()
  )
);

-- ===========================================
-- 6. ACTIVITY_EVENTS TABLE - Add explicit parent/guardian check
-- ===========================================

-- Drop existing policies
DROP POLICY IF EXISTS "Parents can create activity events" ON public.activity_events;
DROP POLICY IF EXISTS "Parents can update activity events" ON public.activity_events;
DROP POLICY IF EXISTS "Parents can delete activity events" ON public.activity_events;

-- Create new INSERT policy
CREATE POLICY "Parents can create activity events" 
ON public.activity_events 
FOR INSERT 
WITH CHECK (
  is_parent_or_guardian(auth.uid())
  AND EXISTS (
    SELECT 1 FROM child_activities ca
    JOIN parent_children pc ON pc.child_id = ca.child_id
    JOIN profiles p ON pc.parent_id = p.id
    WHERE ca.id = activity_events.activity_id 
    AND p.user_id = auth.uid()
  )
);

-- Create new UPDATE policy
CREATE POLICY "Parents can update activity events" 
ON public.activity_events 
FOR UPDATE 
USING (
  is_parent_or_guardian(auth.uid())
  AND EXISTS (
    SELECT 1 FROM child_activities ca
    JOIN parent_children pc ON pc.child_id = ca.child_id
    JOIN profiles p ON pc.parent_id = p.id
    WHERE ca.id = activity_events.activity_id 
    AND p.user_id = auth.uid()
  )
);

-- Create new DELETE policy
CREATE POLICY "Parents can delete activity events" 
ON public.activity_events 
FOR DELETE 
USING (
  is_parent_or_guardian(auth.uid())
  AND EXISTS (
    SELECT 1 FROM child_activities ca
    JOIN parent_children pc ON pc.child_id = ca.child_id
    JOIN profiles p ON pc.parent_id = p.id
    WHERE ca.id = activity_events.activity_id 
    AND p.user_id = auth.uid()
  )
);

-- ===========================================
-- 7. CHILD_PHOTOS TABLE - Add parent/guardian check
-- ===========================================

DROP POLICY IF EXISTS "Users can upload photos for their children" ON public.child_photos;
DROP POLICY IF EXISTS "Users can update their own photos" ON public.child_photos;
DROP POLICY IF EXISTS "Users can delete their own photos" ON public.child_photos;

CREATE POLICY "Parents can upload photos for their children" 
ON public.child_photos 
FOR INSERT 
WITH CHECK (
  is_parent_or_guardian(auth.uid())
  AND EXISTS (
    SELECT 1 FROM parent_children pc
    JOIN profiles p ON p.id = pc.parent_id
    WHERE pc.child_id = child_photos.child_id 
    AND p.user_id = auth.uid()
  )
  AND uploaded_by IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Parents can update their own photos" 
ON public.child_photos 
FOR UPDATE 
USING (
  is_parent_or_guardian(auth.uid())
  AND uploaded_by IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Parents can delete their own photos" 
ON public.child_photos 
FOR DELETE 
USING (
  is_parent_or_guardian(auth.uid())
  AND uploaded_by IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  )
);

-- ===========================================
-- 8. EXPENSES UPDATE/DELETE - Add parent/guardian check
-- ===========================================

DROP POLICY IF EXISTS "Users can update their own expenses" ON public.expenses;
DROP POLICY IF EXISTS "Users can delete their own expenses" ON public.expenses;

CREATE POLICY "Parents can update their own expenses" 
ON public.expenses 
FOR UPDATE 
USING (
  is_parent_or_guardian(auth.uid())
  AND created_by IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Parents can delete their own expenses" 
ON public.expenses 
FOR DELETE 
USING (
  is_parent_or_guardian(auth.uid())
  AND created_by IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  )
);

-- ===========================================
-- 9. GIFT_LISTS TABLE - Add parent/guardian check for mutations
-- ===========================================

DROP POLICY IF EXISTS "Parents can create gift lists" ON public.gift_lists;
DROP POLICY IF EXISTS "Parents can update gift lists" ON public.gift_lists;
DROP POLICY IF EXISTS "Parents can delete gift lists" ON public.gift_lists;

CREATE POLICY "Parents can create gift lists" 
ON public.gift_lists 
FOR INSERT 
WITH CHECK (
  is_parent_or_guardian(auth.uid())
  AND (
    primary_parent_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR primary_parent_id IN (
      SELECT co_parent_id FROM profiles 
      WHERE user_id = auth.uid() AND co_parent_id IS NOT NULL
    )
  )
);

CREATE POLICY "Parents can update gift lists" 
ON public.gift_lists 
FOR UPDATE 
USING (
  is_parent_or_guardian(auth.uid())
  AND (
    primary_parent_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR primary_parent_id IN (
      SELECT co_parent_id FROM profiles 
      WHERE user_id = auth.uid() AND co_parent_id IS NOT NULL
    )
  )
);

CREATE POLICY "Parents can delete gift lists" 
ON public.gift_lists 
FOR DELETE 
USING (
  is_parent_or_guardian(auth.uid())
  AND (
    primary_parent_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR primary_parent_id IN (
      SELECT co_parent_id FROM profiles 
      WHERE user_id = auth.uid() AND co_parent_id IS NOT NULL
    )
  )
);

-- ===========================================
-- 10. GIFT_ITEMS TABLE - Add parent/guardian check for INSERT/DELETE
-- ===========================================

DROP POLICY IF EXISTS "Parents can create gift items" ON public.gift_items;
DROP POLICY IF EXISTS "Parents can delete gift items" ON public.gift_items;
DROP POLICY IF EXISTS "Parents can update gift items" ON public.gift_items;

CREATE POLICY "Parents can create gift items" 
ON public.gift_items 
FOR INSERT 
WITH CHECK (
  is_parent_or_guardian(auth.uid())
  AND created_by IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  AND gift_list_id IN (
    SELECT gl.id FROM gift_lists gl
    WHERE gl.primary_parent_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR gl.primary_parent_id IN (
      SELECT co_parent_id FROM profiles 
      WHERE user_id = auth.uid() AND co_parent_id IS NOT NULL
    )
  )
);

CREATE POLICY "Parents can update gift items" 
ON public.gift_items 
FOR UPDATE 
USING (
  is_parent_or_guardian(auth.uid())
  AND gift_list_id IN (
    SELECT gl.id FROM gift_lists gl
    WHERE gl.primary_parent_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR gl.primary_parent_id IN (
      SELECT co_parent_id FROM profiles 
      WHERE user_id = auth.uid() AND co_parent_id IS NOT NULL
    )
  )
);

CREATE POLICY "Parents can delete gift items" 
ON public.gift_items 
FOR DELETE 
USING (
  is_parent_or_guardian(auth.uid())
  AND gift_list_id IN (
    SELECT gl.id FROM gift_lists gl
    WHERE gl.primary_parent_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR gl.primary_parent_id IN (
      SELECT co_parent_id FROM profiles 
      WHERE user_id = auth.uid() AND co_parent_id IS NOT NULL
    )
  )
);
