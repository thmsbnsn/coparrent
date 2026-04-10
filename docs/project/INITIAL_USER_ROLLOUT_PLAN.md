# CoParrent Initial User Rollout Plan

Last updated: 2026-04-10

This plan assumes a controlled phase-1 rollout, not a public launch.

## Launch Recommendation

Current recommendation: **Hold external rollout until blocker closeout.**

Phase-1 can become viable quickly, but only if the rollout stays narrow and disciplined.

## Rollout Principles

- Launch only what is repo-confirmed and either freshly verified or consciously accepted as historical.
- Do not promise push/PWA, async family challenges, or child-install polish unless those are explicitly reverified.
- Distribute redeem codes only through the proven complimentary-access operator flow and only in small batches.
- Keep support direct and human for the first cohort.

## Scope Recommendation For The First Cohort

Recommended in-scope surfaces:

- public site
- auth
- onboarding
- invite acceptance
- family switching and fail-closed family scope
- messaging
- calling
- subscription flow
- complimentary access-code distribution through the operator runbook
- problem reporting
- exports only after fresh production verification

Recommended out-of-scope surfaces unless reverified first:

- push/PWA as a promised feature
- async family challenges
- child-device rollout
- anything that depends on a brand-new production schema change during the cohort window

## Milestone 1: First Internal Test Users

### Entry criteria

- Public host decision is explicit.
- Current-production smoke, auth, invite, and billing reruns are complete.
- Support owner is assigned.

### User count

- 2 to 5 trusted internal testers

### Goal

- Confirm the real production host and the first-run family setup path are stable enough for non-developer users.

### Required actions

1. Run the production smoke path.
2. Run login and signup with captcha.
3. Run onboarding.
4. Run co-parent invite acceptance.
5. Run third-party invite acceptance.
6. Run pricing, checkout, webhook confirmation, and portal.
7. Run one fresh production export verification if exports are in scope.
8. Confirm problem-report intake and response workflow.

### Exit criteria

- No unknowns remain for public host, auth, invite, or billing.
- Any issues found are fixed or explicitly removed from phase-1 scope.

## Milestone 2: First External Pilot Users

### Entry criteria

- Internal milestone passed.
- Phase-1 scope has been frozen.
- No required launch changes remain unplanned.

### User count

- 5 to 20 external users max

### Goal

- Validate onboarding, family operations, billing posture, support load, and real-user comprehension.

### Operating model

- Manual support coverage during the pilot window
- Daily issue review
- No silent scope expansion during the pilot

### Exit criteria

- Onboarding and invite flows remain stable under real-user usage
- Support load is manageable
- No unresolved critical launch bugs are found

## Milestone 3: Redeem-Code-Enabled Rollout

### Entry criteria

- Redeem-code issuance exists and is deployed
- Redeem-code runbook exists
- One QA code has been minted and redeemed end-to-end on the public production host
- Support team knows how to revoke or replace a bad code

### Goal

- Start controlled distribution of a small code batch without improvising operations

### First batch guidance

- Start with a very small batch
- Track each code issue and redemption outcome
- Avoid large campaign distribution until the first batch is clean

## Exact Recommended Next 10 Actions In Order

1. Decide the canonical production host and update the launch posture docs to match it.
2. Re-run production smoke, login, signup, and captcha checks on that exact host.
3. Re-run onboarding plus co-parent and third-party invite acceptance on that exact host.
4. Re-run pricing entry, checkout, webhook confirmation, and customer portal on that exact host.
5. Re-run fresh production court/export verification if exports are part of the first-cohort promise.
6. Keep phase-1 redeem codes on the complimentary-access path only. Do not introduce Stripe coupon behavior.
7. Use the proven operator runbook for the first small redeem-code batch.
8. Confirm support and monitoring posture for the cohort, including whether Sentry is intentionally disabled and who watches logs and problem reports.
9. Start a very small internal cohort first.
10. Start external pilot users only after the remaining non-code launch blockers are either closed or explicitly removed from phase-1 scope.

## Owner Suggestions

| Workstream | Suggested owner |
| --- | --- |
| Host decision and public launch posture | Founder + ops |
| Auth, invite, billing reruns | QA + engineering |
| Redeem-code distribution operations | Engineering + ops |
| Export verification rerun | QA + engineering |
| Support readiness and monitoring | Founder + support owner |

## Rollback Posture

For the first external cohort:

- Avoid shipping unnecessary schema changes.
- Keep launch scope narrow.
- Keep the last known-good deployment reference available.
- If a critical auth, invite, or billing regression appears, stop external onboarding before expanding the cohort.

## Bottom Line

The shortest safe route is:

1. prove the current production path again
2. lock the host and auth posture
3. use the proven redeem-code operator path only
4. start tiny
5. expand only after the first clean passes

That is the right rollout shape for this repo as it exists today.
