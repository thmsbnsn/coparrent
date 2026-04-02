# CoParrent Prioritized Remaining Checklist

_Last updated: 2026-04-02_

This is the shortest honest list still left after the current production frontend deploy, the targeted shared-games database rollout, and the latest local green verification run.

## 1. Keep The Staging Multiplayer Proof Path Healthy

Status: **Open**

- The staging project is now at schema head.
- The dedicated same-family fixture is now seeded there.
- `npm run seed:family-games:staging` and `npm run verify:family-games` are the canonical multiplayer proof path.
- Treat regressions in that path as priority issues whenever game/session schema changes land.

Why this stays first:
It is the fastest way to catch shared-game regressions before production.

## 2. Validate Shared Games On Real Mobile Devices

Status: **Waiting on device access**

- Verify the latest mobile safe-area/layout adjustments on iPhone and Android.
- Confirm the Game Dashboard no longer clips at the right edge.
- Confirm fullscreen/orientation controls behave sensibly for Toy Plane Dash.

## 3. Reproduce And Fix The Authenticated Pricing Banner Error If Still Present

Status: **Open**

- The public `/pricing` route currently loads normally in a live anonymous check.
- The reported `See Plans` flow from the dashboard still needs a focused authenticated repro if it remains visible to users.
- Do not mark this closed until the exact failing path is identified or disproven.

## 4. Validate Push Notifications And PWA Behavior On Real Devices

Status: **Waiting on user / device access**

- Validate desktop browser registration and delivery.
- Validate Android install flow and push delivery.
- Validate iOS add-to-home-screen and push behavior.
- Follow `docs/project/PUSH_PWA_DEVICE_VALIDATION_CHECKLIST.md` and save evidence.

## 5. Confirm Deployed Auth Posture

Status: **User-assisted**

- Reconfirm captcha behavior in the deployed environment.
- Reconfirm localhost-origin posture and keep docs aligned to the real rule set.
- Follow `docs/project/DEPLOYMENT_AUTH_CONFIRMATION_CHECKLIST.md`.

## 6. Confirm Canonical Host Posture

Status: **Mixed**

- `https://coparrent.com` is now the live aliased production host.
- Reconfirm redirects, TLS, and consistency from multiple networks before calling host posture fully closed.

## 7. Decide The Final Passkey Posture

Status: **User-assisted**

- Decide whether passkeys remain hidden, partial, or a tracked blocker.
- Keep launch messaging aligned with actual deployed support.

## Already Closed

These are no longer part of the highest-priority remaining list:

- production shared-games and family-presence RPC rollout for the current frontend
- staging schema replay for the current shared-game bundle
- the first same-family multiplayer verification pass in staging
- default-deny route access and nav consistency for the current dashboard/game surfaces
- family-scoped game dashboard, shared lobby, synchronized Toy Plane Dash result model, and rematch loop
- graceful frontend fallback when partial environments are missing game or presence RPCs
- local lint, build, and full test-suite health
- current docs refresh for status, completion, security posture, and game-system status
