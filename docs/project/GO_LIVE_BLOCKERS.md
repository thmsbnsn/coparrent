# CoParrent Go-Live Blockers

Last updated: 2026-04-10

This file tracks active blockers for a controlled phase-1 launch decision.

Complimentary access codes are no longer an active blocker:

- repo-ready
- production backend ready
- public production frontend ready
- live public-host proof complete on 2026-04-10

Only rerun access-code QA if the admin issuance or end-user redemption surface changes again before another batch.

## Active Blocker Summary

| Blocker | Classification | Risk | Current status |
| --- | --- | --- | --- |
| Current production third-party invite path is broken | Still blocks first external cohort | Critical | Open |

## Recently Closed Or Removed From First-Cohort Scope

- **Closed item:** Public-host auth misconfiguration
- **Closed on:** 2026-04-10
- **Current state:** `https://coparrent.com/login` and `https://coparrent.com/signup` no longer show the broken missing-site-key captcha state. Production login and signup were re-proven on the public host after explicitly setting `VITE_AUTH_CAPTCHA_ENABLED=false` and redeploying the frontend.
- **Evidence files:**
  - [../../docs/acquisition/diligence/LIVE_VERIFICATION_EVIDENCE_LOG.md](../../docs/acquisition/diligence/LIVE_VERIFICATION_EVIDENCE_LOG.md)
  - [../../src/lib/authCapabilities.ts](../../src/lib/authCapabilities.ts)
  - [../../src/pages/Login.tsx](../../src/pages/Login.tsx)
  - [../../src/pages/Signup.tsx](../../src/pages/Signup.tsx)
- **Operational note:** Current first-cohort auth posture does not rely on captcha. Direct auth API requests without captcha tokens remain allowed until the operator deliberately configures both public-site and server-side captcha enforcement and reruns proof.

- **Closed item:** Current production onboarding proof
- **Closed on:** 2026-04-10
- **Current state:** A fresh live signup completed end to end through confirmation handoff, onboarding, child creation, and dashboard landing in a usable family context on `https://coparrent.com`.
- **Evidence files:**
  - [../../docs/acquisition/diligence/LIVE_VERIFICATION_EVIDENCE_LOG.md](../../docs/acquisition/diligence/LIVE_VERIFICATION_EVIDENCE_LOG.md)
  - [../../src/pages/Onboarding.tsx](../../src/pages/Onboarding.tsx)
  - [../../src/contexts/FamilyContext.tsx](../../src/contexts/FamilyContext.tsx)
- **Operational note:** Re-run this only if the public auth or onboarding surface changes again before the cohort.

- **Closed item:** Current production co-parent invite acceptance proof
- **Closed on:** 2026-04-10
- **Current state:** The live Settings page created a co-parent invite under an explicit current-client `activeFamilyId`, and the invitee completed account creation, acceptance, and dashboard landing on the public host.
- **Evidence files:**
  - [../../docs/acquisition/diligence/LIVE_VERIFICATION_EVIDENCE_LOG.md](../../docs/acquisition/diligence/LIVE_VERIFICATION_EVIDENCE_LOG.md)
  - [../../src/components/settings/CoParentInvite.tsx](../../src/components/settings/CoParentInvite.tsx)
  - [../../src/pages/AcceptInvite.tsx](../../src/pages/AcceptInvite.tsx)
- **Operational note:** This path is now re-proven on the public host. Re-run only if the co-parent invite surface changes again.

- **Closed item:** Complimentary access-code rollout proof
- **Closed on:** 2026-04-10
- **Current state:** `admin-manage-access-codes` is deployed to production, the public production frontend exposes the admin `Access Codes` tab, and live public-host QA proved issuance, one-time raw reveal, inventory visibility, redemption, complimentary Power state reflection, deactivation, and inactive-code rejection.
- **Evidence files:**
  - [REDEEM_CODE_READINESS.md](REDEEM_CODE_READINESS.md)
  - [REDEEM_CODE_OPERATOR_RUNBOOK.md](REDEEM_CODE_OPERATOR_RUNBOOK.md)
  - [../../supabase/functions/admin-manage-access-codes/index.ts](../../supabase/functions/admin-manage-access-codes/index.ts)
  - [../../src/components/admin/AdminAccessCodeManager.tsx](../../src/components/admin/AdminAccessCodeManager.tsx)
  - [../../src/components/settings/AccessCodeRedeemer.tsx](../../src/components/settings/AccessCodeRedeemer.tsx)
  - [../../docs/acquisition/diligence/LIVE_VERIFICATION_EVIDENCE_LOG.md](../../docs/acquisition/diligence/LIVE_VERIFICATION_EVIDENCE_LOG.md)
- **Operational note:** Re-run this QA proof only if the access-code admin or redemption surface changes again.

- **Closed item:** Canonical public-host posture
- **Closed on:** 2026-04-10
- **Current state:** `https://coparrent.com` is now the canonical public host for the launch docs. `https://www.coparrent.com` does not redirect yet, but it intentionally serves the same app and the rendered canonical metadata points to the apex host.
- **Evidence files:**
  - [../../docs/acquisition/diligence/LIVE_VERIFICATION_EVIDENCE_LOG.md](../../docs/acquisition/diligence/LIVE_VERIFICATION_EVIDENCE_LOG.md)
  - [../../docs/acquisition/diligence/DEPLOYMENT_RUNBOOK.md](../../docs/acquisition/diligence/DEPLOYMENT_RUNBOOK.md)
  - [../../.env.example](../../.env.example)
- **Operational note:** Redirect cleanup can wait until later as long as launch docs and env posture stay aligned to the apex host.

- **Closed item:** Current production pricing, checkout, webhook, and customer-portal proof
- **Closed on:** 2026-04-10
- **Current state:** The live public pricing route was rechecked on `https://coparrent.com`, a safe no-charge live trial checkout returned successfully to `/settings?success=true`, the webhook promoted the QA profile to active Power access, `check-subscription` returned the expected paid state, and the customer portal completed a safe action.
- **Evidence files:**
  - [../../docs/acquisition/diligence/LIVE_VERIFICATION_EVIDENCE_LOG.md](../../docs/acquisition/diligence/LIVE_VERIFICATION_EVIDENCE_LOG.md)
  - [../../src/pages/Pricing.tsx](../../src/pages/Pricing.tsx)
  - [../../src/hooks/useSubscription.ts](../../src/hooks/useSubscription.ts)
  - [../../supabase/functions/check-subscription/index.ts](../../supabase/functions/check-subscription/index.ts)
  - [../../supabase/functions/customer-portal/index.ts](../../supabase/functions/customer-portal/index.ts)
- **Operational note:** The exact dashboard subscription-banner click itself was not rerun separately in the safe-trial pass. Re-run that UI affordance only if the banner path changes again.

- **Removed from first-cohort scope:** Fresh production court/export verification
- **Removed on:** 2026-04-10
- **Current state:** Exports are no longer gating the first external cohort. They stay out of the phase-1 promise until a fresh production export pass is rerun deliberately.
- **Evidence files:**
  - [LAUNCH_READINESS_AUDIT.md](LAUNCH_READINESS_AUDIT.md)
  - [INITIAL_USER_ROLLOUT_PLAN.md](INITIAL_USER_ROLLOUT_PLAN.md)
  - [PHASE_1_LAUNCH_CHECKLIST.md](PHASE_1_LAUNCH_CHECKLIST.md)
- **Operational note:** Keep exports out of first-cohort messaging until the evidence package and PDF verification path are rerun on production.

- **Removed from first-cohort scope:** Fresh Law Office Portal live verification
- **Removed on:** 2026-04-10
- **Current state:** The Lawyer Portal / Law Office Portal is present in repo and phase-1 read-only, but it is not part of the first-cohort promise and has not been freshly live-verified on the current public host.
- **Evidence files:**
  - [../../src/pages/LawOfficeDashboard.tsx](../../src/pages/LawOfficeDashboard.tsx)
  - [LAUNCH_READINESS_AUDIT.md](LAUNCH_READINESS_AUDIT.md)
  - [PHASE_1_LAUNCH_CHECKLIST.md](PHASE_1_LAUNCH_CHECKLIST.md)
- **Operational note:** Do not promise law-office export review in launch messaging until the login, assigned-family selection, stored download, and verify actions are re-proven on the public host.

- **Closed item:** First-cohort support and monitoring ownership
- **Closed on:** 2026-04-10
- **Current state:** Support ownership is now explicitly assigned for the first cohort.
- **Ownership:**
  - support inbox owner: CoParrent Development Team (`support@coparrent.com`)
  - general contact owner: CoParrent Development Team (`hello@coparrent.com`)
  - legal / law-office inquiry owner: CoParrent Development Team (`legal@coparrent.com`)
  - problem report triage owner: CoParrent Development Team
  - edge-function / runtime log owner: CoParrent Development Team
  - transactional sender mailbox: `no-reply@coparrent.com` outbound only, not monitored for support
  - Sentry posture for first cohort: intentionally absent unless enabled before external users
- **Operating posture:** Check `support@coparrent.com` at least twice daily during pilot, check problem reports daily, review runtime / edge-function logs daily during pilot, and route legal or law-office requests through `legal@coparrent.com`.

## 1. Current Production Third-Party Invite Path Is Broken

- **Why it matters:** Third-party invite acceptance is a separate family-role path. It is not safe to assume it works because co-parent invites now pass.
- **Current status:** Open.
- **Evidence files:**
  - [../../docs/acquisition/diligence/LIVE_VERIFICATION_EVIDENCE_LOG.md](../../docs/acquisition/diligence/LIVE_VERIFICATION_EVIDENCE_LOG.md)
  - [../../src/components/settings/ThirdPartyManager.tsx](../../src/components/settings/ThirdPartyManager.tsx)
  - [../../src/pages/AcceptInvite.tsx](../../src/pages/AcceptInvite.tsx)
  - [../../supabase/migrations/20260329153000_scope_third_party_invites_to_active_family.sql](../../supabase/migrations/20260329153000_scope_third_party_invites_to_active_family.sql)
- **Risk level:** Critical
- **Launch impact:** Still blocks the first external cohort unless the third-party invite surface is deliberately removed from first-cohort scope.
- **Exact next action:** Correct production so `public.rpc_create_third_party_invite` exposes the scoped `p_family_id` signature that the current client sends, then rerun the third-party invite flow end to end on `https://coparrent.com`.
- **Owner suggestion:** Engineering
- **Classification:** Still blocks first external cohort
- **Observed live defect:** The live browser request returned `404` with `PGRST202`, and the response indicated production still exposes the older unscoped RPC signature instead of the scoped repo contract.

## Law Office Portal Status

- **Present in repo:** Yes
- **What it currently does:** Read-only review of immutable family-wide court-record exports, stored-artifact download, and receipt-backed verification for assigned families
- **Phase-1 read-only:** Yes
- **In first-cohort scope:** No
- **Freshly live-verified on the current public host:** No
- **What still has to happen before it can be promised:** Re-prove law-office login, assigned-family selection, stored download, and verification actions on the public host, then decide to bring exports back into launch scope deliberately

## Should Finish Before Public Launch

These are not current first-cohort blockers if they stay out of scope:

- fresh production export verification if exports will be promised again
- fresh Law Office Portal live verification if law-office review will be promised again
- captcha hardening, only if the operator wants to re-enable captcha before public launch
- real-device push/PWA validation
- async family challenge promotion and live verification
- shared-game mobile verification
- redirect cleanup for the `www` host if the team wants a single-host redirect posture

## Can Wait Until After First Cohort

- child-device rollout polish
- broader analytics and monitoring upgrades beyond the minimum owned launch posture
- additional game consumers and broader multiplayer scope
- passkey enablement, if intentionally deferred
- exports and law-office review, until they are deliberately reverified and brought back into scope
