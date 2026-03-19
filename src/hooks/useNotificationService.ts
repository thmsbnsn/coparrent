import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePushNotifications } from './usePushNotifications';

export type NotificationType = 
  | 'new_message'
  | 'schedule_change'
  | 'schedule_response'
  | 'document_upload'
  | 'child_update'
  | 'exchange_reminder'
  | 'expense_request';

interface SendNotificationParams {
  type: NotificationType;
  recipientProfileId: string;
  title: string;
  message: string;
  senderName?: string;
  actionUrl?: string;
  relatedId?: string;
}

export const useNotificationService = () => {
  const { user } = useAuth();
  const { sendLocalNotification, permission } = usePushNotifications();

  /**
   * Send a notification to a recipient via edge function
   * This handles both in-app notifications and email delivery
   */
  const sendNotification = useCallback(async (params: SendNotificationParams): Promise<boolean> => {
    if (!user) {
      console.warn('Cannot send notification: user not authenticated');
      return false;
    }

    try {
      console.log('Sending notification:', params);

      const { error } = await supabase.functions.invoke('send-notification', {
        body: {
          type: params.type,
          recipient_profile_id: params.recipientProfileId,
          sender_name: params.senderName,
          title: params.title,
          message: params.message,
          action_url: params.actionUrl,
          data: {
            related_id: params.relatedId,
          },
        },
      });

      if (error) {
        console.error('Error sending notification:', error);
        return false;
      }

      console.log('Notification sent successfully');
      return true;
    } catch (error) {
      console.error('Exception sending notification:', error);
      return false;
    }
  }, [user]);

  /**
   * Show a local browser notification
   */
  const showLocalNotification = useCallback(async (
    title: string,
    body: string,
    options?: NotificationOptions
  ): Promise<boolean> => {
    if (permission !== 'granted') {
      console.log('Local notifications not permitted');
      return false;
    }

    return sendLocalNotification(title, {
      body,
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      tag: `coparrent-${Date.now()}`,
      ...options,
    });
  }, [permission, sendLocalNotification]);

  /**
   * Helper to send message notification
   */
  const notifyNewMessage = useCallback(async (
    recipientProfileId: string,
    senderName: string,
    messagePreview: string
  ) => {
    return sendNotification({
      type: 'new_message',
      recipientProfileId,
      title: 'New Message',
      message: messagePreview.length > 100 
        ? `${messagePreview.substring(0, 100)}...` 
        : messagePreview,
      senderName,
      actionUrl: '/dashboard/messages',
    });
  }, [sendNotification]);

  /**
   * Helper to send schedule change request notification
   */
  const notifyScheduleChange = useCallback(async (
    recipientProfileId: string,
    senderName: string,
    requestType: string,
    originalDate: string,
    proposedDate?: string
  ) => {
    const message = proposedDate
      ? `${senderName} has requested to swap ${originalDate} for ${proposedDate}.`
      : `${senderName} has requested to change the schedule for ${originalDate}.`;

    return sendNotification({
      type: 'schedule_change',
      recipientProfileId,
      title: 'Schedule Change Request',
      message,
      senderName,
      actionUrl: '/dashboard/calendar',
    });
  }, [sendNotification]);

  /**
   * Helper to send schedule response notification
   */
  const notifyScheduleResponse = useCallback(async (
    recipientProfileId: string,
    responderName: string,
    status: 'accepted' | 'declined',
    originalDate: string
  ) => {
    const message = status === 'accepted'
      ? `${responderName} has accepted your schedule change request for ${originalDate}.`
      : `${responderName} has declined your schedule change request for ${originalDate}.`;

    return sendNotification({
      type: 'schedule_response',
      recipientProfileId,
      title: `Schedule Request ${status === 'accepted' ? 'Accepted' : 'Declined'}`,
      message,
      senderName: responderName,
      actionUrl: '/dashboard/calendar',
    });
  }, [sendNotification]);

  /**
   * Helper to send document upload notification
   */
  const notifyDocumentUpload = useCallback(async (
    recipientProfileId: string,
    uploaderName: string,
    documentTitle: string
  ) => {
    return sendNotification({
      type: 'document_upload',
      recipientProfileId,
      title: 'New Document Shared',
      message: `${uploaderName} has shared a new document: "${documentTitle}"`,
      senderName: uploaderName,
      actionUrl: '/dashboard/documents',
    });
  }, [sendNotification]);

  /**
   * Helper to send child info update notification
   */
  const notifyChildUpdate = useCallback(async (
    recipientProfileId: string,
    updaterName: string,
    childName: string,
    updateType: string
  ) => {
    return sendNotification({
      type: 'child_update',
      recipientProfileId,
      title: 'Child Information Updated',
      message: `${updaterName} has updated ${updateType} for ${childName}.`,
      senderName: updaterName,
      actionUrl: '/dashboard/children',
    });
  }, [sendNotification]);

  /**
   * Helper to send exchange reminder notification
   */
  const notifyExchangeReminder = useCallback(async (
    recipientProfileId: string,
    exchangeDate: string,
    exchangeTime?: string,
    location?: string
  ) => {
    let message = `You have a custody exchange coming up on ${exchangeDate}`;
    if (exchangeTime) message += ` at ${exchangeTime}`;
    if (location) message += ` at ${location}`;
    message += '.';

    return sendNotification({
      type: 'exchange_reminder',
      recipientProfileId,
      title: 'Upcoming Custody Exchange',
      message,
      actionUrl: '/dashboard/calendar',
    });
  }, [sendNotification]);

  return {
    sendNotification,
    showLocalNotification,
    notifyNewMessage,
    notifyScheduleChange,
    notifyScheduleResponse,
    notifyDocumentUpload,
    notifyChildUpdate,
    notifyExchangeReminder,
  };
};
