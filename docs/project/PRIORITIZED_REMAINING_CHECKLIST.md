# CoParrent Prioritized Remaining Checklist

_Last updated: 2026-03-30_

This is the shortest honest list still left for launch readiness after the completed family-scope/runtime Tickets 1 through 5.

## 1. Validate push notifications and PWA behavior on real devices

Status: **Waiting on user / device access**

- Validate desktop browser registration and delivery
- Validate Android install flow and push delivery
- Validate iOS add-to-home-screen and push behavior
- Follow `docs/project/PUSH_PWA_DEVICE_VALIDATION_CHECKLIST.md` and save the finished screenshots plus matching verifier artifacts once the physical-device pass is complete

Why this stays first:
The backend plumbing now exists and the repo is verified locally. The remaining gap is real device proof.

## 2. Confirm the canonical public host

Status: **Mixed**

- `https://www.coparrent.com` is the honest public URL today
- Reconfirm the apex `https://coparrent.com` host from multiple networks until TLS and redirects are fully settled
- Keep `www` canonical until the apex behaves cleanly everywhere
- Follow `docs/project/DEPLOYMENT_AUTH_CONFIRMATION_CHECKLIST.md` and save `curl` output plus browser evidence before closing this blocker

## 3. Confirm deployed auth posture

Status: **User-assisted**

- Keep hCaptcha configured in the deployed auth environment
- Confirm the tightened localhost-origin defaults are the intended permanent production posture
- Record the final production rule set once that decision is made
- Follow `docs/project/DEPLOYMENT_AUTH_CONFIRMATION_CHECKLIST.md` and keep the blocker open until captcha, localhost-origin posture, and evidence are all confirmed

## 4. Decide the passkey posture

Status: **User-assisted**

- Hosted Supabase for this project still does not expose WebAuthn/passkey enrollment
- Decide whether passkeys stay hidden from launch messaging or whether launch waits on that support
- Record the final decision through `docs/project/DEPLOYMENT_AUTH_CONFIRMATION_CHECKLIST.md`

## Already closed

These are no longer part of the remaining launch-readiness list:

- legacy messaging removal and runtime `co_parent_id` removal
- default-deny route access and route/nav consistency
- Gift Lists and Creations family-scope migration
- Chore Chart removal from the live app until a real backend version exists
- stale duplicate env cleanup: `_(2).env` removed from the active workflow, `.env.example` remains the repo template, and local `scripts/verify-*.ts` helpers are documented as QA-only tooling
- production smoke verification on `https://www.coparrent.com`
- Stripe, invite acceptance, and AI runtime live verification
- local lint, build, and test pipeline health
