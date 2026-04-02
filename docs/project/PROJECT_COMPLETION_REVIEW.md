# CoParrent Project Completion Review

Last updated: 2026-04-02

This review answers a narrow question: what is complete in the current repo, what is deployed, and what still depends on follow-through outside the codebase?

## Repo-Complete In Current Main

The current repo state already includes:

- family-scoped architecture across core operational flows, with `activeFamilyId` on the client and explicit `family_id` on the server
- route-level access control plus supporting role and child-account gate components
- subscription and Stripe lifecycle hardening, including durable customer linking, past-due grace handling, and webhook idempotency coverage
- unified court-record export integrity work, including server-generated evidence packages, receipt verification, PDF artifact handling, and immutable-artifact metadata for new exports
- Daily-backed calling flows in the main app surface, with persisted call-session and call-event state
- problem-report submission flow and supporting schema/function work
- child portal, child device-access, and child-mode launch/setup foundations
- shared family games frontend and server model:
  - reusable game registry
  - generic family-scoped sessions and lobbies
  - deterministic seeded Toy Plane Dash rounds
  - synchronized `start_time`
  - server-owned result rows and winner resolution
  - host-only rematch reset flow
  - family presence integration for dashboard, lobby, and in-game states
- clean local verification status for lint, build, and the full Vitest suite

Important boundary on the recordkeeping and game story:

- New Messaging Hub exports and new family-wide court-record exports share the same server-side receipt, verification, and immutable-artifact model.
- Call records are included as evidence context through persisted session and event history, but the repo does not include call recording, transcripts, or a standalone call-media archive.
- Family-wide court-record exports include document metadata and access history, not raw document binaries, and journal entries remain intentionally excluded.
- Shared games are not full real-time multiplayer. The current implementation is a synchronized parallel race model for Toy Plane Dash.
- Legacy pre-cutover export artifacts may still exist outside the newer immutable-storage path.

## Deployed Now

Confirmed on 2026-04-02:

- the production frontend was redeployed and aliased to `https://coparrent.com`
- the latest app-shell, branding, game-dashboard, fallback, and UI-polish changes are in production frontend code
- the targeted production database bundle for child portal controls, family presence, shared game lobbies, race sync/results, and rematch flow was applied successfully

## Not Fully Closed Yet

The newer shared games and family presence backend stack is now applied in production, but the environment story is still not fully closed.

Current blocker:

- a clean staging database replay fails at [../../supabase/migrations/20260315205438_expand_audit_logging.sql](../../supabase/migrations/20260315205438_expand_audit_logging.sql)
- that migration creates triggers on `public.calendar_events`, but that table does not exist at that point in a clean apply path
- a later replay step also proves that a fresh project is missing the older `public.families` baseline assumed by later migrations

Practical consequence:

- production now has the newer game/presence RPCs
- local and verifier tooling can target the staging project explicitly
- but a brand-new staging project still cannot be rebuilt cleanly from the repo migrations alone
- the first real two-user multiplayer verification pass still needs a dedicated same-family test setup

## Historically Verified Externally, But Not Rechecked In This Doc Pass

The repo also contains dated evidence for several live-system checks:

- preview and production smoke passes
- invite acceptance
- Stripe checkout and customer portal
- OpenRouter-backed AI flows
- Daily calling
- problem-report submission
- Google auth and password-reset behavior

Source:

- [../acquisition/diligence/LIVE_VERIFICATION_EVIDENCE_LOG.md](../acquisition/diligence/LIVE_VERIFICATION_EVIDENCE_LOG.md)

These should be described as evidence on file, not as freshly reconfirmed behavior.

## Still Requiring User Assistance Or Operational Confirmation

- build a reproducible staging baseline so staging can reach the current shared-game schema without manual bootstrapping
- run the real multiplayer verifier against a dedicated same-family test setup
- real-device push/PWA validation
- final deployed auth posture confirmation
- final canonical-host confirmation
- final passkey posture
- fresh live verification of the deployed Object Lock-backed export path after meaningful releases
- product and implementation decisions on whether legacy pre-cutover export artifacts are migrated or retained as legacy records
- product and implementation decisions on whether synchronized family games stay race-only or expand into broader live multiplayer features

## Current Conclusion

There is no major repo-only blocker for the main family, billing, messaging, export, and frontend game surfaces.

There is, however, a concrete operational blocker around environment reproducibility:

- the database migration chain does not replay cleanly into a brand-new staging project
- that means staging is not yet a trustworthy clean-room proof environment for the newly deployed game backend

So the current risk is staging/bootstrap and verification-oriented, not a missing frontend or session-model implementation inside the repo and not missing production game RPCs.

## Related Docs

- Current snapshot: [CURRENT_STATUS.md](CURRENT_STATUS.md)
- Shared games status: [GAME_SYSTEM_STATUS.md](GAME_SYSTEM_STATUS.md)
- Next priorities: [next-10-tasks.md](next-10-tasks.md)
