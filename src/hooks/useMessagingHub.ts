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
type ThreadMessageRow = Database["public"]["Tables"]["thread_messages"]["Row"];
type MessageThreadRow = Database["public"]["Tables"]["message_threads"]["Row"];

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
  attachments?: MessageAttachment[];
}

export interface MessageAttachment {
  attachment_type: "document" | "image" | "video";
  document_id: string | null;
  file_name: string;
  file_path: string;
  file_type: string;
  id: string;
  media_asset_id: string | null;
  message_id: string;
  preview_url?: string | null;
  title: string;
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
  relationship_label: string | null;
  role: string;
  profiles: RelatedProfile | null;
}

interface CallableFamilyMemberRow {
  avatar_url?: string | null;
  email?: string | null;
  full_name?: string | null;
  id?: string;
  membership_id?: string;
  profile_id: string;
  profiles?: RelatedProfile | null;
  relationship_label: string | null;
  role: string;
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

interface MessageAttachmentRow {
  attachment_type: "document" | "image" | "video";
  document_id: string | null;
  documents: {
    file_name: string;
    file_path: string;
    file_type: string;
    id: string;
    title: string;
  } | null;
  family_media_assets: {
    file_name: string;
    file_path: string;
    file_type: string;
    id: string;
  } | null;
  id: string;
  media_asset_id: string | null;
  message_id: string;
}

interface CallSessionThreadRow {
  answered_at: string | null;
  call_type: Database["public"]["Enums"]["call_type"];
  callee_display_name: string | null;
  callee_profile_id: string;
  created_at: string;
  id: string;
  initiator_display_name: string | null;
  initiator_profile_id: string;
  status: Database["public"]["Enums"]["call_status"];
}

interface CallEventThreadRow {
  actor_display_name: string | null;
  actor_profile_id: string | null;
  call_session_id: string;
  created_at: string;
  event_type: Database["public"]["Enums"]["call_event_type"];
  id: string;
}

export interface ThreadSystemEvent {
  actorId: string | null;
  actorName: string | null;
  callType?: Database["public"]["Enums"]["call_type"] | null;
  eventType:
    | "call_answered"
    | "call_attempt"
    | "call_declined"
    | "call_missed"
    | "conversation_started";
  id: string;
  note: string;
  timestamp: string;
  type: "system";
}

const formatRelationshipLabel = (relationshipLabel: string | null, role: string) => {
  const cleaned = relationshipLabel?.trim();
  if (cleaned) {
    return cleaned
      .split(/[_\-\s]+/)
      .filter(Boolean)
      .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join(" ");
  }

  switch (role) {
    case "guardian":
      return "Guardian";
    case "third_party":
      return "Third-Party Member";
    case "child":
      return "Child";
    default:
      return "Parent";
  }
};

type MessageReadReceiptRealtimeRow =
  Database["public"]["Tables"]["message_read_receipts"]["Row"];

const getThreadActivityTimestamp = (thread: MessageThread) =>
  thread.last_message?.created_at ?? thread.created_at;

const sortThreadsByActivity = (threadList: MessageThread[]) =>
  [...threadList].sort(
    (a, b) =>
      new Date(getThreadActivityTimestamp(b)).getTime() -
      new Date(getThreadActivityTimestamp(a)).getTime(),
  );

export const useMessagingHub = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { activeFamilyId, profileId, primaryParentId, role, loading: roleLoading } = useFamilyRole();
  
  const [threads, setThreads] = useState<MessageThread[]>([]);
  const [groupChats, setGroupChats] = useState<MessageThread[]>([]);
  const [familyChannel, setFamilyChannel] = useState<MessageThread | null>(null);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const familyMembersRef = useRef<FamilyMember[]>([]);
  const [activeThread, setActiveThread] = useState<MessageThread | null>(null);
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [systemEvents, setSystemEvents] = useState<ThreadSystemEvent[]>([]);
  const [activeThreadLoading, setActiveThreadLoading] = useState(false);
  const [activeThreadLoadError, setActiveThreadLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [setupError, setSetupError] = useState<string | null>(null);

  useEffect(() => {
    familyMembersRef.current = familyMembers;
  }, [familyMembers]);

  const findExistingFamilyChannel = useCallback(async () => {
    if (!activeFamilyId && !primaryParentId) return null;

    if (activeFamilyId) {
      const { data, error } = await supabase
        .from("message_threads")
        .select("*")
        .eq("family_id", activeFamilyId)
        .eq("thread_type", "family_channel")
        .maybeSingle();

      if (error) throw error;
      if (data) return data;
    }

    if (!primaryParentId) return null;

    const { data, error } = await supabase
      .from("message_threads")
      .select("*")
      .is("family_id", null)
      .eq("primary_parent_id", primaryParentId)
      .eq("thread_type", "family_channel")
      .maybeSingle();

    if (error) throw error;
    return data;
  }, [activeFamilyId, primaryParentId]);

  const findExistingDirectMessage = useCallback(async (otherProfileId: string) => {
    if ((!activeFamilyId && !primaryParentId) || !profileId) return null;

    const [participantA, participantB] =
      profileId < otherProfileId
        ? [profileId, otherProfileId]
        : [otherProfileId, profileId];

    if (activeFamilyId) {
      const { data, error } = await supabase
        .from("message_threads")
        .select("*")
        .eq("family_id", activeFamilyId)
        .eq("thread_type", "direct_message")
        .eq("participant_a_id", participantA)
        .eq("participant_b_id", participantB)
        .maybeSingle();

      if (error) throw error;
      if (data) return data;
    }

    if (!primaryParentId) return null;

    const { data, error } = await supabase
      .from("message_threads")
      .select("*")
      .is("family_id", null)
      .eq("primary_parent_id", primaryParentId)
      .eq("thread_type", "direct_message")
      .eq("participant_a_id", participantA)
      .eq("participant_b_id", participantB)
      .maybeSingle();

    if (error) throw error;
    return data;
  }, [activeFamilyId, primaryParentId, profileId]);

  const fallbackEnsureFamilyChannel = useCallback(async () => {
    if (!activeFamilyId || !primaryParentId) return null;

    const existingChannel = await findExistingFamilyChannel();
    if (existingChannel) return existingChannel;

    const { data, error } = await supabase
      .from("message_threads")
      .insert({
        family_id: activeFamilyId,
        primary_parent_id: primaryParentId,
        thread_type: "family_channel",
        name: "Family Chat",
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return await findExistingFamilyChannel();
      }
      throw error;
    }

    return data;
  }, [activeFamilyId, findExistingFamilyChannel, primaryParentId]);

  const fallbackGetOrCreateDMThread = useCallback(async (otherProfileId: string) => {
    if (!activeFamilyId || !primaryParentId || !profileId) return null;

    const existingThread = await findExistingDirectMessage(otherProfileId);
    if (existingThread) return existingThread;

    const [participantA, participantB] =
      profileId < otherProfileId
        ? [profileId, otherProfileId]
        : [otherProfileId, profileId];

    const { data, error } = await supabase
      .from("message_threads")
      .insert({
        family_id: activeFamilyId,
        primary_parent_id: primaryParentId,
        thread_type: "direct_message",
        participant_a_id: participantA,
        participant_b_id: participantB,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return await findExistingDirectMessage(otherProfileId);
      }
      throw error;
    }

    return data;
  }, [activeFamilyId, findExistingDirectMessage, primaryParentId, profileId]);

  // Fetch family members
  const fetchFamilyMembers = useCallback(async () => {
    if (!activeFamilyId || !profileId) {
      setFamilyMembers([]);
      return [] as FamilyMember[];
    }

    try {
      const { data: selfMembership, error: selfMembershipError } = await supabase
        .from("family_members")
        .select(`
          id,
          profile_id,
          relationship_label,
          role,
          profiles!family_members_profile_id_fkey (
            id,
            full_name,
            email,
            avatar_url
          )
        `)
        .eq("family_id", activeFamilyId)
        .eq("profile_id", profileId)
        .eq("status", "active")
        .maybeSingle();

      if (selfMembershipError) {
        throw selfMembershipError;
      }

      const { data: callableMembers, error: callableMembersError } = await supabase
        .rpc("get_callable_family_members", {
          p_family_id: activeFamilyId,
        })
        .returns<CallableFamilyMemberRow[]>();

      let visibleMembers = (callableMembers as CallableFamilyMemberRow[] | null) ?? [];

      if (callableMembersError) {
        console.warn("Callable family member lookup failed, falling back to direct membership query:", callableMembersError);

        const fallbackResult = await supabase
          .from("family_members")
          .select(`
            id,
            profile_id,
            relationship_label,
            role,
            profiles!family_members_profile_id_fkey (
              id,
              full_name,
              email,
              avatar_url
            )
          `)
          .eq("family_id", activeFamilyId)
          .eq("status", "active")
          .neq("profile_id", profileId);

        if (fallbackResult.error) {
          throw fallbackResult.error;
        }

        visibleMembers = (fallbackResult.data as CallableFamilyMemberRow[] | null) ?? [];
      }

      const membersByProfileId = new Map<string, FamilyMember>();
      const upsertMember = (member: CallableFamilyMemberRow | FamilyMemberRow | null) => {
        if (!member || member.role === "child") {
          return;
        }

        membersByProfileId.set(member.profile_id, {
          id: "membership_id" in member && member.membership_id ? member.membership_id : member.id,
          profile_id: member.profile_id,
          full_name:
            ("full_name" in member ? member.full_name : null) ??
            member.profiles?.full_name ??
            formatRelationshipLabel(member.relationship_label, member.role),
          email:
            ("email" in member ? member.email : null) ??
            member.profiles?.email ??
            null,
          role: member.role,
          avatar_url:
            ("avatar_url" in member ? member.avatar_url : null) ??
            member.profiles?.avatar_url ??
            null,
        });
      };

      upsertMember(selfMembership as FamilyMemberRow | null);
      visibleMembers.forEach(upsertMember);

      const members = Array.from(membersByProfileId.values())
        .sort((left, right) =>
          resolveDisplayName({
            primary: left.full_name,
            secondary: left.email,
            fallback: "Family member",
          }).localeCompare(
            resolveDisplayName({
              primary: right.full_name,
              secondary: right.email,
              fallback: "Family member",
            }),
          ),
        );

      setFamilyMembers(members);
      return members;
    } catch (error) {
      console.error("Error fetching family members:", error);
      setFamilyMembers([]);
      return [] as FamilyMember[];
    }
  }, [activeFamilyId, profileId]);

  const buildLastMessageMap = useCallback(async (threadIds: string[]) => {
    const uniqueThreadIds = [...new Set(threadIds)];
    const lastMessageMap = new Map<string, ThreadMessage>();

    if (uniqueThreadIds.length === 0) {
      return lastMessageMap;
    }

    const { data: recentMessages, error: recentMessagesError } = await supabase
      .from("thread_messages")
      .select("id, thread_id, sender_id, sender_role, content, created_at")
      .in("thread_id", uniqueThreadIds)
      .order("created_at", { ascending: false });

    if (recentMessagesError) {
      throw recentMessagesError;
    }

    const latestByThread = new Map<string, ThreadMessageRow>();
    for (const message of recentMessages || []) {
      if (!latestByThread.has(message.thread_id)) {
        latestByThread.set(message.thread_id, message);
      }
    }

    const senderIds = [...new Set(Array.from(latestByThread.values()).map((message) => message.sender_id))];
    const senderNames = new Map<string, string>();

    if (senderIds.length > 0) {
      const { data: senderProfiles, error: senderProfilesError } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", senderIds);

      if (senderProfilesError) {
        throw senderProfilesError;
      }

      for (const profile of senderProfiles || []) {
        senderNames.set(
          profile.id,
          resolveDisplayName({ primary: profile.full_name, fallback: "Family member" }),
        );
      }
    }

    latestByThread.forEach((message, threadId) => {
      lastMessageMap.set(threadId, {
        ...message,
        sender_name: senderNames.get(message.sender_id) || "Family member",
        is_from_me: message.sender_id === profileId,
        read_by: [],
      });
    });

    return lastMessageMap;
  }, [profileId]);

  // Fetch threads
  const fetchThreads = useCallback(async (visibleFamilyMembers?: FamilyMember[]) => {
    if ((!activeFamilyId && !primaryParentId) || !profileId) {
      setFamilyChannel(null);
      setThreads([]);
      setGroupChats([]);
      setActiveThread(null);
      setMessages([]);
      setSystemEvents([]);
      setActiveThreadLoading(false);
      setActiveThreadLoadError(null);
      return;
    }

    try {
      const memberDirectory = visibleFamilyMembers ?? familyMembersRef.current;
      const scopedThreadMap = new Map<string, MessageThreadRow>();

      if (activeFamilyId) {
        const { data: familyThreads, error: familyThreadsError } = await supabase
          .from("message_threads")
          .select("*")
          .eq("family_id", activeFamilyId)
          .order("updated_at", { ascending: false });

        if (familyThreadsError) throw familyThreadsError;

        (familyThreads as MessageThreadRow[] | null)?.forEach((thread) => {
          scopedThreadMap.set(thread.id, thread);
        });
      }

      if (primaryParentId) {
        const { data: legacyThreads, error: legacyThreadsError } = await supabase
          .from("message_threads")
          .select("*")
          .is("family_id", null)
          .eq("primary_parent_id", primaryParentId)
          .order("updated_at", { ascending: false });

        if (legacyThreadsError) throw legacyThreadsError;

        (legacyThreads as MessageThreadRow[] | null)?.forEach((thread) => {
          scopedThreadMap.set(thread.id, thread);
        });
      }

      const threadData = Array.from(scopedThreadMap.values()).sort(
        (left, right) =>
          new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime(),
      );

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
              const knownMember = memberDirectory.find(
                (member) => member.profile_id === otherParticipantId,
              );

              if (knownMember) {
                dmThreads.push({
                  ...thread,
                  other_participant: {
                    id: knownMember.profile_id,
                    full_name: knownMember.full_name,
                    email: knownMember.email,
                    role: knownMember.role,
                  },
                });
                continue;
              }

              const { data: otherProfile } = await supabase
                .from("profiles")
                .select("id, full_name, email")
                .eq("id", otherParticipantId)
                .maybeSingle();

              if (otherProfile) {
                dmThreads.push({
                  ...thread,
                  other_participant: otherProfile || undefined,
                });
              }
            }
          }
        }
      }

      const allKnownThreads = channel
        ? [...dmThreads, ...groupThreads, channel]
        : [...dmThreads, ...groupThreads];
      const lastMessageMap = await buildLastMessageMap(allKnownThreads.map((thread) => thread.id));
      const hydrateThread = (thread: MessageThread) => ({
        ...thread,
        last_message: lastMessageMap.get(thread.id),
      });

      const hydratedFamilyChannel = channel ? hydrateThread(channel) : null;
      const hydratedThreads = sortThreadsByActivity(dmThreads.map(hydrateThread));
      const hydratedGroupChats = sortThreadsByActivity(groupThreads.map(hydrateThread));
      const hydratedById = new Map<string, MessageThread>();

      if (hydratedFamilyChannel) {
        hydratedById.set(hydratedFamilyChannel.id, hydratedFamilyChannel);
      }
      hydratedThreads.forEach((thread) => hydratedById.set(thread.id, thread));
      hydratedGroupChats.forEach((thread) => hydratedById.set(thread.id, thread));

      setFamilyChannel(hydratedFamilyChannel);
      setThreads(hydratedThreads);
      setGroupChats(hydratedGroupChats);
      setActiveThread((current) => {
        if (current?.id && hydratedById.has(current.id)) {
          return hydratedById.get(current.id) ?? current;
        }

        return hydratedFamilyChannel ?? hydratedThreads[0] ?? hydratedGroupChats[0] ?? null;
      });
      if (hydratedFamilyChannel) {
        setSetupError(null);
      }
    } catch (error) {
      console.error("Error fetching threads:", error);
    }
  }, [activeFamilyId, buildLastMessageMap, primaryParentId, profileId]);

  const applyThreadPreviewUpdate = useCallback(
    (threadId: string, lastMessage: ThreadMessage) => {
      const isKnownThread =
        familyChannel?.id === threadId ||
        threads.some((thread) => thread.id === threadId) ||
        groupChats.some((thread) => thread.id === threadId);

      if (!isKnownThread) {
        void fetchThreads();
        return;
      }

      setFamilyChannel((current) =>
        current?.id === threadId
          ? {
              ...current,
              last_message: lastMessage,
            }
          : current,
      );

      setThreads((current) =>
        sortThreadsByActivity(
          current.map((thread) =>
            thread.id === threadId
              ? {
                  ...thread,
                  last_message: lastMessage,
                }
              : thread,
          ),
        ),
      );

      setGroupChats((current) =>
        sortThreadsByActivity(
          current.map((thread) =>
            thread.id === threadId
              ? {
                  ...thread,
                  last_message: lastMessage,
                }
              : thread,
          ),
        ),
      );

      setActiveThread((current) =>
        current?.id === threadId
          ? {
              ...current,
              last_message: lastMessage,
            }
          : current,
      );
    },
    [familyChannel?.id, fetchThreads, groupChats, threads],
  );

  const markMessagesRead = useCallback(
    async (messageIds: string[]) => {
      if (!profileId || messageIds.length === 0) {
        return;
      }

      const uniqueMessageIds = [...new Set(messageIds)];
      const payload = uniqueMessageIds.map((messageId) => ({
        message_id: messageId,
        reader_id: profileId,
      }));

      const { error } = await supabase
        .from("message_read_receipts")
        .upsert(payload, {
          ignoreDuplicates: true,
          onConflict: "message_id,reader_id",
        });

      if (!error) {
        return;
      }

      if (error.code === "23505" || error.code === "23503") {
        return;
      }

      logger.warn("Unable to create message read receipts", {
        code: error.code,
        details: error.details,
        hint: error.hint,
        message: error.message,
        messageIds: uniqueMessageIds,
        profileId,
      });
    },
    [profileId],
  );

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

      const messageIds = (data || []).map(m => m.id);
      const attachmentRows =
        messageIds.length > 0
          ? (
              await supabase
                .from("message_attachments")
                .select(`
                  attachment_type,
                  document_id,
                  documents (
                    file_name,
                    file_path,
                    file_type,
                    id,
                    title
                  ),
                  family_media_assets (
                    file_name,
                    file_path,
                    file_type,
                    id
                  ),
                  id,
                  media_asset_id,
                  message_id
                `)
                .in("message_id", messageIds)
            ).data
          : [];

      const attachmentPreviewCache = new Map<string, string | null>();
      const resolvedAttachments = await Promise.all(
        ((attachmentRows as MessageAttachmentRow[] | null) ?? []).map(async (attachment) => {
          const documentRecord = attachment.documents;
          const mediaRecord = attachment.family_media_assets;
          const assetRecord = documentRecord ?? mediaRecord;
          const storageBucket = documentRecord ? "documents" : mediaRecord ? "family-media" : null;

          if (!assetRecord || !storageBucket) {
            return null;
          }

          const assetCacheKey = `${storageBucket}:${assetRecord.id}`;
          let previewUrl = attachmentPreviewCache.get(assetCacheKey);
          if (previewUrl === undefined) {
            const { data: previewData, error: previewError } = await supabase.storage
              .from(storageBucket)
              .createSignedUrl(assetRecord.file_path, 60 * 60);

            previewUrl = previewError ? null : previewData?.signedUrl ?? null;
            attachmentPreviewCache.set(assetCacheKey, previewUrl);
          }

          return {
            attachment_type: attachment.attachment_type,
            document_id: documentRecord?.id ?? null,
            file_name: assetRecord.file_name,
            file_path: assetRecord.file_path,
            file_type: assetRecord.file_type,
            id: attachment.id,
            media_asset_id: mediaRecord?.id ?? null,
            message_id: attachment.message_id,
            preview_url: previewUrl,
            title: documentRecord?.title ?? mediaRecord?.file_name ?? assetRecord.file_name,
          } satisfies MessageAttachment;
        }),
      );

      const attachmentsByMessage = new Map<string, MessageAttachment[]>();
      resolvedAttachments.filter(Boolean).forEach((attachment) => {
        const existing = attachmentsByMessage.get(attachment!.message_id) ?? [];
        existing.push(attachment!);
        attachmentsByMessage.set(attachment!.message_id, existing);
      });

      const receipts =
        messageIds.length > 0
          ? (
              await supabase
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
                .in("message_id", messageIds)
            ).data
          : [];

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
        attachments: attachmentsByMessage.get(msg.id) ?? [],
        sender_name: profileMap.get(msg.sender_id) || "Family member",
        is_from_me: msg.sender_id === profileId,
        read_by: receiptsByMessage.get(msg.id) || [],
      }));

      setMessages(formattedMessages);

      // Mark messages as read
      const unreadMessageIds = (data || [])
        .filter((message) => {
          if (message.sender_id === profileId) {
            return false;
          }

          return !receiptsByMessage
            .get(message.id)
            ?.some((receipt) => receipt.reader_id === profileId);
        })
        .map((message) => message.id);

      await markMessagesRead(unreadMessageIds);
    } catch (error) {
      console.error("Error fetching messages:", error);
      throw error;
    }
  }, [markMessagesRead, profileId]);

  const fetchSystemEvents = useCallback(async (thread: MessageThread) => {
    const conversationStartedEvent: ThreadSystemEvent = {
      actorId: null,
      actorName: null,
      eventType: "conversation_started",
      id: `conversation-started-${thread.id}`,
      note:
        thread.thread_type === "family_channel"
          ? "This family record is active and ready for documented communication."
          : thread.thread_type === "group_chat"
            ? "This group conversation is active and ready for documented communication."
            : "This direct conversation is active and ready for documented communication.",
      timestamp: thread.created_at,
      type: "system",
    };

    setSystemEvents([conversationStartedEvent]);

    try {
      const { data: sessions, error: sessionsError } = await supabase
        .from("call_sessions")
        .select(
          "id, created_at, answered_at, call_type, status, initiator_profile_id, initiator_display_name, callee_profile_id, callee_display_name",
        )
        .eq("thread_id", thread.id)
        .order("created_at", { ascending: true })
        .returns<CallSessionThreadRow[]>();

      if (sessionsError || !sessions || sessions.length === 0) {
        if (sessionsError) {
          console.error("Error fetching call sessions for thread:", sessionsError);
        }
        setSystemEvents([conversationStartedEvent]);
        return;
      }

      const sessionIds = sessions.map((session) => session.id);
      const callEventsBySession = new Map<string, CallEventThreadRow[]>();

      if (sessionIds.length > 0) {
        const { data: callEvents, error: callEventsError } = await supabase
          .from("call_events")
          .select("id, call_session_id, actor_profile_id, actor_display_name, event_type, created_at")
          .in("call_session_id", sessionIds)
          .in("event_type", ["accepted", "created", "declined", "missed", "ringing"])
          .order("created_at", { ascending: true })
          .returns<CallEventThreadRow[]>();

        if (callEventsError) {
          console.error("Error fetching call events for thread:", callEventsError);
        } else {
          (callEvents || []).forEach((event) => {
            const existing = callEventsBySession.get(event.call_session_id) || [];
            existing.push(event);
            callEventsBySession.set(event.call_session_id, existing);
          });
        }
      }

      const callTimeline: ThreadSystemEvent[] = sessions.flatMap((session) => {
        const sessionEvents = callEventsBySession.get(session.id) || [];
        const initialCallEvent =
          sessionEvents.find((event) => event.event_type === "created") ||
          sessionEvents.find((event) => event.event_type === "ringing");
        const acceptedEvent = sessionEvents.find((event) => event.event_type === "accepted");
        const declinedEvent = sessionEvents.find((event) => event.event_type === "declined");
        const missedEvent = sessionEvents.find((event) => event.event_type === "missed");

        const timeline: ThreadSystemEvent[] = [
          {
            actorId: initialCallEvent?.actor_profile_id ?? session.initiator_profile_id,
            actorName:
              initialCallEvent?.actor_display_name ??
              session.initiator_display_name ??
              "Family member",
            callType: session.call_type,
            eventType: "call_attempt",
            id: `call-attempt-${session.id}`,
            note: `${session.call_type === "video" ? "Video" : "Audio"} call started.`,
            timestamp: initialCallEvent?.created_at ?? session.created_at,
            type: "system",
          },
        ];

        if (acceptedEvent || session.status === "accepted" || session.status === "ended") {
          timeline.push({
            actorId: acceptedEvent?.actor_profile_id ?? session.callee_profile_id,
            actorName:
              acceptedEvent?.actor_display_name ??
              session.callee_display_name ??
              "Family member",
            callType: session.call_type,
            eventType: "call_answered",
            id: `call-answered-${session.id}`,
            note: `${session.call_type === "video" ? "Video" : "Audio"} call connected.`,
            timestamp: acceptedEvent?.created_at ?? session.answered_at ?? session.created_at,
            type: "system",
          });
        } else if (declinedEvent || session.status === "declined") {
          timeline.push({
            actorId: declinedEvent?.actor_profile_id ?? session.callee_profile_id,
            actorName:
              declinedEvent?.actor_display_name ??
              session.callee_display_name ??
              "Family member",
            callType: session.call_type,
            eventType: "call_declined",
            id: `call-declined-${session.id}`,
            note: "The call was declined.",
            timestamp: declinedEvent?.created_at ?? session.created_at,
            type: "system",
          });
        } else if (missedEvent || session.status === "missed") {
          timeline.push({
            actorId: missedEvent?.actor_profile_id ?? null,
            actorName: missedEvent?.actor_display_name ?? null,
            callType: session.call_type,
            eventType: "call_missed",
            id: `call-missed-${session.id}`,
            note: "No answer.",
            timestamp: missedEvent?.created_at ?? session.created_at,
            type: "system",
          });
        }

        return timeline;
      });

      setSystemEvents(
        [conversationStartedEvent, ...callTimeline].sort(
          (left, right) =>
            new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime(),
        ),
      );
    } catch (error) {
      console.error("Error fetching thread system events:", error);
      setSystemEvents([conversationStartedEvent]);
    }
  }, []);

  const refreshActiveThread = useCallback(async () => {
    if (!activeThread) {
      setMessages([]);
      setSystemEvents([]);
      setActiveThreadLoading(false);
      setActiveThreadLoadError(null);
      return;
    }

    setActiveThreadLoading(true);
    setActiveThreadLoadError(null);

    try {
      await Promise.all([
        fetchMessages(activeThread.id),
        fetchSystemEvents(activeThread),
      ]);
    } catch (error) {
      logger.warn("Unable to refresh active thread", error, {
        profileId,
        threadId: activeThread.id,
      });
      setMessages([]);
      setActiveThreadLoadError(
        "The recorded thread could not be loaded right now. Refresh before replying.",
      );
    } finally {
      setActiveThreadLoading(false);
    }
  }, [activeThread, fetchMessages, fetchSystemEvents, profileId]);

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
      const { data, error } = await supabase
        .from("thread_messages")
        .insert({
          thread_id: activeThread.id,
          sender_id: profileId,
          sender_role: role,
          content,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error("Error sending message:", error);
      toast({
        title: "Error",
        description: ERROR_MESSAGES.MESSAGE_FAILED,
        variant: "destructive",
      });
      return null;
    } finally {
      releaseMutationLock(mutationKey);
    }
  };

  // Create or get DM thread via edge function
  const getOrCreateDMThread = async (otherProfileId: string) => {
    const fallbackToClient = async () => {
      try {
        logger.warn("Falling back to client-side direct message thread creation", {
          activeFamilyId,
          profileId,
          otherProfileId,
        });
        const fallbackThread = await fallbackGetOrCreateDMThread(otherProfileId);
        if (!fallbackThread) return null;
        await fetchThreads();
        setSetupError(null);
        return fallbackThread;
      } catch (fallbackError) {
        logger.error("Direct message fallback failed", fallbackError, {
          activeFamilyId,
          profileId,
          otherProfileId,
        });
        toast({
          title: "Error",
          description: "Failed to start conversation",
          variant: "destructive",
        });
        return null;
      }
    };

    try {
      const { data, error } = await supabase.functions.invoke("create-message-thread", {
        body: {
          family_id: activeFamilyId,
          thread_type: "direct_message",
          other_profile_id: otherProfileId,
        },
      });

      if (error) {
        logger.warn("Edge function direct message creation failed; trying fallback", error, {
          activeFamilyId,
          profileId,
          otherProfileId,
        });
        return await fallbackToClient();
      }

      if (!data?.success) {
        logger.warn("Edge function direct message creation returned unsuccessful response", {
          activeFamilyId,
          profileId,
          otherProfileId,
          error: data?.error,
        });
        return await fallbackToClient();
      }

      await fetchThreads();
      setSetupError(null);
      return data.thread;
    } catch (error) {
      logger.warn("Direct message creation threw before completion; trying fallback", error, {
        activeFamilyId,
        profileId,
        otherProfileId,
      });
      return await fallbackToClient();
    }
  };

  // Create group chat via edge function
  const createGroupChat = async (name: string, participantIds: string[]) => {
    try {
      const { data, error } = await supabase.functions.invoke("create-message-thread", {
        body: {
          family_id: activeFamilyId,
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
    if (!activeFamilyId || !primaryParentId) return null;

    const fallbackToClient = async () => {
      try {
        logger.warn("Falling back to client-side family channel creation", {
          activeFamilyId,
          profileId,
          primaryParentId,
        });
        const fallbackThread = await fallbackEnsureFamilyChannel();
        if (!fallbackThread) {
          setSetupError("Messaging setup could not finish. Try refreshing the conversation list.");
          return null;
        }
        setFamilyChannel(fallbackThread);
        setSetupError(null);
        return fallbackThread;
      } catch (fallbackError) {
        logger.error("Family channel fallback failed", fallbackError, {
          activeFamilyId,
          profileId,
          primaryParentId,
        });
        setSetupError("Messaging setup could not finish. Try refreshing the conversation list.");
        return null;
      }
    };

    try {
      const { data, error } = await supabase.functions.invoke("create-message-thread", {
        body: {
          family_id: activeFamilyId,
          thread_type: "family_channel",
        },
      });

      if (error) {
        logger.warn("Edge function family channel creation failed; trying fallback", error, {
          activeFamilyId,
          profileId,
          primaryParentId,
        });
        return await fallbackToClient();
      }

      if (!data?.success) {
        logger.warn("Edge function family channel creation returned unsuccessful response", {
          activeFamilyId,
          profileId,
          primaryParentId,
          error: data?.error,
        });
        return await fallbackToClient();
      }

      setFamilyChannel(data.thread);
      setSetupError(null);
      return data.thread;
    } catch (error) {
      logger.warn("Family channel creation threw before completion; trying fallback", error, {
        activeFamilyId,
        profileId,
        primaryParentId,
      });
      return await fallbackToClient();
    }
  };

  // Initialize
  useEffect(() => {
    const initialize = async () => {
      if (roleLoading || (!activeFamilyId && !primaryParentId)) return;
      
      setLoading(true);
      const members = await fetchFamilyMembers();
      await fetchThreads(members);
      setLoading(false);
    };

    initialize();
  }, [activeFamilyId, roleLoading, primaryParentId, fetchFamilyMembers, fetchThreads]);

  // Fetch messages when active thread changes
  useEffect(() => {
    if (activeThread) {
      setMessages([]);
      setSystemEvents([]);
      void refreshActiveThread();
    } else {
      setMessages([]);
      setSystemEvents([]);
    }
  }, [activeThread, refreshActiveThread]);

  useEffect(() => {
    if ((!activeFamilyId && !primaryParentId) || !profileId) return;

    const channel = supabase.channel(
      `message-thread-metadata-${activeFamilyId ?? "legacy"}-${primaryParentId ?? "none"}`,
    );

    if (activeFamilyId) {
      channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "message_threads",
          filter: `family_id=eq.${activeFamilyId}`,
        },
        () => {
          void fetchThreads();
        },
      );
    }

    if (primaryParentId) {
      channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "message_threads",
          filter: `primary_parent_id=eq.${primaryParentId}`,
        },
        () => {
          void fetchThreads();
        },
      );
    }

    channel
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "group_chat_participants",
        },
        () => {
          void fetchThreads();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeFamilyId, fetchThreads, primaryParentId, profileId]);

  useEffect(() => {
    if ((!activeFamilyId && !primaryParentId) || !profileId) return;

    const channel = supabase
      .channel(`message-thread-previews-${activeFamilyId ?? "legacy"}-${profileId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "thread_messages",
        },
        async (payload) => {
          const newMessage = payload.new as ThreadMessageRow;
          const knownThreadIds = new Set([
            ...(familyChannel ? [familyChannel.id] : []),
            ...threads.map((thread) => thread.id),
            ...groupChats.map((thread) => thread.id),
          ]);

          if (!knownThreadIds.has(newMessage.thread_id)) {
            const { data: threadRecord } = await supabase
              .from("message_threads")
              .select("family_id, primary_parent_id")
              .eq("id", newMessage.thread_id)
              .maybeSingle();

            const belongsToActiveFamily =
              (activeFamilyId && threadRecord?.family_id === activeFamilyId) ||
              (!threadRecord?.family_id &&
                primaryParentId &&
                threadRecord?.primary_parent_id === primaryParentId);

            if (belongsToActiveFamily) {
              await fetchThreads();
            }
            return;
          }

          const { data: senderProfile } = await supabase
            .from("profiles")
            .select("full_name, email")
            .eq("id", newMessage.sender_id)
            .maybeSingle();

          applyThreadPreviewUpdate(newMessage.thread_id, {
            ...newMessage,
            sender_name: resolveDisplayName({
              primary: senderProfile?.full_name,
              fallback: "Family member",
            }),
            is_from_me: newMessage.sender_id === profileId,
            read_by: [],
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeFamilyId, applyThreadPreviewUpdate, familyChannel, fetchThreads, groupChats, primaryParentId, profileId, threads]);

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
            await markMessagesRead([newMsg.id]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeThread, markMessagesRead, profileId]);

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

  useEffect(() => {
    if (!activeThread) return;

    const channel = supabase
      .channel(`message-attachments-${activeThread.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "message_attachments",
          filter: `thread_id=eq.${activeThread.id}`,
        },
        () => {
          void fetchMessages(activeThread.id);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeThread, fetchMessages]);

  useEffect(() => {
    if (!activeThread) return;

    const channel = supabase
      .channel(`thread-call-events-${activeThread.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "call_sessions",
          filter: `thread_id=eq.${activeThread.id}`,
        },
        () => {
          void fetchSystemEvents(activeThread);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeThread, fetchSystemEvents]);

  return {
    threads,
    groupChats,
    familyChannel,
    familyMembers,
    activeFamilyId,
    activeThread,
    messages,
    systemEvents,
    activeThreadLoading,
    activeThreadLoadError,
    loading,
    role,
    profileId,
    setActiveThread,
    sendMessage,
    getOrCreateDMThread,
    createGroupChat,
    ensureFamilyChannel,
    fetchThreads,
    refreshActiveThread,
    setupError,
  };
};
