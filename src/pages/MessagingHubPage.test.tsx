import type { ReactNode } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MessagingHubPage from "@/pages/MessagingHubPage";

const messagingMockState = vi.hoisted(() => ({
  activeFamilyId: "family-1",
  directMessages: [
    {
      content: "Can we confirm the pickup time for tomorrow?",
      created_at: "2026-03-30T10:45:00.000Z",
      id: "direct-message-1",
      is_from_me: false,
      read_by: [],
      sender_id: "jessica-profile",
      sender_name: "Jessica Morgan",
      sender_role: "parent",
      thread_id: "direct-thread-jessica",
    },
    {
      content: "Yes, 5:30 PM at the school entrance works for me.",
      created_at: "2026-03-30T10:47:00.000Z",
      id: "direct-message-2",
      is_from_me: true,
      read_by: [],
      sender_id: "my-profile",
      sender_name: "Taylor Parent",
      sender_role: "parent",
      thread_id: "direct-thread-jessica",
    },
  ],
  directThread: {
    created_at: "2026-03-30T10:00:00.000Z",
    id: "direct-thread-jessica",
    last_message: {
      content: "Can we confirm the pickup time for tomorrow?",
      created_at: "2026-03-30T10:45:00.000Z",
      id: "thread-message-last",
      is_from_me: false,
      read_by: [],
      sender_id: "jessica-profile",
      sender_name: "Jessica Morgan",
      sender_role: "parent",
      thread_id: "direct-thread-jessica",
    },
    name: null,
    other_participant: {
      email: "jessica@example.com",
      full_name: "Jessica Morgan",
      id: "jessica-profile",
      role: "parent",
    },
    participant_a_id: "jessica-profile",
    participant_b_id: "my-profile",
    primary_parent_id: "primary-parent",
    thread_type: "direct_message" as const,
  },
  familyChannel: {
    created_at: "2026-03-30T09:00:00.000Z",
    id: "family-thread",
    name: "Family Chat",
    participant_a_id: null,
    participant_b_id: null,
    primary_parent_id: "primary-parent",
    thread_type: "family_channel" as const,
  },
  familyMembers: [
    {
      avatar_url: null,
      email: "jessica@example.com",
      full_name: "Jessica Morgan",
      id: "membership-jessica",
      profile_id: "jessica-profile",
      role: "parent",
    },
  ],
  familyMessages: [
    {
      content: "Family channel note",
      created_at: "2026-03-30T09:10:00.000Z",
      id: "family-message-1",
      is_from_me: true,
      read_by: [],
      sender_id: "my-profile",
      sender_name: "Taylor Parent",
      sender_role: "parent",
      thread_id: "family-thread",
    },
  ],
  mockScenario: {
    mode: "interactive" as "interactive" | "error",
  },
  viewport: {
    isMobile: false,
  },
}));

const supabaseMockState = vi.hoisted(() => {
  const listExportRecord = {
    artifact_hash: "artifact-hash-123",
    artifact_hash_algorithm: "sha256",
    artifact_type: "json_evidence_package",
    canonicalization_version: "coparrent.messaging-thread-export-canonical/v2",
    content_hash: "hash-123",
    export_format: "pdf",
    exported_at: "2026-03-30T14:00:00.000Z",
    family_id: "family-1",
    hash_algorithm: "sha256",
    id: "export-record-1",
    integrity_model_version: "coparrent.messaging-thread-export-receipt/v4",
    manifest_hash: "manifest-hash-123",
    manifest_hash_algorithm: "sha256",
    pdf_artifact_hash: "pdf-hash-123",
    pdf_hash_algorithm: "sha256",
    pdf_bytes_size: 2048,
    pdf_generated_at: "2026-03-30T14:00:00.000Z",
    record_count: 3,
    signature_algorithm: "ed25519",
    signing_key_id: "messaging-export-key-v1",
    signature_present: true,
    thread_display_name: "Jessica Morgan",
    thread_id: "direct-thread-jessica",
    thread_type: "direct_message",
    total_messages: 2,
    total_system_events: 1,
  };

  const buildVerificationData = (
    verificationMode:
      | "provided_package_json"
      | "provided_pdf_artifact"
      | "stored_pdf_artifact"
      | "stored_signature"
      | "stored_source",
    status:
      | "artifact_not_found"
      | "artifact_hash_unavailable"
      | "match"
      | "mismatch"
      | "not_authorized"
      | "pdf_hash_unavailable"
      | "receipt_not_found"
      | "signature_invalid"
      | "verification_not_supported" = "match",
  ) => {
    const isPdfVerification =
      verificationMode === "provided_pdf_artifact" || verificationMode === "stored_pdf_artifact";
    const isMismatch = status === "mismatch";
    const computedHash = isPdfVerification ? "pdf-hash-123" : "hash-123";

    return {
      computed_hash: computedHash,
      export: {
        ...listExportRecord,
        record_count: 1,
        total_messages: 1,
        total_system_events: 0,
      },
      status,
      stored_hash: isPdfVerification ? "pdf-hash-123" : "hash-123",
      verification_layers: {
        artifact_hash: {
          algorithm: "sha256",
          computed: "artifact-hash-123",
          label: "JSON evidence package hash",
          matches: !isMismatch,
          note: isMismatch ? "The uploaded evidence package does not match the stored receipt." : null,
          status: isMismatch ? "mismatch" : "match",
          stored: "artifact-hash-123",
        },
        canonical_content_hash: {
          algorithm: "sha256",
          computed: isMismatch ? "hash-999" : "hash-123",
          label: "Canonical content hash",
          matches: !isMismatch,
          note: isMismatch ? "The canonical record content no longer matches the stored receipt." : null,
          status: isMismatch ? "mismatch" : "match",
          stored: "hash-123",
        },
        manifest_hash: {
          algorithm: "sha256",
          computed: isMismatch ? "manifest-hash-999" : "manifest-hash-123",
          label: "Manifest hash",
          matches: !isMismatch,
          note: isMismatch ? "The manifest hash no longer matches the stored receipt." : null,
          status: isMismatch ? "mismatch" : "match",
          stored: "manifest-hash-123",
        },
        pdf_artifact_hash: {
          algorithm: "sha256",
          computed: isMismatch ? "pdf-hash-999" : "pdf-hash-123",
          label: "PDF artifact hash",
          matches: !isMismatch,
          note: isMismatch
            ? "The checked PDF hash does not match the stored receipt."
            : "The stored PDF artifact still matches the server-signed receipt.",
          status: isMismatch ? "mismatch" : "match",
          stored: "pdf-hash-123",
        },
        receipt_signature: {
          algorithm: "ed25519",
          note: isMismatch
            ? "The stored export receipt signature is still valid, but one or more hashes do not match."
            : "The stored export receipt server signature is valid.",
          present: true,
          status: "match",
          valid: true,
        },
      },
      verification_mode: verificationMode,
    };
  };

  return {
    exportList: [listExportRecord],
    verificationOverride: null as
      | {
          data: unknown;
          error: null;
        }
      | {
          data: null;
          error: unknown;
        }
      | null,
    invoke: vi.fn(async (_name: string, payload?: { body?: Record<string, unknown> }) => {
    const body = payload?.body;
    if (body?.action === "create") {
      return {
        data: {
          artifact_payload_json: "{\"artifact\":true}",
          canonical_payload: {
            entries: [
              {
                content: "Can we confirm the pickup time for tomorrow?",
                entry_id: "direct-message-1",
                kind: "message",
                sender_id: "jessica-profile",
                sender_name: "Jessica Morgan",
                sender_role: "parent",
                sender_role_label: "Parent",
                sequence: 1,
                timestamp: "2026-03-30T10:45:00.000Z",
              },
            ],
            family_id: "family-1",
            schema_version: "coparrent.messaging-thread-export/v3",
            canonicalization_version: "coparrent.messaging-thread-export-canonical/v2",
            source_type: "message_thread",
            thread: {
              id: "direct-thread-jessica",
              thread_type: "direct_message",
            },
          },
          canonical_payload_json: "{\"ok\":true}",
          evidence_package: {
            artifact_payload_json: "{\"artifact\":true}",
            canonical_payload_json: "{\"ok\":true}",
            canonical_payload: {
              entries: [],
              family_id: "family-1",
              schema_version: "coparrent.messaging-thread-export/v3",
              canonicalization_version: "coparrent.messaging-thread-export-canonical/v2",
              source_type: "message_thread",
              thread: {
                id: "direct-thread-jessica",
                thread_type: "direct_message",
              },
            },
            manifest: {},
            manifest_json: "{\"manifest\":true}",
            package_schema_version: "coparrent.messaging-thread-export-package/v4",
            receipt: {},
            verification_instructions: ["note-1"],
          },
          evidence_package_json: "{\"evidence\":true}",
          export: {
            artifact_hash: "artifact-hash-123",
            artifact_hash_algorithm: "sha256",
            artifact_type: "json_evidence_package",
            canonicalization_version: "coparrent.messaging-thread-export-canonical/v2",
            content_hash: "hash-123",
            export_format: "pdf",
            exported_at: "2026-03-30T14:00:00.000Z",
            family_id: "family-1",
            hash_algorithm: "sha256",
            id: "export-record-1",
            integrity_model_version: "coparrent.messaging-thread-export-receipt/v4",
            manifest_hash: "manifest-hash-123",
            manifest_hash_algorithm: "sha256",
            pdf_artifact_hash: "pdf-hash-123",
            pdf_hash_algorithm: "sha256",
            pdf_bytes_size: 2048,
            pdf_generated_at: "2026-03-30T14:00:00.000Z",
            record_count: 1,
            signature_algorithm: "ed25519",
            signing_key_id: "messaging-export-key-v1",
            signature_present: true,
            thread_display_name: "Jessica Morgan",
            thread_id: "direct-thread-jessica",
            thread_type: "direct_message",
            total_messages: 1,
            total_system_events: 0,
          },
          manifest: {
            application_build_id: null,
            canonicalization_version: "coparrent.messaging-thread-export-canonical/v2",
            export_generated_at: "2026-03-30T14:00:00.000Z",
            export_id: "export-record-1",
            export_format: "pdf",
            exported_by_profile_id: "my-profile",
            family_id: "family-1",
            integrity_model_version: "coparrent.messaging-thread-export-receipt/v4",
            included_message_ids: ["direct-message-1"],
            included_system_event_ids: [],
            included_timeline_entry_ids: ["direct-message-1"],
            artifact_storage_bucket: "court-export-artifacts",
            artifact_storage_path: "families/family-1/threads/direct-thread-jessica/exports/export-record-1/direct-thread-jessica-export-record-1-evidence-package.json",
            pdf_artifact_hash: "pdf-hash-123",
            pdf_hash_algorithm: "sha256",
            pdf_bytes_size: 2048,
            pdf_generated_at: "2026-03-30T14:00:00.000Z",
            pdf_storage_bucket: "court-export-artifacts",
            pdf_storage_path: "families/family-1/threads/direct-thread-jessica/exports/export-record-1/direct-thread-jessica-export-record-1.pdf",
            record_end: "2026-03-30T10:45:00.000Z",
            record_start: "2026-03-30T10:45:00.000Z",
            schema_version: "coparrent.messaging-thread-export/v3",
            source_type: "message_thread",
            thread_display_name: "Jessica Morgan",
            thread_id: "direct-thread-jessica",
            thread_type: "direct_message",
            total_entries: 1,
            total_messages: 1,
            total_system_events: 0,
            verification_notes: ["note-1"],
          },
          manifest_json: "{\"manifest\":true}",
          receipt: {
            application_build_id: null,
            artifact_hash: "artifact-hash-123",
            artifact_hash_algorithm: "sha256",
            artifact_type: "json_evidence_package",
            artifact_storage_bucket: "court-export-artifacts",
            artifact_storage_path: "families/family-1/threads/direct-thread-jessica/exports/export-record-1/direct-thread-jessica-export-record-1-evidence-package.json",
            canonical_content_hash: "hash-123",
            canonical_hash_algorithm: "sha256",
            canonicalization_version: "coparrent.messaging-thread-export-canonical/v2",
            created_by_profile_id: "my-profile",
            export_format: "pdf",
            exported_at: "2026-03-30T14:00:00.000Z",
            family_id: "family-1",
            integrity_model_version: "coparrent.messaging-thread-export-receipt/v4",
            signing_key_id: "messaging-export-key-v1",
            manifest_hash: "manifest-hash-123",
            manifest_hash_algorithm: "sha256",
            pdf_artifact_hash: "pdf-hash-123",
            pdf_artifact_type: "server_generated_pdf_artifact",
            pdf_bytes_size: 2048,
            pdf_generated_at: "2026-03-30T14:00:00.000Z",
            pdf_hash_algorithm: "sha256",
            pdf_storage_bucket: "court-export-artifacts",
            pdf_storage_path: "families/family-1/threads/direct-thread-jessica/exports/export-record-1/direct-thread-jessica-export-record-1.pdf",
            receipt_signature: "signature-123",
            receipt_signature_algorithm: "ed25519",
            record_count: 1,
            record_end: "2026-03-30T10:45:00.000Z",
            record_start: "2026-03-30T10:45:00.000Z",
            schema_version: "coparrent.messaging-thread-export/v3",
            source_id: "direct-thread-jessica",
            source_type: "message_thread",
            thread_display_name: "Jessica Morgan",
            thread_id: "direct-thread-jessica",
            thread_type: "direct_message",
            total_messages: 1,
            total_system_events: 0,
          },
          pdf_artifact: {
            base64: "JVBERi0xLjQKJUZBS0U=",
            bytes_size: 2048,
            content_type: "application/pdf",
            file_name: "messages-export-record-1.pdf",
            generated_at: "2026-03-30T14:00:00.000Z",
            hash: "pdf-hash-123",
            hash_algorithm: "sha256",
          },
        },
        error: null,
      };
    }

    if (body?.action === "download") {
      return {
        data: {
          artifact: {
            base64:
              body.artifact_kind === "pdf"
                ? "JVBERi0xLjQKJUZBS0U="
                : "eyJlZmlkZW5jZSI6dHJ1ZX0=",
            bytes_size: body.artifact_kind === "pdf" ? 2048 : 128,
            content_type:
              body.artifact_kind === "pdf"
                ? "application/pdf"
                : "application/json;charset=utf-8",
            file_name:
              body.artifact_kind === "pdf"
                ? "messages-export-record-1.pdf"
                : "messages-export-record-1-evidence-package.json",
            hash: body.artifact_kind === "pdf" ? "pdf-hash-123" : "artifact-hash-123",
            hash_algorithm: "sha256",
            kind: body.artifact_kind,
          },
          export: {
            id: "export-record-1",
          },
        },
        error: null,
      };
    }

    if (body?.action === "verify") {
      const verificationMode =
        (body.verification_mode as
          | "provided_package_json"
          | "provided_pdf_artifact"
          | "stored_pdf_artifact"
          | "stored_signature"
          | "stored_source"
          | undefined) ?? "stored_source";
      const computedHash =
        verificationMode === "provided_pdf_artifact" ||
        verificationMode === "stored_pdf_artifact"
          ? "pdf-hash-123"
          : "hash-123";

      if (supabaseMockState.verificationOverride) {
        return supabaseMockState.verificationOverride;
      }

      return {
        data: {
          ...buildVerificationData(verificationMode),
          computed_hash: computedHash,
        },
        error: null,
      };
    }

    return {
      data: {
        exports: supabaseMockState.exportList,
      },
      error: null,
    };
    }),
  };
});

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: { children?: ReactNode }) => <div {...props}>{children}</div>,
  },
}));

vi.mock("@/components/dashboard/DashboardLayout", () => ({
  DashboardLayout: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/tooltip", () => ({
  TooltipProvider: ({ children }: { children?: ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children, open }: { children?: ReactNode; open?: boolean }) => (open ? <div>{children}</div> : null),
  DialogContent: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({
    children,
    disabled,
    onClick,
  }: {
    children?: ReactNode;
    disabled?: boolean;
    onClick?: () => void;
  }) => (
    <button disabled={disabled} onClick={onClick} type="button">
      {children}
    </button>
  ),
  DropdownMenuSeparator: () => <hr />,
  DropdownMenuTrigger: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ children, open }: { children?: ReactNode; open?: boolean }) => (open ? <div>{children}</div> : null),
  SheetContent: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  SheetHeader: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/tabs", async () => {
  const React = await import("react");

  return {
    Tabs: ({
      children,
      onValueChange,
      value,
    }: {
      children?: ReactNode;
      onValueChange?: (value: string) => void;
      value?: string;
    }) => (
      <div data-tabs-value={value}>
        {React.Children.map(children, (child) =>
          React.isValidElement(child)
            ? React.cloneElement(child as React.ReactElement<Record<string, unknown>>, {
                __onTabsChange: onValueChange,
                __tabsValue: value,
              })
            : child,
        )}
      </div>
    ),
    TabsContent: ({
      __tabsValue,
      children,
      value,
    }: {
      __tabsValue?: string;
      children?: ReactNode;
      value: string;
    }) => (__tabsValue === value ? <div>{children}</div> : null),
    TabsList: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    TabsTrigger: ({
      __onTabsChange,
      children,
      value,
    }: {
      __onTabsChange?: (value: string) => void;
      children?: ReactNode;
      value: string;
    }) => (
      <button onClick={() => __onTabsChange?.(value)} type="button">
        {children}
      </button>
    ),
  };
});

vi.mock("@/components/messages/MessageSearch", () => ({
  MessageSearch: () => null,
}));

vi.mock("@/components/messages/UnreadBadge", () => ({
  UnreadBadge: ({ count }: { count: number }) => <span>{count}</span>,
}));

vi.mock("@/components/messages/SwipeableTabs", () => ({
  SwipeableTabs: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/messages/EvidencePanel", () => ({
  EvidencePanel: ({ timelineItems }: { timelineItems: unknown[] }) => (
    <div data-testid="evidence-panel">timeline:{timelineItems.length}</div>
  ),
}));

vi.mock("@/components/messages/DeliberateComposer", () => ({
  DeliberateComposer: ({
    disabled,
    helperText,
    placeholder,
  }: {
    disabled?: boolean;
    helperText?: string;
    placeholder?: string;
  }) => (
    <div
      data-disabled={String(Boolean(disabled))}
      data-testid="composer"
    >
      {placeholder}
      {helperText ?? ""}
    </div>
  ),
}));

vi.mock("@/components/messages/CourtViewToggle", () => ({
  CourtViewToggle: ({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) => (
    <button onClick={onToggle} type="button">
      {enabled ? "court-on" : "court-off"}
    </button>
  ),
}));

vi.mock("@/components/messages/PullToRefreshIndicator", () => ({
  PullToRefreshIndicator: () => null,
}));

vi.mock("@/components/calls/CallActionButtons", () => ({
  CallActionButtons: () => <div>call-actions</div>,
}));

vi.mock("@/hooks/useTypingIndicator", () => ({
  useTypingIndicator: () => ({
    clearTyping: vi.fn(),
    setTyping: vi.fn(),
  }),
}));

vi.mock("@/hooks/useUnreadMessages", () => ({
  useUnreadMessages: () => ({
    getUnreadByType: () => 0,
    getUnreadForThread: () => 0,
    refresh: vi.fn(async () => undefined),
    showIndicator: false,
    totalUnread: 0,
  }),
}));

vi.mock("@/hooks/usePullToRefresh", () => ({
  usePullToRefresh: () => ({
    bindEvents: vi.fn(),
    isRefreshing: false,
    pullDistance: 0,
  }),
}));

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => messagingMockState.viewport.isMobile,
}));

vi.mock("@/hooks/useCallSessions", () => ({
  useCallSessions: () => ({
    createCall: vi.fn(async () => undefined),
    currentThreadCall: null,
    incomingSession: null,
  }),
}));

vi.mock("@/hooks/useChildAccount", () => ({
  useChildAccount: () => ({
    isChildAccount: false,
  }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: supabaseMockState.invoke,
    },
  },
}));

vi.mock("@/components/feedback/useProblemReport", () => ({
  useProblemReport: () => ({
    openReportModal: vi.fn(),
  }),
}));

vi.mock("@/hooks/useMessagingHub", async () => {
  const React = await import("react");

  const commonState = {
    createGroupChat: vi.fn(async () => null),
    ensureFamilyChannel: vi.fn(async () => messagingMockState.familyChannel),
    familyChannel: messagingMockState.familyChannel,
    familyMembers: messagingMockState.familyMembers,
    fetchThreads: vi.fn(async () => undefined),
    getOrCreateDMThread: vi.fn(async () => messagingMockState.directThread),
    groupChats: [],
    loading: false,
    profileId: "my-profile",
    refreshActiveThread: vi.fn(async () => undefined),
    sendMessage: vi.fn(async () => true),
    setupError: null,
    systemEvents: [],
    threads: [messagingMockState.directThread],
  };

  return {
    useMessagingHub: () => {
      const [activeThread, setActiveThreadState] = React.useState(
        messagingMockState.familyChannel,
      );
      const [messages, setMessages] = React.useState(messagingMockState.familyMessages);
      const [activeThreadLoading, setActiveThreadLoading] = React.useState(false);
      const [activeThreadLoadError, setActiveThreadLoadError] = React.useState<string | null>(null);

      const setActiveThread = (
        thread:
          | typeof messagingMockState.familyChannel
          | typeof messagingMockState.directThread
          | null,
      ) => {
        setActiveThreadState(thread);
        setActiveThreadLoadError(null);

        if (thread?.id === messagingMockState.directThread.id) {
          setActiveThreadLoading(true);
          setMessages([]);
          setTimeout(() => {
            setMessages(messagingMockState.directMessages);
            setActiveThreadLoading(false);
          }, 0);
          return;
        }

        setActiveThreadLoading(false);
        setMessages(messagingMockState.familyMessages);
      };

      if (messagingMockState.mockScenario.mode === "error") {
        return {
          ...commonState,
          activeFamilyId: messagingMockState.activeFamilyId,
          activeThread: messagingMockState.directThread,
          activeThreadLoadError:
            "The recorded thread could not be loaded right now. Refresh before replying.",
          activeThreadLoading: false,
          messages: [],
          setActiveThread: vi.fn(),
        };
      }

      return {
        ...commonState,
        activeFamilyId: messagingMockState.activeFamilyId,
        activeThread,
        activeThreadLoadError,
        activeThreadLoading,
        messages,
        setActiveThread,
      };
    },
  };
});

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock("jspdf", () => ({
  default: class MockJsPdf {
    internal = {
      pageSize: {
        height: 100,
        width: 100,
      },
    };

    getNumberOfPages() {
      return 1;
    }

    save() {}

    setFont() {}

    setFontSize() {}

    setPage() {}

    setTextColor() {}

    text() {}
  },
}));

vi.mock("jspdf-autotable", () => ({
  default: vi.fn(),
}));

describe("MessagingHubPage", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;
  const createObjectUrl = vi.fn(() => "blob:mock");
  const revokeObjectUrl = vi.fn();
  const clipboardWriteText = vi.fn(async () => undefined);

  beforeEach(() => {
    messagingMockState.activeFamilyId = "family-1";
    messagingMockState.mockScenario.mode = "interactive";
    messagingMockState.viewport.isMobile = false;
    supabaseMockState.exportList = [
      {
        artifact_hash: "artifact-hash-123",
        artifact_hash_algorithm: "sha256",
        artifact_type: "json_evidence_package",
        canonicalization_version: "coparrent.messaging-thread-export-canonical/v2",
        content_hash: "hash-123",
        export_format: "pdf",
        exported_at: "2026-03-30T14:00:00.000Z",
        family_id: "family-1",
        hash_algorithm: "sha256",
        id: "export-record-1",
        integrity_model_version: "coparrent.messaging-thread-export-receipt/v4",
        manifest_hash: "manifest-hash-123",
        manifest_hash_algorithm: "sha256",
        pdf_artifact_hash: "pdf-hash-123",
        pdf_hash_algorithm: "sha256",
        pdf_bytes_size: 2048,
        pdf_generated_at: "2026-03-30T14:00:00.000Z",
        record_count: 3,
        signature_algorithm: "ed25519",
        signing_key_id: "messaging-export-key-v1",
        signature_present: true,
        thread_display_name: "Jessica Morgan",
        thread_id: "direct-thread-jessica",
        thread_type: "direct_message",
        total_messages: 2,
        total_system_events: 1,
      },
    ];
    supabaseMockState.verificationOverride = null;
    supabaseMockState.invoke.mockClear();
    clipboardWriteText.mockClear();
    vi.useFakeTimers();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: clipboardWriteText,
      },
    });
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectUrl,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: revokeObjectUrl,
    });
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    container?.remove();
    container = null;
    root = null;
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  const renderPage = async (path = "/dashboard/messages") => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(
        <MemoryRouter initialEntries={[path]}>
          <MessagingHubPage />
        </MemoryRouter>,
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    return container;
  };

  const findButton = (rendered: HTMLDivElement, text: string) =>
    Array.from(rendered.querySelectorAll("button")).find((button) =>
      button.textContent?.includes(text),
    ) as HTMLButtonElement | undefined;

  const openVerifyDialog = async (rendered: HTMLDivElement) => {
    const verifyReceiptButton = findButton(rendered, "Verify receipt");
    expect(verifyReceiptButton).toBeTruthy();

    await act(async () => {
      verifyReceiptButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });
  };

  it("opens an existing direct-message thread as a loading recorded thread instead of a fresh chat state", async () => {
    const rendered = await renderPage("/dashboard/messages?thread=direct-thread-jessica");

    expect(rendered.textContent).toContain("Loading recorded history");
    expect(rendered.textContent).toContain("This direct thread already has recorded activity.");
    expect(rendered.textContent).not.toContain("This record is open and ready for the first message.");
    expect(rendered.textContent).not.toContain("No messages yet");
    expect(rendered.querySelector('[data-testid="composer"]')?.getAttribute("data-disabled")).toBe("true");

    await act(async () => {
      vi.runAllTimers();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(rendered.textContent).toContain("Existing record");
    expect(rendered.textContent).toContain("2 recorded messages currently visible in this conversation.");
    expect(rendered.querySelector('[data-testid="composer"]')?.getAttribute("data-disabled")).toBe("false");
  });

  it("shows an explicit blocked state when a direct thread fails to hydrate", async () => {
    messagingMockState.mockScenario.mode = "error";
    const rendered = await renderPage();

    expect(rendered.textContent).toContain("Load blocked");
    expect(rendered.textContent).toContain("The recorded thread could not be loaded right now. Refresh before replying.");
    expect(rendered.textContent).not.toContain("This record is open and ready for the first message.");
    expect(rendered.querySelector('[data-testid="composer"]')?.getAttribute("data-disabled")).toBe("true");
  });

  it("routes evidence export through the server-backed export record flow", async () => {
    const rendered = await renderPage();
    const exportButton = Array.from(rendered.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("Export evidence package"),
    );

    expect(exportButton).toBeTruthy();

    await act(async () => {
      exportButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(supabaseMockState.invoke).toHaveBeenCalledWith(
      "messaging-thread-export",
      expect.objectContaining({
        body: expect.objectContaining({
          action: "create",
          family_id: "family-1",
        }),
      }),
    );
  });

  it("fails closed when family scope is missing before export begins", async () => {
    messagingMockState.activeFamilyId = null;
    const rendered = await renderPage();
    const exportButton = Array.from(rendered.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("Export evidence package"),
    ) as HTMLButtonElement | undefined;

    expect(exportButton?.disabled).toBe(true);
    expect(
      supabaseMockState.invoke.mock.calls.some(
        ([name, payload]) =>
          name === "messaging-thread-export" &&
          (payload as { body?: { action?: string } })?.body?.action === "create",
      ),
    ).toBe(false);
  });

  it("renders the export receipt panel with latest receipt metadata and safe wording", async () => {
    const rendered = await renderPage();

    expect(rendered.textContent).toContain("Export Receipt");
    expect(rendered.textContent).toContain("Status unknown");
    expect(rendered.textContent).toContain("Latest export receipt recorded Mar 30, 2026");
    expect(rendered.textContent).toContain("Receipt ID");
    expect(rendered.textContent).toContain("PDF Hash");
    expect(rendered.textContent).toContain("messaging-export-key-v1");
    expect(rendered.textContent).toContain("Copy hash");
    expect(rendered.textContent).toContain("Copy receipt ID");
    expect(rendered.textContent).toContain("The exact PDF bytes are generated on the server");
    expect(rendered.textContent).toContain("does not contain an embedded Acrobat-style digital signature");
    expect(rendered.textContent).not.toContain("notarized");
    expect(rendered.textContent).not.toContain("court-certified");
    expect(rendered.textContent).not.toContain("signed PDF");
  });

  it("shows a clean empty receipt state when no export has been created yet", async () => {
    supabaseMockState.exportList = [];
    const rendered = await renderPage();

    expect(rendered.textContent).toContain("No export receipt recorded for this thread");
    expect(rendered.textContent).toContain("No receipt yet");
  });

  it("fails explicitly in the receipt panel when family scope is missing", async () => {
    messagingMockState.activeFamilyId = null;
    const rendered = await renderPage();

    expect(rendered.textContent).toContain("Family scope required");
    expect(rendered.textContent).toContain("Messaging export actions require explicit family scope");
  });

  it("copies the PDF hash with explicit feedback", async () => {
    const rendered = await renderPage();
    const copyHashButton = rendered.querySelector('button[aria-label="Copy PDF hash"]') as HTMLButtonElement | null;

    expect(copyHashButton).toBeTruthy();

    await act(async () => {
      copyHashButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(clipboardWriteText).toHaveBeenCalledWith("pdf-hash-123");
    expect(copyHashButton?.textContent).toContain("Copied");
  });

  it("renders a clear verified state with a human-readable explanation", async () => {
    const rendered = await renderPage();
    await openVerifyDialog(rendered);
    const verifyStoredPdfButton = findButton(rendered, "Verify stored PDF artifact");

    expect(verifyStoredPdfButton).toBeTruthy();

    await act(async () => {
      verifyStoredPdfButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(supabaseMockState.invoke).toHaveBeenCalledWith(
      "messaging-thread-export",
      expect.objectContaining({
        body: expect.objectContaining({
          action: "verify",
          export_id: "export-record-1",
          family_id: "family-1",
          verification_mode: "stored_pdf_artifact",
        }),
      }),
    );
    expect(rendered.textContent).toContain("Verified");
    expect(rendered.textContent).toContain("Verification match. The stored PDF artifact still matches the stored export receipt.");
    expect(rendered.textContent).toContain("Raw result: match");
  });

  it("renders a clear mismatch explanation for PDF verification", async () => {
    supabaseMockState.verificationOverride = {
      data: {
        computed_hash: "pdf-hash-999",
        export: {
          ...supabaseMockState.exportList[0],
        },
        status: "mismatch",
        stored_hash: "pdf-hash-123",
        verification_layers: {
          artifact_hash: {
            algorithm: "sha256",
            computed: "artifact-hash-123",
            label: "JSON evidence package hash",
            matches: true,
            note: null,
            status: "match",
            stored: "artifact-hash-123",
          },
          canonical_content_hash: {
            algorithm: "sha256",
            computed: "hash-123",
            label: "Canonical content hash",
            matches: true,
            note: null,
            status: "match",
            stored: "hash-123",
          },
          manifest_hash: {
            algorithm: "sha256",
            computed: "manifest-hash-123",
            label: "Manifest hash",
            matches: true,
            note: null,
            status: "match",
            stored: "manifest-hash-123",
          },
          pdf_artifact_hash: {
            algorithm: "sha256",
            computed: "pdf-hash-999",
            label: "PDF artifact hash",
            matches: false,
            note: "The checked PDF hash does not match the stored receipt.",
            status: "mismatch",
            stored: "pdf-hash-123",
          },
          receipt_signature: {
            algorithm: "ed25519",
            note: "The stored export receipt server signature is valid.",
            present: true,
            status: "match",
            valid: true,
          },
        },
        verification_mode: "stored_pdf_artifact",
      },
      error: null,
    };

    const rendered = await renderPage();
    await openVerifyDialog(rendered);
    const verifyStoredPdfButton = findButton(rendered, "Verify stored PDF artifact");

    await act(async () => {
      verifyStoredPdfButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(rendered.textContent).toContain(
      "Verification mismatch. The file does not match the stored export receipt and may have been altered.",
    );
    expect(rendered.textContent).toContain("Raw result: mismatch");
  });

  it("renders human-readable not-authorized verification feedback", async () => {
    supabaseMockState.verificationOverride = {
      data: null,
      error: {
        context: new Response(
          JSON.stringify({
            error: "You do not have permission to verify this export.",
            status: "not_authorized",
          }),
          {
            headers: {
              "Content-Type": "application/json",
            },
            status: 403,
          },
        ),
        message: "Edge Function returned a non-2xx status code",
      },
    };

    const rendered = await renderPage();
    await openVerifyDialog(rendered);
    const verifyCurrentRecordButton = findButton(rendered, "Verify current server record");

    await act(async () => {
      verifyCurrentRecordButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(rendered.textContent).toContain("Verification blocked");
    expect(rendered.textContent).toContain("You do not have permission to verify this export.");
    expect(rendered.textContent).toContain("Raw result: not_authorized");
  });

  it("keeps the export receipt surface readable on mobile", async () => {
    messagingMockState.viewport.isMobile = true;
    const rendered = await renderPage();

    expect(rendered.textContent).toContain("Export Receipt");
    expect(rendered.textContent).toContain("Copy hash");
    expect(rendered.textContent).toContain("Latest export receipt recorded");
    expect(rendered.textContent).toContain("Conversations");
    expect(rendered.textContent).not.toContain("Current mode");
    expect(rendered.textContent).not.toContain("Loaded thread");
  });
});
