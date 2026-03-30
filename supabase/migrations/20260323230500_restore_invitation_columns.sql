ALTER TABLE public.invitations
ADD COLUMN IF NOT EXISTS relationship text,
ADD COLUMN IF NOT EXISTS child_ids uuid[] DEFAULT '{}'::uuid[];

UPDATE public.invitations
SET child_ids = '{}'::uuid[]
WHERE child_ids IS NULL;
