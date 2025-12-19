-- Create invitations table
CREATE TABLE public.invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  invitee_email TEXT NOT NULL,
  token UUID NOT NULL DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled')),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '7 days'),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(inviter_id, invitee_email)
);

-- Add trial columns to profiles
ALTER TABLE public.profiles 
ADD COLUMN trial_started_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN trial_ends_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN subscription_status TEXT DEFAULT 'none' CHECK (subscription_status IN ('none', 'trial', 'active', 'expired'));

-- Enable RLS on invitations
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- Invitations policies
CREATE POLICY "Users can view their sent invitations" ON public.invitations
  FOR SELECT USING (inviter_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can create invitations" ON public.invitations
  FOR INSERT WITH CHECK (inviter_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update their invitations" ON public.invitations
  FOR UPDATE USING (inviter_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

-- Allow anyone to view invitation by token (for accepting)
CREATE POLICY "Anyone can view invitation by token" ON public.invitations
  FOR SELECT USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_invitations_updated_at
  BEFORE UPDATE ON public.invitations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to start trial when co-parents are linked
CREATE OR REPLACE FUNCTION public.start_trial_for_linked_parents()
RETURNS TRIGGER AS $$
BEGIN
  -- Start trial for both parents when they're linked
  IF NEW.co_parent_id IS NOT NULL AND OLD.co_parent_id IS NULL THEN
    -- Update current profile
    UPDATE public.profiles 
    SET trial_started_at = now(),
        trial_ends_at = now() + interval '7 days',
        subscription_status = 'trial'
    WHERE id = NEW.id AND trial_started_at IS NULL;
    
    -- Update co-parent profile
    UPDATE public.profiles 
    SET trial_started_at = now(),
        trial_ends_at = now() + interval '7 days',
        subscription_status = 'trial'
    WHERE id = NEW.co_parent_id AND trial_started_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger to start trial when co-parents link
CREATE TRIGGER on_co_parent_linked
  AFTER UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.start_trial_for_linked_parents();