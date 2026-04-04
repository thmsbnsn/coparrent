# CoParrent Next 10 Tasks

Last updated: 2026-04-02

Ranked by highest product and operational value after the current production deploy, the targeted shared-games database rollout through rematch flow, the staging verifier repair, and the newly landed async family challenge / authenticated pricing-path repo work.

## 1. Promote The New Repo-Ahead Bundle To Staging, Then Production

Owner: Mixed

- The repo now contains:
  - async family challenges
  - the authenticated dashboard subscription-banner pricing-path fix
- Neither change should be described as fully deployed until:
  - the new challenge migration is applied in staging
  - the challenge flow is verified there
  - the frontend/backend bundle is promoted and rechecked in production

Why this is first:
The repo is ahead of the confirmed deployed state again. Closing that gap is worth more than adding more features on top.

## 2. Run The First Real Production Same-Family Multiplayer And Challenge Proof

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
  - async challenge creation
  - challenge acceptance
  - best-score-only leaderboard updates

## 3. Recheck Shared Games On Real Mobile Devices

Owner: User-assisted

- Verify Game Dashboard layout on iPhone and Android after the recent safe-area and overflow fixes.
- Confirm fullscreen/orientation controls behave well for Toy Plane Dash on supported devices.
- Check the new post-race results flow and the async challenge board on real small screens instead of relying only on desktop emulation.

## 4. Complete Real-Device Push/PWA Validation

Owner: User-assisted

- Test install and push behavior on iOS, Android, and desktop.
- Verify child-mode and main-app install posture on real devices.
- Save dated evidence instead of relying on repo-only assumptions.

## 5. Ship A Second Real Shared Game Consumer

Owner: Mixed

- Use the current registry, session, presence, and challenge foundation instead of rebuilding state for a second time.
- `Family Raceway` is still the most natural next shared game consumer.

## 6. Refine Child-Safe Multiplayer And Challenge Restrictions

Owner: Mixed

- Broaden the current child-safe posture from the first game and first async challenge into the platform layer.
- Keep family scope explicit and server-backed for:
  - games enabled / disabled
  - multiplayer enabled / disabled
  - per-game allowlists
  - future challenge eligibility

## 7. Finish The Toy Plane Dash Results Reveal Polish

Owner: Mixed

- The post-race experience is much stronger now, but the animation/reveal layer can still be cleaner.
- Continue with:
  - richer podium entrance
  - stronger leaderboard motion hierarchy
  - tasteful shared-family celebration without clutter

## 8. Confirm Final Deployed Auth Posture

Owner: Mixed

- Reconfirm hCaptcha and the final localhost-origin posture in the deployed environment.

## 9. Confirm Canonical Host And Final Passkey Posture

Owner: Mixed

- Confirm the canonical host/public deployment posture.
- Decide whether passkeys remain hidden, remain partial, or become a tracked launch blocker.

## 10. Keep The Shared-Game Proof Path Defensible

Owner: Mixed

- Re-run:
  - `npm run seed:family-games:staging`
  - `npm run verify:family-games`
  after meaningful shared-game changes.
- Add async challenge verification coverage into that proof path once the new migration is promoted.
- Preserve clean replay behavior in the repaired migration chain instead of reintroducing environment drift.
- Refresh live evidence after production-facing game/platform deploys.
