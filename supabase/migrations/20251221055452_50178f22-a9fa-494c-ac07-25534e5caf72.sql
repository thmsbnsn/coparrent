-- Create notifications table for storing user notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- e.g., 'schedule_change', 'new_message', 'document_upload', etc.
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  related_id UUID, -- optional reference to related entity (message_id, document_id, etc.)
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can view their own notifications
CREATE POLICY "Users can view their own notifications" ON public.notifications
  FOR SELECT USING (user_id IN (SELECT id FROM profiles WHERE profiles.user_id = auth.uid()));

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update their own notifications" ON public.notifications
  FOR UPDATE USING (user_id IN (SELECT id FROM profiles WHERE profiles.user_id = auth.uid()));

-- System can insert notifications (via triggers/functions)
CREATE POLICY "System can insert notifications" ON public.notifications
  FOR INSERT WITH CHECK (true);

-- Users can delete their own notifications
CREATE POLICY "Users can delete their own notifications" ON public.notifications
  FOR DELETE USING (user_id IN (SELECT id FROM profiles WHERE profiles.user_id = auth.uid()));

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Create blog_posts table
CREATE TABLE IF NOT EXISTS public.blog_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  excerpt TEXT,
  content TEXT NOT NULL,
  featured_image TEXT,
  author_name TEXT NOT NULL DEFAULT 'CoParrent Team',
  category TEXT NOT NULL DEFAULT 'General',
  tags TEXT[] DEFAULT '{}',
  published BOOLEAN NOT NULL DEFAULT false,
  published_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on blog_posts
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

-- Everyone can view published blog posts
CREATE POLICY "Anyone can view published blog posts" ON public.blog_posts
  FOR SELECT USING (published = true);

-- Admins can manage blog posts
CREATE POLICY "Admins can manage blog posts" ON public.blog_posts
  FOR ALL USING (is_admin());

-- Create index for faster slug lookups
CREATE INDEX IF NOT EXISTS idx_blog_posts_slug ON public.blog_posts(slug);
CREATE INDEX IF NOT EXISTS idx_blog_posts_published ON public.blog_posts(published, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_blog_posts_category ON public.blog_posts(category);

-- Add trigger for updated_at
CREATE TRIGGER update_blog_posts_updated_at
  BEFORE UPDATE ON public.blog_posts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert some sample blog posts
INSERT INTO public.blog_posts (title, slug, excerpt, content, category, author_name, published, published_at, tags)
VALUES 
  ('5 Tips for Effective Co-Parenting Communication', 'effective-coparenting-communication', 
   'Learn how to improve communication with your co-parent for the benefit of your children.',
   'Communication is the cornerstone of successful co-parenting. Here are five proven tips to help you communicate more effectively with your co-parent...

1. **Use Written Communication**: Text messages and emails create a record and give both parents time to respond thoughtfully.

2. **Keep It Business-Like**: Treat co-parenting discussions like business meetings. Stay focused on the children''s needs.

3. **Use "I" Statements**: Instead of blaming, express how situations affect you. "I feel concerned when..." is more productive than "You always..."

4. **Set Boundaries**: Establish clear times and methods for communication to prevent constant interruptions.

5. **Use Technology**: Apps like CoParrent can help manage schedules and keep communication organized.',
   'Communication', 'Sarah Mitchell', true, now() - interval '2 days', ARRAY['communication', 'tips', 'co-parenting']),
  
  ('Managing Holiday Schedules: A Complete Guide', 'managing-holiday-schedules',
   'Navigate holiday custody arrangements with less stress and more joy for everyone.',
   'Holiday schedules can be one of the most challenging aspects of co-parenting. Here''s how to handle them gracefully...

**Plan Ahead**: Start discussing holiday schedules at least 2-3 months in advance.

**Be Flexible**: Sometimes the exact day matters less than the quality time spent together.

**Create New Traditions**: Both households can develop their own special traditions.

**Put Children First**: Focus on what will make the holidays most enjoyable for your children.

**Document Everything**: Use your co-parenting calendar to keep track of holiday arrangements.',
   'Schedules', 'CoParrent Team', true, now() - interval '5 days', ARRAY['holidays', 'schedules', 'planning']),
  
  ('Understanding Your Children''s Emotions During Transitions', 'childrens-emotions-transitions',
   'Help your children navigate the emotional challenges of moving between two homes.',
   'Transitions between homes can be emotionally challenging for children. Here''s what you need to know...

Children often experience a range of emotions during transitions, and this is completely normal. Understanding these feelings can help you support them better.

**Common Reactions**:
- Sadness when leaving one parent
- Excitement about seeing the other parent
- Anxiety about the change
- Acting out behavior

**How to Help**:
- Maintain consistent routines in both homes
- Allow time for adjustment after transitions
- Validate their feelings
- Avoid putting them in the middle of adult issues',
   'Parenting', 'Dr. James Thompson', true, now() - interval '1 week', ARRAY['children', 'emotions', 'transitions']);

-- Create index for notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(user_id, created_at DESC);