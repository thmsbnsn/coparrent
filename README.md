# CoParrent

CoParrent is a Vite/React + Supabase web application for co-parenting operations. The current product surface includes scheduling, family messaging, documents, expenses, child records, Kids Hub tools, notifications, and related family workflows.

## Current Repo Status

Last reviewed: 2026-04-02

This README is intentionally limited to repo-confirmed statements plus clearly labeled historical evidence.

- The current mainline codebase has been reviewed locally on 2026-04-02.
- `npm run lint` passes locally.
- `npm run build` passes locally.
- `npm run test -- --run` passes locally with 101 test files and 388 tests.
- The repo includes verification helpers for preview smoke, Stripe, invites, Daily calling, shared family game flow, AI runtime, Messaging Hub, and push/PWA checks.
- The production frontend was redeployed on 2026-04-02 and aliased to `https://coparrent.com`.
- The production shared-game and family-presence database bundle was applied on 2026-04-02, so the new family game RPCs now exist in production.
- Local development can now target the staging Supabase project explicitly through `VITE_SUPABASE_TARGET=staging` plus the staging Vite env vars in [.env.example](.env.example).
- The staging Supabase project was advanced to the last deployed shared-game schema on 2026-04-02 after repairing the migration chain and adding the missing explicit-family baseline bridge migration.
- The local repo now includes an additional async family challenge migration and client surface that still need promotion to staging and production before those challenge features can be described as live.
- Historical live verification artifacts from March 2026 exist in [docs/acquisition/diligence/LIVE_VERIFICATION_EVIDENCE_LOG.md](docs/acquisition/diligence/LIVE_VERIFICATION_EVIDENCE_LOG.md).
- Those external checks were not rerun as part of this documentation cleanup. Treat them as evidence on file, not as a fresh guarantee.

## What The Product Currently Covers

- Public site: marketing pages, pricing, help center, blog, court-record overview, and legal pages.
- Auth and onboarding: email/password auth, Google OAuth, invite acceptance, onboarding, and family selection.
- Family operations: dashboard, calendar, children, documents, expenses, sports, gift lists, journal, notifications, and child-oriented views.
- Shared family games: Game Dashboard, family presence/activity UI, generic game-session/lobby model, async family challenge foundation, and Toy Plane Dash as the first playable game.
- Messaging and calling: Messaging Hub, family/direct/group threads, message drafting aids, and Daily-backed calling flows with persisted session/event state.
- Export and evidence flows: server-generated Messaging Hub evidence packages, server-generated family-wide court-record exports, verification-backed PDF and evidence-package downloads, and expense report generation.
- Support and admin: admin dashboard, law-library management, problem reporting, and PWA diagnostics.

The current route map is defined in [src/App.tsx](src/App.tsx).

## Architecture Invariants

These rules should be treated as non-negotiable:

- Family-scoped operations use `activeFamilyId` on the client and explicit `family_id` on the server.
- Missing or ambiguous family scope must fail closed.
- Client state is advisory only. Authorization, plan state, and role checks are enforced server-side.
- Shared family records are family-scoped. Private generated content remains owner-scoped until explicitly shared.
- Cross-family inference from legacy relationship fields is not part of the intended architecture.

See:

- [docs/security/SECURITY_MODEL.md](docs/security/SECURITY_MODEL.md)
- [docs/security/GATED_FEATURES.md](docs/security/GATED_FEATURES.md)

## Plans And Feature Access

The current plan definition in [src/lib/planLimits.ts](src/lib/planLimits.ts) is:

| Plan | Limits | Notable Feature Flags |
| --- | --- | --- |
| Free | 4 children, 4 third-party accounts, 2 parent accounts | No expenses, court-export entitlement, sports-hub entitlement, or AI-assist entitlement |
| Power | 6 children, 6 third-party accounts, 2 parent accounts | Expenses, court-export entitlement, sports hub, AI assist, full message history |

Subscription state is resolved server-side, including trial handling, past-due grace handling, and Stripe customer linking.

## Known Open Items

These are still open or require user-assisted confirmation:

- Real-device push/PWA validation on iOS, Android, and desktop.
- Final deployed auth posture confirmation, especially captcha and localhost-origin behavior.
- Final canonical-host posture confirmation for public deployment.
- Final passkey posture. The repo contains passkey-related UI, but deployment support and launch messaging still need a clear decision.
- Fresh deployed verification of the Object Lock-backed export path after any meaningful release.
- Deciding whether legacy pre-Object-Lock export artifacts remain read-only legacy records or are migrated into the newer storage posture.
- Deciding whether call evidence remains timeline/status based or grows into a dedicated media export surface. The current repo does not include call recording or transcripts.
- Keeping the repaired Supabase migration chain healthy as new schema work lands.
- Re-running the staged family-game verifier after meaningful multiplayer/backend changes.
- Promoting and verifying the new async family challenge migration and UI flow in staging and production.
- Live verification of the authenticated dashboard subscription-banner pricing path after the explicit pricing-intent routing changes.

See [docs/project/CURRENT_STATUS.md](docs/project/CURRENT_STATUS.md) and [docs/project/next-10-tasks.md](docs/project/next-10-tasks.md).

## Local Development

### Prerequisites

- Node.js 22+
- npm
- Supabase CLI for local function and schema work

### Install

```bash
npm install
```

### Local Run

```bash
npm run dev
```

### Optional Staging Target

To point local browser runtime at the staging Supabase project instead of production:

```bash
VITE_SUPABASE_TARGET=staging
VITE_SUPABASE_STAGING_URL=...
VITE_SUPABASE_STAGING_PUBLISHABLE_KEY=...
```

The verifier script can also point at staging independently through the `VERIFY_FAMILY_GAME_*` or `SUPABASE_STAGING_*` env vars without changing the normal app runtime.

To seed or refresh the dedicated staging family-game fixture before running the verifier:

```bash
npm run seed:family-games:staging
```

### Key Verification Commands

```bash
npm run lint
npm run build
npm run test -- --run
```

Additional repo helpers:

```bash
npm run verify:preview-smoke
npm run verify:stripe
npm run verify:daily-calls
npm run verify:family-games
npm run verify:push-pwa
```

These helper scripts are QA tools. They are not runtime dependencies.

## Documentation Map

- Current repo snapshot: [docs/project/CURRENT_STATUS.md](docs/project/CURRENT_STATUS.md)
- Completion split: [docs/project/PROJECT_COMPLETION_REVIEW.md](docs/project/PROJECT_COMPLETION_REVIEW.md)
- Shared games status: [docs/project/GAME_SYSTEM_STATUS.md](docs/project/GAME_SYSTEM_STATUS.md)
- Next priorities: [docs/project/next-10-tasks.md](docs/project/next-10-tasks.md)
- Security model: [docs/security/SECURITY_MODEL.md](docs/security/SECURITY_MODEL.md)
- Feature gating: [docs/security/GATED_FEATURES.md](docs/security/GATED_FEATURES.md)
- Buyer package index: [docs/acquisition/internal/BUYER_PACKAGE_INDEX.md](docs/acquisition/internal/BUYER_PACKAGE_INDEX.md)
- Diligence evidence log: [docs/acquisition/diligence/LIVE_VERIFICATION_EVIDENCE_LOG.md](docs/acquisition/diligence/LIVE_VERIFICATION_EVIDENCE_LOG.md)

## Documentation Standard

When updating docs:

- Prefer repo-confirmed facts over memory or assumption.
- Date external verification claims and point to the evidence source.
- Do not describe deployment behavior as current unless it is either freshly verified or explicitly cited as historical evidence.
- Keep architecture language aligned with the family-scoped model and current trust boundaries.

## License

This repository is proprietary. See [LICENSE](LICENSE).
