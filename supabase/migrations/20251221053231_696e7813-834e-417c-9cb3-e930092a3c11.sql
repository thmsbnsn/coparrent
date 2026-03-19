-- Create app_role enum type for role-based access control
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

-- Create user_roles table for secure role management
CREATE TABLE public.user_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Add free_premium_access and access_reason columns to profiles
ALTER TABLE public.profiles 
ADD COLUMN free_premium_access boolean NOT NULL DEFAULT false,
ADD COLUMN access_reason text;

-- Create security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create function to check if current user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin')
$$;

-- RLS policy: Admins can read all user roles
CREATE POLICY "Admins can view all user roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- RLS policy: Users can view their own roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- RLS policy: Only admins can manage user roles
CREATE POLICY "Admins can insert user roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update user roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete user roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Add RLS policy for profiles: Admins can view all profiles
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.is_admin());

-- Add RLS policy for profiles: Admins can update free_premium_access
CREATE POLICY "Admins can update all profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (public.is_admin());

-- Seed admin role for the super admin user (thmsbnsn@coparrent.com)
-- This uses a DO block to safely insert the role if the user exists
DO $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Get user_id for the super admin
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'thmsbnsn@coparrent.com' LIMIT 1;
  
  IF v_user_id IS NOT NULL THEN
    -- Insert admin role if not exists
    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_user_id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
    
    -- Set free premium access
    UPDATE public.profiles 
    SET free_premium_access = true, access_reason = 'Super Admin - Free Forever Premium'
    WHERE user_id = v_user_id;
  END IF;
END $$;

-- Seed free premium access for other users
DO $$
DECLARE
  v_emails text[] := ARRAY['no-reply@coparrent.com', 'tlbenson.1988@gmail.com', 'jessicaosborn10@gmail.com', 'legal@coparrent.com'];
  v_reasons text[] := ARRAY['Free Forever Premium', 'MVP Tester', 'MVP Tester', 'Law Office Partner'];
  v_email text;
  v_reason text;
  v_user_id uuid;
  i int := 1;
BEGIN
  FOREACH v_email IN ARRAY v_emails
  LOOP
    v_reason := v_reasons[i];
    
    SELECT id INTO v_user_id FROM auth.users WHERE email = v_email LIMIT 1;
    
    IF v_user_id IS NOT NULL THEN
      UPDATE public.profiles 
      SET free_premium_access = true, access_reason = v_reason
      WHERE user_id = v_user_id;
    END IF;
    
    i := i + 1;
  END LOOP;
END $$;