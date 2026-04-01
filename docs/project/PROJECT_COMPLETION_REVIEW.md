# CoParrent Project Completion Review

_Last updated: 2026-03-30_

This is the current project-completion split requested for release planning.

## Tasks Codex Can Do Without User Assistance

Completed in this pass:

1. Route-level lazy loading and vendor chunk splitting so the app no longer ships as a single multi-megabyte initial bundle.
2. Lint pipeline cleanup so `npm run lint` passes on maintained source code instead of failing on generated output.
3. Stale runtime URL cleanup across notifications, reminders, environment detection, and Nurse Nancy export output.
4. Sports reminder logic fix for users assigned both pickup and drop-off responsibility.
5. Documentation sync for current status, next-step priorities, and README cleanup.
6. Centralized route-access rules into a shared helper and fixed the third-party access leak caused by prefix-matching `"/dashboard"` as an allowed subtree.
7. Added a targeted Vitest regression suite for invite status logic, family bootstrap helpers, plan limits, route/security gating, and reminder helpers.
8. Added repeatable local verification scripts: `npm run test`, `npm run test:watch`, and `npm run verify`.
9. Burned down the local lint backlog to zero warnings, including typed cleanup across frontend hooks/pages and edge functions plus a targeted Fast Refresh allowlist for intentional companion exports.
10. Added `ProtectedRoute` integration coverage so auth loading, redirects, parent-only enforcement, and child/third-party routing decisions are exercised through the component, not just pure helpers.
11. Added `AcceptInvite` component coverage so invalid/expired tokens, pending invite redirects, co-parent acceptance, third-party acceptance, and email-mismatch handling are exercised through the page, not just pure invitation helpers.
12. Added shared auth-redirect coverage for `Login` and `Signup` so pending invite handoff plus onboarding-versus-dashboard routing is exercised through the real pages after authentication.
13. Added `FamilyProvider` regression coverage and fixed the persisted active-family restoration bug that was clearing the stored family before the initial refresh completed.
14. Added `PremiumFeatureGate` regression coverage for upgrade prompts, expired trials, hidden locked states, and custom fallbacks.
15. Added `KidsDashboard` smoke coverage and fixed the signed-out redirect so login navigation happens in an effect instead of during render.
16. Upgraded the public-site content/design surface across Home, About, Help, Blog, Blog Post, Court Records, and Payment Success, removed the temporary app banner, and added the missing PWA icon assets.
17. Improved mobile dashboard UX across Dashboard, Children, Expenses, Sports Hub, Kids Hub, Kid Center, and Activities, including fixes for mobile-only layout and select-state issues.
18. Fixed `useFamilyRole.primaryParentId` so downstream features receive the real parent profile ID instead of the active family UUID.
19. Refined the Messaging Hub mobile experience with clearer header/actions, explicit setup-failure handling, and a retry path that no longer loops after setup failure.
20. Completed live co-parent and third-party invite verification twice: first through the fallback path on March 23, 2026 to prove the flow, then again on March 25, 2026 through the native `get_invitation_by_token`, `rpc_create_third_party_invite`, `accept_coparent_invitation`, and `accept_third_party_invitation` path after the production invitation-schema repair.
21. Completed live OpenRouter runtime verification for Nurse Nancy, Activity Generator, and Coloring Page Creator against the latest deployed frontend and production backend, with saved screenshots and report artifacts.
22. Completed live Stripe checkout, webhook, premium-gating, and customer-portal verification against the production billing stack, with saved screenshots and report artifacts.
23. Added real push-subscription sync plumbing, a targeted `send-push` filter path, and the `verify-push-pwa` harness so desktop plus manual Android/iOS device testing can be run against the live backend without inventing evidence.
24. Completed live Daily audio/video verification on March 27, 2026 through the dashboard caller widget and the Messaging Hub direct-message header, including actor-attributed `call_events`, `call_participants`, and thread log assertions with saved screenshots and a report artifact.
25. Added and pushed the shake-based problem-reporting feature, including mobile `devicemotion` detection, explicit motion-permission enablement, manual fallback entry points, the structured report modal, Supabase migration files for `problem_reports`, and the deployed `submit-problem-report` edge function.
26. Fixed the hosted Google OAuth configuration, repaired the Vercel Git connection and Namecheap/Vercel domain wiring, and redeployed the current pushed `main` to production so `https://www.coparrent.com` now serves the live public app again.
27. Completed the production `problem_reports` rollout on March 28, 2026 by applying the scoped SQL manually in the Supabase SQL editor, verifying the live table/policy/private bucket, and successfully saving a real report from `https://www.coparrent.com/help/contact`.
28. Tightened the shared edge-function CORS baseline around the real production host surface, removed legacy `.app` / Lovable defaults, updated AI runtime endpoints to use the shared strict origin validator, and cleaned remaining runtime references so the app consistently advertises `coparrent.com` / `www.coparrent.com`.
29. Completed the optional production problem-report screenshot-upload verification on March 28, 2026 by submitting a real image-attached report through the live public help/contact page and reading back the newest `problem_reports` row with a populated private-bucket `screenshot_path`.
30. Re-ran the smoke harness directly against `https://www.coparrent.com` on late March 28, 2026 and confirmed home, login, invite landing, dashboard, and Messaging Hub all pass cleanly on the live public domain with zero unexpected diagnostics.
31. Removed the legacy messaging runtime path and the live runtime reliance on `co_parent_id`, replacing the old `/dashboard/messages-legacy` surface with Messaging Hub only.
32. Switched protected-route access to explicit allowlist/default-deny behavior and aligned sidebar/dashboard quick-link visibility with the same route rules.
33. Finished the active-family runtime migration in the live Gift Lists and Creations flows and added regression coverage for missing-scope and cross-family isolation behavior.
34. Hid the Chore Chart feature from the live app because the repo implementation was still local-only; the route now redirects back to Kids Hub and the audit docs no longer claim RLS-backed persistence.
35. Re-verified the current local pipeline after the family-scope/runtime passes: lint, build, and the full Vitest suite all pass locally.
36. Completed the stale env/config hygiene pass: removed the duplicate `_(2).env` file from the active workflow, kept `.env.example` as the repo template, and clarified that `scripts/verify-*.ts` are local QA helpers rather than runtime dependencies.

Remaining Codex-only backlog:

1. No current launch-blocking Codex-only backlog is called out in the verified repo state.
2. If device validation or deployment checks expose new runtime gaps, treat those as follow-on tickets rather than current known blockers.

## Tasks That Need User Assistance

1. Validate push notifications and PWA install behavior on physical iOS, Android, and desktop devices.
2. Confirm the deployed auth environment keeps captcha configured and confirm the current tightened localhost-origin defaults remain the intended production posture.
3. Confirm the apex `https://coparrent.com` host finishes its DNS/certificate/redirect cutover cleanly and keep `https://www.coparrent.com` canonical until then.
4. Decide the final passkey posture while hosted Supabase still does not expose WebAuthn for this project.

## Release Readiness Summary

- Local build status: passing
- Local test status: passing
- Local lint status: passing cleanly
- Highest remaining release risk: real-device push/PWA behavior, final QA-exception cleanup, final passkey posture, and final confirmation that the apex `https://coparrent.com` host finishes its cutover cleanly everywhere
- Highest remaining Codex-only risk: no current launch-blocking repo task is called out; the remaining risks are primarily device verification and deployment/configuration confirmation
