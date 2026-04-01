// @vitest-environment node
import { describe, expect, it } from "vitest";
import { normalizeSubscriptionSnapshot } from "@/hooks/subscriptionSnapshot";

describe("useSubscription", () => {
  it("surfaces grace-period state when the server returns a past-due grace window", () => {
    const snapshot = normalizeSubscriptionSnapshot({
      access_grace_until: "2026-04-07T12:00:00.000Z",
      is_grace_period: true,
      past_due: true,
      subscribed: true,
      subscription_status: "past_due",
      tier: "power",
    });

    expect(snapshot).toMatchObject({
      accessGraceUntil: "2026-04-07T12:00:00.000Z",
      isGracePeriod: true,
      pastDue: true,
      subscribed: true,
      subscriptionStatus: "past_due",
      tier: "power",
    });
  });
});
