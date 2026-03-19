-- Gift Lists table
CREATE TABLE public.gift_lists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  child_id UUID NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  primary_parent_id UUID NOT NULL REFERENCES public.profiles(id),
  occasion_type TEXT NOT NULL DEFAULT 'birthday',
  custom_occasion_name TEXT,
  event_date DATE,
  allow_multiple_claims BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Gift Items table
CREATE TABLE public.gift_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  gift_list_id UUID NOT NULL REFERENCES public.gift_lists(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT DEFAULT 'other',
  suggested_age_range TEXT,
  notes TEXT,
  parent_only_notes TEXT,
  link TEXT,
  status TEXT DEFAULT 'unclaimed',
  claimed_by UUID REFERENCES public.profiles(id),
  claimed_at TIMESTAMP WITH TIME ZONE,
  purchased BOOLEAN DEFAULT false,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Typing indicators table for real-time presence
CREATE TABLE public.typing_indicators (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  thread_id UUID NOT NULL REFERENCES public.message_threads(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(thread_id, profile_id)
);

-- Enable RLS
ALTER TABLE public.gift_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.typing_indicators ENABLE ROW LEVEL SECURITY;

-- Enable realtime for typing indicators
ALTER PUBLICATION supabase_realtime ADD TABLE public.typing_indicators;

-- Gift Lists policies
CREATE POLICY "Parents can create gift lists"
ON public.gift_lists FOR INSERT
WITH CHECK (
  primary_parent_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  ) OR primary_parent_id IN (
    SELECT co_parent_id FROM profiles WHERE user_id = auth.uid() AND co_parent_id IS NOT NULL
  )
);

CREATE POLICY "Family members can view gift lists"
ON public.gift_lists FOR SELECT
USING (
  is_family_member(auth.uid(), primary_parent_id)
);

CREATE POLICY "Parents can update gift lists"
ON public.gift_lists FOR UPDATE
USING (
  primary_parent_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  ) OR primary_parent_id IN (
    SELECT co_parent_id FROM profiles WHERE user_id = auth.uid() AND co_parent_id IS NOT NULL
  )
);

CREATE POLICY "Parents can delete gift lists"
ON public.gift_lists FOR DELETE
USING (
  primary_parent_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  ) OR primary_parent_id IN (
    SELECT co_parent_id FROM profiles WHERE user_id = auth.uid() AND co_parent_id IS NOT NULL
  )
);

-- Gift Items policies
CREATE POLICY "Family members can view gift items"
ON public.gift_items FOR SELECT
USING (
  gift_list_id IN (
    SELECT id FROM gift_lists gl
    WHERE is_family_member(auth.uid(), gl.primary_parent_id)
  )
);

CREATE POLICY "Parents can create gift items"
ON public.gift_items FOR INSERT
WITH CHECK (
  created_by IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  AND gift_list_id IN (
    SELECT id FROM gift_lists gl
    WHERE gl.primary_parent_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    ) OR gl.primary_parent_id IN (
      SELECT co_parent_id FROM profiles WHERE user_id = auth.uid() AND co_parent_id IS NOT NULL
    )
  )
);

CREATE POLICY "Parents can update gift items"
ON public.gift_items FOR UPDATE
USING (
  gift_list_id IN (
    SELECT id FROM gift_lists gl
    WHERE gl.primary_parent_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    ) OR gl.primary_parent_id IN (
      SELECT co_parent_id FROM profiles WHERE user_id = auth.uid() AND co_parent_id IS NOT NULL
    )
  )
);

CREATE POLICY "Family members can claim gifts"
ON public.gift_items FOR UPDATE
USING (
  gift_list_id IN (
    SELECT id FROM gift_lists gl
    WHERE is_family_member(auth.uid(), gl.primary_parent_id)
  )
  AND (
    -- Only allow claiming/unclaiming actions
    claimed_by IS NULL OR claimed_by IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  )
);

CREATE POLICY "Parents can delete gift items"
ON public.gift_items FOR DELETE
USING (
  gift_list_id IN (
    SELECT id FROM gift_lists gl
    WHERE gl.primary_parent_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    ) OR gl.primary_parent_id IN (
      SELECT co_parent_id FROM profiles WHERE user_id = auth.uid() AND co_parent_id IS NOT NULL
    )
  )
);

-- Typing indicators policies
CREATE POLICY "Family members can view typing indicators"
ON public.typing_indicators FOR SELECT
USING (
  thread_id IN (
    SELECT id FROM message_threads mt
    WHERE can_access_thread(auth.uid(), mt.id)
  )
);

CREATE POLICY "Users can create their typing indicators"
ON public.typing_indicators FOR INSERT
WITH CHECK (
  profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  AND thread_id IN (
    SELECT id FROM message_threads mt
    WHERE can_access_thread(auth.uid(), mt.id)
  )
);

CREATE POLICY "Users can update their typing indicators"
ON public.typing_indicators FOR UPDATE
USING (
  profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
);

CREATE POLICY "Users can delete their typing indicators"
ON public.typing_indicators FOR DELETE
USING (
  profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
);

-- Triggers for updated_at
CREATE TRIGGER update_gift_lists_updated_at
BEFORE UPDATE ON public.gift_lists
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_gift_items_updated_at
BEFORE UPDATE ON public.gift_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();