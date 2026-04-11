# CoParrent Phase-1 Launch Checklist

Last updated: 2026-04-10

Use this checklist for the first controlled cohort only. This is not the public-launch checklist.

## Launch Call

Current recommendation: **Do not launch the first external cohort yet.**

Minimum go or no-go rule:

- All items in `Must finish before first cohort` must be complete.
- If any item stays `Unknown`, launch stays `No-Go`.

Access-code status for this checklist:

- the complimentary access-code system is already repo-ready, production backend ready, public production frontend ready, and live-proofed on 2026-04-10
- do not reopen access-code implementation work as part of launch closeout
- rerun access-code QA only if the admin issuance or end-user redemption surface changes again before another batch

## Must Finish Before First Cohort

### Production deployment checks

- [x] Canonical public host confirmed as `https://coparrent.com`
- [x] Non-canonical host `https://www.coparrent.com` intentionally serves the same app today
- [ ] Confirm TLS and browser loads from at least two networks
- [ ] Confirm the production build matches the intended Supabase project and current repo state
- [x] Confirm no broken auth env drift remains on the public host

Primary evidence:

- [DEPLOYMENT_AUTH_CONFIRMATION_CHECKLIST.md](DEPLOYMENT_AUTH_CONFIRMATION_CHECKLIST.md)
- [../../README.md](../../README.md)
- [../../docs/acquisition/diligence/DEPLOYMENT_RUNBOOK.md](../../docs/acquisition/diligence/DEPLOYMENT_RUNBOOK.md)

### Staging verification checks

- [ ] If any pre-launch code or schema change is still pending, verify it in staging first
- [x] Access-code issuance, listing, deactivation, and redemption were proven end-to-end on the public production host on 2026-04-10
- [ ] Only if the access-code surface changes again: rerun one public-host issuance, redemption, and deactivation proof before sending another batch
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

- [x] Live pricing route on `https://coparrent.com` rechecked with the dashboard-source query string on 2026-04-10
- [x] Safe live trial Stripe checkout rerun on current production on 2026-04-10
- [x] Webhook profile update reconfirmed on 2026-04-10
- [x] Customer portal rerun on current production on 2026-04-10
- [x] If redeem codes are used, explicitly confirm they are complimentary access and not a Stripe discount path
- [x] If redeem codes are used, confirm operators are using the runbook instead of manual profile toggles

Operational note:

- The exact dashboard subscription-banner click itself was not rerun separately in the 2026-04-10 safe-trial pass. Rerun that UI affordance only if the banner path changes again.

Primary evidence:

- [../../src/pages/Pricing.tsx](../../src/pages/Pricing.tsx)
- [../../supabase/functions/create-checkout/index.ts](../../supabase/functions/create-checkout/index.ts)
- [../../supabase/functions/customer-portal/index.ts](../../supabase/functions/customer-portal/index.ts)
- [REDEEM_CODE_OPERATOR_RUNBOOK.md](REDEEM_CODE_OPERATOR_RUNBOOK.md)
- [REDEEM_CODE_READINESS.md](REDEEM_CODE_READINESS.md)

### Invite and onboarding checks

- [x] Current production login re-proven on `https://coparrent.com`
- [x] Current production signup re-proven on `https://coparrent.com`
- [x] Current production onboarding re-proven end to end to a usable family context
- [x] Current production co-parent invite acceptance re-proven with explicit inviter `activeFamilyId`
- [ ] Correct production so the third-party invite RPC matches the scoped repo contract
- [ ] Re-run third-party invite acceptance on the chosen public host
- [x] Current launch posture documented honestly: captcha is intentionally off on the public host for first cohort
- [ ] Only before public launch if captcha will be re-enabled: prove site key plus server-side enforcement together

Primary evidence:

- [../../src/pages/Login.tsx](../../src/pages/Login.tsx)
- [../../src/pages/Signup.tsx](../../src/pages/Signup.tsx)
- [../../src/pages/Onboarding.tsx](../../src/pages/Onboarding.tsx)
- [../../src/pages/AcceptInvite.tsx](../../src/pages/AcceptInvite.tsx)
- [../../src/components/settings/ThirdPartyManager.tsx](../../src/components/settings/ThirdPartyManager.tsx)
- [../../docs/acquisition/diligence/LIVE_VERIFICATION_EVIDENCE_LOG.md](../../docs/acquisition/diligence/LIVE_VERIFICATION_EVIDENCE_LOG.md)

### Family-scope fail-closed checks

- [x] Co-parent invite proof used an explicit current-client `activeFamilyId`
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

- [x] Exports are explicitly out of first-cohort scope until they are deliberately reverified
- [x] Law Office Portal review is explicitly out of first-cohort scope until it is deliberately reverified
- [ ] Only before public launch or if exports are promised again: create a fresh production court-record export
- [ ] Only before public launch or if exports are promised again: download the stored evidence package
- [ ] Only before public launch or if exports are promised again: download the stored PDF
- [ ] Only before public launch or if exports are promised again: verify stored source
- [ ] Only before public launch or if exports are promised again: verify stored PDF artifact
- [ ] Only before public launch or if Law Office Portal access is promised again: verify login, assigned-family selection, stored download, and verify from the law-office portal too

Primary evidence:

- [../../src/hooks/useCourtExport.ts](../../src/hooks/useCourtExport.ts)
- [../../src/pages/LawOfficeDashboard.tsx](../../src/pages/LawOfficeDashboard.tsx)
- [PROJECT_COMPLETION_REVIEW.md](PROJECT_COMPLETION_REVIEW.md)

### Support and problem-report readiness

- [ ] Confirm public help/contact problem reporting still works on current production
- [x] Confirm support inbox owner: CoParrent Development Team (`support@coparrent.com`)
- [x] Confirm general contact owner: CoParrent Development Team (`hello@coparrent.com`)
- [x] Confirm legal / law-office inquiry owner: CoParrent Development Team (`legal@coparrent.com`)
- [x] Confirm problem report triage owner: CoParrent Development Team
- [x] Confirm transactional sender mailbox: `no-reply@coparrent.com` is outbound only and not monitored for support
- [x] Confirm first-cohort support cadence: check `support@coparrent.com` at least twice daily during pilot, check problem reports daily, and route legal or law-office requests through `legal@coparrent.com`
- [ ] Confirm the problem-report screenshot path is still working if screenshots are allowed

Primary evidence:

- [PROBLEM_REPORT_SETUP.md](PROBLEM_REPORT_SETUP.md)
- [../../src/components/feedback/ProblemReportContext.tsx](../../src/components/feedback/ProblemReportContext.tsx)

### Analytics, logging, and monitoring checks

- [x] Confirm who reads edge-function logs during the cohort: CoParrent Development Team
- [x] Confirm who reads runtime logs during the cohort: CoParrent Development Team
- [x] Record the Sentry decision for the cohort: intentionally absent unless enabled before external users
- [x] If Sentry stays off, record that as an explicit launch concession
- [x] Confirm daily runtime / edge-function log review during pilot
- [x] Confirm support does not rely only on user complaints arriving ad hoc; daily problem-report and log review is part of the pilot cadence

Operational note:

- `VITE_SENTRY_DSN` is absent in the current documented env inventory and is intentionally absent for first cohort unless enabled before external users.

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

- [ ] Fresh production export verification complete
- [ ] Fresh Law Office Portal live verification complete if it will be promised
- [ ] Captcha hardening completed if the operator wants it back on
- [ ] Real-device push/PWA validation complete
- [ ] Async family challenge path promoted and live-verified
- [ ] Shared-game mobile verification completed
- [ ] Production monitoring posture upgraded beyond the minimum

## Can Wait Until After First Cohort

- [ ] Child-install polish
- [ ] Additional game consumers
- [ ] Passkey enablement, if intentionally deferred
- [ ] Broader analytics instrumentation
- [ ] `www` redirect cleanup

## Explicit No-Go Conditions

Do not proceed to the first external cohort if any of these remain true:

- The live third-party invite path still fails on the current client.
- The first-cohort scope still includes third-party invites without a fresh live proof.
- The launch window still depends on unplanned production schema work without rollback notes.
- Exports or Law Office Portal review are being promised without fresh live verification.
