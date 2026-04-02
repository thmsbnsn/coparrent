# CoParrent Next 10 Tasks

Last updated: 2026-04-02

Ranked by highest product and operational value after the current production deploy, the targeted shared-games database rollout, the staging verifier repair, and the latest Toy Plane Dash post-race/shared-platform polish.

## 1. Run The First Real Production Same-Family Multiplayer Proof

Owner: User-assisted

- Use two real accounts in the same production family.
- Verify:
  - open/create lobby
  - join from second account
  - ready both players
  - synchronized start
  - shared seed
  - result reporting
  - winner resolution
  - rematch reset

Why this is first:
The platform is now live and staging-verified. The highest-value remaining proof is one real production same-family run.

## 2. Recheck Shared Games On Real Mobile Devices

Owner: User-assisted

- Verify Game Dashboard layout on iPhone and Android after the recent safe-area and overflow fixes.
- Confirm fullscreen/orientation controls behave well for Toy Plane Dash on supported devices.
- Check the new post-race results flow on real small screens instead of relying only on desktop emulation.

## 3. Investigate The Authenticated Pricing / Trial Banner Path

Owner: Mixed

- The public `/pricing` page itself currently loads normally.
- The reported dashboard `See Plans` / trial-ending flow still needs a focused authenticated repro so the exact failing path can be identified and fixed if it is still happening.

## 4. Complete Real-Device Push/PWA Validation

Owner: User-assisted

- Test install and push behavior on iOS, Android, and desktop.
- Verify child-mode and main-app install posture on real devices.
- Save dated evidence instead of relying on repo-only assumptions.

## 5. Build Async Family Challenges On The Shared Session Foundation

Owner: Mixed

- Keep this on the generic `game_slug` platform instead of adding a Toy Plane Dash-only side system.
- Start with:
  - challenge creation
  - challenge acceptance
  - family-scoped standings
  - simple lifecycle/status handling

## 6. Ship A Second Real Shared Game Consumer

Owner: Mixed

- Use the current registry and shared session foundation instead of rebuilding session state.
- `Family Raceway` is the most natural next consumer if the team wants another multiplayer-first game.

## 7. Refine Child-Safe Multiplayer And Game Restrictions

Owner: Mixed

- Broaden the current child-safe posture from the first game into the platform layer.
- Keep family scope explicit and server-backed for:
  - games enabled / disabled
  - multiplayer enabled / disabled
  - per-game allowlists
  - future challenge eligibility

## 8. Finish The Toy Plane Dash Results Reveal Polish

Owner: Mixed

- The post-race experience is much stronger now, but the animation/reveal layer can still be cleaner.
- Continue with:
  - richer podium entrance
  - stronger leaderboard motion hierarchy
  - tasteful shared-family celebration without clutter

## 9. Confirm Final Deployed Auth / Host / Passkey Posture

Owner: Mixed

- Reconfirm hCaptcha and the final localhost-origin posture in the deployed environment.
- Confirm the canonical host/public deployment posture.
- Decide whether passkeys remain hidden, remain partial, or become a tracked launch blocker.

## 10. Keep The Shared-Game Proof Path Defensible

Owner: Mixed

- Re-run:
  - `npm run seed:family-games:staging`
  - `npm run verify:family-games`
  after meaningful shared-game changes.
- Preserve clean replay behavior in the repaired migration chain instead of reintroducing environment drift.
- Refresh live evidence after production-facing game/platform deploys.
