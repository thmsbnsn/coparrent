import type { ReactNode } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MessagingHubPage from "@/pages/MessagingHubPage";

const messagingMockState = vi.hoisted(() => ({
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
    onClick,
  }: {
    children?: ReactNode;
    onClick?: () => void;
  }) => (
    <button onClick={onClick} type="button">
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

vi.mock("@/components/feedback/useProblemReport", () => ({
  useProblemReport: () => ({
    openReportModal: vi.fn(),
  }),
}));

vi.mock("@/hooks/useMessagingHub", async () => {
  const React = await import("react");

  const commonState = {
    activeFamilyId: "family-1",
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

  beforeEach(() => {
    messagingMockState.mockScenario.mode = "interactive";
    messagingMockState.viewport.isMobile = false;
    vi.useFakeTimers();
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
    expect(rendered.textContent).toContain("2 messages currently visible in this record.");
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
});
