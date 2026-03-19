# CoParrent Project Completion Review

_Last updated: 2026-03-19_

This is the current project-completion split requested for release planning.

## Tasks Codex Can Do Without User Assistance

Completed in this pass:

1. Route-level lazy loading and vendor chunk splitting so the app no longer ships as a single multi-megabyte initial bundle.
2. Lint pipeline cleanup so `npm run lint` passes on maintained source code instead of failing on generated output.
3. Stale runtime URL cleanup across notifications, reminders, environment detection, and Nurse Nancy export output.
4. Sports reminder logic fix for users assigned both pickup and drop-off responsibility.
5. Documentation sync for current status, next-step priorities, and README cleanup.
6. Centralized route-access rules into a shared helper and fixed the third-party access leak caused by prefix-matching `"/dashboard"` as an allowed subtree.
7. Added a targeted Vitest regression suite for invite status logic, family bootstrap helpers, plan limits, route/security gating, and reminder helpers.
8. Added repeatable local verification scripts: `npm run test`, `npm run test:watch`, and `npm run verify`.
9. Burned down the local lint backlog to zero warnings, including typed cleanup across frontend hooks/pages and edge functions plus a targeted Fast Refresh allowlist for intentional companion exports.
10. Added `ProtectedRoute` integration coverage so auth loading, redirects, parent-only enforcement, and child/third-party routing decisions are exercised through the component, not just pure helpers.
11. Added `AcceptInvite` component coverage so invalid/expired tokens, pending invite redirects, co-parent acceptance, third-party acceptance, and email-mismatch handling are exercised through the page, not just pure invitation helpers.

Remaining Codex-only backlog:

1. Expand the current regression suite into broader onboarding, family-switching, and post-login smoke coverage after the live-system dependencies are settled.

## Tasks That Need User Assistance

1. End-to-end invite acceptance testing with real inboxes and clean accounts.
2. Restore or replace `LOVABLE_API_KEY` and confirm the long-term provider decision for Lovable-backed AI tools.
3. Run live Stripe checkout, webhook, and customer-portal verification.
4. Validate push notifications and PWA install behavior on physical iOS, Android, and desktop devices.
5. Decide whether to re-enable auth captcha and turn off localhost-origin exceptions after QA.
6. Decide how access codes are issued, audited, and scoped for beta vs launch.

## Release Readiness Summary

- Local build status: passing
- Local test status: passing
- Local lint status: passing cleanly
- Highest remaining release risk: live-system verification, not local code compilation
- Highest remaining Codex-only risk: regression breadth is still narrower than a full onboarding and cross-route UI smoke suite
