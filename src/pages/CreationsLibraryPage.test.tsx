import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CreationsLibraryPage from "@/pages/CreationsLibraryPage";
import { useCreations } from "@/hooks/useCreations";

vi.mock("@/hooks/useCreations", () => ({
  useCreations: vi.fn(),
}));

vi.mock("@/components/dashboard/DashboardLayout", () => ({
  DashboardLayout: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/gates/RoleGate", () => ({
  RoleGate: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/onboarding/CreationsPrivacyTooltip", () => ({
  CreationsPrivacyTooltip: () => <div>creations-privacy-tooltip</div>,
}));

const mockedUseCreations = vi.mocked(useCreations);

describe("CreationsLibraryPage", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    mockedUseCreations.mockReturnValue({
      createCreation: vi.fn(),
      createFolder: vi.fn(),
      creations: [],
      deleteCreation: vi.fn(),
      deleteFolder: vi.fn(),
      familyMembers: [],
      fetchActivityDetail: vi.fn(),
      fetchColoringPageDetail: vi.fn(),
      fetchCreations: vi.fn(),
      fetchFamilyMembers: vi.fn(),
      fetchFolders: vi.fn(),
      fetchShares: vi.fn(async () => []),
      folders: [],
      loading: false,
      moveToFolder: vi.fn(),
      scopeError: "Select an active family before using the Creations Library.",
      shareCreation: vi.fn(),
      unshareCreation: vi.fn(),
      updateCreation: vi.fn(),
      updateFolder: vi.fn(),
    } as never);
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

  it("renders an explicit blocked state when the active family scope is missing", () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root?.render(
        <MemoryRouter>
          <CreationsLibraryPage />
        </MemoryRouter>,
      );
    });

    expect(container.textContent).toContain("Active family required");
    expect(container.textContent).toContain("Select an active family before using the Creations Library.");
    expect(container.textContent).not.toContain("No creations yet");
  });
});
