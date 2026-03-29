# CoParrent Prioritized Remaining Checklist

_Last updated: 2026-03-28_

This is the shortest honest list of what is left.

It is ranked for practical value, not for how satisfying it sounds to check boxes.

## 1. Launch-Critical Public Access And Auth Posture

### 1.1 Confirm the canonical public host after the DNS and production cutover

Status: **Mixed**

- `https://www.coparrent.com` is now healthy on the March 27 production redeploy and is the real public app again
- `coparrent.com` DNS is fixed and Vercel now marks the apex valid
- Reconfirm from multiple networks that the apex host finishes certificate and redirect propagation cleanly
- Keep `https://www.coparrent.com` as the canonical public URL until the apex behaves cleanly everywhere

Why this is first:
This is the public front door. Marketing before the final domain behavior is stable is avoidable self-inflicted damage.

### 1.2 Decide the passkey posture

Status: **User-assisted**

- Google sign-in is fixed on production `www`
- Password-reset requests now succeed on production `www`
- Hosted Supabase MFA still exposes TOTP and SMS only for this project
- Decide whether passkeys stay hidden/disabled in launch messaging or whether you wait for WebAuthn support before advertising them

### 1.3 Branded Google-auth domain after Supabase upgrade

Status: **Pinned / later**

- Google sign-in now works on production `www`
- The remaining branding issue is the chooser text showing the raw Supabase project domain
- The current Supabase org is still on `Free`, and Supabase custom domains / vanity subdomains require a paid organization
- Circle back after the upgrade using `docs/project/BRANDED_GOOGLE_AUTH_SETUP.md`

Why this is pinned instead of urgent:
This is a trust and polish improvement, not a current auth outage.

## 2. Buyer Demo And Launch Confidence

### 2.1 Push and PWA device validation

Status: **Waiting on user / device access**

- Validate push registration and delivery on desktop
- Validate Android PWA install and push delivery
- Validate iOS PWA install and push behavior
- Capture screenshots and add the finished evidence entry

Why this is second:
This is the last meaningful live-verification item that still needs physical-device proof.

## 3. Deployment Alignment

### 3.1 Production/frontend alignment

Status: **Largely complete**

- The Vercel project is now connected to `thmsbnsn/coparrent`
- The March 27 production redeploy now serves the current pushed `main` on `https://www.coparrent.com`
- The preview target remains useful for staging and smoke checks, but production `www` is no longer behind it
- Recheck the evidence log against the environment a buyer or new public user will actually see

Current state:
The March 27 production redeploy now serves the current pushed `main` on `https://www.coparrent.com`, and the March 27 preview smoke rerun still passes cleanly on `https://coparrent-lp7hjcv30-thomas-projects-6401cf21.vercel.app` as an optional staging target.

### 3.2 Problem-report production rollout

Status: **Complete**

- The `submit-problem-report` edge function is deployed
- The production Supabase project now has the live `problem_reports` table, user-view RLS policy, and private `problem-report-screenshots` bucket
- A real report was submitted successfully from `https://www.coparrent.com/help/contact` and verified in production on March 28, 2026

### 3.3 Clean environment hygiene

Status: **Mixed**

- Confirm which local env files are still authoritative
- Archive or remove stale references like `_(2).env`
- Keep local-only verification helpers separate from production runtime config

Why this is third:
The repo is stronger than the live frontend right now. That is manageable, but it weakens demos and diligence if left alone.

## 4. Launch Policy Cleanup

### 4.1 Close temporary QA exceptions

Status: **User-assisted**

- Decide final auth captcha posture
- Confirm the new tightened localhost-origin defaults should remain the permanent production posture
- Record the final production rule set in docs

Why this is fourth:
These are not abstract cleanup items. They affect whether the deployed environment is believable and stable.

## 5. Buyer Package Assets

### 5.1 Produce demo visuals

Status: **Mixed**

- Capture a deliberate screenshot set from the strongest public and in-app pages
- Record the short walkthrough video
- Keep the visuals consistent with the actual demo target

### 5.2 Seed or preserve a clean demo family

Status: **Mixed**

- Keep a stable family with realistic children, schedules, expenses, and messages
- Make sure it survives buyer demos without last-minute cleanup

Why this is fifth:
The docs are getting strong. The package still needs the visual/demo layer.

## 6. Ownership And Transfer Proof

### 6.1 Back the current memos with proof

Status: **User-assisted**

- Seller legal name and operating details
- Confirmation of sale authority
- Contributor/contractor disclosure
- Domain registrar and mailbox control proof
- Provider-account ownership proof

Why this is sixth:
This is what turns a smart package into something counsel can actually review.

## 7. Transition Package

### 7.1 Finish buyer-handoff materials

Status: **Codex-doable / partially done**

- Handoff checklist
- Account transfer plan
- First 30-day buyer plan
- Architecture walkthrough agenda

Why this matters:
Buyers pay more when transfer looks manageable.

## 8. Optional But Helpful

### 8.1 Thin preview smoke coverage

Status: **Complete for preview confidence**

- `scripts/verify-preview-smoke.ts` now exists and the March 27 rerun covered home, login, invite landing, dashboard reachability, and Messaging Hub load against the chosen demo target
- The latest saved run completed with zero unexpected diagnostics on the current preview deployment

### 8.2 Lightweight observability

Status: **Mixed**

- Decide whether to turn on Sentry before the next production push
- Add enough monitoring to catch real live regressions quickly

These help, but they are not the top blockers now.

## What Is Already Closed

These are not still on the list:

- Messaging Hub live backend verification
- Co-parent and third-party invite acceptance verification
- Stripe checkout, webhook, gating, and customer portal verification
- OpenRouter runtime verification for Nurse Nancy, Activity Generator, and Coloring Page Creator
- shake-based problem reporting frontend and edge-function implementation
- production `problem_reports` rollout and live public submission verification
- local lint, test, and build baseline
- public-site and mobile dashboard improvement pass
- core buyer package structure

## Bottom Line

What is left is not "build the product."

What is left is:

- apex-host confirmation and passkey posture
- real-device proof
- transfer proof
- demo packaging

That is a much better final-mile list than a product-construction list.
