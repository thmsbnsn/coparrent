-- Add health fields to children table
ALTER TABLE public.children 
ADD COLUMN IF NOT EXISTS blood_type text,
ADD COLUMN IF NOT EXISTS allergies text[],
ADD COLUMN IF NOT EXISTS medications text[],
ADD COLUMN IF NOT EXISTS medical_notes text,
ADD COLUMN IF NOT EXISTS emergency_contact text,
ADD COLUMN IF NOT EXISTS emergency_phone text,
ADD COLUMN IF NOT EXISTS doctor_name text,
ADD COLUMN IF NOT EXISTS doctor_phone text,
ADD COLUMN IF NOT EXISTS school_name text,
ADD COLUMN IF NOT EXISTS school_phone text,
ADD COLUMN IF NOT EXISTS grade text;

-- Add subscription tier to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS subscription_tier text DEFAULT 'free';

-- Create step_parents table with approval workflow
CREATE TABLE IF NOT EXISTS public.step_parents (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  primary_parent_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  other_parent_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  primary_parent_approved boolean DEFAULT false,
  other_parent_approved boolean DEFAULT false,
  status text DEFAULT 'pending',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, primary_parent_id)
);

-- Enable RLS on step_parents
ALTER TABLE public.step_parents ENABLE ROW LEVEL SECURITY;

-- Step-parents can view their own records
CREATE POLICY "Step-parents can view their records"
ON public.step_parents
FOR SELECT
USING (
  user_id IN (SELECT profiles.user_id FROM profiles WHERE profiles.user_id = auth.uid())
  OR primary_parent_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  OR other_parent_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
);

-- Primary parents can insert step-parent invites
CREATE POLICY "Parents can invite step-parents"
ON public.step_parents
FOR INSERT
WITH CHECK (
  primary_parent_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
);

-- Parents can update approval status
CREATE POLICY "Parents can approve step-parents"
ON public.step_parents
FOR UPDATE
USING (
  primary_parent_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  OR other_parent_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
);

-- Link custody schedules to children
ALTER TABLE public.custody_schedules 
ADD COLUMN IF NOT EXISTS child_ids uuid[] DEFAULT '{}';

-- Trigger for step_parents updated_at
CREATE TRIGGER update_step_parents_updated_at
BEFORE UPDATE ON public.step_parents
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();