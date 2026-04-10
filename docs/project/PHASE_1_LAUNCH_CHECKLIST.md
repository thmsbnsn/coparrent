# CoParrent Phase-1 Launch Checklist

Last updated: 2026-04-10

Use this checklist for the first controlled cohort only. This is not the public-launch checklist.

## Launch Call

Current recommendation: **Do not launch the first external cohort yet.**

Minimum go or no-go rule:

- All items in `Must finish before first cohort` must be complete.
- If any item stays `Unknown`, launch stays `No-Go`.

## Must Finish Before First Cohort

### Production deployment checks

- [ ] Confirm the canonical public host: `https://coparrent.com` or `https://www.coparrent.com`
- [ ] Confirm the non-canonical host cleanly redirects or intentionally serves the same app
- [ ] Confirm TLS and browser loads from at least two networks
- [ ] Confirm the production build matches the intended Supabase project and current repo state
- [ ] Confirm no last-minute production env drift from the intended launch posture

Primary evidence:

- [DEPLOYMENT_AUTH_CONFIRMATION_CHECKLIST.md](DEPLOYMENT_AUTH_CONFIRMATION_CHECKLIST.md)
- [../../README.md](../../README.md)
- [../../docs/acquisition/diligence/DEPLOYMENT_RUNBOOK.md](../../docs/acquisition/diligence/DEPLOYMENT_RUNBOOK.md)

### Staging verification checks

- [ ] If any pre-launch code or schema change is still pending, verify it in staging first
- [x] Verify redeem-code issuance, listing, deactivation, and redemption end-to-end on the production public host if codes are part of the cohort plan
- [ ] If async challenges are intended for cohort scope, verify staging before production

Primary evidence:

- [CURRENT_STATUS.md](CURRENT_STATUS.md)
- [GAME_SYSTEM_STATUS.md](GAME_SYSTEM_STATUS.md)

### Real-device checks

- [ ] Decide whether push/PWA is in first-cohort scope
- [ ] If yes, complete desktop, Android, and iOS evidence capture
- [ ] If no, remove push/PWA from cohort promise language and support expectations

Primary evidence:

- [PUSH_PWA_DEVICE_VALIDATION_CHECKLIST.md](PUSH_PWA_DEVICE_VALIDATION_CHECKLIST.md)
- [../../docs/acquisition/diligence/LIVE_VERIFICATION_EVIDENCE_LOG.md](../../docs/acquisition/diligence/LIVE_VERIFICATION_EVIDENCE_LOG.md)

### Stripe and pricing checks

- [ ] Re-run pricing entry from the dashboard subscription banner on current production
- [ ] Re-run Stripe checkout on current production
- [ ] Confirm webhook updates the profile correctly
- [ ] Re-run customer portal on current production
- [x] If redeem codes are used, explicitly confirm they are complimentary access and not a Stripe discount path
- [x] If redeem codes are used, confirm operators are using the runbook instead of manual profile toggles

Primary evidence:

- [CURRENT_STATUS.md](CURRENT_STATUS.md)
- [../../src/components/dashboard/SubscriptionBanner.tsx](../../src/components/dashboard/SubscriptionBanner.tsx)
- [../../src/pages/Pricing.tsx](../../src/pages/Pricing.tsx)
- [../../supabase/functions/create-checkout/index.ts](../../supabase/functions/create-checkout/index.ts)
- [../../supabase/functions/customer-portal/index.ts](../../supabase/functions/customer-portal/index.ts)
- [REDEEM_CODE_OPERATOR_RUNBOOK.md](REDEEM_CODE_OPERATOR_RUNBOOK.md)
- [REDEEM_CODE_READINESS.md](REDEEM_CODE_READINESS.md)

### Invite and onboarding checks

- [ ] Re-run signup with captcha on the chosen public host
- [ ] Re-run login with captcha on the chosen public host
- [ ] Re-run co-parent invite acceptance on the chosen public host
- [ ] Re-run third-party invite acceptance on the chosen public host
- [ ] Re-run the onboarding flow to the point where a new family is usable

Primary evidence:

- [../../src/pages/Login.tsx](../../src/pages/Login.tsx)
- [../../src/pages/Signup.tsx](../../src/pages/Signup.tsx)
- [../../src/pages/Onboarding.tsx](../../src/pages/Onboarding.tsx)
- [../../src/pages/AcceptInvite.tsx](../../src/pages/AcceptInvite.tsx)
- [../../docs/acquisition/diligence/LIVE_VERIFICATION_EVIDENCE_LOG.md](../../docs/acquisition/diligence/LIVE_VERIFICATION_EVIDENCE_LOG.md)

### Family-scope fail-closed checks

- [ ] Confirm protected family routes still show explicit blocked state when `activeFamilyId` is missing
- [ ] Confirm server-side family-scoped actions fail when `family_id` is missing or ambiguous
- [ ] Confirm no launch change reintroduces `co_parent_id` inference or profile-pair scoping
- [ ] Confirm a multi-family account cannot silently act in the wrong family

Primary evidence:

- [../../src/contexts/FamilyContext.tsx](../../src/contexts/FamilyContext.tsx)
- [../../src/components/ProtectedRoute.tsx](../../src/components/ProtectedRoute.tsx)
- [../../src/lib/routeAccess.ts](../../src/lib/routeAccess.ts)
- [../../docs/security/SECURITY_MODEL.md](../../docs/security/SECURITY_MODEL.md)

### Export verification checks

- [ ] Create a fresh production court-record export
- [ ] Download the stored evidence package
- [ ] Download the stored PDF
- [ ] Verify stored source
- [ ] Verify stored PDF artifact
- [ ] If law-office access is in first-cohort scope, verify list, download, and verify from the law-office portal too

Primary evidence:

- [../../src/hooks/useCourtExport.ts](../../src/hooks/useCourtExport.ts)
- [../../src/pages/LawOfficeDashboard.tsx](../../src/pages/LawOfficeDashboard.tsx)
- [PROJECT_COMPLETION_REVIEW.md](PROJECT_COMPLETION_REVIEW.md)

### Support and problem-report readiness

- [ ] Confirm public help/contact problem reporting still works on current production
- [ ] Confirm who monitors the support inbox
- [ ] Confirm who triages production issues during the cohort
- [ ] Confirm the problem-report screenshot path is still working if screenshots are allowed

Primary evidence:

- [PROBLEM_REPORT_SETUP.md](PROBLEM_REPORT_SETUP.md)
- [../../src/components/feedback/ProblemReportContext.tsx](../../src/components/feedback/ProblemReportContext.tsx)

### Analytics, logging, and monitoring checks

- [ ] Confirm whether Sentry is intentionally enabled or intentionally absent in production
- [ ] Confirm who reads edge-function logs during the cohort
- [ ] Confirm support does not rely only on user complaints arriving ad hoc
- [ ] If no Sentry or alerting is enabled, record that as an explicit launch concession

Primary evidence:

- [../../src/lib/sentry.ts](../../src/lib/sentry.ts)
- [../../docs/acquisition/diligence/SECRETS_AND_ENV_INVENTORY.md](../../docs/acquisition/diligence/SECRETS_AND_ENV_INVENTORY.md)
- [../../src/components/admin/ProductionChecklist.tsx](../../src/components/admin/ProductionChecklist.tsx)

### Rollback readiness

- [ ] Document the exact launch-day config or schema changes
- [ ] Document the rollback order for those changes
- [ ] Avoid introducing any non-essential schema changes during the first external cohort window
- [ ] Keep a known-good preview or prior deployment reference available

Primary evidence:

- [../../docs/acquisition/diligence/DEPLOYMENT_RUNBOOK.md](../../docs/acquisition/diligence/DEPLOYMENT_RUNBOOK.md)
- [PROBLEM_REPORT_SETUP.md](PROBLEM_REPORT_SETUP.md)

## Should Finish Before Public Launch

- [ ] Real-device push/PWA validation complete
- [ ] Async family challenge path promoted and live-verified
- [ ] Shared-game mobile verification completed
- [ ] Production monitoring posture upgraded beyond the minimum

## Can Wait Until After First Cohort

- [ ] Child-install polish
- [ ] Additional game consumers
- [ ] Passkey enablement, if intentionally deferred
- [ ] Broader analytics instrumentation

## Explicit No-Go Conditions

Do not proceed to the first external cohort if any of these remain true:

- The public host decision is still ambiguous.
- Auth, invite, and billing have not been rerun on the current production host.
- Export verification has not been rerun on current production.
- The launch window still depends on unplanned production schema work without rollback notes.
