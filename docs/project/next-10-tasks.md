# CoParrent Next 10 Tasks

Last updated: 2026-04-02

Ranked by highest product and operational value after the current production deploy, the targeted shared-games database rollout, and the latest local green verification baseline.

## 1. Build A Reproducible Staging Baseline

Owner: Mixed

- A brand-new Supabase staging project still does not rebuild cleanly from the tracked migration chain alone.
- The repo now documents the first known replay blocker and the later missing `public.families` baseline issue, but the environment still needs a formal answer:
  - either backfill the missing historical baseline into local migrations
  - or formalize a production-derived bootstrap path for staging

Why this is first:
The production game backend is now deployed, but staging is still the main environment risk.

## 2. Run The First Real Two-User Multiplayer Verification Pass

Owner: User-assisted

- Use one dedicated same-family test setup with two real accounts.
- Run the family game verifier end to end:
  - create/open session
  - join second player
  - ready both
  - start session
  - confirm shared seed
  - confirm synchronized start
  - submit results
  - confirm winner resolution

Why this is second:
The code and targeted production RPC layer are now in place. The missing proof is a real shared-family run.

## 3. Recheck Shared Games On Real Mobile Devices

Owner: User-assisted

- Verify Game Dashboard layout on iPhone and Android after the recent safe-area and overflow fixes.
- Confirm fullscreen/orientation controls behave well for Toy Plane Dash on supported devices.
- Capture a short dated record of what still needs mobile polish.

## 4. Investigate The Authenticated Pricing / Trial Banner Path

Owner: Mixed

- The public `/pricing` page itself currently loads normally.
- The reported dashboard `See Plans` / trial-ending flow still needs a focused authenticated repro so the exact failing path can be identified and fixed if it is still happening.

## 5. Complete Real-Device Push/PWA Validation

Owner: User-assisted

- Test install and push behavior on iOS, Android, and desktop.
- Save dated evidence instead of relying on repo-only assumptions.

## 6. Confirm Deployed Auth And Origin Posture

Owner: User-assisted

- Reconfirm hCaptcha and the final localhost-origin posture in the deployed environment.
- Keep deployment docs tied to actual observed configuration, not just repo defaults.

## 7. Decide The Final Passkey Posture

Owner: Mixed

- Decide whether passkeys remain hidden, remain partial, or become a tracked launch blocker.
- Keep buyer-facing messaging aligned with actual deployed support.

## 8. Refresh Live Evidence After Material Deploys

Owner: Mixed

- Re-run the relevant smoke and workflow verifiers after meaningful production-facing changes.
- Keep the evidence trail current so the status story stays defensible.

## 9. Polish The Toy Plane Dash Post-Race Experience Further

Owner: Mixed

- The results and rematch loop are materially better, but the reveal flow can still be stronger.
- Continue with:
  - richer leaderboard/podium reveal
  - cleaner rematch readiness feedback
  - stronger shared-family celebration without clutter

## 10. Expand The Shared Game Platform Deliberately

Owner: Mixed

- Keep the next game-platform work on the reusable session foundation instead of building one-off systems.
- The most likely next slices are:
  - async family challenges
  - a second real multiplayer-capable game consumer
  - broader game restrictions and child-safe multiplayer posture refinement
