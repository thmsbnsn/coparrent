# CoParrent Launch Readiness Audit

Last updated: 2026-04-10

This audit is launch-readiness first, rollout-readiness second. It is grounded in the current repo, current docs, current scripts, and current implementation. It does not treat older verification as a fresh guarantee.

## Executive Summary

### Current answer

Phase-1 launch readiness right now: **No**

Reason:

- Complimentary access codes are launch-closed: repo-ready, production backend ready, public production frontend ready, and live public-host proof complete on 2026-04-10.
- Public-host login, signup, onboarding, and co-parent invite acceptance were re-proven on 2026-04-10.
- The current launch posture now keeps captcha explicitly off on the public host instead of leaving a broken missing-site-key state in front of users.
- The remaining first-cohort gap is now narrow and concrete: the live third-party invite path is broken because production still resolves an older unscoped RPC signature.
- First-cohort support and monitoring ownership is now assigned to the CoParrent Development Team.

### Top blocker

1. Current production third-party invite creation is broken on the live client.

### Top important follow-ups that do not have to block the first cohort

1. Fresh production court/export verification before exports are brought back into scope.
2. Fresh Law Office Portal live verification before law-office review is promised in launch messaging.
3. Real-device push and PWA validation on desktop, Android, and iOS.
4. Async family challenge promotion and live verification in staging and production.
5. Redirect cleanup for `https://www.coparrent.com` if the team wants a single-host redirect posture.

## Evidence Rules For This Audit

- `Repo-confirmed` means the current checked-in code or docs prove the surface exists.
- `Staging verified` means a repo doc or script result explicitly says staging was exercised.
- `Production verified` means there is dated live evidence on file.
- `Unknown` means no current evidence was found, or the latest evidence predates a later deploy/config change.
- Historical verification is useful, but it does not replace a fresh post-deploy check.

## Already Repo-Complete

Repo-confirmed now:

- Public site routes, pricing page, help center, blog, legal pages, and court-records overview.
- Auth flows, onboarding, invite acceptance, family selection, and protected-route fail-closed behavior.
- Messaging Hub, direct and family thread creation, and Messaging Hub export surfaces.
- Daily-backed audio and video calling with persisted call session and event state.
- Server-authoritative subscription checking, live Stripe checkout integration, and Stripe customer portal integration.
- Family-scoped court-record export creation, listing, download, and verification hooks.
- Admin dashboard, law-office portal, problem-report flow, and PWA diagnostics route.
- Child account, child restrictions, child login/setup, and child-mode route foundations.
- Shared game foundations, lobbies, race flow, and repo-local async challenge system.

Primary evidence:

- [../../README.md](../../README.md)
- [CURRENT_STATUS.md](CURRENT_STATUS.md)
- [PROJECT_COMPLETION_REVIEW.md](PROJECT_COMPLETION_REVIEW.md)
- [GAME_SYSTEM_STATUS.md](GAME_SYSTEM_STATUS.md)
- [../../src/App.tsx](../../src/App.tsx)
- [../../src/contexts/FamilyContext.tsx](../../src/contexts/FamilyContext.tsx)
- [../../src/components/ProtectedRoute.tsx](../../src/components/ProtectedRoute.tsx)

## Already Deployed Or Live-Verified

Repo-backed operational claims already on file:

- Complimentary access-code admin operations were deployed and public-host verified on 2026-04-10.
- Canonical public-host posture was rechecked on 2026-04-10 and closed to `https://coparrent.com`; `https://www.coparrent.com` intentionally serves the same app and the rendered canonical metadata points at the apex host.
- Login, signup, and end-to-end onboarding were re-proven on `https://coparrent.com` on 2026-04-10 under the current explicit no-captcha posture.
- Co-parent invite creation and acceptance were re-proven on `https://coparrent.com` on 2026-04-10 using an explicit current-client `activeFamilyId`.
- Pricing route, safe live trial checkout, webhook-backed profile update, and customer portal were re-proven on `https://coparrent.com` on 2026-04-10.
- Historical live verification on file from 2026-03-23 through 2026-03-28 for Messaging Hub thread creation, invite acceptance, Daily calling, problem-report submission, and production smoke.

Primary evidence:

- [../../docs/acquisition/diligence/LIVE_VERIFICATION_EVIDENCE_LOG.md](../../docs/acquisition/diligence/LIVE_VERIFICATION_EVIDENCE_LOG.md)

## Repo-Confirmed Launch Capabilities

| Capability | Repo-confirmed | Staging verified | Production verified | Current confidence | Evidence |
| --- | --- | --- | --- | --- | --- |
| Public site | Yes | N/A | Yes on 2026-04-10 for current public hosts and canonical metadata | Good | [../../src/App.tsx](../../src/App.tsx), [../../docs/acquisition/diligence/LIVE_VERIFICATION_EVIDENCE_LOG.md](../../docs/acquisition/diligence/LIVE_VERIFICATION_EVIDENCE_LOG.md), [../../README.md](../../README.md) |
| Auth and onboarding | Yes | Unknown | Yes on 2026-04-10 on `https://coparrent.com` | Good with notes | [../../src/pages/Login.tsx](../../src/pages/Login.tsx), [../../src/pages/Signup.tsx](../../src/pages/Signup.tsx), [../../src/pages/Onboarding.tsx](../../src/pages/Onboarding.tsx), [../../docs/acquisition/diligence/LIVE_VERIFICATION_EVIDENCE_LOG.md](../../docs/acquisition/diligence/LIVE_VERIFICATION_EVIDENCE_LOG.md) |
| Invite acceptance | Yes | Unknown | Co-parent path re-proven on 2026-04-10; third-party path failed on 2026-04-10 because production still exposes the wrong RPC signature | Blocked by third-party path | [../../src/pages/AcceptInvite.tsx](../../src/pages/AcceptInvite.tsx), [../../src/components/settings/CoParentInvite.tsx](../../src/components/settings/CoParentInvite.tsx), [../../src/components/settings/ThirdPartyManager.tsx](../../src/components/settings/ThirdPartyManager.tsx), [../../docs/acquisition/diligence/LIVE_VERIFICATION_EVIDENCE_LOG.md](../../docs/acquisition/diligence/LIVE_VERIFICATION_EVIDENCE_LOG.md) |
| Family switching and family scope | Yes | Unknown | Co-parent invite proof used explicit current-client `activeFamilyId`; no fresh dedicated multi-family switch proof | Repo-strong, live-partial | [../../src/contexts/FamilyContext.tsx](../../src/contexts/FamilyContext.tsx), [../../src/lib/routeAccess.ts](../../src/lib/routeAccess.ts), [../../src/components/ProtectedRoute.tsx](../../src/components/ProtectedRoute.tsx) |
| Messaging | Yes | No explicit staging proof found | Historical production proof on 2026-03-23 and route-load proof on 2026-03-28 | Good but not freshly rerun | [../../src/hooks/useMessagingHub.ts](../../src/hooks/useMessagingHub.ts), [../../supabase/functions/create-message-thread/index.ts](../../supabase/functions/create-message-thread/index.ts), [../../docs/acquisition/diligence/LIVE_VERIFICATION_EVIDENCE_LOG.md](../../docs/acquisition/diligence/LIVE_VERIFICATION_EVIDENCE_LOG.md) |
| Calling | Yes | Unknown | Historical production backend proof on 2026-03-27 | Good but not freshly rerun | [../../src/hooks/useCallSessions.ts](../../src/hooks/useCallSessions.ts), [../../supabase/functions/create-call-session/index.ts](../../supabase/functions/create-call-session/index.ts), [../../docs/acquisition/diligence/LIVE_VERIFICATION_EVIDENCE_LOG.md](../../docs/acquisition/diligence/LIVE_VERIFICATION_EVIDENCE_LOG.md) |
| Court and export flows | Yes | Unknown | Fresh deployed export proof is still intentionally out of first-cohort scope | Out of first-cohort scope | [../../src/hooks/useCourtExport.ts](../../src/hooks/useCourtExport.ts), [../../src/pages/LawOfficeDashboard.tsx](../../src/pages/LawOfficeDashboard.tsx), [PROJECT_COMPLETION_REVIEW.md](PROJECT_COMPLETION_REVIEW.md), [CURRENT_STATUS.md](CURRENT_STATUS.md) |
| Subscription flow | Yes | Unknown | Pricing route, safe live trial checkout, webhook, and customer portal re-proven on 2026-04-10 | Good | [../../src/hooks/useSubscription.ts](../../src/hooks/useSubscription.ts), [../../supabase/functions/create-checkout/index.ts](../../supabase/functions/create-checkout/index.ts), [../../supabase/functions/customer-portal/index.ts](../../supabase/functions/customer-portal/index.ts), [../../docs/acquisition/diligence/LIVE_VERIFICATION_EVIDENCE_LOG.md](../../docs/acquisition/diligence/LIVE_VERIFICATION_EVIDENCE_LOG.md) |
| Complimentary access codes | Yes | Unknown | Production backend and public-host frontend verified on 2026-04-10 | Launch-closed for phase-1 codes | [REDEEM_CODE_READINESS.md](REDEEM_CODE_READINESS.md), [REDEEM_CODE_OPERATOR_RUNBOOK.md](REDEEM_CODE_OPERATOR_RUNBOOK.md), [../../docs/acquisition/diligence/LIVE_VERIFICATION_EVIDENCE_LOG.md](../../docs/acquisition/diligence/LIVE_VERIFICATION_EVIDENCE_LOG.md) |
| Game system | Yes | Yes for staging multiplayer fixture | Production shared-game RPC bundle applied on 2026-04-02; async challenges are not yet promoted/live-verified | Partial | [GAME_SYSTEM_STATUS.md](GAME_SYSTEM_STATUS.md), [CURRENT_STATUS.md](CURRENT_STATUS.md) |
| Child account flow | Yes | Unknown | No live child-device proof found; current repo wording still calls parts of this a foundation | Partial and out of first-cohort scope | [../../src/pages/ChildAppPage.tsx](../../src/pages/ChildAppPage.tsx), [../../src/pages/ChildAccessSetupPage.tsx](../../src/pages/ChildAccessSetupPage.tsx), [PROJECT_COMPLETION_REVIEW.md](PROJECT_COMPLETION_REVIEW.md) |
| Admin/law-office flow | Yes | Unknown | Admin exists in repo; Law Office Portal is repo-present, phase-1 read-only, and not freshly live-verified on the current public host | Repo-strong, live-unclear, out of first-cohort scope | [../../src/pages/AdminDashboard.tsx](../../src/pages/AdminDashboard.tsx), [../../src/pages/LawOfficeDashboard.tsx](../../src/pages/LawOfficeDashboard.tsx), [../../supabase/functions/admin-manage-users/index.ts](../../supabase/functions/admin-manage-users/index.ts) |
| Diagnostics/support tools | Yes | N/A | Problem-report submission live-verified on 2026-03-28; first-cohort support and monitoring ownership now assigned to the CoParrent Development Team | Good with notes | [PROBLEM_REPORT_SETUP.md](PROBLEM_REPORT_SETUP.md), [PUSH_PWA_DEVICE_VALIDATION_CHECKLIST.md](PUSH_PWA_DEVICE_VALIDATION_CHECKLIST.md), [../../src/pages/PWADiagnosticsPage.tsx](../../src/pages/PWADiagnosticsPage.tsx), [../../docs/acquisition/diligence/LIVE_VERIFICATION_EVIDENCE_LOG.md](../../docs/acquisition/diligence/LIVE_VERIFICATION_EVIDENCE_LOG.md) |

## Law Office Portal Status

- **Present in repo:** Yes
- **What it currently does:** Read-only review of immutable family-wide court-record exports, stored artifact download, and receipt-backed integrity verification for assigned families
- **Phase-1 read-only:** Yes
- **Assigned-family scoped:** Yes
- **Export creation enabled in this phase:** No
- **In first-cohort scope:** No
- **Freshly live-verified on the current public host:** No
- **What still has to happen before it can be promised:** Fresh live proof of law-office login, assigned-family selection, stored download, and verification actions on the public host, plus an explicit decision to bring exports back into launch scope

## What Still Blocks A Controlled Launch To Initial Users

Blocking today:

1. Current production third-party invite creation fails because production still exposes the wrong RPC signature.

Detailed blocker breakdown lives in [GO_LIVE_BLOCKERS.md](GO_LIVE_BLOCKERS.md).

## First-Cohort Support Ownership

- **Support inbox owner:** CoParrent Development Team (`support@coparrent.com`)
- **General contact owner:** CoParrent Development Team (`hello@coparrent.com`)
- **Legal / law-office inquiry owner:** CoParrent Development Team (`legal@coparrent.com`)
- **Problem report triage owner:** CoParrent Development Team
- **Edge-function / runtime log owner:** CoParrent Development Team
- **Transactional sender mailbox:** `no-reply@coparrent.com`; outbound only, not monitored for support
- **Sentry posture for first cohort:** intentionally absent unless enabled before external users

Operating posture:

- Check `support@coparrent.com` at least twice daily during pilot.
- Check problem reports daily.
- Review runtime / edge-function logs daily during pilot.
- Route legal or law-office requests through `legal@coparrent.com`.

## What Still Blocks Sending Redeem Codes

Nothing currently blocks sending phase-1 complimentary access codes from a feature-readiness standpoint.

What exists:

- database tables for access-pass codes and redemptions
- secure redemption RPC
- authenticated edge function
- end-user settings UI for code redemption
- admin-only issuance, listing, and deactivation
- live public-host proof complete on the current production frontend

What still has to happen before sending real codes operationally:

- follow [REDEEM_CODE_OPERATOR_RUNBOOK.md](REDEEM_CODE_OPERATOR_RUNBOOK.md)
- keep first distribution small
- do not describe codes as Stripe coupons, promotion codes, or billing discounts
- rerun the public-host access-code QA proof only if the access-code admin or redemption surface changes again before another batch

Detailed analysis lives in [REDEEM_CODE_READINESS.md](REDEEM_CODE_READINESS.md).

## What Must Be Completed Before Launch Day

Must finish before the first external cohort:

1. Correct production so `rpc_create_third_party_invite` exposes the scoped `p_family_id` signature the current client sends, then rerun third-party invite end to end on `https://coparrent.com`.

## What Can Wait Until After The First Cohort

Can wait if not explicitly promised to the first cohort:

- fresh production export verification
- fresh Law Office Portal live verification
- real-device push and PWA pass
- async family challenge live rollout
- broader multiplayer and mobile game validation
- child-install polish beyond the current parent-controlled setup
- passkey enablement, if launch posture is explicitly `disabled for now`

## What Is Unclear And Needs Explicit Confirmation

Unknowns that need product or operations confirmation, not guesses:

1. Will the team keep third-party invite acceptance in first-cohort scope, or explicitly remove it until the production RPC drift is fixed?

## Phase Split

### Must finish before first cohort

- Restore the scoped third-party invite RPC in production and rerun the third-party invite flow

### Conditional revalidation, not a current blocker

- Re-run public-host access-code QA only if the access-code admin or redemption surface changes again before another batch
- Re-run login, signup, onboarding, or co-parent invite only if those surfaces change again before the cohort

### Should finish before public launch

- Fresh production export verification if exports will be promised again
- Fresh Law Office Portal live verification if law-office review will be promised again
- Captcha hardening, only if the operator wants it back on before public launch
- Real-device push/PWA validation
- Async family challenge promotion and live verification
- Shared-game mobile verification

### Can wait until after first cohort

- Child-install polish
- Additional games
- Broader analytics work
- Passkey enablement, if intentionally deferred
- Redirect cleanup for the `www` host if the team wants a single-host redirect posture

## Exact Recommended Next Sequence

### 1. Smallest safe path to first internal test users

1. Correct the live third-party invite RPC drift.
2. Rerun third-party invite creation and acceptance on `https://coparrent.com`.
3. Operate the first-cohort support and monitoring cadence under the documented CoParrent Development Team ownership.
4. Keep exports and Law Office Portal review out of this internal scope.
5. Start with 2 to 5 trusted internal testers.

### 2. Smallest safe path to first external pilot users

1. Finish the internal reruns above.
2. Freeze phase-1 scope to features that are actually live-verified now.
3. Do not promise exports, Law Office Portal review, push/PWA, async challenges, or child-install polish unless they are explicitly reverified.
4. Run the checklist in [PHASE_1_LAUNCH_CHECKLIST.md](PHASE_1_LAUNCH_CHECKLIST.md).
5. Invite a very small external cohort with direct support coverage.

### 3. Smallest safe path to redeem-code-enabled rollout

1. Keep phase-1 codes on the complimentary-access path only.
2. Keep the already-proven access-code surface unchanged, or rerun public-host QA before distribution if that surface changes.
3. Use the deployed admin-only issuance path with deactivate support.
4. Run the operator runbook.
5. Mint a small first real batch and track each recipient and redemption outcome.

## Bottom Line

CoParrent is much closer to first-cohort readiness than it was before this pass.

The public-host auth problem is closed. End-to-end onboarding is closed. Co-parent invite acceptance is closed. Billing and access codes were already closed.

What is still missing is now narrow and specific:

- repair the live third-party invite path without reintroducing family inference
- keep exports and Law Office Portal review out of launch messaging until they are deliberately reverified

That is short enough to finish quickly, but it is not finished yet.
