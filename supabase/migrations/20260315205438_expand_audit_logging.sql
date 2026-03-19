-- Add comprehensive audit logging for additional tables
-- Migration: 20260315205438_expand_audit_logging

-- =====================================================
-- ACTIVITY EVENTS AUDIT LOGGING
-- =====================================================

CREATE OR REPLACE FUNCTION public.audit_activity_events_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action text;
  v_before jsonb;
  v_after jsonb;
  v_child_id uuid;
BEGIN
  -- Get child_id from the activity
  SELECT ca.child_id INTO v_child_id
  FROM child_activities ca
  WHERE ca.id = COALESCE(NEW.activity_id, OLD.activity_id);

  IF TG_OP = 'INSERT' THEN
    v_action := 'ACTIVITY_EVENT_INSERT';
    v_before := NULL;
    v_after := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'ACTIVITY_EVENT_UPDATE';
    v_before := to_jsonb(OLD);
    v_after := to_jsonb(NEW);
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'ACTIVITY_EVENT_DELETE';
    v_before := to_jsonb(OLD);
    v_after := NULL;
  END IF;

  -- Log the audit event
  PERFORM log_audit_event(
    v_action,
    'activity_event',
    COALESCE(NEW.id, OLD.id),
    v_child_id,
    NULL,
    jsonb_build_object('activity_id', COALESCE(NEW.activity_id, OLD.activity_id)),
    v_before,
    v_after
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- Create triggers on activity_events table
CREATE TRIGGER audit_activity_events_insert
  AFTER INSERT ON public.activity_events
  FOR EACH ROW
  EXECUTE FUNCTION audit_activity_events_changes();

CREATE TRIGGER audit_activity_events_update
  AFTER UPDATE ON public.activity_events
  FOR EACH ROW
  EXECUTE FUNCTION audit_activity_events_changes();

CREATE TRIGGER audit_activity_events_delete
  AFTER DELETE ON public.activity_events
  FOR EACH ROW
  EXECUTE FUNCTION audit_activity_events_changes();

-- =====================================================
-- CALENDAR EVENTS AUDIT LOGGING
-- =====================================================

CREATE OR REPLACE FUNCTION public.audit_calendar_events_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action text;
  v_before jsonb;
  v_after jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := 'CALENDAR_EVENT_INSERT';
    v_before := NULL;
    v_after := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'CALENDAR_EVENT_UPDATE';
    v_before := to_jsonb(OLD);
    v_after := to_jsonb(NEW);
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'CALENDAR_EVENT_DELETE';
    v_before := to_jsonb(OLD);
    v_after := NULL;
  END IF;

  -- Log the audit event
  PERFORM log_audit_event(
    v_action,
    'calendar_event',
    COALESCE(NEW.id, OLD.id),
    COALESCE(NEW.child_id, OLD.child_id),
    NULL,
    jsonb_build_object('calendar_id', COALESCE(NEW.calendar_id, OLD.calendar_id)),
    v_before,
    v_after
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- Create triggers on calendar_events table
CREATE TRIGGER audit_calendar_events_insert
  AFTER INSERT ON public.calendar_events
  FOR EACH ROW
  EXECUTE FUNCTION audit_calendar_events_changes();

CREATE TRIGGER audit_calendar_events_update
  AFTER UPDATE ON public.calendar_events
  FOR EACH ROW
  EXECUTE FUNCTION audit_calendar_events_changes();

CREATE TRIGGER audit_calendar_events_delete
  AFTER DELETE ON public.calendar_events
  FOR EACH ROW
  EXECUTE FUNCTION audit_calendar_events_changes();

-- =====================================================
-- THREAD MESSAGES AUDIT LOGGING
-- =====================================================

CREATE OR REPLACE FUNCTION public.audit_thread_messages_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action text;
  v_before jsonb;
  v_after jsonb;
  v_child_id uuid;
BEGIN
  -- Get child_id from thread if it exists
  SELECT t.child_id INTO v_child_id
  FROM threads t
  WHERE t.id = COALESCE(NEW.thread_id, OLD.thread_id);

  IF TG_OP = 'INSERT' THEN
    v_action := 'MESSAGE_INSERT';
    v_before := NULL;
    v_after := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'MESSAGE_UPDATE';
    v_before := to_jsonb(OLD);
    v_after := to_jsonb(NEW);
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'MESSAGE_DELETE';
    v_before := to_jsonb(OLD);
    v_after := NULL;
  END IF;

  -- Log the audit event
  PERFORM log_audit_event(
    v_action,
    'thread_message',
    COALESCE(NEW.id, OLD.id),
    v_child_id,
    NULL,
    jsonb_build_object('thread_id', COALESCE(NEW.thread_id, OLD.thread_id)),
    v_before,
    v_after
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- Create triggers on thread_messages table
CREATE TRIGGER audit_thread_messages_insert
  AFTER INSERT ON public.thread_messages
  FOR EACH ROW
  EXECUTE FUNCTION audit_thread_messages_changes();

CREATE TRIGGER audit_thread_messages_update
  AFTER UPDATE ON public.thread_messages
  FOR EACH ROW
  EXECUTE FUNCTION audit_thread_messages_changes();

CREATE TRIGGER audit_thread_messages_delete
  AFTER DELETE ON public.thread_messages
  FOR EACH ROW
  EXECUTE FUNCTION audit_thread_messages_changes();

-- =====================================================
-- DOCUMENTS AUDIT LOGGING
-- =====================================================

CREATE OR REPLACE FUNCTION public.audit_documents_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action text;
  v_before jsonb;
  v_after jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := 'DOCUMENT_INSERT';
    v_before := NULL;
    v_after := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'DOCUMENT_UPDATE';
    v_before := to_jsonb(OLD);
    v_after := to_jsonb(NEW);
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'DOCUMENT_DELETE';
    v_before := to_jsonb(OLD);
    v_after := NULL;
  END IF;

  -- Log the audit event
  PERFORM log_audit_event(
    v_action,
    'document',
    COALESCE(NEW.id, OLD.id),
    COALESCE(NEW.child_id, OLD.child_id),
    NULL,
    NULL,
    v_before,
    v_after
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- Create triggers on documents table
CREATE TRIGGER audit_documents_insert
  AFTER INSERT ON public.documents
  FOR EACH ROW
  EXECUTE FUNCTION audit_documents_changes();

CREATE TRIGGER audit_documents_update
  AFTER UPDATE ON public.documents
  FOR EACH ROW
  EXECUTE FUNCTION audit_documents_changes();

CREATE TRIGGER audit_documents_delete
  AFTER DELETE ON public.documents
  FOR EACH ROW
  EXECUTE FUNCTION audit_documents_changes();

-- =====================================================
-- EXPENSES AUDIT LOGGING
-- =====================================================

CREATE OR REPLACE FUNCTION public.audit_expenses_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action text;
  v_before jsonb;
  v_after jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := 'EXPENSE_INSERT';
    v_before := NULL;
    v_after := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'EXPENSE_UPDATE';
    v_before := to_jsonb(OLD);
    v_after := to_jsonb(NEW);
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'EXPENSE_DELETE';
    v_before := to_jsonb(OLD);
    v_after := NULL;
  END IF;

  -- Log the audit event
  PERFORM log_audit_event(
    v_action,
    'expense',
    COALESCE(NEW.id, OLD.id),
    COALESCE(NEW.child_id, OLD.child_id),
    NULL,
    NULL,
    v_before,
    v_after
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- Create triggers on expenses table
CREATE TRIGGER audit_expenses_insert
  AFTER INSERT ON public.expenses
  FOR EACH ROW
  EXECUTE FUNCTION audit_expenses_changes();

CREATE TRIGGER audit_expenses_update
  AFTER UPDATE ON public.expenses
  FOR EACH ROW
  EXECUTE FUNCTION audit_expenses_changes();

CREATE TRIGGER audit_expenses_delete
  AFTER DELETE ON public.expenses
  FOR EACH ROW
  EXECUTE FUNCTION audit_expenses_changes();

-- =====================================================
-- GIFT LISTS AUDIT LOGGING
-- =====================================================

CREATE OR REPLACE FUNCTION public.audit_gift_lists_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action text;
  v_before jsonb;
  v_after jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := 'GIFT_LIST_INSERT';
    v_before := NULL;
    v_after := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'GIFT_LIST_UPDATE';
    v_before := to_jsonb(OLD);
    v_after := to_jsonb(NEW);
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'GIFT_LIST_DELETE';
    v_before := to_jsonb(OLD);
    v_after := NULL;
  END IF;

  -- Log the audit event
  PERFORM log_audit_event(
    v_action,
    'gift_list',
    COALESCE(NEW.id, OLD.id),
    COALESCE(NEW.child_id, OLD.child_id),
    NULL,
    NULL,
    v_before,
    v_after
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- Create triggers on gift_lists table
CREATE TRIGGER audit_gift_lists_insert
  AFTER INSERT ON public.gift_lists
  FOR EACH ROW
  EXECUTE FUNCTION audit_gift_lists_changes();

CREATE TRIGGER audit_gift_lists_update
  AFTER UPDATE ON public.gift_lists
  FOR EACH ROW
  EXECUTE FUNCTION audit_gift_lists_changes();

CREATE TRIGGER audit_gift_lists_delete
  AFTER DELETE ON public.gift_lists
  FOR EACH ROW
  EXECUTE FUNCTION audit_gift_lists_changes();

-- =====================================================
-- GIFT ITEMS AUDIT LOGGING
-- =====================================================

CREATE OR REPLACE FUNCTION public.audit_gift_items_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action text;
  v_before jsonb;
  v_after jsonb;
  v_child_id uuid;
BEGIN
  -- Get child_id from the gift list
  SELECT gl.child_id INTO v_child_id
  FROM gift_lists gl
  WHERE gl.id = COALESCE(NEW.list_id, OLD.list_id);

  IF TG_OP = 'INSERT' THEN
    v_action := 'GIFT_ITEM_INSERT';
    v_before := NULL;
    v_after := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'GIFT_ITEM_UPDATE';
    v_before := to_jsonb(OLD);
    v_after := to_jsonb(NEW);
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'GIFT_ITEM_DELETE';
    v_before := to_jsonb(OLD);
    v_after := NULL;
  END IF;

  -- Log the audit event
  PERFORM log_audit_event(
    v_action,
    'gift_item',
    COALESCE(NEW.id, OLD.id),
    v_child_id,
    NULL,
    jsonb_build_object('list_id', COALESCE(NEW.list_id, OLD.list_id)),
    v_before,
    v_after
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- Create triggers on gift_items table
CREATE TRIGGER audit_gift_items_insert
  AFTER INSERT ON public.gift_items
  FOR EACH ROW
  EXECUTE FUNCTION audit_gift_items_changes();

CREATE TRIGGER audit_gift_items_update
  AFTER UPDATE ON public.gift_items
  FOR EACH ROW
  EXECUTE FUNCTION audit_gift_items_changes();

CREATE TRIGGER audit_gift_items_delete
  AFTER DELETE ON public.gift_items
  FOR EACH ROW
  EXECUTE FUNCTION audit_gift_items_changes();

-- =====================================================
-- CHORES AUDIT LOGGING
-- =====================================================

CREATE OR REPLACE FUNCTION public.audit_chores_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action text;
  v_before jsonb;
  v_after jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := 'CHORE_INSERT';
    v_before := NULL;
    v_after := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    -- Check if this is a completion (status change to completed)
    IF OLD.status != 'completed' AND NEW.status = 'completed' THEN
      v_action := 'CHORE_COMPLETE';
    ELSE
      v_action := 'CHORE_UPDATE';
    END IF;
    v_before := to_jsonb(OLD);
    v_after := to_jsonb(NEW);
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'CHORE_DELETE';
    v_before := to_jsonb(OLD);
    v_after := NULL;
  END IF;

  -- Log the audit event
  PERFORM log_audit_event(
    v_action,
    'chore',
    COALESCE(NEW.id, OLD.id),
    COALESCE(NEW.child_id, OLD.child_id),
    NULL,
    NULL,
    v_before,
    v_after
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- Create triggers on chores table
CREATE TRIGGER audit_chores_insert
  AFTER INSERT ON public.chores
  FOR EACH ROW
  EXECUTE FUNCTION audit_chores_changes();

CREATE TRIGGER audit_chores_update
  AFTER UPDATE ON public.chores
  FOR EACH ROW
  EXECUTE FUNCTION audit_chores_changes();

CREATE TRIGGER audit_chores_delete
  AFTER DELETE ON public.chores
  FOR EACH ROW
  EXECUTE FUNCTION audit_chores_changes();

-- =====================================================
-- FAMILY MEMBERS AUDIT LOGGING
-- =====================================================

CREATE OR REPLACE FUNCTION public.audit_family_members_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action text;
  v_before jsonb;
  v_after jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := 'FAMILY_MEMBER_INSERT';
    v_before := NULL;
    v_after := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'FAMILY_MEMBER_UPDATE';
    v_before := to_jsonb(OLD);
    v_after := to_jsonb(NEW);
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'FAMILY_MEMBER_DELETE';
    v_before := to_jsonb(OLD);
    v_after := NULL;
  END IF;

  -- Log the audit event
  PERFORM log_audit_event(
    v_action,
    'family_member',
    COALESCE(NEW.id, OLD.id),
    NULL, -- No specific child for family member changes
    jsonb_build_object('family_id', COALESCE(NEW.family_id, OLD.family_id)),
    NULL,
    v_before,
    v_after
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- Create triggers on family_members table
CREATE TRIGGER audit_family_members_insert
  AFTER INSERT ON public.family_members
  FOR EACH ROW
  EXECUTE FUNCTION audit_family_members_changes();

CREATE TRIGGER audit_family_members_update
  AFTER UPDATE ON public.family_members
  FOR EACH ROW
  EXECUTE FUNCTION audit_family_members_changes();

CREATE TRIGGER audit_family_members_delete
  AFTER DELETE ON public.family_members
  FOR EACH ROW
  EXECUTE FUNCTION audit_family_members_changes();

-- =====================================================
-- CHILD PERMISSIONS AUDIT LOGGING
-- =====================================================

CREATE OR REPLACE FUNCTION public.audit_child_permissions_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action text;
  v_before jsonb;
  v_after jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := 'PERMISSION_UPDATE'; -- Permission creation
    v_before := NULL;
    v_after := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'PERMISSION_UPDATE';
    v_before := to_jsonb(OLD);
    v_after := to_jsonb(NEW);
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'PERMISSION_UPDATE'; -- Permission removal
    v_before := to_jsonb(OLD);
    v_after := NULL;
  END IF;

  -- Log the audit event
  PERFORM log_audit_event(
    v_action,
    'child_permission',
    COALESCE(NEW.id, OLD.id),
    COALESCE(NEW.child_id, OLD.child_id),
    NULL,
    NULL,
    v_before,
    v_after
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- Create triggers on child_permissions table
CREATE TRIGGER audit_child_permissions_insert
  AFTER INSERT ON public.child_permissions
  FOR EACH ROW
  EXECUTE FUNCTION audit_child_permissions_changes();

CREATE TRIGGER audit_child_permissions_update
  AFTER UPDATE ON public.child_permissions
  FOR EACH ROW
  EXECUTE FUNCTION audit_child_permissions_changes();

CREATE TRIGGER audit_child_permissions_delete
  AFTER DELETE ON public.child_permissions
  FOR EACH ROW
  EXECUTE FUNCTION audit_child_permissions_changes();

-- =====================================================
-- PROFILES AUDIT LOGGING (for profile updates)
-- =====================================================

CREATE OR REPLACE FUNCTION public.audit_profiles_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action text;
  v_before jsonb;
  v_after jsonb;
BEGIN
  -- Only log updates, not inserts (inserts are handled by auth)
  IF TG_OP = 'UPDATE' THEN
    v_action := 'PROFILE_UPDATE';
    v_before := to_jsonb(OLD);
    v_after := to_jsonb(NEW);
  END IF;

  -- Log the audit event
  PERFORM log_audit_event(
    v_action,
    'profile',
    NEW.id,
    NULL, -- No specific child
    NULL,
    NULL,
    v_before,
    v_after
  );

  RETURN NEW;
END;
$$;

-- Create trigger on profiles table (only for updates)
CREATE TRIGGER audit_profiles_update
  AFTER UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION audit_profiles_changes();

-- =====================================================
-- NOTIFICATIONS AUDIT LOGGING
-- =====================================================

CREATE OR REPLACE FUNCTION public.audit_notifications_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action text;
  v_before jsonb;
  v_after jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := 'NOTIFICATION_SEND';
    v_before := NULL;
    v_after := to_jsonb(NEW);
  END IF;

  -- Log the audit event (only for new notifications)
  PERFORM log_audit_event(
    v_action,
    'notification',
    NEW.id,
    NEW.child_id,
    NULL,
    jsonb_build_object('type', NEW.type),
    v_before,
    v_after
  );

  RETURN NEW;
END;
$$;

-- Create trigger on notifications table (only for inserts)
CREATE TRIGGER audit_notifications_insert
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION audit_notifications_changes();

-- =====================================================
-- RPC FUNCTIONS FOR VIEW LOGGING
-- =====================================================

-- Function to view activity event details with audit logging
CREATE OR REPLACE FUNCTION public.get_activity_event_details(p_event_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_profile_id uuid;
  v_event jsonb;
  v_has_access boolean := false;
  v_child_id uuid;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required');
  END IF;

  -- Get profile ID
  SELECT id INTO v_profile_id
  FROM profiles
  WHERE user_id = v_user_id;

  IF v_profile_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Profile not found');
  END IF;

  -- Get child_id from the activity event
  SELECT ca.child_id INTO v_child_id
  FROM activity_events ae
  JOIN child_activities ca ON ca.id = ae.activity_id
  WHERE ae.id = p_event_id;

  -- Check if user has access to this child's data
  SELECT EXISTS (
    SELECT 1 FROM parent_children pc
    WHERE pc.child_id = v_child_id
    AND pc.parent_id = v_profile_id
  ) INTO v_has_access;

  IF NOT v_has_access THEN
    RETURN jsonb_build_object('success', false, 'error', 'Access denied');
  END IF;

  -- Get event data
  SELECT to_jsonb(ae.*) INTO v_event
  FROM activity_events ae
  WHERE ae.id = p_event_id;

  IF v_event IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Activity event not found');
  END IF;

  -- Log the view event
  PERFORM log_audit_event(
    'ACTIVITY_EVENT_VIEW',
    'activity_event',
    p_event_id,
    v_child_id,
    NULL,
    NULL,
    NULL,
    NULL
  );

  RETURN jsonb_build_object('success', true, 'event', v_event);
END;
$$;

-- Function to view calendar event details with audit logging
CREATE OR REPLACE FUNCTION public.get_calendar_event_details(p_event_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_profile_id uuid;
  v_event jsonb;
  v_has_access boolean := false;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required');
  END IF;

  -- Get profile ID
  SELECT id INTO v_profile_id
  FROM profiles
  WHERE user_id = v_user_id;

  IF v_profile_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Profile not found');
  END IF;

  -- Check if user has access to this calendar event's family
  SELECT EXISTS (
    SELECT 1 FROM calendar_events ce
    JOIN calendars c ON c.id = ce.calendar_id
    WHERE ce.id = p_event_id
    AND c.family_id IN (
      SELECT fm.family_id FROM family_members fm WHERE fm.profile_id = v_profile_id
    )
  ) INTO v_has_access;

  IF NOT v_has_access THEN
    RETURN jsonb_build_object('success', false, 'error', 'Access denied');
  END IF;

  -- Get event data
  SELECT to_jsonb(ce.*) INTO v_event
  FROM calendar_events ce
  WHERE ce.id = p_event_id;

  IF v_event IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Calendar event not found');
  END IF;

  -- Log the view event
  PERFORM log_audit_event(
    'CALENDAR_EVENT_VIEW',
    'calendar_event',
    p_event_id,
    (v_event->>'child_id')::uuid,
    NULL,
    NULL,
    NULL,
    NULL
  );

  RETURN jsonb_build_object('success', true, 'event', v_event);
END;
$$;