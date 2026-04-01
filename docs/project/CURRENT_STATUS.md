# CoParrent Current Status

Last updated: 2026-04-01

This document is the current project snapshot. It prefers repo-confirmed statements and separates those from historical external verification evidence.

## Repo-Confirmed Now

As of this review:

- The current mainline codebase has been reviewed locally on 2026-04-01.
- `npm run lint` passes locally.
- `npm run build` passes locally.
- `npm run test -- --run` passes locally with 60 test files and 241 tests.

Current repo capabilities include:

- public marketing, pricing, help, blog, court-record overview, and legal pages
- auth, onboarding, family selection, and invite acceptance
- family-scoped dashboard, calendar, children, documents, expenses, sports, gifts, journal, and notifications
- Messaging Hub with direct/group/family threads, AI drafting support, and message-thread export receipts
- Daily-backed calling flows in dashboard and messaging contexts, with persisted call-session and call-event state
- family-wide court-record exports built server-side from family-scoped records with stored receipt and artifact metadata
- admin dashboard, law-library management, problem reporting, and PWA diagnostics

Current repo hardening also includes:

- explicit family-scope enforcement through `activeFamilyId` and server-side `family_id`
- server-side subscription resolution and Stripe lifecycle handling
- server-generated Messaging Hub and family-wide court-record evidence packages and PDF artifacts
- immutable export-artifact storage metadata and verification paths for new court-record exports
- verification helpers for preview smoke, Stripe, Daily calling, AI runtime, invites, and push/PWA flows

Important implementation boundaries:

- New Messaging Hub exports and new family-wide court-record exports now share one server-authoritative export model: explicit `family_id`, server-built canonical payloads, signed receipts, server-generated PDF artifacts, stored hash metadata, and verification paths.
- Call activity is persisted and included honestly as session/event evidence context. The repo does not include call recording, transcripts, or a standalone call-media archive.
- Family-wide court-record exports include document metadata and access history, not raw document binaries. Journal entries remain intentionally excluded.
- Legacy export artifacts created before the Object Lock cutover may still exist outside the newer immutable-storage path.

## Historical External Verification On File

The repo contains March 2026 evidence for:

- preview smoke coverage
- production smoke coverage
- invite acceptance flows
- Stripe checkout, webhook, and customer-portal behavior
- OpenRouter-backed AI flows
- problem-report submission
- Daily calling flows
- Google sign-in and password-reset behavior

Source:

- [../acquisition/diligence/LIVE_VERIFICATION_EVIDENCE_LOG.md](../acquisition/diligence/LIVE_VERIFICATION_EVIDENCE_LOG.md)

Those checks were not rerun as part of this documentation cleanup. Treat them as dated evidence on file, not as a new live guarantee.

## Open Items That Are Not Closed By Repo Inspection

- Real-device push/PWA validation on iOS, Android, and desktop.
- Final deployed auth posture confirmation, especially captcha and localhost-origin behavior.
- Final canonical-host posture confirmation for public deployment.
- Final passkey posture. Passkey-related UI exists in the repo, but deployment support and product messaging still need a clear decision.
- Fresh end-to-end deployed verification of the Object Lock-backed export path after the new storage configuration is released.
- A policy decision on whether legacy pre-cutover export artifacts remain as legacy records or are migrated.
- Whether call evidence should remain timeline/status based or expand into a dedicated media export/reporting surface.

## Current Recommendation

The project should be described today as:

- locally verified
- strongly documented
- unified in-repo for server-generated court-record exports across messaging, call-event evidence, and family-wide record packages
- partially evidence-backed at the live-system level
- still carrying a short list of deployment and physical-device confirmations

That is a credible current-state story without overstating certainty.

## Related Docs

- Completion split: [PROJECT_COMPLETION_REVIEW.md](PROJECT_COMPLETION_REVIEW.md)
- Next priorities: [next-10-tasks.md](next-10-tasks.md)
- Security model: [../security/SECURITY_MODEL.md](../security/SECURITY_MODEL.md)
- Gated features: [../security/GATED_FEATURES.md](../security/GATED_FEATURES.md)
