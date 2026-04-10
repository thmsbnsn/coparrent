# CoParrent Go-Live Blockers

Last updated: 2026-04-10

This file only tracks blockers that materially affect a controlled launch decision. It is intentionally operational and blunt.

## Blocker Summary

| Blocker | Risk | Blocks phase-1 user onboarding | Blocks redeem-code rollout | Current status |
| --- | --- | --- | --- | --- |
| Redeem-code rollout public-host proof | Low | No | No | Closed on 2026-04-10 |
| Current production auth/onboarding/invite/billing proof is stale or partial after the 2026-04-02 production changes | Critical | Yes | Yes | Open |
| Canonical-host and auth posture are not fully closed | High | Yes | Yes | Open |
| Fresh production export verification is missing | High | Yes if exports are part of launch promise | No | Open |
| Production schema rollout remains fragile for launch changes | High | Yes | Yes | Open |

## 1. Redeem-code rollout public-host proof

- **Why it matters:** Phase-1 code distribution must not rely on unproven admin tooling or manual profile toggles.
- **Current status:** Closed. `admin-manage-access-codes` is deployed to production, the public production frontend exposes the admin `Access Codes` tab, and public-host QA proved issuance, one-time raw reveal, inventory visibility, redemption, complimentary Power state reflection, deactivation, and inactive-code rejection.
- **Evidence files:**
  - [../../supabase/migrations/20260313120000_recover_access_code_system.sql](../../supabase/migrations/20260313120000_recover_access_code_system.sql)
  - [../../supabase/functions/redeem-access-code/index.ts](../../supabase/functions/redeem-access-code/index.ts)
  - [../../supabase/functions/admin-manage-access-codes/index.ts](../../supabase/functions/admin-manage-access-codes/index.ts)
  - [../../src/components/settings/AccessCodeRedeemer.tsx](../../src/components/settings/AccessCodeRedeemer.tsx)
  - [../../src/components/admin/AdminAccessCodeManager.tsx](../../src/components/admin/AdminAccessCodeManager.tsx)
  - [../../src/pages/AdminDashboard.tsx](../../src/pages/AdminDashboard.tsx)
  - [REDEEM_CODE_OPERATOR_RUNBOOK.md](REDEEM_CODE_OPERATOR_RUNBOOK.md)
  - [REDEEM_CODE_READINESS.md](REDEEM_CODE_READINESS.md)
  - [../../supabase/functions/_shared/adminManageAccessCodes.test.ts](../../supabase/functions/_shared/adminManageAccessCodes.test.ts)
- **Risk level:** Low
- **Launch impact:** This no longer blocks phase-1 redeem-code rollout. Distribution should still be small-batch and operator-controlled.
- **Exact next action:** Use the operator runbook for the first real batch. Click `Refresh` before reading post-redemption admin inventory state because the table does not auto-refresh.
- **Owner suggestion:** Engineering + ops
- **Blocks phase-1 user onboarding:** No
- **Blocks redeem-code rollout:** No

## 2. Current production auth, onboarding, invite, and billing proof is stale or partial after the 2026-04-02 production changes

- **Why it matters:** The repo and docs show historical live proof for auth, invites, and Stripe, but that proof mostly predates the 2026-04-02 production frontend redeploy and apex alias claim. Launch needs current proof on the actual public host.
- **Current status:** Historical proof exists. Current-production rerun is missing.
- **Evidence files:**
  - [../../README.md](../../README.md)
  - [CURRENT_STATUS.md](CURRENT_STATUS.md)
  - [../../docs/acquisition/diligence/LIVE_VERIFICATION_EVIDENCE_LOG.md](../../docs/acquisition/diligence/LIVE_VERIFICATION_EVIDENCE_LOG.md)
  - [../../src/pages/Onboarding.tsx](../../src/pages/Onboarding.tsx)
  - [../../src/pages/AcceptInvite.tsx](../../src/pages/AcceptInvite.tsx)
  - [../../src/hooks/useSubscription.ts](../../src/hooks/useSubscription.ts)
  - [../../supabase/functions/create-checkout/index.ts](../../supabase/functions/create-checkout/index.ts)
  - [../../supabase/functions/customer-portal/index.ts](../../supabase/functions/customer-portal/index.ts)
- **Risk level:** Critical
- **Launch impact:** Without a current rerun, the first external cohort would rely on stale evidence for the most important user acquisition and monetization paths.
- **Exact next action:** Re-run end-to-end on the chosen public host: login, signup, captcha gate, onboarding, co-parent invite, third-party invite, pricing entry, checkout, webhook confirmation, and customer portal.
- **Owner suggestion:** QA + engineering
- **Blocks phase-1 user onboarding:** Yes
- **Blocks redeem-code rollout:** Partially. Codes can be distributed, but recipients still rely on sign-in and account setup.

## 3. Canonical-host and auth posture are not fully closed

- **Why it matters:** The repo currently points to apex `https://coparrent.com`, but the auth confirmation checklist still says to keep `https://www.coparrent.com` canonical until apex is confirmed from multiple networks. That is not a documentation nit. It directly affects invite links, auth callbacks, public trust, and launch messaging.
- **Current status:** Open. Repo defaults and operational docs are not aligned.
- **Evidence files:**
  - [../../index.html](../../index.html)
  - [../../.env.example](../../.env.example)
  - [DEPLOYMENT_AUTH_CONFIRMATION_CHECKLIST.md](DEPLOYMENT_AUTH_CONFIRMATION_CHECKLIST.md)
  - [../../docs/acquisition/diligence/LIVE_VERIFICATION_EVIDENCE_LOG.md](../../docs/acquisition/diligence/LIVE_VERIFICATION_EVIDENCE_LOG.md)
  - [../../src/lib/authCapabilities.ts](../../src/lib/authCapabilities.ts)
  - [../../src/components/auth/AuthCaptcha.tsx](../../src/components/auth/AuthCaptcha.tsx)
  - [../../src/components/auth/PasskeySetup.tsx](../../src/components/auth/PasskeySetup.tsx)
- **Risk level:** High
- **Launch impact:** This can create broken or ambiguous public links, muddled auth behavior, and unclear product posture around captcha and passkeys.
- **Exact next action:** Make one host decision, prove it from multiple networks, then update the docs and env posture to match that one decision. At the same time, explicitly record whether passkeys stay disabled for launch.
- **Owner suggestion:** Ops + engineering
- **Blocks phase-1 user onboarding:** Yes
- **Blocks redeem-code rollout:** Yes

## 4. Fresh production export verification is missing

- **Why it matters:** Court/export integrity is one of the repo’s strongest differentiated surfaces. The repo and tests are strong, but the docs explicitly still call for a fresh live verification pass of the Object Lock-backed export path after meaningful releases.
- **Current status:** Open. Repo-complete, not freshly live-reverified.
- **Evidence files:**
  - [CURRENT_STATUS.md](CURRENT_STATUS.md)
  - [PROJECT_COMPLETION_REVIEW.md](PROJECT_COMPLETION_REVIEW.md)
  - [../../src/hooks/useCourtExport.ts](../../src/hooks/useCourtExport.ts)
  - [../../src/pages/LawOfficeDashboard.tsx](../../src/pages/LawOfficeDashboard.tsx)
  - [../../supabase/functions/_shared/courtRecordExport.test.ts](../../supabase/functions/_shared/courtRecordExport.test.ts)
- **Risk level:** High
- **Launch impact:** If exports are part of the first-cohort value proposition, launching without fresh proof weakens both trust and support readiness.
- **Exact next action:** Create a fresh production export, download both stored artifacts, run verification against stored source and stored PDF, and record the result in the live evidence log.
- **Owner suggestion:** QA + engineering
- **Blocks phase-1 user onboarding:** Yes if the first cohort is being sold on export/legal evidence value; otherwise high-risk partial
- **Blocks redeem-code rollout:** No

## 5. Production schema rollout remains fragile for launch changes

- **Why it matters:** Recent docs explicitly say some production rollout work was done manually because the remote project was behind on a broader migration backlog and a blind `supabase db push` was intentionally avoided. That means any last-minute launch change still needs disciplined rollout and rollback steps.
- **Current status:** Open operational risk.
- **Evidence files:**
  - [PROBLEM_REPORT_SETUP.md](PROBLEM_REPORT_SETUP.md)
  - [CURRENT_STATUS.md](CURRENT_STATUS.md)
  - [../../docs/acquisition/diligence/DEPLOYMENT_RUNBOOK.md](../../docs/acquisition/diligence/DEPLOYMENT_RUNBOOK.md)
- **Risk level:** High
- **Launch impact:** A bad or rushed launch-day rollout can break onboarding, billing, or other launch-critical paths with no simple recovery path.
- **Exact next action:** Freeze required schema/config changes, document the exact apply order and rollback plan, and avoid any unnecessary production schema work during the external cohort launch window.
- **Owner suggestion:** Engineering
- **Blocks phase-1 user onboarding:** Yes for any cohort that depends on additional launch changes
- **Blocks redeem-code rollout:** No for the current proven access-code system. Yes only if new schema or server changes are introduced before code distribution.

## Non-Blocking But Important

These should stay visible, but they do not have to block the first small cohort if they are clearly out of scope:

- Real-device push/PWA validation is still open.
- Async family challenges are repo-complete but not promoted/live-verified.
- Shared-game mobile verification remains worth doing.
- Production monitoring posture is only partially documented. `VITE_SENTRY_DSN` was not present in the last recorded Vercel env inventory.
- Child-device flow is a foundation, not a launch-closed child-install program.

Relevant evidence:

- [PUSH_PWA_DEVICE_VALIDATION_CHECKLIST.md](PUSH_PWA_DEVICE_VALIDATION_CHECKLIST.md)
- [GAME_SYSTEM_STATUS.md](GAME_SYSTEM_STATUS.md)
- [../../docs/acquisition/diligence/SECRETS_AND_ENV_INVENTORY.md](../../docs/acquisition/diligence/SECRETS_AND_ENV_INVENTORY.md)
- [../../src/pages/ChildAppPage.tsx](../../src/pages/ChildAppPage.tsx)
