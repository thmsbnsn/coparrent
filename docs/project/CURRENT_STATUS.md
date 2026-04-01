# CoParrent Current Status

_Last updated: 2026-03-31_

This document is the current operational snapshot for the repo and live services.

## Repo Status

- This workspace is still the active project copy.
- `npm run build` passes locally as of March 31, 2026.
- `npm run lint` passes locally as of March 31, 2026 with zero warnings.
- `npm run test -- --run` passes locally as of March 31, 2026 with 58 test files and 229 tests.
- The local verification pipeline is healthy again: lint, build, and the current Vitest suite all pass from the repo root.
- Route-level lazy loading and manual vendor chunking are still in place; the largest bundles remain the PDF, charts, and UI vendor chunks.
- Generated directories (`dist`, `dev-dist`, `output`, `tmp`, `supabase/.temp`) are excluded from lint so lint focuses on maintained source code.
- React Fast Refresh companion exports are now explicitly allowlisted in ESLint for a small set of intentional UI/context helper exports instead of being left as recurring warnings.
- Stale runtime references to `coparrent.lovable.app` were removed from notification/reminder flows, environment detection, and Nurse Nancy export output.
- Route-access rules are now centralized in `src/lib/routeAccess.ts`, and the prior third-party `"/dashboard"` prefix leak has been closed.
- Sports reminder calculations and responsibility assignment now run through shared pure helpers, including a midnight-safe leave-by calculation path.
- The regression suite now includes `ProtectedRoute` integration coverage for loading, auth redirects, parent-only enforcement, third-party redirects, and child-account redirects.
- The regression suite now also includes `AcceptInvite` component coverage for invalid and expired tokens, unauthenticated pending-token redirects, co-parent acceptance, third-party acceptance, and third-party email-mismatch handling.
- The regression suite now also includes shared auth-redirect coverage for `Login` and `Signup`, including pending invite handoff, family bootstrap invocation, and dashboard versus onboarding routing after authentication.
- The regression suite now also includes `FamilyProvider` coverage for persisted active-family restoration, valid family switching, auto-bootstrap behavior, and invite-pending suppression.
- The regression suite now also includes `PremiumFeatureGate` coverage for premium-required denials, expired-trial messaging, custom fallbacks, and hidden locked states.
- The regression suite now also includes `KidsDashboard` smoke coverage for loading, child rendering, signed-out redirects, and parent-account redirects.
- `FamilyContext` no longer wipes the persisted active-family selection before the initial membership load reads it.
- `KidsDashboard` no longer calls `navigate("/login")` during render for signed-out users.
- Public marketing/content pages were upgraded across Home, About, Help, Blog, Blog Post, Court Records, and Payment Success so the public site reads less like a placeholder and more like a sellable product surface.
- The temporary in-app banner has been removed, and missing PWA icon assets were added to fix the manifest warning.
- Mobile dashboard UX was improved across Dashboard, Children, Expenses, Sports Hub, Kids Hub, Kid Center, and Activities, including layout cleanup and the removal of several mobile-only crash paths.
- `useFamilyRole` now returns the active family's real `primaryParentId` instead of leaking the family UUID into features that expect a parent profile ID.
- Completed repo Tickets 1 through 5 are now reflected in the live code: legacy messaging was removed, protected routes now fail closed by default, runtime `co_parent_id` usage was removed from live family flows, Gift Lists and Creations are active-family scoped, and the Chore Chart prototype is intentionally hidden until a real server-backed version exists.
- Core family workflows now use explicit `activeFamilyId` / `family_id` scope instead of legacy relationship inference.
- That family-scope migration now covers invite/bootstrap runtime paths, `aiGuard`, third-party management, schedule persistence, schedule requests, document flow, expenses/report generation, gift lists, creations, dashboard summaries, and reminder jobs.
- `MessagingHubPage` now has a clearer mobile header, better action layout, explicit setup/empty states, and a retry flow that no longer loops endlessly after setup failure.
- Messaging Hub export integrity UX now includes a dedicated Export Receipt surface with receipt ID and PDF hash copy actions, explicit status wording, and human-readable verification results for match, mismatch, authorization, and receipt/artifact availability outcomes.
- Daily calling now has a live-verified implementation: the call tables and RLS are in place, the Daily-backed edge functions and callable-member RPC are deployed, Messaging Hub direct-message audio/video buttons are active, the shared global call manager is mounted through `DashboardLayout`, and the parent/guardian dashboard caller widget can place calls to parent, guardian, and approved third-party recipients in the active family.
- Incoming call alerts are also wired into the deployed server-side call flow: ringing sessions create app notification rows and attempt Web Push delivery to subscribed devices for the callee.
- Daily calling was verified live twice on March 27, 2026 through `scripts/verify-daily-calls.ts` against the production Supabase backend and Daily account. The latest pass confirmed the same dashboard-started audio call and Messaging Hub-started video call flows after deploying the production `get_callable_family_members` RPC, including actor-attributed `call_events`, `call_participants`, and Messaging Hub thread log entries.
- The latest Daily rerun also removed the prior caller-refresh workaround: the page-local and global call hooks now synchronize immediately on call mutations, so both sides reach the active call panel without forcing a dashboard reload.
- Messaging Hub now preserves callable/direct-message members even when the `family_members -> profiles` join is hidden by RLS, falling back to the membership relationship label instead of dropping the thread entirely.
- Current lint warning count: 0
- The dirty local worktree is still ahead of live production, but the current pushed `origin/main` state is now deployed to production on `https://www.coparrent.com`.
- The latest preview target remains `https://coparrent-lp7hjcv30-thomas-projects-6401cf21.vercel.app`, but production `https://www.coparrent.com` is now the honest public/demo target for the current pushed repo state.
- The repo now also includes `scripts/verify-preview-smoke.ts` as a local QA helper, and the latest March 27 rerun verified public home, public login, invite landing, authenticated dashboard reachability, and Messaging Hub load against that current preview target.
- Shake-based problem reporting is now implemented in the frontend, including mobile `devicemotion` detection, explicit motion-permission enable flow, a manual fallback entry point, a structured report modal, and the Supabase-backed submission client/edge-function path.
- Shared edge-function CORS defaults are now tightened around the current production surface: legacy `.app`, Lovable, and implicit preview-host defaults were removed, preview wildcards must now be configured explicitly through env, and the AI runtime endpoints now use the shared strict origin validator instead of wildcard CORS.
- Legacy runtime references to `coparrent.app` were also removed from browser environment detection, health reporting, and OpenRouter `HTTP-Referer` headers so the current production host posture is consistently `coparrent.com` / `www.coparrent.com`.

## Completion Review

- A project-completion review with the exact Codex-only vs user-assisted split now lives in `docs/project/PROJECT_COMPLETION_REVIEW.md`.
- A single ranked remaining-work list now lives in `docs/project/PRIORITIZED_REMAINING_CHECKLIST.md`.

## Live Systems

- Vercel production frontend is live.
- `https://www.coparrent.com` now serves the March 27, 2026 production redeploy from the current pushed `main`.
- `coparrent.com` DNS is now corrected in Namecheap and Vercel marks the apex valid, but the local verifier still saw intermittent TLS failure immediately after the cutover. `https://www.coparrent.com` should remain the canonical public URL until the apex host behaves cleanly everywhere.
- Production Supabase project is `jnxtskcpwzuxyxjzqrkv`.
- `supabase/config.toml` points at that project.
- `.env.example` remains the repo template for local and deployed env variables. Local `.env` files and `scripts/verify-*.ts` helpers are local-only workflow inputs, not runtime configuration sources.
- Messaging Hub thread creation is now verified against the deployed backend, with saved evidence in `docs/acquisition/diligence/LIVE_VERIFICATION_EVIDENCE_LOG.md`.
- Invite acceptance is now verified end to end through the native RPC path with real inbox delivery, correct family/role assertions, and saved evidence artifacts in the same log.
- Preview-versus-production alignment is no longer a major blocker: the March 27 production redeploy now serves the current pushed `main` on `https://www.coparrent.com`, and the March 27 preview smoke pass remains available for staging confidence.
- The thin preview smoke pass was rerun successfully on March 27 against a fresh preview deployment. It now passes cleanly across home, login, invite landing, dashboard, and Messaging Hub with zero unexpected diagnostics.
- A fresh late-March-28 production smoke pass also completed cleanly on `https://www.coparrent.com` across home, login, invite landing, dashboard, and Messaging Hub with zero unexpected diagnostics.
- The `submit-problem-report` edge function, `problem_reports` table, user-view policy, and private `problem-report-screenshots` bucket are now live on the production Supabase project.
- The `problem_reports` rollout was completed safely on March 28, 2026 by applying the scoped SQL manually through the Supabase SQL editor instead of blindly pushing the broader pending migration backlog.
- A real production report was then submitted successfully from `https://www.coparrent.com/help/contact`, and the new row was verified directly in `public.problem_reports`.
- The optional screenshot-upload path was also verified live on March 28, 2026: a second production report saved successfully with `screenshot_path=2026-03-29/11341d7f-aee3-4a91-90c0-1a719207a5d8/3355a237-b12b-4ed3-9ac7-4fa7ee4aa35b/verification.png`.
- Stripe checkout, webhook subscription-state updates, premium gating, and the customer portal are now also verified live, with saved evidence artifacts in the same log.
- Nurse Nancy, Activity Generator, and Coloring Page Creator are now also verified live against the latest deployed frontend and production backend, with saved evidence artifacts in the same log.
- Daily audio/video calling is now also verified live against the production Supabase backend and Daily account, with saved evidence artifacts in the same log.
- Production Google sign-in is no longer blocked: the March 27 live pass from `https://www.coparrent.com/login` now reaches Google with the corrected Supabase callback and the new Google OAuth client.
- Production forgot-password requests now succeed from `https://www.coparrent.com/forgot-password`, and the current sent email body shows the normal Supabase recovery URL plus the app redirect target. Reports of `lovable-app` links now appear to be downstream inbox/link-rewrite behavior, not current app/template code.
- The remaining live-system risk is now real-device push/PWA validation, the final passkey posture, final QA-exception cleanup, and final confirmation that the apex `https://coparrent.com` host finishes its DNS/certificate cutover cleanly everywhere.
- The repo-side fix for the preview subscription-check noise is now deployed in the current buyer/demo preview: `useSubscription` waits for auth hydration and sends the current access token explicitly when calling `check-subscription`.
- Push/PWA verification is no longer blocked on missing backend plumbing or the local VAPID-key gap: `sync-push-subscription`, targeted `send-push`, and `scripts/verify-push-pwa.ts` now exist, and the local env now exposes the public VAPID key. The prep surface now also includes `/pwa-diagnostics`, a step-by-step device checklist in `docs/project/PUSH_PWA_DEVICE_VALIDATION_CHECKLIST.md`, and a verifier-generated markdown summary alongside the JSON report. Real-device evidence is still outstanding; the current saved artifacts are preflight only.
- Deployment/auth confirmation prep now has its own checklist in `docs/project/DEPLOYMENT_AUTH_CONFIRMATION_CHECKLIST.md`. The repo posture is clear, but apex-host confirmation, deployed captcha confirmation, localhost-origin disposition, and the final passkey decision still require user-assisted evidence before they can be marked closed.
- The buyer/diligence package now also includes dedicated docs for architecture, deployment, vendor costs, domain/DNS, env/secrets, provider-account mapping, transfer planning, and first-30-day stabilization.

## Billing Status

- Stripe is in live mode.
- Current live product:
  - `CoParrent Power`
  - product ID `prod_TwwA5VNxPgt62D`
  - recurring price ID `price_1Sz2IZHpttmwwVs1H4deOgQe`
- Repo billing code matches those live IDs.
- Stripe live verification was completed on March 24, 2026 with:
  - a successful live Power checkout using a no-charge one-day trial session
  - webhook-driven profile update to `subscription_status=active` and `subscription_tier=power`
  - successful `check-subscription` premium gating resolution for the same user
  - a successful customer-portal session and one completed portal action
- Notes:
  - the deployed integration is on live Stripe keys, so a Stripe test card was not usable for an honest live verification run
  - the live pass exposed and fixed a production `check-subscription` bug caused by Stripe rejecting the deep expand path `data.items.data.price.product`
  - the customer-portal function was verified using the allowed origin `https://coparrent.com` because production CORS correctly blocks localhost origins

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
- Multi-family behavior now depends on explicit family scope everywhere in the migrated core flows; requests, notifications, and visibility should not guess across families.
- Local regression coverage now exercises invite-status classification, pending invite token handling, and family bootstrap RPC result handling.
- This was verified on March 13, 2026 by:
  - confirming the parent tester gained an active family membership
  - confirming Nurse Nancy stopped failing on `Parent Access Only`
  - confirming a new co-parent invitation row was created with the same `family_id` as the inviter
- This was verified again on March 23, 2026 by:
  - sending a fresh co-parent invite to `testingcoparrent@yahoo.com`
  - sending a fresh third-party invite to `testingcoparrent@yahoo.com`
  - accepting both from the real inbox with a clean invitee family state between scenarios
  - confirming both flows landed in family `2b14a8e4-4ae2-4dd1-b832-adf10b2bfdc1`
  - confirming the accepted roles were `parent` and `third_party`
  - confirming both post-acceptance routes resolved to `/dashboard`
- This was verified again on March 25, 2026 by:
  - restoring the missing production `invitations.relationship` and `invitations.child_ids` columns
  - re-running the co-parent acceptance flow through the native `accept_coparent_invitation` RPC
  - re-running the third-party flow through the native `rpc_create_third_party_invite` and `accept_third_party_invitation` RPCs
  - confirming both flows again landed in family `2b14a8e4-4ae2-4dd1-b832-adf10b2bfdc1`
  - confirming the accepted roles were still `parent` and `third_party`
  - confirming both post-acceptance routes resolved to `/dashboard`
- Notes:
  - the March 23 fallback-path evidence remains in the log as history
  - the March 25 rerun is the current proof that the native invitation RPC contract now matches production again

## AI Status

- OpenRouter-backed functions:
  - `ai-message-assist`
  - `ai-schedule-suggest`
  - `nurse-nancy-chat`
  - `kid-activity-generator`
  - `generate-coloring-page`
- `OPENROUTER_API_KEY` is present in production Edge Function secrets.
- Result:
  - The repo now routes all AI edge functions through OpenRouter only
  - Live runtime verification for Nurse Nancy, activity generation, and coloring-page generation was completed on March 24, 2026 against the latest deployed frontend and production Supabase backend
  - The remaining AI risk is deployment alignment, not provider uncertainty or unproven runtime behavior

### Current Model Mapping

Based on the current repo code:

- `ai-message-assist` -> `google/gemini-3-flash-preview`
- `ai-schedule-suggest` -> `google/gemini-2.0-flash-exp:free`
- `nurse-nancy-chat` -> `google/gemini-3-flash-preview`
- `kid-activity-generator` -> `google/gemini-3-flash-preview`
- `generate-coloring-page` -> `google/gemini-2.5-flash-image`, with fallback to `google/gemini-3.1-flash-image-preview`

## Temporary QA Exceptions

- Repo-side production auth now requires captcha by default; deployed environments should keep hCaptcha configured.
- Edge-function localhost handling should still be treated as temporary QA configuration and reviewed before promoting new production changes.
- `notify-third-party-added` intentionally keeps `verify_jwt=false` in `supabase/config.toml` because the function now enforces JWT-or-internal authorization, family/invitation ownership checks, rate limits, and audit logging inside the handler.
- The repo-side default posture is now tighter: shared CORS no longer permits legacy hosts by default, and localhost only opens when `ALLOW_LOCALHOST_ORIGINS=true` or the function is running in explicit local development.

These are still temporary settings and should be reviewed before promoting new production changes. Use `docs/project/DEPLOYMENT_AUTH_CONFIRMATION_CHECKLIST.md` for the evidence standard before closing them.

## Auth Status

- Google sign-in is no longer blocked by `redirect_uri_mismatch`: the hosted Google client was replaced in the correct Google Cloud project, Supabase now uses that client, and live production `https://www.coparrent.com/login` reaches Google with the correct Supabase callback.
- Password-reset requests now succeed on production `https://www.coparrent.com`, and the current sent email body contains the normal Supabase recovery URL plus the app redirect target. The remaining `lovable-app` reports appear to be downstream mailbox link rewriting, not current app or template configuration.
- Passkeys are still not live because hosted Supabase MFA for this project currently exposes TOTP and SMS only, not WebAuthn/passkey enrollment.
- Branded Google-auth domain work is now intentionally pinned for later. The current Supabase org is still on `Free`, and Supabase custom domains / vanity subdomains require a paid organization. Google sign-in works now, but the chooser will keep showing `jnxtskcpwzuxyxjzqrkv.supabase.co` until that upgrade happens. The circle-back steps are documented in `docs/project/BRANDED_GOOGLE_AUTH_SETUP.md`.

## Highest-Priority Next Steps

1. Validate push notifications and PWA behavior on real devices.
2. Confirm the apex `https://coparrent.com` host fully settles and keep `https://www.coparrent.com` as the canonical public URL until it does. Follow `docs/project/DEPLOYMENT_AUTH_CONFIRMATION_CHECKLIST.md`.
3. Confirm deployed auth captcha configuration and review remaining localhost-origin exceptions before the next buyer-facing deployment pass. Follow `docs/project/DEPLOYMENT_AUTH_CONFIRMATION_CHECKLIST.md`.
4. Decide the final passkey posture while hosted Supabase still does not expose WebAuthn for this project. Record the decision through `docs/project/DEPLOYMENT_AUTH_CONFIRMATION_CHECKLIST.md`.
