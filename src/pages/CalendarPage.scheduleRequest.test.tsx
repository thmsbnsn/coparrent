import type { ReactNode } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CalendarPage from "@/pages/CalendarPage";

const navigate = vi.hoisted(() => vi.fn());
const createRequest = vi.hoisted(() => vi.fn());
const saveSchedule = vi.hoisted(() => vi.fn());

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");

  return {
    ...actual,
    useNavigate: () => navigate,
  };
});

vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children?: ReactNode }) => <>{children}</>,
  motion: {
    div: ({ children, ...props }: { children?: ReactNode; className?: string }) => <div {...props}>{children}</div>,
  },
}));

vi.mock("@/components/dashboard/DashboardLayout", () => ({
  DashboardLayout: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    ...props
  }: {
    children?: ReactNode;
    onClick?: () => void;
    disabled?: boolean;
  }) => (
    <button type="button" onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/calendar/CalendarWizard", () => ({
  CalendarWizard: () => <div>calendar-wizard</div>,
}));

vi.mock("@/components/calendar/CalendarExportDialog", () => ({
  CalendarExportDialog: () => null,
}));

vi.mock("@/components/calendar/ScheduleChangeRequest", () => ({
  ScheduleChangeRequest: ({
    onSubmit,
  }: {
    onSubmit: (request: {
      type: string;
      originalDate: string;
      proposedDate?: string;
      reason?: string;
    }) => void;
  }) => (
    <button
      type="button"
      onClick={() =>
        void onSubmit({
          type: "swap",
          originalDate: "2026-04-10",
          proposedDate: "2026-04-11",
          reason: "Need to swap pickup day",
        })
      }
    >
      submit-schedule-request
    </button>
  ),
}));

vi.mock("@/components/calendar/SportsEventDetail", () => ({
  SportsEventDetail: () => null,
}));

vi.mock("@/components/calendar/SportsEventListPopup", () => ({
  SportsEventListPopup: () => null,
}));

vi.mock("@/hooks/useScheduleRequests", () => ({
  useScheduleRequests: () => ({
    createRequest,
  }),
}));

vi.mock("@/hooks/useSchedulePersistence", () => ({
  useSchedulePersistence: () => ({
    scheduleConfig: null,
    loading: false,
    saving: false,
    saveSchedule,
  }),
}));

vi.mock("@/hooks/usePermissions", () => ({
  usePermissions: () => ({
    permissions: {
      canEditCalendar: true,
      isViewOnly: false,
      viewOnlyReason: null,
    },
    isThirdParty: false,
    isChildAccount: false,
    loading: false,
  }),
}));

vi.mock("@/hooks/useSportsEvents", () => ({
  useSportsEvents: () => ({
    events: [],
    getEventsForDate: () => [],
    hasEventsOnDate: () => false,
    loading: false,
  }),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: null,
  }),
}));

vi.mock("@/contexts/FamilyContext", () => ({
  useFamily: () => ({
    activeFamilyId: null,
    loading: false,
    profileId: null,
  }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: null, error: null }),
        }),
      }),
    }),
  },
}));

vi.mock("@/components/ui/ViewOnlyBadge", () => ({
  ViewOnlyBadge: () => <div>view-only-badge</div>,
}));

const flushPromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const getButtonByText = (container: HTMLDivElement, text: string) => {
  const button = Array.from(container.querySelectorAll("button")).find((candidate) =>
    candidate.textContent?.includes(text),
  );

  if (!button) {
    throw new Error(`Button not found: ${text}`);
  }

  return button;
};

describe("CalendarPage schedule request navigation", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    createRequest.mockReset();
    saveSchedule.mockReset();
    navigate.mockReset();

    createRequest.mockResolvedValue({
      messageDestination: "/dashboard/messages?thread=thread-123",
    });

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    container?.remove();
    container = null;
    root = null;
    vi.clearAllMocks();
  });

  it("navigates successful schedule requests to the working messaging route", async () => {
    await act(async () => {
      root?.render(<CalendarPage />);
      await flushPromises();
    });

    await act(async () => {
      getButtonByText(container!, "Request Change").click();
      await flushPromises();
    });

    await act(async () => {
      getButtonByText(container!, "submit-schedule-request").click();
      await flushPromises();
    });

    expect(createRequest).toHaveBeenCalledWith({
      request_type: "swap",
      original_date: "2026-04-10",
      proposed_date: "2026-04-11",
      reason: "Need to swap pickup day",
    });
    expect(navigate).toHaveBeenCalledWith("/dashboard/messages?thread=thread-123");
    expect(navigate).not.toHaveBeenCalledWith("/messages");
  });
});
