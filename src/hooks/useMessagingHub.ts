/**
 * useMessagingHub - Primary messaging hook for CoParrent
 * 
 * This is the AUTHORITATIVE messaging implementation. All new messaging
 * features should use this hook. It provides:
 * 
 * - Thread management (direct messages, group chats, family channel)
 * - Message fetching with read receipts
 * - Thread creation via edge function (bypasses RLS for secure creation)
 * - Realtime subscriptions for messages
 * 
 * Data Model:
 * - `message_threads` - Thread metadata (type, participants, primary_parent_id)
 * - `thread_messages` - Actual messages (content, sender, timestamps)
 * - `message_read_receipts` - Read status tracking
 * - `group_chat_participants` - Group membership for group_chat threads
 * 
 * Edge Functions:
 * - `create-message-thread` - Server-side thread creation with validation
 * 
 * @see useUnreadMessages for unread count tracking
 * @see useTypingIndicator for typing status
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useFamilyRole } from "./useFamilyRole";
import { useToast } from "./use-toast";
import { Database } from "@/integrations/supabase/types";
import { resolveDisplayName } from "@/lib/safeText";
import { logger } from "@/lib/logger";
import { 
  getMutationKey, 
  acquireMutationLock, 
  releaseMutationLock 
} from "@/lib/mutations";
import { ERROR_MESSAGES } from "@/lib/errorMessages";

type ThreadType = Database["public"]["Enums"]["thread_type"];

export interface ThreadMessage {
  id: string;
  thread_id: string;
  sender_id: string;
  sender_role: string;
  content: string;
  created_at: string;
  sender_name?: string;
  is_from_me: boolean;
  read_by?: ReadReceipt[];
}

export interface ReadReceipt {
  reader_id: string;
  reader_name: string;
  read_at: string;
}

export interface MessageThread {
  id: string;
  primary_parent_id: string;
  thread_type: ThreadType;
  participant_a_id: string | null;
  participant_b_id: string | null;
  name: string | null;
  created_at: string;
  other_participant?: {
    id: string;
    full_name: string | null;
    email: string | null;
    role?: string;
  };
  participants?: GroupParticipant[];
  last_message?: ThreadMessage;
  unread_count?: number;
}

export interface GroupParticipant {
  profile_id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
}

export interface FamilyMember {
  id: string;
  profile_id: string;
  full_name: string | null;
  email: string | null;
  role: string;
  avatar_url: string | null;
}

interface RelatedProfile {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
}

interface FamilyMemberRow {
  id: string;
  profile_id: string;
  role: string;
  profiles: RelatedProfile | null;
}

interface GroupParticipantRow {
  profile_id: string;
  profiles: RelatedProfile | null;
}

interface ReadReceiptRow {
  message_id: string;
  reader_id: string;
  read_at: string;
  profiles: Pick<RelatedProfile, "full_name" | "email"> | null;
}

type MessageReadReceiptRealtimeRow =
  Database["public"]["Tables"]["message_read_receipts"]["Row"];

export const useMessagingHub = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { profileId, primaryParentId, role, loading: roleLoading } = useFamilyRole();
  
  const [threads, setThreads] = useState<MessageThread[]>([]);
  const [groupChats, setGroupChats] = useState<MessageThread[]>([]);
  const [familyChannel, setFamilyChannel] = useState<MessageThread | null>(null);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [activeThread, setActiveThread] = useState<MessageThread | null>(null);
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch family members
  const fetchFamilyMembers = useCallback(async () => {
    if (!primaryParentId || !profileId) return;

    try {
      // Get parents (primary parent and co-parent)
      const { data: primaryProfile } = await supabase
        .from("profiles")
        .select("id, full_name, email, avatar_url, co_parent_id")
        .eq("id", primaryParentId)
        .single();

      const members: FamilyMember[] = [];

      if (primaryProfile) {
        members.push({
          id: primaryProfile.id,
          profile_id: primaryProfile.id,
          full_name: primaryProfile.full_name,
          email: primaryProfile.email,
          role: "parent",
          avatar_url: primaryProfile.avatar_url,
        });

        // Get co-parent
        if (primaryProfile.co_parent_id) {
          const { data: coParent } = await supabase
            .from("profiles")
            .select("id, full_name, email, avatar_url")
            .eq("id", primaryProfile.co_parent_id)
            .single();

          if (coParent) {
            members.push({
              id: coParent.id,
              profile_id: coParent.id,
              full_name: coParent.full_name,
              email: coParent.email,
              role: "parent",
              avatar_url: coParent.avatar_url,
            });
          }
        }
      }

      // Get third-party members
      const { data: thirdParties } = await supabase
        .from("family_members")
        .select(`
          id,
          profile_id,
          role,
          profiles!family_members_profile_id_fkey (
            id,
            full_name,
            email,
            avatar_url
          )
        `)
        .eq("primary_parent_id", primaryParentId)
        .eq("status", "active");

      if (thirdParties) {
        (thirdParties as FamilyMemberRow[]).forEach((tp) => {
          if (tp.profiles) {
            members.push({
              id: tp.id,
              profile_id: tp.profile_id,
              full_name: tp.profiles.full_name,
              email: tp.profiles.email,
              role: tp.role,
              avatar_url: tp.profiles.avatar_url,
            });
          }
        });
      }

      setFamilyMembers(members);
    } catch (error) {
      console.error("Error fetching family members:", error);
    }
  }, [primaryParentId, profileId]);

  // Fetch threads
  const fetchThreads = useCallback(async () => {
    if (!primaryParentId || !profileId) return;

    try {
      const { data: threadData, error } = await supabase
        .from("message_threads")
        .select("*")
        .eq("primary_parent_id", primaryParentId)
        .order("updated_at", { ascending: false });

      if (error) throw error;

      const dmThreads: MessageThread[] = [];
      const groupThreads: MessageThread[] = [];
      let channel: MessageThread | null = null;

      for (const thread of threadData || []) {
        if (thread.thread_type === "family_channel") {
          channel = thread;
        } else if (thread.thread_type === "group_chat") {
          // Fetch group participants
          const { data: participants } = await supabase
            .from("group_chat_participants")
            .select(`
              profile_id,
              profiles!group_chat_participants_profile_id_fkey (
                id,
                full_name,
                email,
                avatar_url
              )
            `)
            .eq("thread_id", thread.id);

          const isParticipant = participants?.some(p => p.profile_id === profileId);
          
          if (isParticipant) {
            groupThreads.push({
              ...thread,
              participants: ((participants as GroupParticipantRow[] | null) ?? []).map((p) => ({
                profile_id: p.profile_id,
                full_name: p.profiles?.full_name,
                email: p.profiles?.email,
                avatar_url: p.profiles?.avatar_url,
              })) || [],
            });
          }
        } else if (thread.thread_type === "direct_message") {
          // For DMs, only include if user is a participant
          if (thread.participant_a_id === profileId || thread.participant_b_id === profileId) {
            const otherParticipantId = 
              thread.participant_a_id === profileId 
                ? thread.participant_b_id 
                : thread.participant_a_id;

            if (otherParticipantId) {
              const { data: otherProfile } = await supabase
                .from("profiles")
                .select("id, full_name, email")
                .eq("id", otherParticipantId)
                .single();

              dmThreads.push({
                ...thread,
                other_participant: otherProfile || undefined,
              });
            }
          }
        }
      }

      setFamilyChannel(channel);
      setThreads(dmThreads);
      setGroupChats(groupThreads);
    } catch (error) {
      console.error("Error fetching threads:", error);
    }
  }, [primaryParentId, profileId]);

  // Fetch messages for active thread with read receipts
  const fetchMessages = useCallback(async (threadId: string) => {
    if (!profileId) return;

    try {
      const { data, error } = await supabase
        .from("thread_messages")
        .select("*")
        .eq("thread_id", threadId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      // Fetch sender names
      const senderIds = [...new Set((data || []).map(m => m.sender_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", senderIds);

      const profileMap = new Map(
        (profiles || []).map(p => [p.id, resolveDisplayName({ primary: p.full_name, fallback: "Family member" })])
      );

      // Fetch read receipts
      const messageIds = (data || []).map(m => m.id);
      const { data: receipts } = await supabase
        .from("message_read_receipts")
        .select(`
          message_id,
          reader_id,
          read_at,
          profiles!message_read_receipts_reader_id_fkey (
            full_name,
            email
          )
        `)
        .in("message_id", messageIds);

      const receiptsByMessage = new Map<string, ReadReceipt[]>();
      ((receipts as ReadReceiptRow[] | null) ?? []).forEach((r) => {
        const list = receiptsByMessage.get(r.message_id) || [];
        list.push({
          reader_id: r.reader_id,
          reader_name: resolveDisplayName({ primary: r.profiles?.full_name, fallback: "Family member" }),
          read_at: r.read_at,
        });
        receiptsByMessage.set(r.message_id, list);
      });

      const formattedMessages: ThreadMessage[] = (data || []).map(msg => ({
        ...msg,
        sender_name: profileMap.get(msg.sender_id) || "Family member",
        is_from_me: msg.sender_id === profileId,
        read_by: receiptsByMessage.get(msg.id) || [],
      }));

      setMessages(formattedMessages);

      // Mark messages as read
      const unreadMessages = (data || []).filter(m => 
        m.sender_id !== profileId
      );
      
      for (const msg of unreadMessages) {
        await supabase
          .from("message_read_receipts")
          .upsert({
            message_id: msg.id,
            reader_id: profileId,
          }, { onConflict: "message_id,reader_id" });
      }
    } catch (error) {
      console.error("Error fetching messages:", error);
    }
  }, [profileId]);

  // Send message with double-submit protection
  const sendMessage = async (content: string) => {
    if (!activeThread || !profileId || !role) {
      toast({
        title: "Cannot send message",
        description: "Please select a conversation first",
        variant: "destructive",
      });
      return false;
    }

    // Guard against double-submits using content hash
    const contentHash = content.slice(0, 50);
    const mutationKey = getMutationKey("sendMessage", activeThread.id, contentHash);
    if (!acquireMutationLock(mutationKey)) {
      // Silent block for rapid message sends
      return false;
    }

    try {
      const { error } = await supabase.from("thread_messages").insert({
        thread_id: activeThread.id,
        sender_id: profileId,
        sender_role: role,
        content,
      });

      if (error) throw error;
      return true;
    } catch (error) {
      console.error("Error sending message:", error);
      toast({
        title: "Error",
        description: ERROR_MESSAGES.MESSAGE_FAILED,
        variant: "destructive",
      });
      return false;
    } finally {
      releaseMutationLock(mutationKey);
    }
  };

  // Create or get DM thread via edge function
  const getOrCreateDMThread = async (otherProfileId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("create-message-thread", {
        body: {
          thread_type: "direct_message",
          other_profile_id: otherProfileId,
        },
      });

      if (error) {
        console.error("Error creating DM thread:", error);
        toast({
          title: "Error",
          description: "Failed to start conversation",
          variant: "destructive",
        });
        return null;
      }

      if (!data?.success) {
        console.error("Failed to create DM thread:", data?.error);
        toast({
          title: "Error",
          description: data?.error || "Failed to start conversation",
          variant: "destructive",
        });
        return null;
      }

      await fetchThreads();
      return data.thread;
    } catch (error) {
      console.error("Error creating DM thread:", error);
      toast({
        title: "Error",
        description: "Failed to start conversation",
        variant: "destructive",
      });
      return null;
    }
  };

  // Create group chat via edge function
  const createGroupChat = async (name: string, participantIds: string[]) => {
    try {
      const { data, error } = await supabase.functions.invoke("create-message-thread", {
        body: {
          thread_type: "group_chat",
          participant_ids: participantIds,
          group_name: name,
        },
      });

      if (error) {
        console.error("Error creating group chat:", error);
        toast({
          title: "Error",
          description: "Failed to create group chat",
          variant: "destructive",
        });
        return null;
      }

      if (!data?.success) {
        console.error("Failed to create group chat:", data?.error);
        toast({
          title: "Error",
          description: data?.error || "Failed to create group chat",
          variant: "destructive",
        });
        return null;
      }

      await fetchThreads();
      return data.thread;
    } catch (error) {
      console.error("Error creating group chat:", error);
      toast({
        title: "Error",
        description: "Failed to create group chat",
        variant: "destructive",
      });
      return null;
    }
  };

  // Create family channel via edge function
  const ensureFamilyChannel = async () => {
    if (familyChannel) return familyChannel;

    try {
      const { data, error } = await supabase.functions.invoke("create-message-thread", {
        body: {
          thread_type: "family_channel",
        },
      });

      if (error) {
        console.error("Error creating family channel:", error);
        return null;
      }

      if (!data?.success) {
        console.error("Failed to create family channel:", data?.error);
        return null;
      }

      setFamilyChannel(data.thread);
      return data.thread;
    } catch (error) {
      console.error("Error creating family channel:", error);
      return null;
    }
  };

  // Initialize
  useEffect(() => {
    const initialize = async () => {
      if (roleLoading || !primaryParentId) return;
      
      setLoading(true);
      await Promise.all([fetchFamilyMembers(), fetchThreads()]);
      setLoading(false);
    };

    initialize();
  }, [roleLoading, primaryParentId, fetchFamilyMembers, fetchThreads]);

  // Fetch messages when active thread changes
  useEffect(() => {
    if (activeThread) {
      fetchMessages(activeThread.id);
    }
  }, [activeThread, fetchMessages]);

  // Subscribe to realtime updates for messages
  useEffect(() => {
    if (!activeThread) return;

    const channel = supabase
      .channel(`thread-messages-${activeThread.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "thread_messages",
          filter: `thread_id=eq.${activeThread.id}`,
        },
        async (payload) => {
          const newMsg = payload.new as ThreadMessage;
          
          // Fetch sender name
          const { data: senderProfile } = await supabase
            .from("profiles")
            .select("full_name, email")
            .eq("id", newMsg.sender_id)
            .single();

          setMessages(prev => [
            ...prev,
            {
              ...newMsg,
              sender_name: resolveDisplayName({
                primary: senderProfile?.full_name,
                secondary: null,
                fallback: "Family member",
              }),
              is_from_me: newMsg.sender_id === profileId,
              read_by: [],
            },
          ]);

          // Mark as read if not from me
          if (newMsg.sender_id !== profileId && profileId) {
            await supabase
              .from("message_read_receipts")
              .upsert({
                message_id: newMsg.id,
                reader_id: profileId,
              }, { onConflict: "message_id,reader_id" });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeThread, profileId]);

  // Subscribe to realtime updates for read receipts
  useEffect(() => {
    if (!activeThread) return;

    const channel = supabase
      .channel(`read-receipts-${activeThread.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "message_read_receipts",
        },
        async (payload) => {
          const receipt = payload.new as MessageReadReceiptRealtimeRow;
          
          // Check if this receipt is for a message in our active thread
          const messageExists = messages.some(m => m.id === receipt.message_id);
          if (!messageExists) return;

          // Fetch reader name
          const { data: readerProfile } = await supabase
            .from("profiles")
            .select("full_name, email")
            .eq("id", receipt.reader_id)
            .single();

          setMessages(prev => prev.map(msg => {
            if (msg.id === receipt.message_id) {
              const existingReceipts = msg.read_by || [];
              if (existingReceipts.some(r => r.reader_id === receipt.reader_id)) {
                return msg;
              }
              return {
                ...msg,
                read_by: [
                  ...existingReceipts,
                  {
                    reader_id: receipt.reader_id,
                    reader_name: resolveDisplayName({
                      primary: readerProfile?.full_name,
                      secondary: null,
                      fallback: "Family member",
                    }),
                    read_at: receipt.read_at,
                  },
                ],
              };
            }
            return msg;
          }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeThread, messages, profileId]);

  return {
    threads,
    groupChats,
    familyChannel,
    familyMembers,
    activeThread,
    messages,
    loading,
    role,
    profileId,
    setActiveThread,
    sendMessage,
    getOrCreateDMThread,
    createGroupChat,
    ensureFamilyChannel,
    fetchThreads,
  };
};
