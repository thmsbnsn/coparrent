-- Add group_chat to thread_type enum
ALTER TYPE public.thread_type ADD VALUE IF NOT EXISTS 'group_chat';