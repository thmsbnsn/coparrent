# CoParrent Launch Readiness Audit

Last updated: 2026-04-10

This audit is launch-readiness first, rollout-readiness second. It is grounded in the current repo, current docs, current scripts, and current implementation. It does not treat older verification as a fresh guarantee.

## Executive Summary

### Current answer

Phase-1 launch readiness right now: **No**

Reason:

- The repo is substantial and several live paths were verified in late March 2026.
- That is not enough to call the full system launch-ready today for a real first cohort.
- The biggest gap is not raw product coverage or redeem-code operations anymore. Redeem-code issuance and redemption are now public-host proven. The remaining launch gap is operational closure around current-production auth/onboarding/invite/billing proof, canonical-host posture, fresh export proof, and safe rollout discipline.

### Top 5 blockers

1. Current production onboarding, invite, and billing proof is stale or partial after the 2026-04-02 production changes.
2. Canonical-host and auth posture are not fully closed, and current docs conflict with repo defaults.
3. Fresh production verification of the court/export integrity path is missing.
4. Production rollout discipline is still fragile because selective/manual database rollout is still part of the current operational story.
5. Support and monitoring ownership for first-cohort issues is still not launch-closed.

### Top 5 important follow-ups that do not have to block the first cohort

1. Real-device push and PWA validation on desktop, Android, and iOS.
2. Async family challenge promotion and live verification in staging and production.
3. Shared-game verification on real mobile devices.
4. Explicit production monitoring posture confirmation, including whether `VITE_SENTRY_DSN` is intentionally unset.
5. Child-device and child-install polish beyond the current repo foundations.

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
- Messaging Hub, direct/family/group thread creation, and Messaging Hub export surfaces.
- Daily-backed audio/video calling with persisted call session/event state.
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

- Production frontend redeployed and aliased to `https://coparrent.com` on 2026-04-02.
- Production shared-game/family-presence database bundle applied on 2026-04-02 through rematch flow.
- Staging shared-game fixture and multiplayer verifier succeeded on 2026-04-02.
- Complimentary access-code admin operations were deployed and public-host verified on 2026-04-10.
- Historical live verification on file from 2026-03-23 through 2026-03-28 for:
  - Messaging Hub thread creation
  - Invite acceptance
  - Stripe checkout, webhook, and customer portal
  - Daily calling
  - Production auth
  - Problem-report submission
  - Production smoke

Primary evidence:

- [CURRENT_STATUS.md](CURRENT_STATUS.md)
- [../../docs/acquisition/diligence/LIVE_VERIFICATION_EVIDENCE_LOG.md](../../docs/acquisition/diligence/LIVE_VERIFICATION_EVIDENCE_LOG.md)

## Repo-Confirmed Launch Capabilities

| Capability | Repo-confirmed | Staging verified | Production verified | Current confidence | Evidence |
| --- | --- | --- | --- | --- | --- |
| Public site | Yes | N/A | Historical yes on 2026-03-28 smoke; post-2026-04-02 host proof is not freshly rerun | Partial | [../../src/App.tsx](../../src/App.tsx), [../../docs/acquisition/diligence/LIVE_VERIFICATION_EVIDENCE_LOG.md](../../docs/acquisition/diligence/LIVE_VERIFICATION_EVIDENCE_LOG.md), [../../README.md](../../README.md) |
| Auth and onboarding | Yes | Unknown | Production auth historically verified on 2026-03-27; full onboarding re-proof on current public host not found | Partial | [../../src/pages/Login.tsx](../../src/pages/Login.tsx), [../../src/pages/Signup.tsx](../../src/pages/Signup.tsx), [../../src/pages/Onboarding.tsx](../../src/pages/Onboarding.tsx), [../../docs/acquisition/diligence/LIVE_VERIFICATION_EVIDENCE_LOG.md](../../docs/acquisition/diligence/LIVE_VERIFICATION_EVIDENCE_LOG.md) |
| Invite acceptance | Yes | Unknown | Historically verified on 2026-03-25 against production backend; current public-host proof after 2026-04-02 is unknown | Partial | [../../src/pages/AcceptInvite.tsx](../../src/pages/AcceptInvite.tsx), [../../supabase/functions/accept-invite/index.ts](../../supabase/functions/accept-invite/index.ts), [../../docs/acquisition/diligence/LIVE_VERIFICATION_EVIDENCE_LOG.md](../../docs/acquisition/diligence/LIVE_VERIFICATION_EVIDENCE_LOG.md) |
| Family switching and family scope | Yes | Unknown | No dedicated live multi-family switch proof found | Repo-strong, live-unclear | [../../src/contexts/FamilyContext.tsx](../../src/contexts/FamilyContext.tsx), [../../src/lib/routeAccess.ts](../../src/lib/routeAccess.ts), [../../src/components/ProtectedRoute.tsx](../../src/components/ProtectedRoute.tsx) |
| Messaging | Yes | No explicit staging proof found | Historical production proof on 2026-03-23 and messaging route load proof on 2026-03-28 | Good but not freshly rerun | [../../src/hooks/useMessagingHub.ts](../../src/hooks/useMessagingHub.ts), [../../supabase/functions/create-message-thread/index.ts](../../supabase/functions/create-message-thread/index.ts), [../../docs/acquisition/diligence/LIVE_VERIFICATION_EVIDENCE_LOG.md](../../docs/acquisition/diligence/LIVE_VERIFICATION_EVIDENCE_LOG.md) |
| Calling | Yes | Unknown | Historical production backend proof on 2026-03-27 | Good but not freshly rerun | [../../src/hooks/useCallSessions.ts](../../src/hooks/useCallSessions.ts), [../../supabase/functions/create-call-session/index.ts](../../supabase/functions/create-call-session/index.ts), [../../docs/acquisition/diligence/LIVE_VERIFICATION_EVIDENCE_LOG.md](../../docs/acquisition/diligence/LIVE_VERIFICATION_EVIDENCE_LOG.md) |
| Court/export flows | Yes | Unknown | Fresh deployed export proof is explicitly still open | Not launch-closed | [../../src/hooks/useCourtExport.ts](../../src/hooks/useCourtExport.ts), [../../src/pages/LawOfficeDashboard.tsx](../../src/pages/LawOfficeDashboard.tsx), [PROJECT_COMPLETION_REVIEW.md](PROJECT_COMPLETION_REVIEW.md), [CURRENT_STATUS.md](CURRENT_STATUS.md) |
| Subscription flow | Yes | Unknown | Historical checkout/webhook/customer-portal proof on 2026-03-24; current pricing-entry path live recheck still open | Partial | [../../src/hooks/useSubscription.ts](../../src/hooks/useSubscription.ts), [../../supabase/functions/create-checkout/index.ts](../../supabase/functions/create-checkout/index.ts), [../../supabase/functions/customer-portal/index.ts](../../supabase/functions/customer-portal/index.ts), [CURRENT_STATUS.md](CURRENT_STATUS.md), [../../docs/acquisition/diligence/LIVE_VERIFICATION_EVIDENCE_LOG.md](../../docs/acquisition/diligence/LIVE_VERIFICATION_EVIDENCE_LOG.md) |
| Complimentary access codes | Yes | Unknown | Production backend and public-host frontend verified on 2026-04-10 | Launch-closed for phase-1 codes | [REDEEM_CODE_READINESS.md](REDEEM_CODE_READINESS.md), [REDEEM_CODE_OPERATOR_RUNBOOK.md](REDEEM_CODE_OPERATOR_RUNBOOK.md), [../../docs/acquisition/diligence/LIVE_VERIFICATION_EVIDENCE_LOG.md](../../docs/acquisition/diligence/LIVE_VERIFICATION_EVIDENCE_LOG.md) |
| Game system | Yes | Yes for staging multiplayer fixture | Production shared-game RPC bundle applied on 2026-04-02; async challenges are not yet promoted/live-verified | Partial | [GAME_SYSTEM_STATUS.md](GAME_SYSTEM_STATUS.md), [CURRENT_STATUS.md](CURRENT_STATUS.md) |
| Child account flow | Yes | Unknown | No live child-device proof found; current repo wording still calls parts of this a foundation | Partial and probably out of first-cohort scope | [../../src/pages/ChildAppPage.tsx](../../src/pages/ChildAppPage.tsx), [../../src/pages/ChildAccessSetupPage.tsx](../../src/pages/ChildAccessSetupPage.tsx), [PROJECT_COMPLETION_REVIEW.md](PROJECT_COMPLETION_REVIEW.md) |
| Admin/law-office flow | Yes | Unknown | No live law-office portal verification found; admin exists in repo | Repo-strong, live-unclear | [../../src/pages/AdminDashboard.tsx](../../src/pages/AdminDashboard.tsx), [../../src/pages/LawOfficeDashboard.tsx](../../src/pages/LawOfficeDashboard.tsx), [../../supabase/functions/admin-manage-users/index.ts](../../supabase/functions/admin-manage-users/index.ts) |
| Diagnostics/support tools | Yes | N/A | Problem-report submission live-verified on 2026-03-28; push/PWA real-device validation still open | Partial | [PROBLEM_REPORT_SETUP.md](PROBLEM_REPORT_SETUP.md), [PUSH_PWA_DEVICE_VALIDATION_CHECKLIST.md](PUSH_PWA_DEVICE_VALIDATION_CHECKLIST.md), [../../src/pages/PWADiagnosticsPage.tsx](../../src/pages/PWADiagnosticsPage.tsx), [../../docs/acquisition/diligence/LIVE_VERIFICATION_EVIDENCE_LOG.md](../../docs/acquisition/diligence/LIVE_VERIFICATION_EVIDENCE_LOG.md) |

## What Still Blocks A Controlled Launch To Initial Users

Blocking today:

1. No fresh post-2026-04-02 production regression pass for the current public host across auth, invite, pricing, checkout, and portal.
2. Canonical-host decision is still split across docs and repo defaults.
3. Export flows are repo-complete but not freshly live-reverified after meaningful release work.
4. Production rollout still depends on careful selective deployment rather than a simple, routine, fully trusted migration push.
5. Support and monitoring ownership for the cohort still needs explicit confirmation.

Detailed blocker breakdown lives in [GO_LIVE_BLOCKERS.md](GO_LIVE_BLOCKERS.md).

## What Still Blocks Sending Redeem Codes

Nothing currently blocks sending phase-1 complimentary access codes from a feature-readiness standpoint.

What exists:

- database tables for access-pass codes and redemptions
- secure redemption RPC
- authenticated edge function
- end-user settings UI for code redemption
- admin-only issuance, listing, and deactivation
- public-host proof on `https://www.coparrent.com`

What still has to happen before sending real codes operationally:

- follow [REDEEM_CODE_OPERATOR_RUNBOOK.md](REDEEM_CODE_OPERATOR_RUNBOOK.md)
- keep first distribution small
- do not describe codes as Stripe coupons, promotion codes, or billing discounts

Detailed analysis lives in [REDEEM_CODE_READINESS.md](REDEEM_CODE_READINESS.md).

## What Must Be Completed Before Launch Day

Must finish before the first external cohort:

1. Close the public-host decision and document the real canonical URL.
2. Re-run current-production auth, onboarding, invite, pricing, checkout, webhook, and portal proof on the chosen public host.
3. Re-run current-production export verification for the real Object Lock-backed export path.
4. Lock the operational rollout and rollback steps for any remaining database or env changes.
5. Confirm support intake path, alerting posture, and who owns first-response support during the cohort.

## What Can Wait Until After The First Cohort

Can wait if not explicitly promised to the first cohort:

- real-device push/PWA pass
- async family challenge live rollout
- broader multiplayer/mobile game validation
- child-install polish beyond the current parent-controlled setup
- second shared game consumer
- passkey enablement, if launch posture is explicitly "disabled for now"

## What Is Unclear And Needs Explicit Confirmation

Unknowns that need product or operations confirmation, not guesses:

1. Is the launch host meant to be `https://coparrent.com` or `https://www.coparrent.com`?
2. Is push/PWA part of the promised first-cohort feature set, or is it explicitly deferred?
3. Is child-device onboarding part of the first-cohort promise, or is the first cohort parent-only?
4. Is Sentry intentionally disabled in production, or is the missing `VITE_SENTRY_DSN` an incomplete launch setup?
5. Will async family challenges ship in phase-1, or should they be kept out of cohort messaging until promoted and reverified?

## Phase Split

### Must finish before first cohort

- Redeem-code deployment and QA proof, if codes are part of the plan
- Current production host decision
- Current production auth/invite/billing regression pass
- Current production export verification pass
- Rollout and rollback runbook for any remaining launch changes

### Should finish before public launch

- Real-device push/PWA validation
- Sentry or alternative explicit monitoring posture
- Async family challenge promotion and live verification
- Shared-game mobile verification

### Can wait until after first cohort

- Child-install polish
- Additional games
- Broader analytics work
- Passkey enablement, if intentionally deferred

### Future roadmap only

- Full real-time multiplayer expansion beyond synchronized race flow
- Dedicated child app beyond the current shared-codebase child mode
- Broader code or campaign tooling beyond the minimum operator issuance path

## Exact Recommended Next Sequence

### 1. Smallest safe path to first internal test users

1. Decide the canonical public host.
2. Re-run current production smoke plus auth/captcha checks on that host.
3. Re-run invite acceptance and subscription flows on that host.
4. Re-run export verification on that host.
5. Confirm support intake and monitoring posture.

### 2. Smallest safe path to first external pilot users

1. Finish the internal reruns above.
2. Freeze phase-1 scope to features that are actually live-verified now.
3. Do not promise push/PWA, async challenges, or child-install polish unless they are explicitly reverified.
4. Run the checklist in [PHASE_1_LAUNCH_CHECKLIST.md](PHASE_1_LAUNCH_CHECKLIST.md).
5. Invite a very small external cohort with direct support coverage.

### 3. Smallest safe path to redeem-code-enabled rollout

1. Keep phase-1 codes on the complimentary-access path only.
2. Use the deployed admin-only issuance path with deactivate support.
3. Run the operator runbook.
4. Mint a small first real batch.
5. Track each recipient and redemption outcome.

## Bottom Line

CoParrent is not missing its product core.

What is still missing is the last layer of launch discipline:

- prove the current public production path again
- close the host posture cleanly
- verify exports again
- stop relying on optimistic assumptions

That is a realistic closeout list. It is short enough to finish, but it is not finished yet.
