# CoParrent Prioritized Remaining Checklist

_Last updated: 2026-04-02_

This is the shortest honest list still left after the current production frontend deploy, the targeted shared-games database rollout through rematch flow, and the latest local green verification run.

## 1. Promote The New Async Challenge / Pricing Bundle Safely

Status: **Open**

- The repo is now ahead of the last confirmed deployed database bundle again.
- Async family challenges and the updated authenticated pricing-entry path are repo-complete and locally verified.
- Apply the new challenge migration in staging, verify there, then promote to production before treating either change as live.

Why this stays first:
It closes the gap between the current repo head and the last confirmed deployed state.

## 2. Keep The Staging Multiplayer Proof Path Healthy

Status: **Open**

- The staging project is at the last deployed shared-game schema head.
- The dedicated same-family fixture is seeded there.
- `npm run seed:family-games:staging` and `npm run verify:family-games` are still the canonical synchronized-race proof path.
- Expand that proof path to include async challenges once the new migration is promoted.

Why this stays near the top:
It is still the fastest way to catch shared-game regressions before production.

## 3. Validate Shared Games On Real Mobile Devices

Status: **Waiting on device access**

- Verify the latest mobile safe-area/layout adjustments on iPhone and Android.
- Confirm the Game Dashboard no longer clips at the right edge.
- Confirm fullscreen/orientation controls behave sensibly for Toy Plane Dash.
- Confirm the challenge board also reads cleanly on narrow screens.

## 4. Validate Push Notifications And PWA Behavior On Real Devices

Status: **Waiting on user / device access**

- Validate desktop browser registration and delivery.
- Validate Android install flow and push delivery.
- Validate iOS add-to-home-screen and push behavior.
- Follow `docs/project/PUSH_PWA_DEVICE_VALIDATION_CHECKLIST.md` and save evidence.

## 5. Run The First Real Production Same-Family Multiplayer And Challenge Proof

Status: **User-assisted after rollout**

- Use two real accounts in the same production family.
- Validate synchronized race flow and the first async challenge flow in the real deployed environment.

## 6. Confirm Deployed Auth Posture

Status: **User-assisted**

- Reconfirm captcha behavior in the deployed environment.
- Reconfirm localhost-origin posture and keep docs aligned to the real rule set.
- Follow `docs/project/DEPLOYMENT_AUTH_CONFIRMATION_CHECKLIST.md`.

## 7. Confirm Canonical Host Posture

Status: **Mixed**

- `https://coparrent.com` is now the live aliased production host.
- Reconfirm redirects, TLS, and consistency from multiple networks before calling host posture fully closed.

## 8. Decide The Final Passkey Posture

Status: **User-assisted**

- Decide whether passkeys remain hidden, partial, or a tracked blocker.
- Keep launch messaging aligned with actual deployed support.

## Already Closed

These are no longer part of the highest-priority remaining list:

- production shared-games and family-presence RPC rollout for the current frontend
- staging schema replay for the current shared-game bundle
- the first same-family multiplayer verification pass in staging
- the repo-side async family challenge foundation on the generic `game_slug` platform
- the repo-side authenticated dashboard subscription-banner pricing-path fix
- default-deny route access and nav consistency for the current dashboard/game surfaces
- family-scoped game dashboard, shared lobby, synchronized Toy Plane Dash result model, and rematch loop
- graceful frontend fallback when partial environments are missing game or presence RPCs
- local lint, build, and full test-suite health
- current docs refresh for status, completion, security posture, and game-system status
