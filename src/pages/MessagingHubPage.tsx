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

import { useState, useCallback, useEffect, useMemo, useRef, type ChangeEvent } from "react";
import { motion } from "framer-motion";
import { 
  AlertTriangle,
  Copy,
  Info,
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
  Check,
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
import { useChildAccount } from "@/hooks/useChildAccount";
import { useProblemReport } from "@/components/feedback/useProblemReport";
import { buildMessageTimeline } from "@/components/messages/threadTimeline";
import type {
  MessagingThreadCanonicalExportPayload,
  MessagingThreadExportEvidencePackage,
  MessagingThreadExportManifest,
  MessagingThreadExportReceipt,
} from "@/components/messages/exportIntegrity";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { toast } from "sonner";
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

const formatHashPreview = (value: string | null | undefined, visible = 18) =>
  value ? `${value.slice(0, visible)}…` : "Unavailable";

const formatHashValue = (value: string | null | undefined, segmentLength = 8) => {
  if (!value) {
    return "Unavailable";
  }

  const segments = value.match(new RegExp(`.{1,${segmentLength}}`, "g"));
  return segments?.join(" ") ?? value;
};

const decodeBase64ToBlob = (base64Value: string, contentType: string) => {
  const binary = window.atob(base64Value);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new Blob([bytes], { type: contentType });
};

const downloadBlobArtifact = (options: {
  base64: string;
  contentType: string;
  fileName: string;
}) => {
  const blob = decodeBase64ToBlob(options.base64, options.contentType);
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = options.fileName;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
};

const encodeArrayBufferToBase64 = (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return window.btoa(binary);
};

interface MessagingThreadExportSummary {
  artifact_hash: string | null;
  artifact_hash_algorithm: string | null;
  artifact_type: string | null;
  canonicalization_version: string | null;
  content_hash: string;
  export_format: "json_manifest" | "pdf";
  exported_at: string;
  family_id: string;
  hash_algorithm: string;
  id: string;
  integrity_model_version: string | null;
  manifest_hash: string | null;
  manifest_hash_algorithm: string | null;
  pdf_artifact_hash: string | null;
  pdf_hash_algorithm: string | null;
  pdf_bytes_size: number | null;
  pdf_generated_at: string | null;
  record_count: number;
  signature_algorithm: string | null;
  signing_key_id: string | null;
  signature_present: boolean;
  thread_display_name: string;
  thread_id: string;
  thread_type: string;
  total_messages: number;
  total_system_events: number;
}

interface MessagingThreadExportCreateResponse {
  artifact_payload_json: string;
  canonical_payload: MessagingThreadCanonicalExportPayload;
  canonical_payload_json: string;
  evidence_package: MessagingThreadExportEvidencePackage;
  evidence_package_json: string;
  export: MessagingThreadExportSummary;
  manifest: MessagingThreadExportManifest;
  manifest_json: string;
  pdf_artifact: {
    base64: string;
    bytes_size: number;
    content_type: string;
    file_name: string;
    generated_at: string;
    hash: string;
    hash_algorithm: string;
  } | null;
  receipt: MessagingThreadExportReceipt;
}

interface MessagingThreadExportArtifactDownloadResponse {
  artifact: {
    base64: string;
    bytes_size: number;
    content_type: string;
    file_name: string;
    hash: string | null;
    hash_algorithm: string | null;
    kind: "json_evidence_package" | "pdf";
  };
  export: MessagingThreadExportSummary;
}

interface MessagingThreadExportVerificationLayer {
  algorithm: string | null;
  computed: string | null;
  label: string;
  matches: boolean | null;
  note: string | null;
  status: "match" | "mismatch" | "not_supported" | "unavailable";
  stored: string | null;
}

interface MessagingThreadExportSignatureLayer {
  algorithm: string | null;
  note: string | null;
  present: boolean;
  status: "match" | "mismatch" | "not_supported";
  valid: boolean | null;
}

type MessagingThreadExportVerificationStatus =
  | "artifact_not_found"
  | "artifact_hash_unavailable"
  | "match"
  | "mismatch"
  | "not_authorized"
  | "pdf_hash_unavailable"
  | "receipt_not_found"
  | "signature_invalid"
  | "verification_not_supported";

type MessagingThreadExportVerificationMode =
  | "provided_pdf_artifact"
  | "provided_package_json"
  | "stored_pdf_artifact"
  | "stored_signature"
  | "stored_source";

interface MessagingThreadExportVerifyResponse {
  computed_hash: string | null;
  export: MessagingThreadExportSummary;
  status: MessagingThreadExportVerificationStatus;
  stored_hash: string | null;
  verification_layers: {
    artifact_hash: MessagingThreadExportVerificationLayer;
    canonical_content_hash: MessagingThreadExportVerificationLayer;
    manifest_hash: MessagingThreadExportVerificationLayer;
    pdf_artifact_hash: MessagingThreadExportVerificationLayer;
    receipt_signature: MessagingThreadExportSignatureLayer;
  };
  verification_mode: MessagingThreadExportVerificationMode;
}

type ReceiptCopyField = "pdf-hash" | "receipt-id";

type MessagingExportErrorPayload = {
  error?: string;
  status?: MessagingThreadExportVerificationStatus;
};

type VerificationPresentation = {
  badgeLabel: string;
  badgeToneClass: string;
  description: string;
  headline: string;
  isAlert: boolean;
};

type ReceiptPanelPresentation = {
  badgeLabel: string;
  badgeToneClass: string;
  description: string;
  headline: string;
  isAlert: boolean;
};

const formatVerificationModeLabel = (mode: MessagingThreadExportVerificationMode) => {
  switch (mode) {
    case "stored_source":
      return "Current server record";
    case "stored_pdf_artifact":
      return "Stored PDF artifact";
    case "provided_pdf_artifact":
      return "Uploaded PDF artifact";
    case "provided_package_json":
      return "Uploaded evidence package";
    case "stored_signature":
      return "Stored receipt signature";
    default:
      return "Verification";
  }
};

const getVerificationPresentation = (
  result: MessagingThreadExportVerifyResponse | null,
): VerificationPresentation => {
  if (!result) {
    return {
      badgeLabel: "Status unknown",
      badgeToneClass: "border-white/12 bg-white/5 text-slate-200/80",
      description:
        "Run verification to compare a current server record, evidence package, or PDF artifact against the stored receipt.",
      headline: "Verification status unknown",
      isAlert: false,
    };
  }

  switch (result.status) {
    case "match":
      return {
        badgeLabel: "Verified",
        badgeToneClass: "border-emerald-300/25 bg-emerald-400/10 text-emerald-50",
        description:
          result.verification_mode === "stored_signature"
            ? "Verification match. The stored server signature on this export receipt is valid."
            : result.verification_mode === "provided_pdf_artifact"
              ? "Verification match. This PDF still matches the stored export receipt."
              : result.verification_mode === "stored_pdf_artifact"
                ? "Verification match. The stored PDF artifact still matches the stored export receipt."
                : result.verification_mode === "provided_package_json"
                  ? "Verification match. This evidence package still matches the stored export receipt."
                  : "Verification match. The current server record still matches the stored export receipt.",
        headline: "Verification match",
        isAlert: false,
      };
    case "mismatch":
      return {
        badgeLabel: "Mismatch",
        badgeToneClass: "border-rose-300/30 bg-rose-500/10 text-rose-50",
        description:
          result.verification_mode === "provided_pdf_artifact" ||
          result.verification_mode === "stored_pdf_artifact"
            ? "Verification mismatch. The file does not match the stored export receipt and may have been altered."
            : result.verification_mode === "provided_package_json"
              ? "Verification mismatch. The evidence package does not match the stored export receipt and may have been altered."
              : "Verification mismatch. The checked material does not match the stored export receipt.",
        headline: "Verification mismatch",
        isAlert: true,
      };
    case "receipt_not_found":
      return {
        badgeLabel: "Receipt not found",
        badgeToneClass: "border-slate-300/20 bg-slate-500/10 text-slate-100",
        description: "The requested export receipt could not be found.",
        headline: "Receipt unavailable",
        isAlert: false,
      };
    case "artifact_not_found":
      return {
        badgeLabel: "Artifact not found",
        badgeToneClass: "border-slate-300/20 bg-slate-500/10 text-slate-100",
        description:
          result.verification_mode === "stored_pdf_artifact"
            ? "The stored PDF artifact linked to this receipt could not be found."
            : "The requested receipt or artifact could not be found.",
        headline: "Artifact unavailable",
        isAlert: false,
      };
    case "not_authorized":
      return {
        badgeLabel: "Not authorized",
        badgeToneClass: "border-amber-300/25 bg-amber-500/10 text-amber-50",
        description: "You do not have permission to verify this export.",
        headline: "Verification blocked",
        isAlert: false,
      };
    case "signature_invalid":
      return {
        badgeLabel: "Signature invalid",
        badgeToneClass: "border-rose-300/30 bg-rose-500/10 text-rose-50",
        description: "The stored signature could not be validated.",
        headline: "Receipt signature invalid",
        isAlert: true,
      };
    case "verification_not_supported":
      return {
        badgeLabel: "Not supported",
        badgeToneClass: "border-slate-300/20 bg-slate-500/10 text-slate-100",
        description: "This verification mode is not available for this export.",
        headline: "Verification limited",
        isAlert: false,
      };
    case "pdf_hash_unavailable":
      return {
        badgeLabel: "PDF hash unavailable",
        badgeToneClass: "border-slate-300/20 bg-slate-500/10 text-slate-100",
        description: "This receipt does not include the exact PDF hash required for PDF verification.",
        headline: "PDF verification unavailable",
        isAlert: false,
      };
    case "artifact_hash_unavailable":
      return {
        badgeLabel: "Package hash unavailable",
        badgeToneClass: "border-slate-300/20 bg-slate-500/10 text-slate-100",
        description:
          "This receipt or evidence package does not include the exact JSON evidence package hash required for package verification.",
        headline: "Package verification unavailable",
        isAlert: false,
      };
    default:
      return {
        badgeLabel: "Status unknown",
        badgeToneClass: "border-white/12 bg-white/5 text-slate-200/80",
        description: "Review the verification details below.",
        headline: "Verification result",
        isAlert: false,
      };
  }
};

const buildUnavailableVerificationLayer = (
  label: string,
  stored: string | null,
  algorithm: string | null,
  note: string,
): MessagingThreadExportVerificationLayer => ({
  algorithm,
  computed: null,
  label,
  matches: null,
  note,
  status: "unavailable",
  stored,
});

const buildFallbackVerificationResult = (options: {
  errorMessage: string;
  exportRecord: MessagingThreadExportSummary;
  status: MessagingThreadExportVerificationStatus;
  verificationMode: MessagingThreadExportVerificationMode;
}): MessagingThreadExportVerifyResponse => {
  const genericNote = `${options.errorMessage} Verification did not continue for the remaining receipt layers.`;

  return {
    computed_hash: null,
    export: options.exportRecord,
    status: options.status,
    stored_hash:
      options.verificationMode === "provided_pdf_artifact" ||
      options.verificationMode === "stored_pdf_artifact"
        ? options.exportRecord.pdf_artifact_hash
        : options.exportRecord.content_hash,
    verification_layers: {
      artifact_hash: buildUnavailableVerificationLayer(
        "JSON evidence package hash",
        options.exportRecord.artifact_hash,
        options.exportRecord.artifact_hash_algorithm,
        genericNote,
      ),
      canonical_content_hash: buildUnavailableVerificationLayer(
        "Canonical content hash",
        options.exportRecord.content_hash,
        options.exportRecord.hash_algorithm,
        genericNote,
      ),
      manifest_hash: buildUnavailableVerificationLayer(
        "Manifest hash",
        options.exportRecord.manifest_hash,
        options.exportRecord.manifest_hash_algorithm,
        genericNote,
      ),
      pdf_artifact_hash: buildUnavailableVerificationLayer(
        "PDF artifact hash",
        options.exportRecord.pdf_artifact_hash,
        options.exportRecord.pdf_hash_algorithm,
        genericNote,
      ),
      receipt_signature: {
        algorithm: options.exportRecord.signature_algorithm,
        note: genericNote,
        present: options.exportRecord.signature_present,
        status: options.status === "signature_invalid" ? "mismatch" : "not_supported",
        valid: options.status === "signature_invalid" ? false : null,
      },
    },
    verification_mode: options.verificationMode,
  };
};

const readMessagingExportError = async (
  error: unknown,
): Promise<{ message: string | null; status: MessagingThreadExportVerificationStatus | null }> => {
  if (!error || typeof error !== "object" || !("context" in error)) {
    return { message: null, status: null };
  }

  const context = (error as { context?: unknown }).context;
  if (!(context instanceof Response)) {
    return { message: null, status: null };
  }

  try {
    const payload = (await context.clone().json()) as MessagingExportErrorPayload;
    return {
      message: typeof payload.error === "string" ? payload.error : null,
      status: payload.status ?? null,
    };
  } catch {
    return { message: null, status: null };
  }
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
  const { isChildAccount } = useChildAccount();
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
  const [threadExports, setThreadExports] = useState<MessagingThreadExportSummary[]>([]);
  const [threadExportsLoading, setThreadExportsLoading] = useState(false);
  const [threadExportsError, setThreadExportsError] = useState<string | null>(null);
  const [exportingThread, setExportingThread] = useState(false);
  const [showVerifyDialog, setShowVerifyDialog] = useState(false);
  const [selectedExportId, setSelectedExportId] = useState<string | null>(null);
  const [copiedReceiptField, setCopiedReceiptField] = useState<ReceiptCopyField | null>(null);
  const [uploadedManifestName, setUploadedManifestName] = useState<string | null>(null);
  const [uploadedManifestJson, setUploadedManifestJson] = useState<string | null>(null);
  const [uploadedPdfName, setUploadedPdfName] = useState<string | null>(null);
  const [uploadedPdfBase64, setUploadedPdfBase64] = useState<string | null>(null);
  const [downloadingArtifact, setDownloadingArtifact] = useState<"json_evidence_package" | "pdf" | null>(null);
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [verificationResult, setVerificationResult] = useState<MessagingThreadExportVerifyResponse | null>(null);
  const receiptCopyResetRef = useRef<number | null>(null);
  const composerSectionRef = useRef<HTMLDivElement | null>(null);
  
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
    if (!isMobile || !activeThread || activeThreadLoading) {
      return;
    }

    const composerSection = composerSectionRef.current;
    if (!composerSection) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      composerSection.scrollIntoView({ block: "end" });
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [activeThread, activeThreadLoading, isMobile]);

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

  const loadThreadExports = useCallback(async () => {
    if (!activeThread?.id || !activeFamilyId) {
      setThreadExports([]);
      setThreadExportsError(null);
      setSelectedExportId(null);
      return;
    }

    setThreadExportsLoading(true);
    setThreadExportsError(null);

    const { data, error } = await supabase.functions.invoke("messaging-thread-export", {
      body: {
        action: "list",
        family_id: activeFamilyId,
        thread_id: activeThread.id,
      },
    });

    if (error) {
      setThreadExports([]);
      setSelectedExportId(null);
      setThreadExportsError(error.message || "Unable to load export records.");
      setThreadExportsLoading(false);
      return;
    }

    const exports = ((data?.exports as MessagingThreadExportSummary[] | undefined) ?? []);
    setThreadExports(exports);
    setSelectedExportId((current) =>
      current && exports.some((record) => record.id === current)
        ? current
        : exports[0]?.id ?? null,
    );
    setThreadExportsLoading(false);
  }, [activeFamilyId, activeThread?.id]);

  useEffect(() => {
    void loadThreadExports();
  }, [loadThreadExports]);

  useEffect(() => {
    setUploadedManifestJson(null);
    setUploadedManifestName(null);
    setUploadedPdfBase64(null);
    setUploadedPdfName(null);
    setVerificationResult(null);
    setCopiedReceiptField(null);
  }, [activeThread?.id]);

  useEffect(() => () => {
    if (receiptCopyResetRef.current) {
      window.clearTimeout(receiptCopyResetRef.current);
    }
  }, []);

  /**
   * Export to PDF - Court-ready document
   * RULE: Uses the exact server-generated PDF artifact bytes
   */
  const handleExportPDF = useCallback(async () => {
    if (!activeThread || !profileId || !activeFamilyId) {
      toast.error("Open a family-scoped thread before exporting.");
      return;
    }

    try {
      setExportingThread(true);
      const { data, error } = await supabase.functions.invoke("messaging-thread-export", {
        body: {
          action: "create",
          export_format: "pdf",
          family_id: activeFamilyId,
          thread_id: activeThread.id,
        },
      });

      if (error) {
        throw error;
      }

      const exportPackage = data as MessagingThreadExportCreateResponse;
      if (!exportPackage.pdf_artifact) {
        throw new Error("The server did not return a PDF artifact for this export.");
      }

      downloadBlobArtifact({
        base64: exportPackage.pdf_artifact.base64,
        contentType: exportPackage.pdf_artifact.content_type,
        fileName: exportPackage.pdf_artifact.file_name,
      });

      const evidencePackageBlob = new Blob([exportPackage.evidence_package_json], {
        type: "application/json;charset=utf-8",
      });
      const manifestUrl = URL.createObjectURL(evidencePackageBlob);
      const manifestLink = document.createElement("a");
      manifestLink.href = manifestUrl;
      manifestLink.download = exportPackage.pdf_artifact.file_name.replace(/\.pdf$/i, "-evidence-package.json");
      manifestLink.click();
      setTimeout(() => URL.revokeObjectURL(manifestUrl), 0);

      await loadThreadExports();
      setVerificationResult(null);
      toast.success(
        `Server-generated evidence package exported. Receipt ${exportPackage.export.id.slice(0, 8)}… recorded with PDF hash ${formatHashPreview(exportPackage.pdf_artifact.hash, 16)}.`,
      );
    } catch (error) {
      console.error("Error exporting Messaging Hub PDF:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unable to export the recorded thread right now.";
      toast.error(errorMessage);
    } finally {
      setExportingThread(false);
    }
  }, [
    activeFamilyId,
    activeThread,
    loadThreadExports,
    profileId,
  ]);

  /**
   * Print current view
   * RULE: Court View must be printable
   */
  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const handleCopyReceiptValue = useCallback(async (
    label: string,
    value: string | null,
    field: ReceiptCopyField,
  ) => {
    if (!value) {
      toast.error(`${label} is not available for this export receipt.`);
      return;
    }

    if (!navigator.clipboard?.writeText) {
      toast.error("Clipboard copy is not available in this browser.");
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      setCopiedReceiptField(field);
      if (receiptCopyResetRef.current) {
        window.clearTimeout(receiptCopyResetRef.current);
      }
      receiptCopyResetRef.current = window.setTimeout(() => {
        setCopiedReceiptField(null);
      }, 1800);
      toast.success(`${label} copied.`);
    } catch (error) {
      console.error(`Unable to copy ${label}:`, error);
      toast.error(`Unable to copy ${label.toLowerCase()} right now.`);
    }
  }, []);

  const handleManifestFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0] ?? null;
      if (!file) {
        setUploadedManifestJson(null);
        setUploadedManifestName(null);
        return;
      }

      try {
        const fileText = await file.text();
        setUploadedManifestJson(fileText);
        setUploadedManifestName(file.name);
        setVerificationResult(null);
      } catch (error) {
        console.error("Unable to read evidence package file:", error);
        setUploadedManifestJson(null);
        setUploadedManifestName(null);
        toast.error("Unable to read the selected evidence package file.");
      } finally {
        event.target.value = "";
      }
    },
    [],
  );

  const handlePdfFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0] ?? null;
      if (!file) {
        setUploadedPdfBase64(null);
        setUploadedPdfName(null);
        return;
      }

      try {
        const arrayBuffer = await file.arrayBuffer();
        setUploadedPdfBase64(encodeArrayBufferToBase64(arrayBuffer));
        setUploadedPdfName(file.name);
        setVerificationResult(null);
      } catch (error) {
        console.error("Unable to read PDF artifact file:", error);
        setUploadedPdfBase64(null);
        setUploadedPdfName(null);
        toast.error("Unable to read the selected PDF artifact.");
      } finally {
        event.target.value = "";
      }
    },
    [],
  );

  const handleDownloadStoredArtifact = useCallback(
    async (
      artifactKind: "json_evidence_package" | "pdf",
      exportIdOverride?: string | null,
    ) => {
      const targetExportId = exportIdOverride ?? selectedExportId;

      if (!activeFamilyId) {
        toast.error("Open a family-scoped thread before downloading an export artifact.");
        return;
      }

      if (!targetExportId) {
        toast.error("Select an export receipt before downloading an artifact.");
        return;
      }

      try {
        setDownloadingArtifact(artifactKind);
        const { data, error } = await supabase.functions.invoke("messaging-thread-export", {
          body: {
            action: "download",
            artifact_kind: artifactKind,
            export_id: targetExportId,
            family_id: activeFamilyId,
          },
        });

        if (error) {
          throw error;
        }

        const downloadResponse = data as MessagingThreadExportArtifactDownloadResponse;
        downloadBlobArtifact({
          base64: downloadResponse.artifact.base64,
          contentType: downloadResponse.artifact.content_type,
          fileName: downloadResponse.artifact.file_name,
        });
        toast.success(
          artifactKind === "pdf"
            ? "Server-generated PDF artifact downloaded."
            : "JSON evidence package downloaded.",
        );
      } catch (error) {
        console.error("Error downloading stored Messaging export artifact:", error);
        const errorMessage =
          error instanceof Error ? error.message : "Unable to download the selected export artifact.";
        toast.error(errorMessage);
      } finally {
        setDownloadingArtifact(null);
      }
    },
    [activeFamilyId, selectedExportId],
  );

  const runVerification = useCallback(
    async (verificationMode: MessagingThreadExportVerificationMode) => {
      if (!activeFamilyId) {
        toast.error("Open a family-scoped thread before verifying an export.");
        return;
      }

      if (!selectedExportId) {
        toast.error("Select an export record to verify.");
        return;
      }

      if (verificationMode === "provided_package_json" && !uploadedManifestJson) {
        toast.error("Choose an evidence-package JSON file before verifying the package.");
        return;
      }

      if (verificationMode === "provided_pdf_artifact" && !uploadedPdfBase64) {
        toast.error("Choose a PDF artifact before verifying the file.");
        return;
      }

      setVerificationLoading(true);
      setVerificationResult(null);

      try {
        const { data, error } = await supabase.functions.invoke("messaging-thread-export", {
          body: {
            action: "verify",
            export_id: selectedExportId,
            family_id: activeFamilyId,
            provided_pdf_base64:
              verificationMode === "provided_pdf_artifact"
                ? uploadedPdfBase64
                : undefined,
            provided_package_json:
              verificationMode === "provided_package_json"
                ? uploadedManifestJson
                : undefined,
            verification_mode: verificationMode,
          },
        });

        if (error) {
          throw error;
        }

        setVerificationResult(data as MessagingThreadExportVerifyResponse);
      } catch (error) {
        console.error("Error verifying Messaging Hub export:", error);
        const selectedExportRecord =
          threadExports.find((record) => record.id === selectedExportId) ?? null;
        const structuredError = await readMessagingExportError(error);
        const fallbackErrorMessage =
          structuredError.message ??
          (error instanceof Error ? error.message : "Unable to verify the selected export.");

        if (structuredError.status && selectedExportRecord) {
          setVerificationResult(
            buildFallbackVerificationResult({
              errorMessage: fallbackErrorMessage,
              exportRecord: selectedExportRecord,
              status: structuredError.status,
              verificationMode,
            }),
          );
          toast.error(fallbackErrorMessage);
        } else {
          toast.error(fallbackErrorMessage);
        }
      } finally {
        setVerificationLoading(false);
      }
    },
    [
      activeFamilyId,
      selectedExportId,
      threadExports,
      uploadedManifestJson,
      uploadedPdfBase64,
    ],
  );

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
              ? `${messages.length} recorded message${messages.length === 1 ? "" : "s"} currently visible in this conversation.`
              : "No messages are on record yet. The first message will begin this conversation.";
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
  const modeSummaryLabel = courtView ? "Legal view active" : "Chat view active";
  const threadShellClass = courtView
    ? "border-slate-300/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.99),rgba(245,245,244,0.97))] shadow-[0_28px_60px_-38px_rgba(120,113,108,0.3)]"
    : "border-border/70 bg-gradient-to-b from-card via-card to-card/90 shadow-[0_28px_60px_-38px_rgba(15,23,42,0.92)]";
  const threadHeaderClass = courtView
    ? "border-slate-300/70 bg-[linear-gradient(180deg,rgba(250,250,249,0.98),rgba(244,244,245,0.94))]"
    : "border-border/80 bg-[linear-gradient(135deg,rgba(15,23,42,0.9),rgba(15,23,42,0.7))]";
  const threadHeaderTextClass = courtView ? "text-slate-950" : "text-white";
  const threadHeaderSubtleClass = courtView ? "text-slate-600" : "text-slate-300/70";
  const threadActionBarClass = courtView
    ? "border-slate-300/70 bg-white/92"
    : "border-white/10 bg-white/5";
  const threadActionTextClass = courtView ? "text-slate-600" : "text-slate-300/75";
  const threadActionButtonClass = courtView
    ? "border-slate-300/70 bg-white text-slate-900 hover:bg-slate-50"
    : "border-white/10 bg-white/5 text-white hover:bg-white/10";
  const evidenceShellClass = courtView
    ? "bg-[linear-gradient(180deg,rgba(161,161,170,0.08),transparent_28%)]"
    : "bg-[linear-gradient(180deg,rgba(15,23,42,0.06),transparent_35%)]";
  const evidenceCardClass = courtView
    ? "border-slate-300/70 bg-white/90"
    : "border-border/70 bg-background/35";
  const evidencePanelClass = courtView
    ? "border-slate-300/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(245,245,244,0.96))]"
    : "border-border/70 bg-background/45";
  const composerSectionClass = courtView
    ? "border-slate-300/70 bg-[linear-gradient(180deg,rgba(245,245,244,0.9),rgba(231,229,228,0.92))]"
    : "border-border/80 bg-[linear-gradient(180deg,rgba(15,23,42,0.02),rgba(15,23,42,0.12))]";
  const composerCardClass = courtView
    ? "border-slate-300/70 bg-white/92"
    : "border-border/70 bg-background/55";
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
    exportingThread;
  const latestThreadExport = threadExports[0] ?? null;
  const selectedThreadExport =
    threadExports.find((record) => record.id === selectedExportId) ?? latestThreadExport;
  const latestReceiptVerificationResult =
    latestThreadExport && verificationResult?.export.id === latestThreadExport.id
      ? verificationResult
      : null;
  const verificationPresentation = getVerificationPresentation(verificationResult);
  const exportScopeError =
    activeThread && !activeFamilyId
      ? "Select a family before using export receipts. Messaging export actions require explicit family scope."
      : null;
  const receiptPanelPresentation: ReceiptPanelPresentation = exportScopeError
    ? {
        badgeLabel: "Scope required",
        badgeToneClass: "border-amber-300/25 bg-amber-500/10 text-amber-50",
        description: exportScopeError,
        headline: "Family scope required",
        isAlert: true,
      }
    : !latestThreadExport
      ? {
          badgeLabel: "No receipt yet",
          badgeToneClass: "border-white/12 bg-white/5 text-slate-200/80",
          description:
            "Create an evidence package to store a tamper-evident receipt, the exact server-generated PDF hash, and the paired JSON evidence package.",
          headline: "No export receipt recorded for this thread",
          isAlert: false,
        }
      : latestReceiptVerificationResult
        ? getVerificationPresentation(latestReceiptVerificationResult)
        : {
            badgeLabel: "Status unknown",
            badgeToneClass: "border-white/12 bg-white/5 text-slate-200/80",
            description:
              "A server-generated receipt is recorded for this export. You can verify whether the PDF still matches the stored receipt.",
            headline: "Verification status unknown",
            isAlert: false,
          };
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
          ? "border-accent/30 bg-accent/10 text-cyan-50"
          : "border-white/10 bg-white/5 text-slate-200/70",
  );

  // Sidebar content - thread navigation
  const renderSidebarContent = () => {
    const tabItems = ["family", "groups", "direct"] as const;
    const familyUnread = showIndicator ? getUnreadByType("family_channel") : 0;
    const groupsUnread = showIndicator ? getUnreadByType("group_chat") : 0;
    const directUnread = showIndicator ? getUnreadByType("direct_message") : 0;

    const renderTabContentInner = () => (
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
                    <span className={cn(
                      "rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em]",
                      thread.last_message
                        ? "border-primary/15 bg-primary/10 text-primary"
                        : "border-border/70 bg-background/45 text-muted-foreground",
                    )}>
                      {thread.last_message ? "Existing record" : "First message pending"}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {getThreadPreviewText(thread, "No messages are on record yet")}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground/80">
                    {thread.last_message
                      ? "Recorded conversation already underway"
                      : "The first message will begin this direct record"}
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
            {renderTabContentInner()}
          </SwipeableTabs>
        ) : (
          renderTabContentInner()
        )}
      </Tabs>
    );
  };

  const exportReceiptPanel = activeThread ? (
    <section className="no-print mt-4 rounded-[28px] border border-border/70 bg-[linear-gradient(180deg,hsl(var(--card)),hsl(var(--card)/0.92))] p-4 shadow-[0_24px_50px_-36px_rgba(15,23,42,0.9)] sm:p-5">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Export Receipt
              </p>
              <Badge
                variant="outline"
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]",
                  receiptPanelPresentation.badgeToneClass,
                )}
              >
                {receiptPanelPresentation.isAlert ? (
                  <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                ) : receiptPanelPresentation.badgeLabel === "Verified" ? (
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                ) : (
                  <Info className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                {receiptPanelPresentation.badgeLabel}
              </Badge>
              {threadExportsLoading && (
                <Badge variant="outline" className="rounded-full bg-background/70 text-muted-foreground">
                  Loading records
                </Badge>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-lg font-semibold text-foreground">
                {latestThreadExport
                  ? `Latest export receipt recorded ${format(new Date(latestThreadExport.exported_at), "MMM d, yyyy 'at' h:mm a")}`
                  : receiptPanelPresentation.headline}
              </p>
              <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
                {receiptPanelPresentation.description}
              </p>
              {latestThreadExport && (
                <p className="text-xs text-muted-foreground">
                  This export includes a tamper-evident receipt generated from server-authoritative records. You can verify whether the PDF still matches the stored receipt.
                </p>
              )}
            </div>

            {latestThreadExport && (
              <div className="grid gap-3 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-border/70 bg-background/55 px-4 py-3 text-xs text-muted-foreground">
                    <p className="font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      Receipt ID
                    </p>
                    <code className="mt-3 block break-all text-[11px] leading-5 text-foreground">
                      {latestThreadExport.id}
                    </code>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="mt-3 h-8 rounded-lg px-2 text-[11px]"
                      aria-label="Copy receipt ID"
                      onClick={() =>
                        void handleCopyReceiptValue(
                          "Receipt ID",
                          latestThreadExport.id,
                          "receipt-id",
                        )
                      }
                    >
                      {copiedReceiptField === "receipt-id" ? (
                        <>
                          <Check className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                          Copy receipt ID
                        </>
                      )}
                    </Button>
                  </div>

                  <div className="rounded-2xl border border-border/70 bg-background/55 px-4 py-3 text-xs text-muted-foreground">
                    <p className="font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      Receipt details
                    </p>
                    <p className="mt-3 text-sm font-medium text-foreground">
                      {latestThreadExport.record_count} record entr{latestThreadExport.record_count === 1 ? "y" : "ies"}
                    </p>
                    <div className="mt-3 space-y-1 text-[11px] leading-5 text-muted-foreground">
                      <p>Raw result: {latestReceiptVerificationResult?.status ?? "unknown"}</p>
                      {latestThreadExport.signing_key_id ? (
                        <p>Signing key ID: {latestThreadExport.signing_key_id}</p>
                      ) : null}
                      {latestThreadExport.signature_algorithm ? (
                        <p>Algorithm: {latestThreadExport.signature_algorithm}</p>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-border/70 bg-[linear-gradient(180deg,hsl(var(--background)/0.9),hsl(var(--muted)/0.2))] px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        PDF Hash
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Full value is copyable. The stored receipt is what links this hash to the server-generated PDF artifact.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-xl"
                      aria-label="Copy PDF hash"
                      disabled={!latestThreadExport.pdf_artifact_hash}
                      onClick={() =>
                        latestThreadExport.pdf_artifact_hash &&
                        void handleCopyReceiptValue(
                          "PDF hash",
                          latestThreadExport.pdf_artifact_hash,
                          "pdf-hash",
                        )
                      }
                    >
                      {copiedReceiptField === "pdf-hash" ? (
                        <>
                          <Check className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                          Copy hash
                        </>
                      )}
                    </Button>
                  </div>
                  <code className="mt-4 block break-all rounded-xl border border-border/70 bg-background/80 px-3 py-3 text-[12px] leading-6 text-foreground">
                    {formatHashValue(latestThreadExport.pdf_artifact_hash)}
                  </code>
                </div>
              </div>
            )}

            {latestThreadExport && (
              <p className="text-xs text-muted-foreground">
                The exact PDF bytes are generated on the server, hashed after rendering, and linked by the server-signed receipt. The PDF does not contain an embedded Acrobat-style digital signature.
              </p>
            )}
            {threadExportsError && (
              <p className="text-sm text-warning">{threadExportsError}</p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl"
              disabled={!activeFamilyId || !latestThreadExport || downloadingArtifact === "pdf"}
              onClick={() =>
                void handleDownloadStoredArtifact("pdf", latestThreadExport?.id ?? null)
              }
            >
              {downloadingArtifact === "pdf" ? "Downloading PDF..." : "Download PDF"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl"
              disabled={!activeFamilyId || !latestThreadExport || downloadingArtifact === "json_evidence_package"}
              onClick={() =>
                void handleDownloadStoredArtifact(
                  "json_evidence_package",
                  latestThreadExport?.id ?? null,
                )
              }
            >
              {downloadingArtifact === "json_evidence_package"
                ? "Downloading JSON..."
                : "Download JSON package"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl"
              disabled={!activeFamilyId || !activeThread || threadExportsLoading}
              onClick={() => {
                setSelectedExportId(latestThreadExport?.id ?? null);
                setShowVerifyDialog(true);
              }}
            >
              Verify receipt
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl"
              disabled={!activeFamilyId || !activeThread || threadExportsLoading}
              onClick={() => void loadThreadExports()}
            >
              Refresh records
            </Button>
          </div>
        </div>
      </div>
    </section>
  ) : null;

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
          data-testid="messaging-page-shell"
          className={cn(
            "relative flex min-h-[calc(100vh-8rem)] flex-col",
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
            <div className="surface-hero relative isolate overflow-hidden p-5">
              <div className="absolute inset-x-0 top-0 h-px bg-white/10" />
              <div className="absolute left-8 top-6 h-32 w-32 rounded-full bg-primary/20 blur-3xl" />
              <div className="absolute bottom-0 right-0 h-40 w-40 rounded-full bg-accent/15 blur-3xl" />
              <div className="relative flex flex-col gap-5">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                  <div className="min-w-0 space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="eyebrow-pill-dark">
                        Messaging record
                      </div>
                      <div className="status-pill-dark">
                        {modeSummaryLabel}
                      </div>
                      {activeThread ? (
                        <>
                          <div className="status-pill-dark">
                            {currentThreadTypeLabel}
                          </div>
                          <div className={cn("inline-flex rounded-full border px-3 py-1 text-xs font-medium", threadStatusBadgeClass)}>
                            {recordStateLabel}
                          </div>
                        </>
                      ) : null}
                      {showIndicator && totalUnread > 0 && (
                        <UnreadBadge count={totalUnread} size="md" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <h1 className="text-2xl font-semibold tracking-tight text-white md:text-3xl">
                        Messaging Hub
                      </h1>
                      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-200/80">
                        Review the current family record, switch into legal view when needed, and keep the conversation itself ahead of utility controls.
                      </p>
                    </div>
                    <div className="surface-hero-panel px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300/70">
                        Selected conversation
                      </p>
                      <p className="mt-2 text-lg font-semibold text-white">{currentThreadTitle}</p>
                      <p className="mt-1 text-sm leading-6 text-slate-300/76">
                        {activeThread
                          ? currentThreadDescription
                          : "Choose the family channel, a group, or a direct thread to load the full record."}
                      </p>
                    </div>
                  </div>
                  {isMobile && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="relative w-fit rounded-2xl border-white/10 bg-white/5 px-4 text-white hover:bg-white/10"
                      onClick={() => setShowSidebar(true)}
                    >
                      <Menu className="mr-2 h-4 w-4" />
                      Conversations
                      {showIndicator && totalUnread > 0 && (
                        <UnreadBadge
                          count={totalUnread}
                          className="absolute -right-1.5 -top-1.5"
                          size="sm"
                        />
                      )}
                    </Button>
                  )}
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

          <Dialog
            open={showVerifyDialog}
            onOpenChange={(open) => {
              setShowVerifyDialog(open);
              if (!open) {
                setUploadedManifestJson(null);
                setUploadedManifestName(null);
                setUploadedPdfBase64(null);
                setUploadedPdfName(null);
              }
            }}
          >
            <DialogContent className="max-w-2xl mx-4 md:mx-auto">
              <DialogHeader>
                <DialogTitle>Verify Export Receipt</DialogTitle>
              </DialogHeader>
              <div className="space-y-5">
                <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
                  <p className="text-sm font-medium text-foreground">Verification options</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Select a recorded export receipt for this thread, then verify it against the
                    current server-authoritative record, a downloaded JSON evidence package, an
                    uploaded PDF artifact, the stored PDF artifact, or the stored server-signed
                    receipt.
                  </p>
                </div>

                {exportScopeError && (
                  <div className="rounded-2xl border border-amber-300/25 bg-amber-500/10 p-4 text-sm text-amber-50">
                    {exportScopeError}
                  </div>
                )}

                <div className="space-y-3">
                  <p className="text-sm font-medium text-foreground">Recorded export receipts</p>
                  {threadExportsLoading ? (
                    <div className="flex items-center gap-2 rounded-2xl border border-border/70 bg-background/40 p-4 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading export records...
                    </div>
                  ) : threadExports.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-border/70 bg-background/30 p-4 text-sm text-muted-foreground">
                      No export records are saved for this thread yet.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {threadExports.map((record) => {
                        const isSelected = record.id === selectedExportId;
                        return (
                          <button
                            key={record.id}
                            type="button"
                            onClick={() => {
                              setSelectedExportId(record.id);
                              setVerificationResult(null);
                            }}
                            className={cn(
                              "w-full rounded-2xl border p-3 text-left transition-colors",
                              isSelected
                                ? "border-primary/30 bg-primary/10"
                                : "border-border/70 bg-background/35 hover:bg-background/50",
                            )}
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-foreground">
                                  Receipt {record.id.slice(0, 8)}…
                                </p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {format(new Date(record.exported_at), "MMM d, yyyy 'at' h:mm a")}
                                </p>
                              </div>
                              <Badge variant="outline" className="border-white/10 bg-white/5 text-slate-200/70">
                                {record.record_count} entr{record.record_count === 1 ? "y" : "ies"}
                              </Badge>
                            </div>
                            <p className="mt-2 text-xs text-muted-foreground">
                              PDF hash {formatHashPreview(record.pdf_artifact_hash, 20)} • Receipt ID {record.id.slice(0, 12)}… • Key {record.signing_key_id ?? "Unavailable"}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <p className="text-sm font-medium text-foreground">Optional evidence package</p>
                  <Input
                    accept=".json,application/json"
                    onChange={(event) => void handleManifestFileChange(event)}
                    type="file"
                  />
                  <p className="text-xs text-muted-foreground">
                    {uploadedManifestName
                      ? `Selected file: ${uploadedManifestName}`
                      : "Choose the paired JSON evidence package if you want to verify a downloaded package against the stored receipt."}
                  </p>
                </div>

                <div className="space-y-3">
                  <p className="text-sm font-medium text-foreground">Optional PDF artifact</p>
                  <Input
                    accept=".pdf,application/pdf"
                    onChange={(event) => void handlePdfFileChange(event)}
                    type="file"
                  />
                  <p className="text-xs text-muted-foreground">
                    {uploadedPdfName
                      ? `Selected file: ${uploadedPdfName}`
                      : "Choose a downloaded PDF artifact if you want to compare exact PDF bytes against the stored receipt hash."}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    className="rounded-xl"
                    disabled={!activeFamilyId || !selectedThreadExport || verificationLoading}
                    onClick={() => void runVerification("stored_source")}
                  >
                    {verificationLoading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    Verify current server record
                  </Button>
                  <Button
                    variant="outline"
                    className="rounded-xl"
                    disabled={!activeFamilyId || !selectedThreadExport || !uploadedManifestJson || verificationLoading}
                    onClick={() => void runVerification("provided_package_json")}
                  >
                    Verify uploaded package
                  </Button>
                  <Button
                    variant="outline"
                    className="rounded-xl"
                    disabled={!activeFamilyId || !selectedThreadExport || !uploadedPdfBase64 || verificationLoading}
                    onClick={() => void runVerification("provided_pdf_artifact")}
                  >
                    Verify uploaded PDF
                  </Button>
                  <Button
                    variant="outline"
                    className="rounded-xl"
                    disabled={!activeFamilyId || !selectedThreadExport || verificationLoading}
                    onClick={() => void runVerification("stored_pdf_artifact")}
                  >
                    Verify stored PDF artifact
                  </Button>
                  <Button
                    variant="outline"
                    className="rounded-xl"
                    disabled={!activeFamilyId || !selectedThreadExport || verificationLoading}
                    onClick={() => void runVerification("stored_signature")}
                  >
                    Verify stored server signature
                  </Button>
                </div>

                {verificationResult && (
                  <div
                    role={verificationPresentation.isAlert ? "alert" : "status"}
                    aria-live="polite"
                    className={cn("rounded-2xl border p-4", verificationPresentation.badgeToneClass)}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          {verificationPresentation.isAlert ? (
                            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                          ) : verificationResult.status === "match" ? (
                            <Check className="h-4 w-4" aria-hidden="true" />
                          ) : (
                            <Info className="h-4 w-4" aria-hidden="true" />
                          )}
                          <p className="text-sm font-semibold">{verificationPresentation.headline}</p>
                        </div>
                        <p className="text-sm opacity-90">
                          {verificationPresentation.description}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline" className="border-current/30 bg-transparent text-current">
                          {formatVerificationModeLabel(verificationResult.verification_mode)}
                        </Badge>
                        <Badge variant="outline" className="border-current/30 bg-transparent font-mono text-current">
                          Raw result: {verificationResult.status}
                        </Badge>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <div className="rounded-xl border border-current/20 bg-black/10 p-3 text-xs opacity-90">
                        <p className="font-semibold uppercase tracking-[0.14em]">Canonical content hash</p>
                        <p className="mt-2 break-all">Stored: {verificationResult.verification_layers.canonical_content_hash.stored ?? "Unavailable"}</p>
                        <p className="mt-1 break-all">Computed: {verificationResult.verification_layers.canonical_content_hash.computed ?? "Unavailable"}</p>
                        {verificationResult.verification_layers.canonical_content_hash.note ? (
                          <p className="mt-2 opacity-80">{verificationResult.verification_layers.canonical_content_hash.note}</p>
                        ) : null}
                      </div>
                      <div className="rounded-xl border border-current/20 bg-black/10 p-3 text-xs opacity-90">
                        <p className="font-semibold uppercase tracking-[0.14em]">Manifest hash</p>
                        <p className="mt-2 break-all">Stored: {verificationResult.verification_layers.manifest_hash.stored ?? "Unavailable"}</p>
                        <p className="mt-1 break-all">Computed: {verificationResult.verification_layers.manifest_hash.computed ?? "Unavailable"}</p>
                        {verificationResult.verification_layers.manifest_hash.note ? (
                          <p className="mt-2 opacity-80">{verificationResult.verification_layers.manifest_hash.note}</p>
                        ) : null}
                      </div>
                      <div className="rounded-xl border border-current/20 bg-black/10 p-3 text-xs opacity-90">
                        <p className="font-semibold uppercase tracking-[0.14em]">JSON evidence package hash</p>
                        <p className="mt-2 break-all">Stored: {verificationResult.verification_layers.artifact_hash.stored ?? "Unavailable"}</p>
                        <p className="mt-1 break-all">Computed: {verificationResult.verification_layers.artifact_hash.computed ?? "Unavailable"}</p>
                        {verificationResult.verification_layers.artifact_hash.note ? (
                          <p className="mt-2 opacity-80">{verificationResult.verification_layers.artifact_hash.note}</p>
                        ) : null}
                      </div>
                      <div className="rounded-xl border border-current/20 bg-black/10 p-3 text-xs opacity-90">
                        <p className="font-semibold uppercase tracking-[0.14em]">PDF artifact hash</p>
                        <p className="mt-2 break-all">Stored: {verificationResult.verification_layers.pdf_artifact_hash.stored ?? "Unavailable"}</p>
                        <p className="mt-1 break-all">Computed: {verificationResult.verification_layers.pdf_artifact_hash.computed ?? "Unavailable"}</p>
                        {verificationResult.verification_layers.pdf_artifact_hash.note ? (
                          <p className="mt-2 opacity-80">{verificationResult.verification_layers.pdf_artifact_hash.note}</p>
                        ) : null}
                      </div>
                      <div className="rounded-xl border border-current/20 bg-black/10 p-3 text-xs opacity-90">
                        <p className="font-semibold uppercase tracking-[0.14em]">Receipt signature</p>
                        <p className="mt-2">
                          Status: {verificationResult.verification_layers.receipt_signature.status}
                        </p>
                        <p className="mt-1">
                          Algorithm: {verificationResult.verification_layers.receipt_signature.algorithm ?? "Not configured"}
                        </p>
                        {verificationResult.export.signing_key_id ? (
                          <p className="mt-1 break-all">
                            Signing key: {verificationResult.export.signing_key_id}
                          </p>
                        ) : null}
                        {verificationResult.verification_layers.receipt_signature.note ? (
                          <p className="mt-2 opacity-80">{verificationResult.verification_layers.receipt_signature.note}</p>
                        ) : null}
                      </div>
                    </div>
                    <p className="mt-3 text-xs opacity-80">
                      Verification checks the stored server-signed receipt and the selected artifact
                      hashes. The PDF file is verifiable against the receipt, but it does not carry
                      an embedded Acrobat-style digital signature.
                    </p>
                  </div>
                )}
              </div>
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
                {renderSidebarContent()}
              </div>
            </SheetContent>
          </Sheet>

          {/* Main Content Area */}
          <div className="flex min-h-[38rem] flex-1 gap-4">
            {/* Desktop Sidebar */}
            {!isMobile && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="no-print flex w-72 flex-shrink-0 flex-col overflow-hidden rounded-[30px] border border-border/70 bg-gradient-to-b from-card via-card to-card/90 shadow-[0_24px_50px_-36px_rgba(15,23,42,0.9)] lg:w-80"
              >
                {renderSidebarContent()}
              </motion.div>
            )}

            {/* 
              Chat Area - Evidence + Action separation
              RULE: These two may not visually blur together
            */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              data-testid="messaging-thread-shell"
              className={cn(
                "flex min-h-[38rem] min-w-0 flex-1 flex-col overflow-hidden rounded-[30px] border",
                threadShellClass,
              )}
            >
              {activeThread ? (
                <>
                  {/* Thread Header - Context for attribution */}
                  <div className={cn("border-b px-4 py-4 sm:px-5", threadHeaderClass)}>
                    <div className="flex flex-col gap-4">
                      <div className="flex w-full items-start justify-between gap-3">
                        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
                          {activeThread.thread_type === "family_channel" ? (
                            <>
                              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                                <Hash className="h-5 w-5" />
                              </div>
                              <div className="min-w-0">
                                <h2 className={cn("text-sm font-semibold", threadHeaderTextClass)}>Family Channel</h2>
                                <p className={cn("text-[11px]", threadHeaderSubtleClass)}>
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
                                <h2 className={cn("truncate text-sm font-semibold", threadHeaderTextClass)}>
                                  {activeThread.name || "Group"}
                                </h2>
                                <p className={cn("truncate text-[11px]", threadHeaderSubtleClass)}>
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
                                <h2 className={cn("truncate text-sm font-semibold", threadHeaderTextClass)}>
                                  {activeThread.other_participant?.full_name ||
                                   activeThread.other_participant?.email ||
                                   "Unknown"}
                                </h2>
                                <div className="mt-1 flex flex-wrap items-center gap-2">
                                  {activeThread.other_participant?.role && (
                                    getRoleBadge(activeThread.other_participant.role)
                                  )}
                                  <Badge
                                    variant="outline"
                                    className={cn(
                                      "text-[10px] uppercase tracking-[0.14em]",
                                      threadActionBarClass,
                                      threadActionTextClass,
                                    )}
                                  >
                                    Direct record
                                  </Badge>
                                  <Badge variant="outline" className={threadStatusBadgeClass}>
                                    {recordStateLabel}
                                  </Badge>
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                        {!isMobile && !isChildAccount && activeThread.thread_type === "direct_message" ? (
                          <div className={cn("rounded-[18px] border p-1.5", threadActionBarClass)}>
                            <CallActionButtons
                              disabled={Boolean(currentThreadCall)}
                              loading={Boolean(startingCallType)}
                              onStartAudio={() => void handleStartCall("audio")}
                              onStartVideo={() => void handleStartCall("video")}
                            />
                          </div>
                        ) : null}
                      </div>
                      <div className={cn("flex flex-wrap items-center justify-between gap-3 rounded-[20px] border px-3 py-2.5", threadActionBarClass)}>
                        <p className={cn("text-xs", threadActionTextClass)}>
                          {recordState === "ready"
                            ? `${messages.length} recorded message${messages.length === 1 ? "" : "s"} visible.`
                            : recordState === "empty"
                              ? "No messages on record yet."
                              : recordStateDescription}
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                          {!isChildAccount && activeThread.thread_type === "direct_message" ? (
                            <div className={cn("rounded-[18px] border p-1.5 md:hidden", threadActionBarClass)}>
                              <CallActionButtons
                                disabled={Boolean(currentThreadCall)}
                                loading={Boolean(startingCallType)}
                                onStartAudio={() => void handleStartCall("audio")}
                                onStartVideo={() => void handleStartCall("video")}
                              />
                            </div>
                          ) : null}
                          <CourtViewToggle
                            compact={isMobile}
                            enabled={courtView}
                            onToggle={() =>
                              setViewMode((currentMode) =>
                                currentMode === "court" ? "chat" : "court",
                              )
                            }
                          />
                          <Button
                            variant="outline"
                            size={isMobile ? "icon" : "sm"}
                            className={cn("rounded-xl", threadActionButtonClass)}
                            onClick={() => void handleRefresh()}
                            disabled={isRefreshing || isPullRefreshing}
                            aria-label={isRefreshing || isPullRefreshing ? "Refreshing thread" : "Refresh thread"}
                          >
                            <RefreshCw
                              className={cn(
                                "h-4 w-4",
                                !isMobile && "mr-2",
                                (isRefreshing || isPullRefreshing) && "animate-spin",
                              )}
                            />
                            {!isMobile && ((isRefreshing || isPullRefreshing) ? "Refreshing..." : "Refresh")}
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="outline"
                                size={isMobile ? "icon" : "sm"}
                                className={cn("rounded-xl", threadActionButtonClass)}
                                aria-label="More messaging actions"
                              >
                                <MoreHorizontal className={cn("h-4 w-4", !isMobile && "mr-2")} />
                                {!isMobile && "More"}
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
                                {exportingThread ? "Exporting evidence package..." : "Export evidence package"}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                disabled={!activeThread || !activeFamilyId || threadExportsLoading}
                                onClick={() => {
                                  setSelectedExportId(latestThreadExport?.id ?? null);
                                  setShowVerifyDialog(true);
                                }}
                              >
                                <Check className="mr-2 h-4 w-4" />
                                Verify saved receipt
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
                    className={cn("no-print border-b px-5 py-3", courtView ? "border-slate-300/70" : "border-border/80")}
                  />

                  {/* 
                    EVIDENCE SECTION - Message History
                    RULE: Evidence and Action must be visually separated
                  */}
                  <div className={cn("flex min-h-0 flex-1 flex-col px-3 py-3 sm:px-4", evidenceShellClass)}>
                    <div className={cn("mb-3 flex flex-wrap items-center justify-between gap-3 rounded-[20px] border px-4 py-2.5", evidenceCardClass)}>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                          Record timeline
                        </p>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          {recordState === "loading_existing"
                            ? "Existing conversation record is loading."
                            : recordState === "loading_empty"
                              ? "Checking this thread before the first message."
                              : recordState === "history_unavailable" || recordState === "error"
                                ? "Refresh before relying on the visible record."
                                : "Messages, call activity, and system events remain in order."}
                        </p>
                      </div>
                      <Badge variant="outline" className="rounded-full bg-background/70">
                        {evidenceSummaryLabel}
                      </Badge>
                    </div>
                    {recordState === "loading_existing" || recordState === "loading_empty" ? (
                      <div className={cn("flex flex-1 items-center justify-center rounded-[26px] border px-6 py-10 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]", evidencePanelClass)}>
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
                        className={cn("flex-1 rounded-[26px] border shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]", evidencePanelClass)}
                      />
                    )}
                  </div>

                  {/* 
                    ACTION SECTION - Deliberate Composer
                    RULE: Feel deliberate, not impulsive
                    RULE: Visually separate drafting from history
                   */}
                  <div
                    ref={composerSectionRef}
                    className={cn("no-print border-t px-3 pb-3 pt-3 sm:px-4", composerSectionClass)}
                  >
                    <div className={cn("mb-3 rounded-[20px] border px-4 py-2.5", evidenceCardClass)}>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        Deliberate composer
                      </p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        {composerDisabled
                          ? composerHelperText
                          : "Draft carefully. Sending places the message into the permanent family record."}
                      </p>
                    </div>
                    <div className={cn("rounded-[26px] border shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]", composerCardClass)}>
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

          {exportReceiptPanel}

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
