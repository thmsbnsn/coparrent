import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FamilyPresenceToggle } from "@/components/family/FamilyPresenceToggle";
import { useFamilyPresence } from "@/hooks/useFamilyPresence";

vi.mock("@/hooks/useFamilyPresence", () => ({
  useFamilyPresence: vi.fn(),
}));

vi.mock("@/components/ui/popover", () => ({
  Popover: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  PopoverContent: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

const mockedUseFamilyPresence = vi.mocked(useFamilyPresence);

describe("FamilyPresenceToggle", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  const renderToggle = async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(<FamilyPresenceToggle />);
    });

    return container;
  };

  beforeEach(() => {
    mockedUseFamilyPresence.mockReturnValue({
      activeCount: 2,
      loading: false,
      members: [
        {
          avatarUrl: null,
          displayName: "Alice",
          gameDisplayName: null,
          gameSlug: null,
          lastSeenAt: null,
          locationType: "dashboard",
          membershipId: "membership-1",
          presenceStatus: "active",
          profileId: "profile-1",
          relationshipLabel: "parent",
          role: "parent",
        },
      ],
      refresh: vi.fn(),
      scopeError: null,
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
  });

  it("renders the family list toggle and current presence summary", async () => {
    const rendered = await renderToggle();

    expect(rendered.textContent).toContain("Family");
    expect(rendered.textContent).toContain("2");
    expect(rendered.textContent).toContain("Alice");
  });
});
