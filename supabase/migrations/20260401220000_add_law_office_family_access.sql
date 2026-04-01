ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_account_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_account_role_check
  CHECK (
    account_role IS NULL OR
    account_role = ANY (
      ARRAY[
        'parent'::text,
        'guardian'::text,
        'third_party'::text,
        'child'::text,
        'law_office'::text,
        'admin'::text
      ]
    )
  );

UPDATE public.profiles
SET account_role = 'law_office'
WHERE account_role = 'lawoffice';

UPDATE public.profiles AS profiles
SET account_role = 'law_office'
FROM auth.users AS users
WHERE profiles.user_id = users.id
  AND profiles.account_role IS DISTINCT FROM 'law_office'
  AND lower(coalesce(users.raw_user_meta_data ->> 'account_type', '')) IN ('lawoffice', 'law_office');

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name, account_role)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data ->> 'full_name',
    CASE
      WHEN lower(coalesce(NEW.raw_user_meta_data ->> 'account_type', '')) IN ('lawoffice', 'law_office')
        THEN 'law_office'
      ELSE NULL
    END
  );

  RETURN NEW;
END;
$function$;

CREATE TABLE IF NOT EXISTS public.law_office_family_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  law_office_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  granted_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS law_office_family_access_active_assignment_idx
  ON public.law_office_family_access (law_office_user_id, family_id)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS law_office_family_access_family_idx
  ON public.law_office_family_access (family_id)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS law_office_family_access_user_idx
  ON public.law_office_family_access (law_office_user_id)
  WHERE revoked_at IS NULL;

ALTER TABLE public.law_office_family_access ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.law_office_family_access FROM anon;
REVOKE ALL ON public.law_office_family_access FROM authenticated;
GRANT SELECT ON public.law_office_family_access TO authenticated;

DROP POLICY IF EXISTS "Assigned law office users can view active family access" ON public.law_office_family_access;

CREATE POLICY "Assigned law office users can view active family access"
ON public.law_office_family_access
FOR SELECT
TO authenticated
USING (
  auth.uid() = law_office_user_id
  AND revoked_at IS NULL
);
