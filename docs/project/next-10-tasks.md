# CoParrent Next 10 Tasks

Ranked by immediate value after the March 28, 2026 production `problem_reports` rollout and screenshot-upload verification. The remaining risk profile is now mostly apex-host confirmation, real-device validation, passkey posture, and launch policy cleanup.

## 1. Confirm the canonical public host after the DNS and production cutover

Owner: Mixed

- `https://www.coparrent.com` is now healthy on the March 27 production redeploy
- `coparrent.com` DNS is now corrected and Vercel marks the apex valid
- Reconfirm from multiple networks that the apex host stops showing intermittent TLS/certificate issues
- Keep `https://www.coparrent.com` as the canonical public URL until the apex behaves cleanly everywhere

## 2. Validate push notifications and PWA behavior on real devices

Owner: User-assisted

- Verify subscription registration works
- Verify iOS PWA install flow
- Verify Android and desktop push delivery
- Verify admin push tester works against current config
- Confirm payload privacy rules hold on-device

## 3. Decide the passkey posture

Owner: Mixed

- Hosted Supabase MFA still exposes TOTP and SMS only for this project
- Decide whether passkeys stay hidden/disabled in launch messaging
- If passkeys matter before launch, treat hosted WebAuthn availability as a separate blocker instead of implying it already exists

## 4. Confirm temporary QA exception posture

Owner: User-assisted

- Keep deployed auth captcha configured unless there is an explicit written decision to change the launch posture
- Confirm the new tightened localhost-origin defaults should remain permanent
- Confirm no preview or test flows still depend on an explicit localhost override
- Document the final rollback or retention decision

## 5. Keep the preview smoke pass as a regression check for the buyer/demo target

Owner: Mixed

- `scripts/verify-preview-smoke.ts` now exists and the March 27 rerun passed on the current preview with zero unexpected diagnostics
- Keep using it after meaningful preview deployments so staging confidence stays tied to the actual deployed target
- Keep the scope to smoke coverage, not full end-to-end billing/device verification

## 6. Document the clean deploy and verification split

Owner: Mixed

- Keep `.env.example` as the repo template for local and deployed env variables
- Keep local `.env` files and `scripts/verify-*.ts` helpers documented as QA-only inputs, not runtime dependencies
- Document the clean `supabase functions deploy` path
- Keep local-only and production env expectations separate

## 7. Add lightweight production observability

Owner: Mixed

- Decide whether to wire Sentry or a comparable error tracker before the next production push
- Add enough frontend and edge-function error capture to catch live regressions quickly
- Track Messaging Hub setup failures explicitly if the issue persists after deployment
- Keep the scope narrow and operational, not a long observability project

## 8. Prepare a stable buyer demo target

Owner: Mixed

- Seed or preserve a clean demo family with realistic schedules, messages, expenses, and child records
- Make sure the strongest public pages match the current in-app quality
- Keep the demo environment free of QA-only banners, broken icons, and placeholder content
- Use the existing buyer-package docs as the script and leave the product in a state a buyer can open without hand-holding on either production `www` or the dedicated preview target

## 9. Produce buyer demo assets from the verified flows

Owner: Mixed

- Capture a clean screenshot set from the strongest public pages plus the verified dashboard flows
- Record a short walkthrough that uses the March 23 invite-verification evidence plus the March 24 billing and AI-runtime evidence instead of hand-waving over live behavior
- Keep the buyer package aligned with the evidence log so the demo story does not outrun what is actually verified

## 10. Run one final pre-marketing production smoke pass

Owner: Mixed

- A late March 28 production smoke pass already completed cleanly across home, login, invite landing, dashboard, and Messaging Hub on `https://www.coparrent.com`
- Re-run the same pass immediately before outreach if additional live changes land
- Use the current public domain and production backend, not the preview target

## Pinned For Later

- Branded Google-auth domain rollout is intentionally deferred until the Supabase org is upgraded from `Free`. The current Google flow is functional, and the circle-back checklist already exists in `docs/project/BRANDED_GOOGLE_AUTH_SETUP.md`.
