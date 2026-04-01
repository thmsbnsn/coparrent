// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  isKnownStripeSubscriptionStatus,
  mapStripeSubscriptionStatus,
  resolvePastDueGraceUntil,
  selectAuthoritativeStripeSubscription,
} from "./subscriptionBilling.ts";

describe("subscriptionBilling", () => {
  it("maps important Stripe lifecycle statuses explicitly", () => {
    expect(mapStripeSubscriptionStatus("active")).toBe("active");
    expect(mapStripeSubscriptionStatus("trialing")).toBe("trial");
    expect(mapStripeSubscriptionStatus("past_due")).toBe("past_due");
    expect(mapStripeSubscriptionStatus("canceled")).toBe("canceled");
    expect(mapStripeSubscriptionStatus("unpaid")).toBe("expired");
    expect(mapStripeSubscriptionStatus("incomplete")).toBe("none");
    expect(mapStripeSubscriptionStatus("incomplete_expired")).toBe("expired");
    expect(mapStripeSubscriptionStatus("paused")).toBe("expired");
    expect(mapStripeSubscriptionStatus("future_state")).toBe("none");
  });

  it("identifies known Stripe statuses and flags unknown ones", () => {
    expect(isKnownStripeSubscriptionStatus("active")).toBe(true);
    expect(isKnownStripeSubscriptionStatus("paused")).toBe(true);
    expect(isKnownStripeSubscriptionStatus("future_state")).toBe(false);
  });

  it("selects the strongest entitlement-bearing subscription deterministically", () => {
    const selected = selectAuthoritativeStripeSubscription([
      {
        created: 300,
        current_period_end: 1_775_603_200,
        id: "sub_canceled_newer",
        status: "canceled",
      },
      {
        created: 100,
        current_period_end: 1_775_689_600,
        id: "sub_active_older",
        status: "active",
      },
      {
        created: 200,
        current_period_end: 1_775_680_000,
        id: "sub_past_due_middle",
        status: "past_due",
      },
    ]);

    expect(selected?.id).toBe("sub_active_older");
  });

  it("uses the latest boundary to break ties inside the same Stripe status", () => {
    const selected = selectAuthoritativeStripeSubscription([
      {
        created: 100,
        current_period_end: 1_775_603_200,
        id: "sub_active_earlier",
        status: "active",
      },
      {
        created: 50,
        current_period_end: 1_775_689_600,
        id: "sub_active_later",
        status: "active",
      },
    ]);

    expect(selected?.id).toBe("sub_active_later");
  });

  it("preserves an existing shorter grace window but clamps malformed far-future values", () => {
    const now = new Date("2026-03-30T12:00:00.000Z");

    expect(resolvePastDueGraceUntil("2026-04-02T12:00:00.000Z", now)).toBe(
      "2026-04-02T12:00:00.000Z",
    );
    expect(resolvePastDueGraceUntil("2027-01-01T00:00:00.000Z", now)).toBe(
      "2026-04-06T12:00:00.000Z",
    );
  });
});
