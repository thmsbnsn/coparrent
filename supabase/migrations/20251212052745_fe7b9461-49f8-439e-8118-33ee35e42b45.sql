-- Create profiles table for user data
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  co_parent_id UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create children table
CREATE TABLE public.children (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  date_of_birth DATE,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Junction table for parents and children (many-to-many)
CREATE TABLE public.parent_children (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  child_id UUID NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  UNIQUE(parent_id, child_id)
);

-- Create messages table for co-parent communication
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create schedule change requests table
CREATE TABLE public.schedule_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  request_type TEXT NOT NULL CHECK (request_type IN ('swap', 'transfer', 'modification')),
  original_date DATE NOT NULL,
  proposed_date DATE,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  message_id UUID REFERENCES public.messages(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create custody schedules table
CREATE TABLE public.custody_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_a_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  parent_b_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  pattern TEXT NOT NULL,
  start_date DATE NOT NULL,
  exchange_time TIME,
  exchange_location TEXT,
  holidays JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.children ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parent_children ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custody_schedules ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view their co-parent profile" ON public.profiles
  FOR SELECT USING (id IN (SELECT co_parent_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Children policies (parents can see their linked children)
CREATE POLICY "Parents can view their children" ON public.children
  FOR SELECT USING (id IN (
    SELECT child_id FROM public.parent_children 
    WHERE parent_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  ));

CREATE POLICY "Parents can insert children" ON public.children
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Parents can update their children" ON public.children
  FOR UPDATE USING (id IN (
    SELECT child_id FROM public.parent_children 
    WHERE parent_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  ));

-- Parent children junction policies
CREATE POLICY "Parents can view their child links" ON public.parent_children
  FOR SELECT USING (parent_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Parents can insert child links" ON public.parent_children
  FOR INSERT WITH CHECK (parent_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

-- Messages policies
CREATE POLICY "Users can view messages they sent or received" ON public.messages
  FOR SELECT USING (
    sender_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()) OR
    recipient_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can send messages" ON public.messages
  FOR INSERT WITH CHECK (sender_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Recipients can update messages (mark as read)" ON public.messages
  FOR UPDATE USING (recipient_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

-- Schedule requests policies
CREATE POLICY "Users can view their schedule requests" ON public.schedule_requests
  FOR SELECT USING (
    requester_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()) OR
    recipient_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can create schedule requests" ON public.schedule_requests
  FOR INSERT WITH CHECK (requester_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Recipients can update schedule requests" ON public.schedule_requests
  FOR UPDATE USING (recipient_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

-- Custody schedules policies
CREATE POLICY "Parents can view their custody schedules" ON public.custody_schedules
  FOR SELECT USING (
    parent_a_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()) OR
    parent_b_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Parents can insert custody schedules" ON public.custody_schedules
  FOR INSERT WITH CHECK (
    parent_a_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()) OR
    parent_b_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Parents can update their custody schedules" ON public.custody_schedules
  FOR UPDATE USING (
    parent_a_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()) OR
    parent_b_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_children_updated_at
  BEFORE UPDATE ON public.children
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_schedule_requests_updated_at
  BEFORE UPDATE ON public.schedule_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_custody_schedules_updated_at
  BEFORE UPDATE ON public.custody_schedules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to handle new user signups
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data ->> 'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger to create profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.schedule_requests;