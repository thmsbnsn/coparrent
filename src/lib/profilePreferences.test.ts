import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  loadProfilePreferences,
  saveProfilePreferencesPatch,
} from "@/lib/profilePreferences";

const queryState = vi.hoisted(() => ({
  preferences: {} as Record<string, unknown> | null,
  updates: [] as Array<{ userId: string; values: Record<string, unknown> }>,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      if (table !== "profiles") {
        throw new Error(`Unexpected table: ${table}`);
      }

      let targetUserId: string | null = null;
      let pendingUpdate: Record<string, unknown> | null = null;

      const builder = {
        eq: (field: string, value: string) => {
          if (field === "user_id") {
            targetUserId = value;
          }
          return builder;
        },
        maybeSingle: async () => ({
          data: { preferences: queryState.preferences },
          error: null,
        }),
        select: () => builder,
        update: (values: Record<string, unknown>) => {
          pendingUpdate = values;
          return builder;
        },
        then: (
          onfulfilled?: ((value: { data: null; error: null }) => unknown) | null,
          onrejected?: ((reason: unknown) => unknown) | null,
        ) => {
          if (pendingUpdate) {
            queryState.updates.push({
              userId: targetUserId ?? "unknown",
              values: pendingUpdate,
            });
            queryState.preferences = pendingUpdate.preferences as Record<string, unknown>;
          }

          return Promise.resolve({ data: null, error: null }).then(
            onfulfilled ?? undefined,
            onrejected ?? undefined,
          );
        },
      };

      return builder;
    },
  },
}));

describe("profilePreferences", () => {
  beforeEach(() => {
    queryState.preferences = null;
    queryState.updates = [];
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("loads an empty object when no stored preferences exist", async () => {
    await expect(loadProfilePreferences("user-1")).resolves.toEqual({});
  });

  it("merges preference patches instead of overwriting unrelated keys", async () => {
    queryState.preferences = {
      cookie_consent: {
        analytics: true,
      },
      theme: "dark",
    };

    const updated = await saveProfilePreferencesPatch("user-1", {
      onboarding_tooltips: {
        completedAt: "2026-03-30T00:00:00.000Z",
      },
      theme: "light",
    });

    expect(updated).toEqual({
      cookie_consent: {
        analytics: true,
      },
      onboarding_tooltips: {
        completedAt: "2026-03-30T00:00:00.000Z",
      },
      theme: "light",
    });
    expect(queryState.updates).toContainEqual({
      userId: "user-1",
      values: {
        preferences: {
          cookie_consent: {
            analytics: true,
          },
          onboarding_tooltips: {
            completedAt: "2026-03-30T00:00:00.000Z",
          },
          theme: "light",
        },
      },
    });
  });
});
