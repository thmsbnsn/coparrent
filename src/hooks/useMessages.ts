/**
 * @deprecated LEGACY HOOK - Use useMessagingHub instead
 * 
 * This hook uses the old `messages` table for 1:1 co-parent messaging.
 * The modern messaging system uses `thread_messages` with support for:
 * - Direct messages (1:1)
 * - Group chats
 * - Family channel
 * 
 * This file is retained for backward compatibility with MessagesPage.tsx
 * but should not be used for new features. See useMessagingHub.ts for
 * the authoritative messaging implementation.
 * 
 * Migration note: The old `messages` table remains in the database
 * for historical data access. New messages go to `thread_messages`.
 */
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useNotificationService } from "@/hooks/useNotificationService";

export interface Message {
  id: string;
  content: string;
  sender_id: string;
  recipient_id: string;
  created_at: string;
  read_at: string | null;
  sender_name?: string;
  is_from_me: boolean;
}

export interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
}

export const useMessages = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { notifyNewMessage, showLocalNotification } = useNotificationService();
  const [messages, setMessages] = useState<Message[]>([]);
  const [coParent, setCoParent] = useState<Profile | null>(null);
  const [userProfile, setUserProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch user's profile and co-parent
  useEffect(() => {
    const fetchProfiles = async () => {
      if (!user) return;

      // Get current user's profile
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (profileError) {
        console.error("Error fetching profile:", profileError);
        return;
      }

      if (profile) {
        setUserProfile(profile);

        // Get co-parent profile if linked
        if (profile.co_parent_id) {
          const { data: coParentData, error: coParentError } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", profile.co_parent_id)
            .maybeSingle();

          if (coParentError) {
            console.error("Error fetching co-parent:", coParentError);
          } else {
            setCoParent(coParentData);
          }
        }
      }
    };

    fetchProfiles();
  }, [user]);

  // Fetch messages
  useEffect(() => {
    const fetchMessages = async () => {
      if (!userProfile) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .or(`sender_id.eq.${userProfile.id},recipient_id.eq.${userProfile.id}`)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Error fetching messages:", error);
        toast({
          title: "Error",
          description: "Failed to load messages",
          variant: "destructive",
        });
      } else {
        const formattedMessages: Message[] = (data || []).map((msg) => ({
          ...msg,
          is_from_me: msg.sender_id === userProfile.id,
        }));
        setMessages(formattedMessages);
      }
      setLoading(false);
    };

    fetchMessages();

    // Subscribe to realtime updates
    if (userProfile) {
      const channel = supabase
        .channel("messages-changes")
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
          },
          async (payload) => {
            const newMsg = payload.new as Message;
            if (
              newMsg.sender_id === userProfile.id ||
              newMsg.recipient_id === userProfile.id
            ) {
              setMessages((prev) => [
                ...prev,
                { ...newMsg, is_from_me: newMsg.sender_id === userProfile.id },
              ]);

              // Show local notification for incoming messages
              if (newMsg.recipient_id === userProfile.id) {
                const senderName = coParent?.full_name || "Your co-parent";
                await showLocalNotification(
                  `New message from ${senderName}`,
                  newMsg.content.length > 50 
                    ? `${newMsg.content.substring(0, 50)}...` 
                    : newMsg.content
                );
              }
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [userProfile, coParent, toast, showLocalNotification]);

  const sendMessage = async (content: string) => {
    if (!userProfile || !coParent) {
      toast({
        title: "Cannot send message",
        description: "You need to connect with a co-parent first",
        variant: "destructive",
      });
      return false;
    }

    const { error } = await supabase.from("messages").insert({
      content,
      sender_id: userProfile.id,
      recipient_id: coParent.id,
    });

    if (error) {
      console.error("Error sending message:", error);
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive",
      });
      return false;
    }

    // Send notification to co-parent
    const senderName = userProfile.full_name || "Your co-parent";
    await notifyNewMessage(coParent.id, senderName, content);

    return true;
  };

  const markAsRead = async (messageId: string) => {
    await supabase
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .eq("id", messageId);
  };

  return {
    messages,
    coParent,
    userProfile,
    loading,
    sendMessage,
    markAsRead,
  };
};
