# CoParrent Current Status

_Last updated: 2026-03-19_

This document is the current operational snapshot for the repo and live services.

## Repo Status

- This workspace is still the active project copy.
- `npm run build` passes locally as of March 19, 2026.
- `npm run lint` now passes locally as of March 19, 2026 with zero warnings.
- `npm run test` now passes locally as of March 19, 2026 with 44 targeted regression tests.
- `npm run verify` now passes locally as of March 19, 2026 and runs lint, tests, then build.
- Route-level lazy loading and manual vendor chunking are now in place. The largest verified chunks from the current build are:
  - `dist/assets/pdf-vendor-DrmE4z1P.js`
  - `dist/assets/charts-vendor-C55vV6P7.js`
  - `dist/assets/ui-vendor-Bs7yaBRw.js`
- Generated directories (`dist`, `dev-dist`, `output`, `tmp`, `supabase/.temp`) are excluded from lint so lint focuses on maintained source code.
- React Fast Refresh companion exports are now explicitly allowlisted in ESLint for a small set of intentional UI/context helper exports instead of being left as recurring warnings.
- Stale runtime references to `coparrent.lovable.app` were removed from notification/reminder flows, environment detection, and Nurse Nancy export output.
- Route-access rules are now centralized in `src/lib/routeAccess.ts`, and the prior third-party `"/dashboard"` prefix leak has been closed.
- Sports reminder calculations and responsibility assignment now run through shared pure helpers, including a midnight-safe leave-by calculation path.
- The regression suite now includes `ProtectedRoute` integration coverage for loading, auth redirects, parent-only enforcement, third-party redirects, and child-account redirects.
- The regression suite now also includes `AcceptInvite` component coverage for invalid and expired tokens, unauthenticated pending-token redirects, co-parent acceptance, third-party acceptance, and third-party email-mismatch handling.
- The regression suite now also includes shared auth-redirect coverage for `Login` and `Signup`, including pending invite handoff, family bootstrap invocation, and dashboard versus onboarding routing after authentication.
- Current lint warning count: 0
- The local repo is still ahead of the live Vercel frontend and should be previewed before any production deploy.

## Completion Review

- A project-completion review with the exact Codex-only vs user-assisted split now lives in `docs/PROJECT_COMPLETION_REVIEW.md`.

## Live Systems

- Vercel production frontend is live.
- Production Supabase project is `jnxtskcpwzuxyxjzqrkv`.
- `supabase/config.toml` points at that project.
- `_(2).env` still looks like stale reference material and should not be treated as the source of truth.

## Billing Status

- Stripe is in live mode.
- Current live product:
  - `CoParrent Power`
  - product ID `prod_TwwA5VNxPgt62D`
  - recurring price ID `price_1Sz2IZHpttmwwVs1H4deOgQe`
- Repo billing code matches those live IDs.
- Full checkout, webhook, and customer-portal verification is still pending.

## Access Code Status

- The access-code backend has been recovered into the repo.
- The in-app redemption UI exists in Settings.
- Production redemption was previously verified end to end with:
  - `coparrenttesting@yahoo.com`
  - `testingcoparrent@yahoo.com`
- The redemption path correctly upgrades users to complimentary Power and blocks duplicate redemption.

## Family Membership Status

- Parent and guardian accounts now bootstrap a family membership before family-scoped gates run.
- New co-parent invitations are created with the inviter's `family_id`.
- Local regression coverage now exercises invite-status classification, pending invite token handling, and family bootstrap RPC result handling.
- This was verified on March 13, 2026 by:
  - confirming the parent tester gained an active family membership
  - confirming Nurse Nancy stopped failing on `Parent Access Only`
  - confirming a new co-parent invitation row was created with the same `family_id` as the inviter
- Fresh live invite-acceptance verification is still pending for:
  - co-parent acceptance with a clean account and real inbox
  - third-party acceptance with a clean account and real inbox

## AI Status

- OpenRouter-backed functions:
  - `ai-message-assist`
  - `ai-schedule-suggest`
- Lovable-backed functions:
  - `nurse-nancy-chat`
  - `kid-activity-generator`
  - `generate-coloring-page`
- `OPENROUTER_API_KEY` is present in production Edge Function secrets.
- `LOVABLE_API_KEY` was not present in production Edge Function secrets when checked on March 13, 2026.
- Result:
  - OpenRouter-backed AI is configured
  - Lovable-backed AI should still be treated as high-risk or unverified until the secret is restored or the implementation changes

### Current Model Mapping

Based on the current repo code:

- `ai-message-assist` -> `google/gemini-2.0-flash-exp:free`
- `ai-schedule-suggest` -> `google/gemini-2.0-flash-exp:free`
- `nurse-nancy-chat` -> `google/gemini-3-flash-preview`
- `kid-activity-generator` -> `google/gemini-3-flash-preview`
- `generate-coloring-page` -> `google/gemini-2.5-flash-image-preview`

## Temporary QA Exceptions

- Supabase auth captcha is currently disabled for controlled manual QA.
- `ALLOW_LOCALHOST_ORIGINS=true` is enabled in production Edge Function secrets to support local verification.

These are still temporary settings and should be reviewed before promoting new production changes.

## Highest-Priority Next Steps

1. Verify co-parent and third-party invite acceptance end to end.
2. Restore or replace `LOVABLE_API_KEY`, then test all AI tools.
3. Run a real live Stripe checkout and webhook verification.
4. Validate push notifications and PWA behavior on real devices.
5. Continue broadening component and smoke coverage around family switching, premium gating, and cross-route post-login access.
