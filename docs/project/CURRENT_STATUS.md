# CoParrent Current Status

Last updated: 2026-03-31

This document is the current project snapshot. It prefers repo-confirmed statements and separates those from historical external verification evidence.

## Repo-Confirmed Now

As of this review:

- The current mainline codebase has been reviewed locally on 2026-03-31.
- `npm run lint` passes locally.
- `npm run build` passes locally.
- `npm run test -- --run` passes locally with 58 test files and 229 tests.

Current repo capabilities include:

- public marketing, pricing, help, blog, court-record overview, and legal pages
- auth, onboarding, family selection, and invite acceptance
- family-scoped dashboard, calendar, children, documents, expenses, sports, gifts, journal, and notifications
- Messaging Hub with direct/group/family threads, AI drafting support, and message-thread export receipts
- Daily-backed calling flows in dashboard and messaging contexts, with persisted call-session and call-event state
- admin dashboard, law-library management, problem reporting, and PWA diagnostics

Current repo hardening also includes:

- explicit family-scope enforcement through `activeFamilyId` and server-side `family_id`
- server-side subscription resolution and Stripe lifecycle handling
- server-generated Messaging Hub evidence packages and PDF artifacts
- verification helpers for preview smoke, Stripe, Daily calling, AI runtime, invites, and push/PWA flows

Important implementation boundaries:

- Messaging Hub export integrity is the strongest recorded-communication path in the repo today. It uses a server-built canonical timeline, server-signed receipts, and server-generated PDF artifact hashing.
- Call activity is persisted and can appear in Messaging Hub evidence exports as system events, but the repo does not include call recording, transcripts, or a standalone immutable call-history export.
- The older documents-page "Court Export" flow is still a client-generated PDF bundle assembled from current stored records. It is useful, but it does not yet have the same signed-receipt or artifact-verification model as Messaging Hub exports.

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
- Whether the documents-page court export should be rebuilt onto the Messaging Hub integrity model instead of remaining a client-generated PDF flow.
- Whether call evidence should remain timeline/status based or expand into a dedicated export/reporting surface.

## Current Recommendation

The project should be described today as:

- locally verified
- strongly documented
- partially evidence-backed at the live-system level
- still carrying a short list of deployment and physical-device confirmations

That is a credible current-state story without overstating certainty.

## Related Docs

- Completion split: [PROJECT_COMPLETION_REVIEW.md](PROJECT_COMPLETION_REVIEW.md)
- Next priorities: [next-10-tasks.md](next-10-tasks.md)
- Security model: [../security/SECURITY_MODEL.md](../security/SECURITY_MODEL.md)
- Gated features: [../security/GATED_FEATURES.md](../security/GATED_FEATURES.md)
