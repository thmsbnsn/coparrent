import type { ReactNode } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AcceptInvite from "@/pages/AcceptInvite";
import { useAuth } from "@/contexts/AuthContext";

const rpc = vi.hoisted(() => vi.fn());
const toast = vi.hoisted(() => vi.fn());

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc,
  },
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast,
  }),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: vi.fn(),
}));

vi.mock("framer-motion", () => ({
  motion: {
    div: ({
      children,
      ...props
    }: {
      children?: ReactNode;
      className?: string;
    }) => <div {...props}>{children}</div>,
  },
}));

const mockedUseAuth = vi.mocked(useAuth);

const defaultInvitation = {
  id: "invite-1",
  inviter_id: "user-2",
  invitee_email: "invitee@example.com",
  status: "pending",
  expires_at: "2999-01-01T00:00:00.000Z",
  created_at: "2026-03-19T00:00:00.000Z",
  inviter_name: "Alex Parent",
  inviter_email: "alex@example.com",
  family_id: "family-1",
  invitation_type: "co_parent",
  role: "parent",
};

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

describe("AcceptInvite", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  const renderAcceptInvite = async (initialEntry: string) => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(
        <MemoryRouter initialEntries={[initialEntry]}>
          <Routes>
            <Route path="/" element={<div>home-page</div>} />
            <Route path="/login" element={<div>login-page</div>} />
            <Route path="/signup" element={<div>signup-page</div>} />
            <Route path="/dashboard" element={<div>dashboard-page</div>} />
            <Route path="/accept-invite" element={<AcceptInvite />} />
          </Routes>
        </MemoryRouter>,
      );
      await flushPromises();
    });

    return container;
  };

  beforeEach(() => {
    rpc.mockReset();
    toast.mockReset();
    sessionStorage.clear();
    localStorage.clear();
    mockedUseAuth.mockReturnValue({
      user: null,
      loading: false,
    } as never);
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    consoleErrorSpy.mockRestore();
    container?.remove();
    container = null;
    root = null;
    vi.clearAllMocks();
  });

  it("renders an invalid state when the invite token is missing", async () => {
    const rendered = await renderAcceptInvite("/accept-invite");

    expect(rendered.textContent).toContain("Invalid Invitation");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("renders the expired state for outdated invitations", async () => {
    rpc.mockResolvedValue({
      data: [
        {
          ...defaultInvitation,
          expires_at: "2020-01-01T00:00:00.000Z",
        },
      ],
      error: null,
    });

    const rendered = await renderAcceptInvite("/accept-invite?token=expired-token");

    expect(rpc).toHaveBeenCalledWith("get_invitation_by_token", {
      _token: "expired-token",
    });
    expect(rendered.textContent).toContain("Invitation Expired");
  });

  it("falls back to deferred validation when invitation lookup errors", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: {
        message: "column i.relationship does not exist",
      },
    });

    const rendered = await renderAcceptInvite("/accept-invite?token=fallback-token&type=third_party");

    expect(rendered.textContent).toContain("Family Invitation");
    expect(rendered.textContent).toContain("Create Account to Accept");
    expect(rendered.textContent).toContain("Invite details could not be loaded up front.");
    expect(rendered.textContent).not.toContain("Invalid Invitation");
  });

  it("stores the pending token and routes unauthenticated users to signup", async () => {
    rpc.mockResolvedValue({
      data: [defaultInvitation],
      error: null,
    });

    const rendered = await renderAcceptInvite("/accept-invite?token=signup-token");
    const button = getButtonByText(rendered, "Create Account to Accept");

    await act(async () => {
      button.click();
      await flushPromises();
    });

    expect(sessionStorage.getItem("pendingInviteToken")).toBe("signup-token");
    expect(rendered.textContent).toContain("signup-page");
  });

  it("accepts a co-parent invitation, clears pending tokens, and routes to the dashboard", async () => {
    sessionStorage.setItem("pendingInviteToken", "old-session-token");
    localStorage.setItem("pendingInviteToken", "old-local-token");

    mockedUseAuth.mockReturnValue({
      user: {
        id: "user-1",
        email: "invitee@example.com",
      },
      loading: false,
    } as never);

    rpc.mockImplementation(async (fnName: string) => {
      if (fnName === "get_invitation_by_token") {
        return {
          data: [defaultInvitation],
          error: null,
        };
      }

      if (fnName === "accept_coparent_invitation") {
        return {
          data: { success: true, family_id: "family-1" },
          error: null,
        };
      }

      throw new Error(`Unexpected rpc call: ${fnName}`);
    });

    const rendered = await renderAcceptInvite("/accept-invite?token=coparent-token");
    const button = getButtonByText(rendered, "Accept & Link Accounts");

    await act(async () => {
      button.click();
      await flushPromises();
    });

    expect(rpc).toHaveBeenCalledWith("accept_coparent_invitation", {
      _token: "coparent-token",
      _acceptor_user_id: "user-1",
    });
    expect(sessionStorage.getItem("pendingInviteToken")).toBeNull();
    expect(localStorage.getItem("pendingInviteToken")).toBeNull();
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Successfully linked!",
      }),
    );
    expect(rendered.textContent).toContain("dashboard-page");
  });

  it("accepts a third-party invitation and routes matched users to the dashboard", async () => {
    sessionStorage.setItem("pendingInviteToken", "old-session-token");
    localStorage.setItem("pendingInviteToken", "old-local-token");

    mockedUseAuth.mockReturnValue({
      user: {
        id: "user-3",
        email: "invitee@example.com",
      },
      loading: false,
    } as never);

    rpc.mockImplementation(async (fnName: string) => {
      if (fnName === "get_invitation_by_token") {
        return {
          data: [defaultInvitation],
          error: null,
        };
      }

      if (fnName === "accept_third_party_invitation") {
        return {
          data: { success: true, family_id: "family-1" },
          error: null,
        };
      }

      throw new Error(`Unexpected rpc call: ${fnName}`);
    });

    const rendered = await renderAcceptInvite("/accept-invite?token=third-party-token&type=third_party");
    const button = getButtonByText(rendered, "Accept & Join Family");

    await act(async () => {
      button.click();
      await flushPromises();
    });

    expect(rpc).toHaveBeenCalledWith("accept_third_party_invitation", {
      _token: "third-party-token",
      _acceptor_user_id: "user-3",
    });
    expect(sessionStorage.getItem("pendingInviteToken")).toBeNull();
    expect(localStorage.getItem("pendingInviteToken")).toBeNull();
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Successfully joined!",
      }),
    );
    expect(rendered.textContent).toContain("dashboard-page");
  });

  it("blocks a third-party accept when the signed-in email does not match the invite", async () => {
    mockedUseAuth.mockReturnValue({
      user: {
        id: "user-4",
        email: "different@example.com",
      },
      loading: false,
    } as never);

    rpc.mockImplementation(async (fnName: string) => {
      if (fnName === "get_invitation_by_token") {
        return {
          data: [defaultInvitation],
          error: null,
        };
      }

      if (fnName === "accept_third_party_invitation") {
        return {
          data: { success: true },
          error: null,
        };
      }

      throw new Error(`Unexpected rpc call: ${fnName}`);
    });

    const rendered = await renderAcceptInvite("/accept-invite?token=mismatch-token&type=third_party");
    const button = getButtonByText(rendered, "Accept & Join Family");

    await act(async () => {
      button.click();
      await flushPromises();
    });

    expect(rendered.textContent).toContain("Wrong Account");
    expect(rendered.textContent).toContain("invitee@example.com");
    expect(rendered.textContent).not.toContain("dashboard-page");
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Email mismatch",
      }),
    );
  });

  it("surfaces an explicit failure when the invitation is missing family scope", async () => {
    mockedUseAuth.mockReturnValue({
      user: {
        id: "user-5",
        email: "invitee@example.com",
      },
      loading: false,
    } as never);

    rpc.mockImplementation(async (fnName: string) => {
      if (fnName === "get_invitation_by_token") {
        return {
          data: [
            {
              ...defaultInvitation,
              family_id: null,
            },
          ],
          error: null,
        };
      }

      if (fnName === "accept_coparent_invitation") {
        return {
          data: {
            success: false,
            code: "FAMILY_ID_REQUIRED",
            error: "Invitation is missing family_id",
          },
          error: null,
        };
      }

      throw new Error(`Unexpected rpc call: ${fnName}`);
    });

    const rendered = await renderAcceptInvite("/accept-invite?token=missing-family-token");
    const button = getButtonByText(rendered, "Accept & Link Accounts");

    await act(async () => {
      button.click();
      await flushPromises();
    });

    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Invitation setup incomplete",
      }),
    );
    expect(rendered.textContent).not.toContain("dashboard-page");
  });
});
