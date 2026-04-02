# CoParrent Prioritized Remaining Checklist

_Last updated: 2026-04-02_

This is the shortest honest list still left after the current production frontend deploy, the targeted shared-games database rollout, and the latest local green verification run.

## 1. Make Staging Reproducible

Status: **Open**

- A brand-new staging Supabase project still does not reach the current schema by replaying the tracked migrations alone.
- The repo now captures the first clean-replay blocker and the later missing baseline-table issue, but staging still needs a durable bootstrap path.
- Do not call staging "ready" until a clean-room rebuild path exists.

Why this stays first:
Production now has the targeted game and family-presence backend bundle. The biggest remaining infrastructure risk is staging/bootstrap integrity.

## 2. Run The First Real Same-Family Multiplayer Verification

Status: **Waiting on user-assisted test setup**

- Use one dedicated family and two real accounts in that same family.
- Run the family-game verification flow from session creation through winner resolution.
- Save the outcome as dated evidence instead of leaving the multiplayer story repo-only.

Why this stays near the top:
The shared-game backend is deployed, but the first real two-user proof still has not been captured.

## 3. Validate Shared Games On Real Mobile Devices

Status: **Waiting on device access**

- Verify the latest mobile safe-area/layout adjustments on iPhone and Android.
- Confirm the Game Dashboard no longer clips at the right edge.
- Confirm fullscreen/orientation controls behave sensibly for Toy Plane Dash.

## 4. Reproduce And Fix The Authenticated Pricing Banner Error If Still Present

Status: **Open**

- The public `/pricing` route currently loads normally in a live anonymous check.
- The reported `See Plans` flow from the dashboard still needs a focused authenticated repro if it remains visible to users.
- Do not mark this closed until the exact failing path is identified or disproven.

## 5. Validate Push Notifications And PWA Behavior On Real Devices

Status: **Waiting on user / device access**

- Validate desktop browser registration and delivery.
- Validate Android install flow and push delivery.
- Validate iOS add-to-home-screen and push behavior.
- Follow `docs/project/PUSH_PWA_DEVICE_VALIDATION_CHECKLIST.md` and save evidence.

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
- default-deny route access and nav consistency for the current dashboard/game surfaces
- family-scoped game dashboard, shared lobby, synchronized Toy Plane Dash result model, and rematch loop
- graceful frontend fallback when partial environments are missing game or presence RPCs
- local lint, build, and full test-suite health
- current docs refresh for status, completion, security posture, and game-system status
