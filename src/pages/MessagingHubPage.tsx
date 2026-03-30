/**
 * MessagingHubPage - Court-Ready Communication System
 * 
 * @page-role Evidence + Action hybrid
 * 
 * DESIGN SYSTEM ENFORCEMENT:
 * - This is NOT a chat app. This is a recorded communication system under stress.
 * - Messages may be read by attorneys, mediators, and judges.
 * - UI must de-escalate by structure, not by tone alone.
 * 
 * REQUIRED ENFORCEMENTS:
 * 1. Ownership & Attribution Clarity - Every message shows who, when, what context
 * 2. Message Hierarchy Under Stress - Content primary, emotion neutralized
 * 3. Court View First-Class - Discoverable toggle, not buried in settings
 * 4. Summary Before Scroll - Unread/action status visible immediately
 * 5. Action Discipline - Deliberate composer, no rapid-fire encouragement
 * 6. Mobile Integrity - Attribution visible, court view accessible
 * 
 * PROHIBITED PATTERNS:
 * - Chat-style bubbles ❌
 * - Emoji-first emphasis ❌
 * - Color-coded emotional framing ❌
 * - Hidden timestamps ❌
 * - Collapsed attribution ❌
 */

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import { 
  MessageSquare, 
  Plus,
  Hash,
  FileText,
  UsersRound,
  Search,
  Menu,
  RefreshCw,
  Printer,
  MoreHorizontal,
  Loader2,
} from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useMessagingHub, MessageThread, FamilyMember } from "@/hooks/useMessagingHub";
import { useTypingIndicator } from "@/hooks/useTypingIndicator";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { MessageSearch } from "@/components/messages/MessageSearch";
import { UnreadBadge } from "@/components/messages/UnreadBadge";
import { SwipeableTabs } from "@/components/messages/SwipeableTabs";
import { EvidencePanel } from "@/components/messages/EvidencePanel";
import { DeliberateComposer } from "@/components/messages/DeliberateComposer";
import { ThreadSummaryBar } from "@/components/messages/ThreadSummaryBar";
import { CourtViewToggle } from "@/components/messages/CourtViewToggle";
import { PullToRefreshIndicator } from "@/components/messages/PullToRefreshIndicator";
import { CallActionButtons } from "@/components/calls/CallActionButtons";
import { useIsMobile } from "@/hooks/use-mobile";
import { useCallSessions } from "@/hooks/useCallSessions";
import { useProblemReport } from "@/components/feedback/useProblemReport";
import { buildMessageTimeline } from "@/components/messages/threadTimeline";
import { buildMessagingThreadExportPackage } from "@/components/messages/exportIntegrity";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { resolveSenderName } from "@/lib/displayResolver";
import { useSearchParams } from "react-router-dom";

/**
 * Role labels for attribution - RULE: No reliance on color alone
 */
const ROLE_LABELS: Record<string, string> = {
  parent: "Parent",
  guardian: "Guardian",
  third_party: "Family Member",
};

const getRoleBadge = (role: string) => {
  const label = ROLE_LABELS[role] || "Member";
  return (
    <Badge variant="outline" className="text-[10px] px-1.5 h-4 font-normal">
      {label}
    </Badge>
  );
};

const getInitials = (name: string | null | undefined, email: string | null | undefined) => {
  if (name) {
    const parts = name.split(" ");
    return parts.length >= 2 
      ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
      : name.substring(0, 2).toUpperCase();
  }
  return email?.substring(0, 2).toUpperCase() || "?";
};

const formatThreadPreviewTime = (timestamp?: string) => {
  if (!timestamp) return "";

  const date = new Date(timestamp);
  const now = new Date();
  return date.toDateString() === now.toDateString() ? format(date, "h:mm a") : format(date, "MMM d");
};

const getThreadPreviewText = (thread: MessageThread, fallback: string) => {
  const content = thread.last_message?.content?.trim();
  if (!content) return fallback;

  if (thread.thread_type === "direct_message") {
    return content;
  }

  return `${resolveSenderName(thread.last_message?.sender_name)}: ${content}`;
};

const MessagingHubPage = () => {
  const {
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
    profileId,
    setActiveThread,
    sendMessage,
    getOrCreateDMThread,
    createGroupChat,
    ensureFamilyChannel,
    fetchThreads,
    refreshActiveThread,
    setupError,
  } = useMessagingHub();
  const [searchParams] = useSearchParams();
  const appliedThreadParamRef = useRef<string | null>(null);
  const refreshContainerRef = useRef<HTMLDivElement | null>(null);

  const {
    createCall,
    currentThreadCall,
    incomingSession,
  } = useCallSessions(activeThread?.id ?? null);
  const { openReportModal } = useProblemReport();
  
  const { setTyping, clearTyping } = useTypingIndicator(activeThread?.id || null);
  const { 
    totalUnread, 
    getUnreadForThread, 
    getUnreadByType, 
    showIndicator,
    refresh: refreshUnread 
  } = useUnreadMessages();
  const isMobile = useIsMobile();
  
  // UI State
  const [showNewDM, setShowNewDM] = useState(false);
  const [activeTab, setActiveTab] = useState<"family" | "groups" | "direct">("family");
  const [selectedMembers, setSelectedMembers] = useState<FamilyMember[]>([]);
  const [showGroupConfirm, setShowGroupConfirm] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [startingCallType, setStartingCallType] = useState<"audio" | "video" | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  
  /**
   * Court View State
   * RULE: Court View is first-class, not a buried setting
   */
  const [viewMode, setViewMode] = useState<"chat" | "court">("chat");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const refreshInFlightRef = useRef(false);
  const courtView = viewMode === "court";
  const timelineItems = useMemo(
    () => buildMessageTimeline(messages, systemEvents),
    [messages, systemEvents],
  );

  // Pull-to-refresh for mobile
  const handleRefresh = useCallback(
    async (options?: { silent?: boolean }) => {
      if (refreshInFlightRef.current) {
        return;
      }

      refreshInFlightRef.current = true;
      setIsRefreshing(true);

      try {
        await Promise.all([
          ensureFamilyChannel(),
          fetchThreads(),
          refreshUnread(),
          refreshActiveThread(),
        ]);

        if (!options?.silent) {
          toast.success("Messages updated");
        }
      } catch (error) {
        console.error("Error refreshing Messaging Hub:", error);
        toast.error("Unable to refresh messages right now.");
      } finally {
        refreshInFlightRef.current = false;
        setIsRefreshing(false);
      }
    },
    [ensureFamilyChannel, fetchThreads, refreshActiveThread, refreshUnread],
  );

  const {
    isRefreshing: isPullRefreshing,
    pullDistance,
    bindEvents,
  } = usePullToRefresh({
    onRefresh: () => handleRefresh({ silent: true }),
    enabled: isMobile,
  });

  useEffect(() => bindEvents(refreshContainerRef.current), [bindEvents]);

  // Initialize family channel
  useEffect(() => {
    if (!loading && !familyChannel && !setupError) {
      ensureFamilyChannel();
    }
  }, [loading, familyChannel, ensureFamilyChannel, setupError]);

  // Set family channel as default active thread
  useEffect(() => {
    if (familyChannel && !activeThread) {
      setActiveThread(familyChannel);
    }
  }, [familyChannel, activeThread, setActiveThread]);

  useEffect(() => {
    const targetThreadId = searchParams.get("thread");
    if (!targetThreadId || appliedThreadParamRef.current === targetThreadId) {
      return;
    }

    const matchingThread =
      threads.find((thread) => thread.id === targetThreadId) ??
      groupChats.find((thread) => thread.id === targetThreadId) ??
      (familyChannel?.id === targetThreadId ? familyChannel : null);

    if (!matchingThread) {
      return;
    }

    setActiveThread(matchingThread);
    setActiveTab(
      matchingThread.thread_type === "group_chat"
        ? "groups"
        : matchingThread.thread_type === "direct_message"
          ? "direct"
          : "family",
    );
    appliedThreadParamRef.current = targetThreadId;
  }, [familyChannel, groupChats, searchParams, setActiveThread, threads]);

  /**
   * Handle message send - deliberate action
   * RULE: Action discipline - no rapid-fire encouragement
   */
  const handleSend = useCallback(async (message: string) => {
    clearTyping();
    await sendMessage(message);
  }, [clearTyping, sendMessage]);

  useEffect(() => {
    if (!incomingSession?.thread_id || activeThread?.id === incomingSession.thread_id) {
      return;
    }

    const matchingThread =
      threads.find((thread) => thread.id === incomingSession.thread_id) ??
      groupChats.find((thread) => thread.id === incomingSession.thread_id) ??
      (familyChannel?.id === incomingSession.thread_id ? familyChannel : null);

    if (matchingThread) {
      setActiveThread(matchingThread);
      setActiveTab(
        matchingThread.thread_type === "group_chat"
          ? "groups"
          : matchingThread.thread_type === "direct_message"
            ? "direct"
            : "family",
      );
    }
  }, [activeThread?.id, familyChannel, groupChats, incomingSession?.thread_id, setActiveThread, threads]);

  const handleStartCall = useCallback(
    async (callType: "audio" | "video") => {
      if (!activeThread || activeThread.thread_type !== "direct_message" || !activeThread.other_participant?.id) {
        toast.error("Open a direct message thread before starting a call.");
        return;
      }

      setStartingCallType(callType);

      try {
        await createCall({
          callType,
          calleeProfileId: activeThread.other_participant.id,
          source: "messaging_hub",
          threadId: activeThread.id,
        });
      } finally {
        setStartingCallType(null);
      }
    },
    [activeThread, createCall],
  );

  /**
   * Export to PDF - Court-ready document
   * RULE: Preserves attribution and order, print-safe
   */
  const handleExportPDF = useCallback(async () => {
    const historyUnavailable =
      Boolean(activeThread?.last_message) &&
      !activeThreadLoading &&
      !activeThreadLoadError &&
      messages.length === 0;

    if (!activeThread || !profileId || !activeFamilyId) {
      toast.error("Open a family-scoped thread before exporting.");
      return;
    }

    if (
      activeThreadLoading ||
      activeThreadLoadError ||
      historyUnavailable ||
      timelineItems.length === 0
    ) {
      toast.error("Wait for the recorded thread to finish loading before exporting.");
      return;
    }

    try {
      const exportedAt = new Date().toISOString();
      const exportPackage = await buildMessagingThreadExportPackage({
        activeFamilyId,
        activeThread,
        exportedAt,
        exportedByProfileId: profileId,
        timelineItems,
      });

      const doc = new jsPDF();
      const exportTimestamp = format(
        new Date(exportPackage.manifest.export_generated_at),
        "MMMM d, yyyy 'at' h:mm a",
      );
      const metadataNote =
        "This export includes tamper-evident metadata. The SHA-256 hash below represents the canonical exported record package generated from the recorded thread at export time. A paired JSON manifest includes the exact canonical payload string used for verification.";

      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("Message Record", 14, 20);

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Thread: ${exportPackage.manifest.thread_display_name}`, 14, 28);
      doc.text(`Exported: ${exportTimestamp}`, 14, 34);
      doc.text(`Total Timeline Entries: ${exportPackage.manifest.total_entries}`, 14, 40);

      let cursorY = 48;
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("Evidence metadata", 14, cursorY);
      cursorY += 6;

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      [
        `Family scope: ${exportPackage.manifest.family_id}`,
        `Thread type: ${exportPackage.manifest.thread_type}`,
        `Record range: ${
          exportPackage.manifest.record_start
            ? format(new Date(exportPackage.manifest.record_start), "MMM d, yyyy h:mm a")
            : "Not available"
        } to ${
          exportPackage.manifest.record_end
            ? format(new Date(exportPackage.manifest.record_end), "MMM d, yyyy h:mm a")
            : "Not available"
        }`,
        `Hash algorithm: ${exportPackage.manifest.hash_algorithm}`,
      ].forEach((line) => {
        doc.text(line, 14, cursorY);
        cursorY += 5;
      });

      doc.setFont("helvetica", "bold");
      doc.text("Integrity hash:", 14, cursorY);
      cursorY += 5;
      doc.setFont("courier", "normal");
      const hashLines = doc.splitTextToSize(
        exportPackage.manifest.canonical_payload_hash,
        178,
      );
      doc.text(hashLines, 14, cursorY);
      cursorY += hashLines.length * 4 + 2;

      doc.setFont("helvetica", "normal");
      const noteLines = doc.splitTextToSize(metadataNote, 178);
      doc.text(noteLines, 14, cursorY);
      cursorY += noteLines.length * 4 + 4;

      const tableData = exportPackage.canonicalPayload.entries.map((entry) => {
        if (entry.kind === "system") {
          return [
            format(new Date(entry.timestamp), "MMM d, yyyy h:mm a"),
            entry.actor_name,
            "System Event",
            entry.note,
          ];
        }

        return [
          format(new Date(entry.timestamp), "MMM d, yyyy h:mm a"),
          entry.sender_name,
          entry.sender_role_label,
          entry.content,
        ];
      });

      autoTable(doc, {
        head: [["Date & Time", "Sender", "Role", "Message Content"]],
        body: tableData,
        startY: cursorY,
        styles: {
          fontSize: 9,
          cellPadding: 3,
        },
        headStyles: {
          fillColor: [51, 51, 51],
          fontStyle: "bold",
        },
        columnStyles: {
          0: { cellWidth: 35 },
          1: { cellWidth: 30 },
          2: { cellWidth: 22 },
          3: { cellWidth: "auto" },
        },
        alternateRowStyles: {
          fillColor: [248, 248, 248],
        },
      });

      doc.addPage();
      let manifestY = 20;
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("Export Manifest", 14, manifestY);
      manifestY += 8;

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      [
        `Thread ID: ${exportPackage.manifest.thread_id}`,
        `Thread type: ${exportPackage.manifest.thread_type}`,
        `Family ID: ${exportPackage.manifest.family_id}`,
        `Export generated at: ${exportPackage.manifest.export_generated_at}`,
        `Exported by profile: ${exportPackage.manifest.exported_by_profile_id}`,
        `Total entries: ${exportPackage.manifest.total_entries}`,
        `Messages: ${exportPackage.manifest.total_messages}`,
        `System events: ${exportPackage.manifest.total_system_events}`,
      ].forEach((line) => {
        doc.text(line, 14, manifestY);
        manifestY += 6;
      });

      doc.setFont("helvetica", "bold");
      doc.text("Included message IDs:", 14, manifestY);
      manifestY += 5;
      doc.setFont("courier", "normal");
      const messageIdLines = doc.splitTextToSize(
        exportPackage.manifest.included_message_ids.join(", ") || "None",
        178,
      );
      doc.text(messageIdLines, 14, manifestY);
      manifestY += messageIdLines.length * 4 + 4;

      doc.setFont("helvetica", "bold");
      doc.text("Included system event IDs:", 14, manifestY);
      manifestY += 5;
      doc.setFont("courier", "normal");
      const systemIdLines = doc.splitTextToSize(
        exportPackage.manifest.included_system_event_ids.join(", ") || "None",
        178,
      );
      doc.text(systemIdLines, 14, manifestY);
      manifestY += systemIdLines.length * 4 + 4;

      doc.setFont("helvetica", "bold");
      doc.text("Verification notes:", 14, manifestY);
      manifestY += 5;
      doc.setFont("helvetica", "normal");
      exportPackage.manifest.verification_notes.forEach((note) => {
        const wrappedNote = doc.splitTextToSize(`• ${note}`, 178);
        doc.text(wrappedNote, 14, manifestY);
        manifestY += wrappedNote.length * 4 + 2;
      });

      const manifestCompanionNote = doc.splitTextToSize(
        "A paired JSON manifest is downloaded with this PDF. It contains the manifest, canonical payload object, and canonical payload string used to compute the integrity hash.",
        178,
      );
      doc.text(manifestCompanionNote, 14, manifestY + 2);

      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(128);
        doc.text(
          `Page ${i} of ${pageCount} | CoParrent Message Record | Integrity hash ${exportPackage.manifest.canonical_payload_hash.slice(0, 16)}…`,
          doc.internal.pageSize.width / 2,
          doc.internal.pageSize.height - 10,
          { align: "center" },
        );
      }

      const exportFileBase = `messages-${format(new Date(exportedAt), "yyyy-MM-dd-HHmm")}`;

      doc.save(`${exportFileBase}.pdf`);

      const manifestBlob = new Blob(
        [
          JSON.stringify(
            {
              canonical_payload: exportPackage.canonicalPayload,
              canonical_payload_json: exportPackage.canonicalPayloadJson,
              manifest: exportPackage.manifest,
            },
            null,
            2,
          ),
        ],
        { type: "application/json;charset=utf-8" },
      );
      const manifestUrl = URL.createObjectURL(manifestBlob);
      const manifestLink = document.createElement("a");
      manifestLink.href = manifestUrl;
      manifestLink.download = `${exportFileBase}-manifest.json`;
      manifestLink.click();
      setTimeout(() => URL.revokeObjectURL(manifestUrl), 0);

      toast.success("Thread record exported with tamper-evident metadata and manifest");
    } catch (error) {
      console.error("Error exporting Messaging Hub PDF:", error);
      toast.error("Unable to export the recorded thread right now.");
    }
  }, [
    activeFamilyId,
    activeThread,
    activeThreadLoadError,
    activeThreadLoading,
    messages.length,
    profileId,
    timelineItems,
  ]);

  /**
   * Print current view
   * RULE: Court View must be printable
   */
  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const getThreadDisplayName = (thread: MessageThread | null) => {
    if (!thread) return "Messages";
    if (thread.thread_type === "group_chat") {
      return thread.name || "Group Chat";
    }
    if (thread.thread_type === "family_channel") {
      return "Family Channel";
    }
    return thread.other_participant?.full_name || 
           thread.other_participant?.email || 
           "Direct Message";
  };

  // Thread selection handlers
  const toggleMemberSelection = (member: FamilyMember) => {
    if (member.profile_id === profileId) return;
    setSelectedMembers(prev => {
      const isSelected = prev.some(m => m.profile_id === member.profile_id);
      return isSelected 
        ? prev.filter(m => m.profile_id !== member.profile_id)
        : [...prev, member];
    });
  };

  const handleStartConversation = async () => {
    if (selectedMembers.length === 0) {
      toast.error("Please select at least one person");
      return;
    }
    
    if (selectedMembers.length > 1) {
      setShowGroupConfirm(true);
      return;
    }
    
    const member = selectedMembers[0];
    const thread = await getOrCreateDMThread(member.profile_id);
    if (thread) {
      setActiveThread({
        ...thread,
        other_participant: {
          id: member.profile_id,
          full_name: member.full_name,
          email: member.email,
          role: member.role,
        },
      });
      setShowNewDM(false);
      setSelectedMembers([]);
      setActiveTab("direct");
      setShowSidebar(false);
    }
  };

  const handleCreateGroupChat = async () => {
    if (!groupName.trim()) {
      toast.error("Please enter a group name");
      return;
    }
    
    setCreatingGroup(true);
    const thread = await createGroupChat(
      groupName.trim(),
      selectedMembers.map(m => m.profile_id)
    );
    
    if (thread) {
      setActiveThread({
        ...thread,
        participants: selectedMembers.map(m => ({
          profile_id: m.profile_id,
          full_name: m.full_name,
          email: m.email,
          avatar_url: m.avatar_url,
        })),
      });
      toast.success("Group created");
      setShowNewDM(false);
      setShowGroupConfirm(false);
      setSelectedMembers([]);
      setGroupName("");
      setActiveTab("groups");
      setShowSidebar(false);
    }
    setCreatingGroup(false);
  };

  const handleSelectThread = (thread: MessageThread) => {
    setActiveThread(thread);
    setActiveTab(
      thread.thread_type === "group_chat"
        ? "groups"
        : thread.thread_type === "direct_message"
          ? "direct"
          : "family",
    );
    if (isMobile) setShowSidebar(false);
  };

  const threadHasRecordedHistory = Boolean(activeThread?.last_message);
  const recordState = !activeThread
    ? null
    : activeThreadLoadError
      ? "error"
      : activeThreadLoading
        ? threadHasRecordedHistory
          ? "loading_existing"
          : "loading_empty"
        : messages.length > 0
          ? "ready"
          : threadHasRecordedHistory
            ? "history_unavailable"
            : "empty";
  const recordStateLabel = !recordState
    ? "No thread selected"
    : recordState === "loading_existing"
      ? "Loading recorded history"
      : recordState === "loading_empty"
        ? "Checking thread status"
        : recordState === "history_unavailable"
          ? "History unavailable"
          : recordState === "error"
            ? "Load blocked"
            : recordState === "ready"
              ? "Existing record"
              : "Ready for first message";
  const recordStateDescription = !recordState
    ? "Start in the family channel or pick a direct or group thread."
    : recordState === "loading_existing"
      ? "Loading the recorded history for this existing thread now."
      : recordState === "loading_empty"
        ? "Confirming the current thread status before drafting."
        : recordState === "history_unavailable"
          ? "This thread shows recorded activity, but the message history did not hydrate in this view."
          : recordState === "error"
            ? activeThreadLoadError || "The selected thread could not be loaded right now."
            : recordState === "ready"
              ? `${messages.length} message${messages.length === 1 ? "" : "s"} currently visible in this record.`
              : "This record is open and ready for the first message.";
  const composerDisabled =
    recordState === "loading_existing" ||
    recordState === "loading_empty" ||
    recordState === "history_unavailable" ||
    recordState === "error";
  const composerHelperText = composerDisabled
    ? recordState === "loading_existing"
      ? "Loading the recorded history before drafting a reply."
      : recordState === "loading_empty"
        ? "Confirming the current thread before drafting the first message."
        : recordState === "history_unavailable"
          ? "Reload this thread before drafting so the visible record is complete."
          : activeThreadLoadError || "Reload this thread before drafting."
    : undefined;
  const composerPlaceholder = composerDisabled
    ? recordState === "error" || recordState === "history_unavailable"
      ? "Reload this recorded thread before drafting."
      : "Loading the recorded thread..."
    : activeThread?.thread_type === "direct_message"
      ? "Compose a direct-message reply for the recorded thread..."
      : activeThread?.thread_type === "group_chat"
        ? "Compose a group-thread update for the record..."
        : "Compose your message for the shared family record...";
  const currentThreadTitle = activeThread ? getThreadDisplayName(activeThread) : "Open a conversation";
  const currentThreadDescription = activeThread
    ? recordStateDescription
    : "Start in the family channel or pick a direct or group thread.";
  const currentThreadTypeLabel = activeThread
    ? activeThread.thread_type === "family_channel"
      ? "Family channel"
      : activeThread.thread_type === "group_chat"
        ? "Group thread"
        : "Direct thread"
    : "No thread selected";
  const modeSummaryLabel = courtView ? "Court view active" : "Chat view active";
  const evidenceSummaryLabel =
    recordState === "loading_existing"
      ? "Loading existing record"
      : recordState === "loading_empty"
        ? "Checking record"
        : recordState === "error"
          ? "Load blocked"
          : recordState === "history_unavailable"
            ? "History unavailable"
            : recordState === "empty"
              ? "Ready for first message"
              : `${timelineItems.length} entr${timelineItems.length === 1 ? "y" : "ies"}`;
  const exportDisabled =
    !activeThread ||
    !activeFamilyId ||
    !profileId ||
    activeThreadLoading ||
    recordState === "history_unavailable" ||
    recordState === "error" ||
    timelineItems.length === 0;
  const sidebarThreadButtonClass = (selected: boolean) =>
    cn(
      "group relative mb-1.5 w-full overflow-hidden rounded-[22px] border p-3.5 text-left transition-all duration-200",
      "shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
      selected
        ? "border-primary/30 bg-[linear-gradient(135deg,rgba(45,212,191,0.14),rgba(15,23,42,0.16))] shadow-[0_20px_40px_-32px_rgba(15,23,42,0.9)]"
        : "border-transparent bg-background/30 hover:-translate-y-0.5 hover:border-border/70 hover:bg-background/55",
    );
  const threadStatusBadgeClass = cn(
    "border-white/10 bg-white/5 text-[10px] uppercase tracking-[0.14em] text-slate-200/70",
    recordState === "loading_existing" || recordState === "loading_empty"
      ? "border-primary/20 bg-primary/10 text-primary-foreground"
      : recordState === "error" || recordState === "history_unavailable"
        ? "border-warning/35 bg-warning/10 text-warning"
        : recordState === "ready"
          ? "border-emerald-300/20 bg-emerald-400/10 text-emerald-100"
          : "border-white/10 bg-white/5 text-slate-200/70",
  );

  // Sidebar content - thread navigation
  const SidebarContent = () => {
    const tabItems = ["family", "groups", "direct"] as const;
    const familyUnread = showIndicator ? getUnreadByType("family_channel") : 0;
    const groupsUnread = showIndicator ? getUnreadByType("group_chat") : 0;
    const directUnread = showIndicator ? getUnreadByType("direct_message") : 0;

    const TabContentInner = () => (
      <>
        <TabsContent value="family" className="m-0 flex-1 overflow-auto p-2">
          {familyChannel && (
            <button
              onClick={() => handleSelectThread(familyChannel)}
              className={sidebarThreadButtonClass(activeThread?.id === familyChannel.id)}
            >
              <div className="absolute inset-x-0 top-0 h-px bg-white/10" />
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl border border-primary/15 bg-primary/10 text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                  <Hash className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-foreground">Family Channel</p>
                      <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground/80">
                        Official shared record
                      </p>
                    </div>
                    {familyChannel.last_message?.created_at && (
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {formatThreadPreviewTime(familyChannel.last_message.created_at)}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {getThreadPreviewText(
                      familyChannel,
                      `${familyMembers.length} members • Official record`,
                    )}
                  </p>
                </div>
                {showIndicator && getUnreadForThread(familyChannel.id) > 0 && (
                  <UnreadBadge count={getUnreadForThread(familyChannel.id)} />
                )}
              </div>
            </button>
          )}

          <div className="mt-4 rounded-[22px] border border-border/70 bg-background/35 p-3">
            <div className="mb-3 flex items-center justify-between gap-3 px-1">
              <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                Family members
              </p>
              <Badge variant="secondary" className="rounded-full text-[10px]">
                {familyMembers.length}
              </Badge>
            </div>
            {familyMembers.map((member) => (
              <div
                key={member.id}
                className="flex items-center gap-3 rounded-2xl px-2.5 py-2 transition-colors hover:bg-background/60"
              >
                <Avatar className="h-8 w-8 flex-shrink-0 border border-border/60">
                  <AvatarFallback className="text-[10px]">
                    {getInitials(member.full_name, member.email)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {member.full_name || member.email}
                    {member.profile_id === profileId && (
                      <span className="text-muted-foreground"> (you)</span>
                    )}
                  </p>
                </div>
                {getRoleBadge(member.role)}
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="groups" className="m-0 flex-1 overflow-auto p-2">
          <Button
            variant="ghost"
            className="mb-3 w-full justify-start gap-2 rounded-[20px] border border-border/70 bg-background/40 px-3 py-5 text-sm font-medium hover:bg-background/70"
            onClick={() => setShowNewDM(true)}
          >
            <Plus className="h-4 w-4" />
            New Group
          </Button>

          {groupChats.map((thread) => (
            <button
              key={thread.id}
              onClick={() => handleSelectThread(thread)}
              className={sidebarThreadButtonClass(activeThread?.id === thread.id)}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl border border-accent/15 bg-accent/10 text-accent shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                  <UsersRound className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate text-sm font-semibold">
                      {thread.name || "Group"}
                    </p>
                    {thread.last_message?.created_at && (
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {formatThreadPreviewTime(thread.last_message.created_at)}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground/80">
                    Group coordination
                  </p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {getThreadPreviewText(thread, `${thread.participants?.length || 0} members`)}
                  </p>
                </div>
                {showIndicator && getUnreadForThread(thread.id) > 0 && (
                  <UnreadBadge count={getUnreadForThread(thread.id)} />
                )}
              </div>
            </button>
          ))}

          {groupChats.length === 0 && (
            <div className="rounded-[22px] border border-dashed border-border/70 bg-background/35 px-4 py-8 text-center">
              <p className="text-sm font-medium text-foreground">No group conversations yet</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Create a group only when the coordination is narrower than the family record.
              </p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="direct" className="m-0 flex-1 overflow-auto p-2">
          <Button
            variant="ghost"
            className="mb-3 w-full justify-start gap-2 rounded-[20px] border border-border/70 bg-background/40 px-3 py-5 text-sm font-medium hover:bg-background/70"
            onClick={() => setShowNewDM(true)}
          >
            <Plus className="h-4 w-4" />
            New Message
          </Button>

          {threads.map((thread) => (
            <button
              key={thread.id}
              onClick={() => handleSelectThread(thread)}
              className={sidebarThreadButtonClass(activeThread?.id === thread.id)}
            >
              <div className="flex items-center gap-3">
                <Avatar className="h-11 w-11 flex-shrink-0 border border-border/60">
                  <AvatarFallback className="text-sm">
                    {getInitials(
                      thread.other_participant?.full_name,
                      thread.other_participant?.email
                    )}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate text-sm font-semibold">
                      {thread.other_participant?.full_name ||
                        thread.other_participant?.email ||
                        "Unknown"}
                    </p>
                    {thread.last_message?.created_at && (
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {formatThreadPreviewTime(thread.last_message.created_at)}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    {thread.other_participant?.role && getRoleBadge(thread.other_participant.role)}
                    <span className="rounded-full border border-border/70 bg-background/45 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                      {thread.last_message ? "Recorded thread" : "Ready to start"}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {getThreadPreviewText(thread, "No messages yet")}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground/80">
                    {thread.last_message
                      ? "Existing direct record"
                      : "Direct thread ready for the first message"}
                  </p>
                </div>
                {showIndicator && getUnreadForThread(thread.id) > 0 && (
                  <UnreadBadge count={getUnreadForThread(thread.id)} />
                )}
              </div>
            </button>
          ))}

          {threads.length === 0 && (
            <div className="rounded-[22px] border border-dashed border-border/70 bg-background/35 px-4 py-8 text-center">
              <p className="text-sm font-medium text-foreground">No direct messages yet</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Start a direct thread when one-to-one coordination is more appropriate than the family record.
              </p>
            </div>
          )}
        </TabsContent>
      </>
    );

    return (
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="flex h-full flex-col">
        <div className="border-b border-border/80 bg-background/45 px-4 py-4 backdrop-blur-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Conversation lanes
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Family channel is the permanent shared record. Use groups or direct messages for narrower coordination.
              </p>
            </div>
            {showIndicator && totalUnread > 0 && (
              <UnreadBadge count={totalUnread} />
            )}
          </div>
        </div>
        <div className="px-3 pt-3">
          <TabsList className="grid w-full grid-cols-3 rounded-[18px] border border-border/70 bg-background/60 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            <TabsTrigger value="family" className="relative gap-1 rounded-[14px] text-xs data-[state=active]:bg-primary/10 data-[state=active]:text-foreground data-[state=active]:shadow-sm">
              <Hash className="h-3 w-3" />
              <span>Family</span>
              {familyUnread > 0 && (
                <UnreadBadge count={familyUnread} className="absolute -right-1 -top-1" />
              )}
            </TabsTrigger>
            <TabsTrigger value="groups" className="relative gap-1 rounded-[14px] text-xs data-[state=active]:bg-accent/10 data-[state=active]:text-foreground data-[state=active]:shadow-sm">
              <UsersRound className="h-3 w-3" />
              <span>Groups</span>
              {groupsUnread > 0 && (
                <UnreadBadge count={groupsUnread} className="absolute -right-1 -top-1" />
              )}
            </TabsTrigger>
            <TabsTrigger value="direct" className="relative gap-1 rounded-[14px] text-xs data-[state=active]:bg-primary/10 data-[state=active]:text-foreground data-[state=active]:shadow-sm">
              <MessageSquare className="h-3 w-3" />
              <span>Direct</span>
              {directUnread > 0 && (
                <UnreadBadge count={directUnread} className="absolute -right-1 -top-1" />
              )}
            </TabsTrigger>
          </TabsList>
        </div>
        <div className="px-3 pb-3 pt-2">
          <p className="rounded-[18px] border border-border/70 bg-background/30 px-3 py-2 text-[11px] leading-5 text-muted-foreground">
            Family channel is the permanent shared record. Use groups or direct messages for narrower coordination.
          </p>
        </div>

        {isMobile ? (
          <SwipeableTabs
            tabs={[...tabItems]}
            activeTab={activeTab}
            onTabChange={(t) => setActiveTab(t as typeof activeTab)}
            className="flex-1"
          >
            <TabContentInner />
          </SwipeableTabs>
        ) : (
          <TabContentInner />
        )}
      </Tabs>
    );
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <TooltipProvider>
        {/* 
          Print styles for Court View
          RULE: Court View must be printable and export-safe
        */}
        <style>{`
          @media print {
            body * { visibility: hidden; }
            .print-area, .print-area * { visibility: visible; }
            .print-area { position: absolute; left: 0; top: 0; width: 100%; }
            .no-print { display: none !important; }
          }
        `}</style>

        <div
          ref={refreshContainerRef}
          className={cn(
            "relative flex h-[calc(100vh-8rem)] flex-col",
            courtView && "print-area",
          )}
        >
          <PullToRefreshIndicator
            isRefreshing={isRefreshing || isPullRefreshing}
            pullDistance={pullDistance}
          />
          {/* 
            Header - Minimal, functional
            RULE: No "friendly app" aesthetics
          */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 no-print"
          >
            <div className="relative isolate overflow-hidden rounded-[30px] border border-primary/15 bg-[radial-gradient(circle_at_top_left,rgba(45,212,191,0.16),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.14),transparent_35%),linear-gradient(135deg,rgba(15,23,42,0.94),rgba(10,16,27,0.92))] p-5 shadow-[0_28px_70px_-38px_rgba(15,23,42,0.9)]">
              <div className="absolute inset-x-0 top-0 h-px bg-white/10" />
              <div className="absolute left-8 top-6 h-32 w-32 rounded-full bg-primary/20 blur-3xl" />
              <div className="absolute bottom-0 right-0 h-40 w-40 rounded-full bg-accent/15 blur-3xl" />
              <div className="relative flex flex-col gap-5">
                <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0 space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="inline-flex rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary-foreground/80">
                        {modeSummaryLabel}
                      </div>
                      <div className="inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-primary-foreground/70">
                        {currentThreadTypeLabel}
                      </div>
                      <div className={cn("inline-flex rounded-full border px-3 py-1 text-xs font-medium", threadStatusBadgeClass)}>
                        {recordStateLabel}
                      </div>
                      {showIndicator && totalUnread > 0 && (
                        <UnreadBadge count={totalUnread} size="md" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <h1 className="text-2xl font-semibold tracking-tight text-white md:text-3xl">
                        Messaging Hub
                      </h1>
                      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-200/80">
                        {currentThreadTitle}. {currentThreadDescription}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 xl:w-[360px] xl:grid-cols-1">
                    <div className="rounded-[24px] border border-white/10 bg-white/5 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-sm">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300/70">
                        Current mode
                      </p>
                      <p className="mt-3 text-lg font-semibold text-white">{modeSummaryLabel}</p>
                      <p className="mt-1 text-sm text-slate-300/70">
                        Use court view for review and export, or chat view for day-to-day drafting.
                      </p>
                    </div>
                    <div className="rounded-[24px] border border-white/10 bg-slate-950/35 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-sm">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300/70">
                        Loaded thread
                      </p>
                      <p className="mt-3 text-lg font-semibold text-white">{recordStateLabel}</p>
                      <p className="mt-1 text-sm text-slate-300/70">
                        {activeThread
                          ? recordStateDescription
                          : "Choose the family record, a group, or a direct thread to load the full record."}
                      </p>
                    </div>
                  </div>
                </div>

                {setupError && (
                  <div className="rounded-[24px] border border-warning/40 bg-warning/10 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-medium text-foreground">Messaging setup needs attention</p>
                        <p className="text-sm text-muted-foreground">{setupError}</p>
                      </div>
                      <Button variant="outline" size="sm" className="rounded-full border-warning/35 bg-background/60" onClick={() => void ensureFamilyChannel()}>
                        Retry setup
                      </Button>
                    </div>
                  </div>
                )}

                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                  <div className="flex flex-wrap items-stretch gap-3">
                    {isMobile && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="relative rounded-2xl border-white/10 bg-white/5 px-4"
                        onClick={() => setShowSidebar(true)}
                      >
                        <Menu className="mr-2 h-4 w-4" />
                        Conversations
                        {showIndicator && totalUnread > 0 && (
                          <UnreadBadge
                            count={totalUnread}
                            className="absolute -top-1 -right-1"
                            size="sm"
                          />
                        )}
                      </Button>
                    )}

                    <div className="rounded-[22px] border border-white/10 bg-white/5 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300/70">
                        Viewing mode
                      </p>
                      <CourtViewToggle
                        enabled={courtView}
                        onToggle={() =>
                          setViewMode((currentMode) =>
                            currentMode === "court" ? "chat" : "court",
                          )
                        }
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-stretch gap-3">
                    <div className="rounded-[22px] border border-white/10 bg-slate-950/35 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300/70">
                        Utilities
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-xl border-white/10 bg-white/5 hover:bg-white/10"
                          onClick={() => void handleRefresh()}
                          disabled={isRefreshing || isPullRefreshing}
                        >
                          <RefreshCw
                            className={cn(
                              "mr-2 h-4 w-4",
                              (isRefreshing || isPullRefreshing) && "animate-spin",
                            )}
                          />
                          {isRefreshing || isPullRefreshing ? "Refreshing..." : "Refresh"}
                        </Button>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="rounded-xl border-white/10 bg-white/5 hover:bg-white/10" aria-label="More messaging actions">
                              <MoreHorizontal className="mr-2 h-4 w-4" />
                              More
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuItem onClick={() => setShowSearch(true)}>
                              <Search className="mr-2 h-4 w-4" />
                              Search messages
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openReportModal("manual")}>
                              <MessageSquare className="mr-2 h-4 w-4" />
                              Report a problem
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              disabled={exportDisabled}
                              onClick={() => void handleExportPDF()}
                            >
                              <FileText className="mr-2 h-4 w-4" />
                              Export evidence package
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={!courtView || timelineItems.length === 0}
                              onClick={handlePrint}
                            >
                              <Printer className="mr-2 h-4 w-4" />
                              Print current view
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Search Dialog */}
          <Dialog open={showSearch} onOpenChange={setShowSearch}>
            <DialogContent className="max-w-lg mx-4 md:mx-auto">
              <DialogHeader>
                <DialogTitle>Search Messages</DialogTitle>
              </DialogHeader>
              <MessageSearch
                threadId={activeThread?.id}
                onResultClick={(result) => {
                  setShowSearch(false);
                  toast.success(`Found message from ${resolveSenderName(result.sender_name)}`);
                }}
                onClose={() => setShowSearch(false)}
              />
            </DialogContent>
          </Dialog>

          {/* Mobile Sidebar */}
          <Sheet open={showSidebar} onOpenChange={setShowSidebar}>
            <SheetContent side="left" className="w-[320px] border-r border-border/70 bg-card/95 p-0 backdrop-blur-sm">
              <SheetHeader className="border-b border-border/70 p-4">
                <SheetTitle className="flex items-center gap-2 text-sm">
                  Conversations
                  {showIndicator && totalUnread > 0 && (
                    <UnreadBadge count={totalUnread} size="md" />
                  )}
                </SheetTitle>
                <p className="text-sm text-muted-foreground">
                  Use the family channel for the shared record, then branch into groups or direct messages only when the discussion is narrower.
                </p>
              </SheetHeader>
              <div className="h-[calc(100%-60px)]">
                <SidebarContent />
              </div>
            </SheetContent>
          </Sheet>

          {/* Main Content Area */}
          <div className="flex min-h-0 flex-1 gap-4">
            {/* Desktop Sidebar */}
            {!isMobile && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="no-print flex w-72 flex-shrink-0 flex-col overflow-hidden rounded-[30px] border border-border/70 bg-gradient-to-b from-card via-card to-card/90 shadow-[0_24px_50px_-36px_rgba(15,23,42,0.9)] lg:w-80"
              >
                <SidebarContent />
              </motion.div>
            )}

            {/* 
              Chat Area - Evidence + Action separation
              RULE: These two may not visually blur together
            */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-[30px] border border-border/70 bg-gradient-to-b from-card via-card to-card/90 shadow-[0_28px_60px_-38px_rgba(15,23,42,0.92)]"
            >
              {activeThread ? (
                <>
                  {/* Thread Header - Context for attribution */}
                  <div className={cn(
                    "border-b border-border/80 bg-[linear-gradient(135deg,rgba(15,23,42,0.9),rgba(15,23,42,0.7))] px-4 py-4 sm:px-5",
                    courtView && "bg-[linear-gradient(135deg,rgba(15,23,42,0.94),rgba(17,24,39,0.78))]"
                  )}>
                    <div className="flex w-full flex-wrap items-center gap-3">
                      {activeThread.thread_type === "family_channel" ? (
                        <>
                          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                            <Hash className="h-5 w-5" />
                          </div>
                          <div className="min-w-0">
                            <h2 className="text-sm font-semibold text-white">Family Channel</h2>
                            <p className="text-[11px] text-slate-300/70">
                              Official family communication record
                            </p>
                          </div>
                        </>
                      ) : activeThread.thread_type === "group_chat" ? (
                        <>
                          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl border border-accent/20 bg-accent/10 text-accent">
                            <UsersRound className="h-5 w-5" />
                          </div>
                          <div className="min-w-0">
                            <h2 className="truncate text-sm font-semibold text-white">
                              {activeThread.name || "Group"}
                            </h2>
                            <p className="truncate text-[11px] text-slate-300/70">
                              {activeThread.participants?.map((p) => p.full_name || p.email).join(", ")}
                            </p>
                          </div>
                        </>
                      ) : (
                        <>
                          <Avatar className="h-11 w-11 flex-shrink-0 border border-white/10">
                            <AvatarFallback className="text-sm">
                              {getInitials(
                                activeThread.other_participant?.full_name,
                                activeThread.other_participant?.email
                              )}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <h2 className="truncate text-sm font-semibold text-white">
                              {activeThread.other_participant?.full_name ||
                               activeThread.other_participant?.email ||
                               "Unknown"}
                            </h2>
                            <div className="mt-1 flex flex-wrap items-center gap-2">
                              {activeThread.other_participant?.role && (
                                getRoleBadge(activeThread.other_participant.role)
                              )}
                              <Badge variant="outline" className="border-white/10 bg-white/5 text-[10px] uppercase tracking-[0.14em] text-slate-200/70">
                                Direct record
                              </Badge>
                              <Badge variant="outline" className={threadStatusBadgeClass}>
                                {recordStateLabel}
                              </Badge>
                            </div>
                          </div>
                          <div className="ml-auto rounded-[18px] border border-white/10 bg-white/5 p-1.5">
                            <CallActionButtons
                              disabled={Boolean(currentThreadCall)}
                              loading={Boolean(startingCallType)}
                              onStartAudio={() => void handleStartCall("audio")}
                              onStartVideo={() => void handleStartCall("video")}
                            />
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* 
                    Thread Summary Bar
                    RULE: Summary Before Scroll - users never scroll to understand urgency
                  */}
                  <ThreadSummaryBar
                    unreadCount={showIndicator ? getUnreadForThread(activeThread.id) : 0}
                    totalMessages={messages.length}
                    recordState={recordState ?? undefined}
                    threadType={activeThread.thread_type as "family_channel" | "group_chat" | "direct_message"}
                    courtView={courtView}
                    className="no-print border-b border-border/80 bg-background/55 px-5 py-3"
                  />

                  {/* 
                    EVIDENCE SECTION - Message History
                    RULE: Evidence and Action must be visually separated
                  */}
                  <div className="flex min-h-0 flex-1 flex-col bg-[linear-gradient(180deg,rgba(15,23,42,0.06),transparent_35%)] px-3 py-3 sm:px-4">
                    <div className="mb-3 flex items-center justify-between gap-3 rounded-[22px] border border-border/70 bg-background/35 px-4 py-3">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                          Record timeline
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {recordState === "loading_existing"
                            ? "Recorded messages, call activity, and system events are loading for this thread."
                            : recordState === "loading_empty"
                              ? "Checking this record before the drafting area becomes active."
                              : recordState === "history_unavailable" || recordState === "error"
                                ? "Refresh this thread before relying on the visible record."
                                : "Messages, call activity, and system events remain in order for review."}
                        </p>
                      </div>
                      <Badge variant="outline" className="rounded-full">
                        {evidenceSummaryLabel}
                      </Badge>
                    </div>
                    {recordState === "loading_existing" || recordState === "loading_empty" ? (
                      <div className="flex flex-1 items-center justify-center rounded-[26px] border border-border/70 bg-background/45 px-6 py-10 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                        <div className="max-w-sm">
                          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/15 bg-primary/10 text-primary">
                            <Loader2 className="h-6 w-6 animate-spin" />
                          </div>
                          <p className="mt-4 text-sm font-semibold text-foreground">
                            {recordState === "loading_existing"
                              ? "Loading recorded history"
                              : "Checking the current thread"}
                          </p>
                          <p className="mt-2 text-sm leading-6 text-muted-foreground">
                            {recordState === "loading_existing"
                              ? "This direct thread already has recorded activity. The evidence view is loading before replies resume."
                              : "The thread is opening now. We are confirming whether it already contains recorded activity."}
                          </p>
                        </div>
                      </div>
                    ) : recordState === "history_unavailable" || recordState === "error" ? (
                      <div className="flex flex-1 items-center justify-center rounded-[26px] border border-warning/30 bg-warning/5 px-6 py-10 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                        <div className="max-w-sm">
                          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-warning/35 bg-warning/10 text-warning">
                            <RefreshCw className="h-6 w-6" />
                          </div>
                          <p className="mt-4 text-sm font-semibold text-foreground">
                            {recordState === "history_unavailable"
                              ? "Recorded history did not hydrate"
                              : "Thread history could not be loaded"}
                          </p>
                          <p className="mt-2 text-sm leading-6 text-muted-foreground">
                            {recordState === "history_unavailable"
                              ? "This thread shows existing message activity, but the full record did not load into this view."
                              : activeThreadLoadError || "The recorded thread could not be loaded right now."}
                          </p>
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-4 rounded-full"
                            onClick={() => void handleRefresh({ silent: true })}
                          >
                            Reload thread
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <EvidencePanel
                        timelineItems={timelineItems}
                        viewMode={viewMode}
                        className="flex-1 rounded-[26px] border border-border/70 bg-background/45 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                      />
                    )}
                  </div>

                  {/* 
                    ACTION SECTION - Deliberate Composer
                    RULE: Feel deliberate, not impulsive
                    RULE: Visually separate drafting from history
                   */}
                  <div className="no-print border-t border-border/80 bg-[linear-gradient(180deg,rgba(15,23,42,0.02),rgba(15,23,42,0.12))] px-3 pb-3 pt-3 sm:px-4">
                    <div className="mb-3 rounded-[22px] border border-border/70 bg-background/35 px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        Deliberate composer
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {composerDisabled
                          ? composerHelperText
                          : "Draft carefully. The message becomes part of the permanent family record as soon as it is sent."}
                      </p>
                    </div>
                    <div className="rounded-[26px] border border-border/70 bg-background/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                      <DeliberateComposer
                        disabled={composerDisabled}
                        helperText={composerHelperText}
                        onSend={handleSend}
                        onTyping={setTyping}
                        placeholder={composerPlaceholder}
                      />
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex flex-1 items-center justify-center p-6">
                  <div className="w-full max-w-lg rounded-[30px] border border-border/70 bg-gradient-to-b from-background/60 to-background/30 p-8 text-center shadow-[0_24px_50px_-36px_rgba(15,23,42,0.9)]">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] border border-primary/15 bg-primary/10 text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                      <MessageSquare className="h-8 w-8" />
                    </div>
                    <h2 className="mt-5 text-xl font-semibold">No conversation loaded yet</h2>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">
                      {setupError
                        ? "Messaging setup is currently blocked for this account in the connected backend. Retry setup or open the conversation list if a thread already exists."
                        : "Open the conversation list to choose the family channel, a group, or a direct message."}
                    </p>
                    <div className="mx-auto mt-5 max-w-sm rounded-[22px] border border-border/70 bg-background/35 px-4 py-3 text-left">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        Ready when needed
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Family channel stays the primary written record. Open a narrower thread only when the context truly requires it.
                      </p>
                    </div>
                    <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
                      {isMobile && (
                        <Button variant="outline" className="rounded-xl" onClick={() => setShowSidebar(true)}>
                          Conversations
                        </Button>
                      )}
                      <Button variant="outline" className="rounded-xl" onClick={() => void ensureFamilyChannel()}>
                        Retry setup
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </div>

          {/* New Conversation Modal */}
          <Dialog open={showNewDM && !showGroupConfirm} onOpenChange={(open) => {
            setShowNewDM(open);
            if (!open) setSelectedMembers([]);
          }}>
            <DialogContent className="max-w-md mx-4 md:mx-auto max-h-[85vh] overflow-hidden flex flex-col">
              <DialogHeader>
                <DialogTitle>New Conversation</DialogTitle>
              </DialogHeader>
              <p className="text-sm text-muted-foreground">
                Select recipients:
              </p>
              <ScrollArea className="flex-1 max-h-64">
                <div className="space-y-1 pr-2">
                  {familyMembers
                    .filter((m) => m.profile_id !== profileId)
                    .map((member) => {
                      const isSelected = selectedMembers.some(m => m.profile_id === member.profile_id);
                      return (
                        <button
                          key={member.id}
                          onClick={() => toggleMemberSelection(member)}
                          className={cn(
                            "w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left",
                            isSelected 
                              ? "bg-muted border border-border" 
                              : "hover:bg-muted/50 border border-transparent"
                          )}
                        >
                          <div className={cn(
                            "w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0",
                            isSelected ? "bg-foreground border-foreground" : "border-muted-foreground/30"
                          )}>
                            {isSelected && <Check className="w-3 h-3 text-background" />}
                          </div>
                          <Avatar className="w-9 h-9 flex-shrink-0">
                            <AvatarFallback className="text-sm">
                              {getInitials(member.full_name, member.email)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">
                              {member.full_name || member.email}
                            </p>
                          </div>
                          {getRoleBadge(member.role)}
                        </button>
                      );
                    })}
                </div>
              </ScrollArea>
              
              {selectedMembers.length > 0 && (
                <div className="p-3 rounded-lg bg-muted/50 text-sm">
                  <span className="font-medium">{selectedMembers.length} selected</span>
                </div>
              )}
              
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setShowNewDM(false);
                    setSelectedMembers([]);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleStartConversation}
                  disabled={selectedMembers.length === 0}
                >
                  {selectedMembers.length > 1 ? "Create Group" : "Start Message"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Group Creation Modal */}
          <Dialog open={showGroupConfirm} onOpenChange={setShowGroupConfirm}>
            <DialogContent className="max-w-md mx-4 md:mx-auto">
              <DialogHeader>
                <DialogTitle>Create Group</DialogTitle>
              </DialogHeader>
              
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Group Name</label>
                  <Input
                    placeholder="e.g., Schedule Coordination"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    autoFocus
                  />
                </div>
                
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    {selectedMembers.length} members selected
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedMembers.map((member) => (
                      <Badge key={member.profile_id} variant="secondary" className="text-xs">
                        {member.full_name || member.email}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
              
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowGroupConfirm(false)}
                  disabled={creatingGroup}
                >
                  Back
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleCreateGroupChat}
                  disabled={!groupName.trim() || creatingGroup}
                >
                  {creatingGroup ? "Creating..." : "Create Group"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </TooltipProvider>
    </DashboardLayout>
  );
};

export default MessagingHubPage;
