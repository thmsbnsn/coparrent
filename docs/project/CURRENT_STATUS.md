# CoParrent Current Status

Last updated: 2026-04-02

This document is the current project snapshot. It separates repo-confirmed facts from live rollout notes so it does not overclaim what is already deployed.

## Repo-Confirmed Now

As of this review:

- The current mainline codebase was reviewed locally on 2026-04-02.
- `npm run lint` passes locally.
- `npm run build` passes locally.
- `npm run test -- --run` passes locally with 101 test files and 388 tests.

Current repo capabilities include:

- public marketing, pricing, help, blog, court-record overview, and legal pages
- auth, onboarding, family selection, invite acceptance, and child-mode launch/setup foundations
- family-scoped dashboard, calendar, children, documents, expenses, sports, gifts, journal, notifications, and kid-center surfaces
- Messaging Hub with direct, group, and family threads, AI drafting support, and message-thread export receipts
- Daily-backed calling flows in dashboard and messaging contexts, with persisted call-session and call-event state
- family-wide court-record exports built server-side from family-scoped records with stored receipt and artifact metadata
- family presence, shared games dashboard, registry-backed game overview routes, reusable game-session/lobby foundation, async family challenge surfaces, and Toy Plane Dash as the first live game consumer
- admin dashboard, law-library management, problem reporting, and PWA diagnostics

Current repo hardening also includes:

- explicit family-scope enforcement through `activeFamilyId` and server-side `family_id`
- server-side subscription resolution and Stripe lifecycle handling
- server-generated Messaging Hub and family-wide court-record evidence packages and PDF artifacts
- immutable export-artifact storage metadata and verification paths for new court-record exports
- family-scoped presence, session, result, and winner paths for shared games that fail closed without explicit scope
- family-scoped async family challenge routes, RPCs, leaderboard state, and result submission paths that fail closed without explicit scope
- verification helpers for preview smoke, Stripe, Daily calling, family games, AI runtime, invites, Messaging Hub, and push/PWA flows

Important implementation boundaries:

- New Messaging Hub exports and new family-wide court-record exports share one server-authoritative export model: explicit `family_id`, server-built canonical payloads, signed receipts, server-generated PDF artifacts, stored hash metadata, and verification paths.
- Call activity is persisted and included honestly as session/event evidence context. The repo does not include call recording, transcripts, or a standalone call-media archive.
- Family-wide court-record exports include document metadata and access history, not raw document binaries. Journal entries remain intentionally excluded.
- Shared games are implemented on a generic `game_slug` foundation. Toy Plane Dash is the first real game, but the session/lobby/result model is not Flappy-only.
- The shared game registry now also drives dedicated overview routes for upcoming titles, so future games no longer exist only as hard-coded dashboard placeholders.
- Async family challenges now sit on that same generic `game_slug` foundation in repo code. They are not a Toy Plane Dash-only side system, even though Toy Plane Dash is the first consumer.
- The shared game frontend now degrades to maintenance messaging and solo preview when required backend RPCs are missing, instead of exposing raw schema-cache errors to users.
- The dashboard subscription banner now routes into `/pricing` with explicit source and intent query params so the authenticated pricing path can render the right context instead of relying on a generic entry.
- The browser client can target staging explicitly through `VITE_SUPABASE_TARGET=staging` and the staging Vite env vars.

## Live Rollout Notes

These are dated operational notes from 2026-04-02, not just repo assumptions:

- The production frontend was redeployed and aliased to `https://coparrent.com`.
- A targeted production database bundle for child portal controls, family presence, shared game lobbies, race sync/results, and rematch flow was applied on 2026-04-02.
- The production database now includes the previously missing shared-game and family-presence RPC layer.
- A direct production RPC probe now returns `Authentication required` for the shared game/presence RPC endpoints instead of the earlier missing-function schema-cache error.
- A separate staging Supabase project exists and local development can target it explicitly.
- On 2026-04-02, the staging project was advanced to the then-current shared-game schema after repairing the tracked migration chain:
  - [../../supabase/migrations/20260324000000_add_explicit_family_scope_baseline.sql](../../supabase/migrations/20260324000000_add_explicit_family_scope_baseline.sql) was added to restore the missing explicit-family baseline.
- several replay defects in March/April 2026 migrations were corrected so a fresh staging replay could reach head.
- A dedicated staging family-game fixture now exists and the multiplayer verifier completes successfully against that staging setup.
- The repo now contains a newer async family challenge migration and frontend flow that were added after that 2026-04-02 staging/production database promotion. Those async challenge pieces are repo-confirmed and locally verified, but they are not part of the already-confirmed live database bundle yet.

That means production and staging both contain the confirmed shared-game session/presence backend bundle through rematch flow, and staging is no longer blocked on the earlier schema-replay gap. The repo has now moved one step ahead again with async family challenges.

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

Those checks were not rerun as part of this documentation pass. Treat them as dated evidence on file, not as a fresh live guarantee.

## Open Items That Are Not Closed By Repo Inspection

- Keep the repaired Supabase migration chain healthy as new database work lands.
- Re-run the real family-game verifier against the dedicated staging family after meaningful multiplayer changes.
- Promote and verify the new async family challenge migration and challenge-board/client flow in staging before calling it live.
- After staging, promote and verify the async family challenge rollout in production.
- Recheck the authenticated dashboard subscription-banner pricing path after the new explicit pricing-entry handling ships.
- Real-device push/PWA validation on iOS, Android, and desktop.
- Final deployed auth posture confirmation, especially captcha and localhost-origin behavior.
- Final canonical-host posture confirmation for public deployment.
- Final passkey posture. Passkey-related UI exists in the repo, but deployment support and product messaging still need a clear decision.
- Fresh end-to-end deployed verification of the Object Lock-backed export path after meaningful releases.
- A policy decision on whether legacy pre-cutover export artifacts remain as legacy records or are migrated.
- Whether shared games remain synchronized parallel races only or expand into deeper live multiplayer later.

## Current Recommendation

The project should be described today as:

- locally verified
- production frontend deployed
- production shared-game and family-presence backend bundle applied
- repo-ahead async family challenge and pricing-path improvements landed locally and verified, but not yet described here as deployed
- strongly documented
- repo-complete for the shared games frontend and server model
- staging-ready with a verified dedicated multiplayer fixture
- still carrying a short list of deployment and physical-device confirmations

That is a credible current-state story without overstating certainty.

## Related Docs

- Completion split: [PROJECT_COMPLETION_REVIEW.md](PROJECT_COMPLETION_REVIEW.md)
- Shared games status: [GAME_SYSTEM_STATUS.md](GAME_SYSTEM_STATUS.md)
- Next priorities: [next-10-tasks.md](next-10-tasks.md)
- Security model: [../security/SECURITY_MODEL.md](../security/SECURITY_MODEL.md)
- Gated features: [../security/GATED_FEATURES.md](../security/GATED_FEATURES.md)
