# CoParrent Live Verification Evidence Log

_Last updated: 2026-03-27_

Prepared for:
- **BNSN Solutions**
- **Owner:** Thomas Benson
- **Website:** https://www.bnsnsolutions.com

## Purpose

This is the single working log for live-system verification evidence.

It exists for one reason: when a buyer asks, "What has actually been tested in a live environment?" there should be one place to answer that without reconstructing the story from memory, screenshots, and scattered notes.

This file started as a template. Completed live-verification entries now live here as they happen.

## Summary Table

| Item | Status | Last Verified Date | Blocker |
|---|---|---|---|
| Messaging Hub thread creation verification | Passed with notes | 2026-03-23 | No |
| Invite acceptance verification | Passed with notes | 2026-03-25 | No |
| Stripe checkout verification | Passed with notes | 2026-03-24 | No |
| Stripe webhook verification | Passed with notes | 2026-03-24 | No |
| Customer portal verification | Passed with notes | 2026-03-24 | No |
| OpenRouter runtime verification | Passed with notes | 2026-03-24 | No |
| Daily audio/video call verification | Passed with notes | 2026-03-27 | No |
| Push notification verification | Blocked | 2026-03-25 | Yes |
| PWA install verification | Not started | TBD | Yes |
| Preview vs production alignment verification | Passed with notes | 2026-03-25 | No |

Use status values like:

- `Not started`
- `In progress`
- `Passed`
- `Passed with notes`
- `Failed`
- `Blocked`

## Evidence Rules

- Record the environment used: local, preview, or production.
- Name the tester.
- State the exact scenario, not just "tested messaging" or "tested Stripe."
- Record the expected result before the actual result.
- Link or reference screenshots, screen recordings, emails, or dashboard evidence.
- If a test fails, keep the failed result in the log. Do not rewrite history after the fix.
- When a failed or blocked item is later re-tested, add a new entry rather than silently replacing the old one.

## 1. Messaging Hub Thread Creation Verification

### Entry 2026-03-23

- **Date:** 2026-03-23
- **Environment:** Production Supabase backend `jnxtskcpwzuxyxjzqrkv` with allowed-origin verification against `https://coparrent-7ktmkbdyx-thomas-projects-6401cf21.vercel.app`
- **Tester:** `coparrenttesting@yahoo.com` (`Parent A`)
- **Scenario:** Sign in through Supabase Auth, verify `create-message-thread` preflight from the current Vercel production deployment origin, verify preview-origin pattern allowance, verify localhost preflight rejection, ensure the family channel, then create or retrieve the direct-message thread with `testingcoparrent@yahoo.com`
- **Expected Result:** The deployed edge function accepts the intended production/preview origins, rejects localhost after the production exception is removed, returns a usable family channel and direct-message thread, and the authenticated tester can read the returned thread through normal RLS-scoped queries without falling back to client-side inserts
- **Actual Result:** Passed. The deployed backend accepted the Vercel production deployment origin and the preview-origin pattern, blocked `http://127.0.0.1:4173`, returned a valid family channel, returned a valid direct-message thread, and the tester could read the returned thread through authenticated `message_threads` access.
- **Pass / Fail:** Passed with notes
- **Notes:** This verification was completed through the live backend and the saved report artifacts because the current public frontend targets are not usable for buyer-facing UI proof. `coparrent.com` is currently failing TLS, `www.coparrent.com` is returning a Vercel `404`, and the latest raw Vercel deployment URL is behind Vercel auth. The backend path that previously triggered the CORS plus `42501` fallback failure is now verified directly with the production tester account.
- **Screenshots / Video Evidence:** [verification report](E:/Files/.coparrent/docs/acquisition/diligence/evidence/messaging-hub-20260323T223051Z-report.json), [summary screenshot](E:/Files/.coparrent/docs/acquisition/diligence/evidence/messaging-hub-20260323T223051Z-summary.png), [details screenshot](E:/Files/.coparrent/docs/acquisition/diligence/evidence/messaging-hub-20260323T223051Z-details.png)

## 2. Invite Acceptance Verification

### Entry 2026-03-23: Co-Parent Acceptance

- **Date:** 2026-03-23
- **Environment:** Local current client `http://127.0.0.1:4174` against production Supabase backend `jnxtskcpwzuxyxjzqrkv`
- **Tester:** inviter `coparrenttesting@yahoo.com` (`Parent A`), invitee `testingcoparrent@yahoo.com` (`Parent B`)
- **Scenario:** Send a fresh co-parent invite, deliver it to the real Yahoo inbox, open the invite link, sign in as the invitee, accept the invite, then confirm the invitee lands in the inviter's existing family with the `parent` role and the expected `/dashboard` post-acceptance route
- **Expected Result:** The invite email is delivered, the invitee joins family `2b14a8e4-4ae2-4dd1-b832-adf10b2bfdc1` as `parent`, both parent profiles link through `co_parent_id`, and the accepted browser session resolves to `/dashboard`
- **Actual Result:** Passed. The email delivered through Resend, the invitee joined family `2b14a8e4-4ae2-4dd1-b832-adf10b2bfdc1` as `parent`, the parent profiles linked correctly, and the accepted session ended on `/dashboard`
- **Pass / Fail:** Passed with notes
- **Notes:** The invitee account was reset to a no-family state before the run. The email link still points at `https://coparrent.com`, so the verifier rewrote the origin to the local current client before browser sign-in. The actual acceptance state change used the deployed `accept-invite` edge function with the invitee's real auth session because the production invitation RPCs still drift from the deployed `invitations` table schema.
- **Screenshots / Video Evidence:** [verification report](E:/Files/.coparrent/docs/acquisition/diligence/evidence/invite-verification-20260323T232853Z-report.json), [co-parent dashboard screenshot](E:/Files/.coparrent/docs/acquisition/diligence/evidence/invite-verification-20260323T232853Z-coparent-dashboard.png)

### Entry 2026-03-23: Third-Party Acceptance

- **Date:** 2026-03-23
- **Environment:** Local current client `http://127.0.0.1:4174` against production Supabase backend `jnxtskcpwzuxyxjzqrkv`
- **Tester:** inviter `coparrenttesting@yahoo.com` (`Parent A`), invitee `testingcoparrent@yahoo.com` (`Parent B`)
- **Scenario:** Send a fresh third-party invite, deliver it to the real Yahoo inbox, open the invite link, sign in as the invitee, accept the invite, then confirm the invitee lands in the inviter's existing family with the `third_party` role, the `grandparent` relationship label, and the expected `/dashboard` post-acceptance route
- **Expected Result:** The invite email is delivered, the invitee joins family `2b14a8e4-4ae2-4dd1-b832-adf10b2bfdc1` as `third_party`, receives the `grandparent` relationship label, does not set `co_parent_id`, and the accepted browser session resolves to `/dashboard`
- **Actual Result:** Passed. The email delivered through Resend, the invitee joined family `2b14a8e4-4ae2-4dd1-b832-adf10b2bfdc1` as `third_party`, received the `grandparent` label, left `co_parent_id` unset, and the accepted session ended on `/dashboard`
- **Pass / Fail:** Passed with notes
- **Notes:** The invitee account was reset again between scenarios so the third-party role assignment was isolated from the co-parent pass. The third-party invitation row was inserted through the verifier with service-role access because the deployed `rpc_create_third_party_invite` function still expects `invitations.relationship` and `invitations.child_ids`, which are not present in production. The actual acceptance state change used the deployed `accept-invite` edge function with the invitee's real auth session for the same reason.
- **Screenshots / Video Evidence:** [verification report](E:/Files/.coparrent/docs/acquisition/diligence/evidence/invite-verification-20260323T232853Z-report.json), [third-party dashboard screenshot](E:/Files/.coparrent/docs/acquisition/diligence/evidence/invite-verification-20260323T232853Z-third-party-dashboard.png)

### Entry 2026-03-25: Co-Parent Acceptance (Native RPC Path)

- **Date:** 2026-03-25
- **Environment:** Local current client `http://127.0.0.1:4174` against production Supabase backend `jnxtskcpwzuxyxjzqrkv`
- **Tester:** inviter `coparrenttesting@yahoo.com` (`Parent A`), invitee `testingcoparrent@yahoo.com` (`Parent B`)
- **Scenario:** Re-run the live co-parent acceptance flow after restoring the missing `invitations` columns in production, then accept the invite by clicking the real Accept Invite page button so the native `accept_coparent_invitation` RPC runs through the current client
- **Expected Result:** The invite email is delivered, `get_invitation_by_token` resolves normally, the invitee joins family `2b14a8e4-4ae2-4dd1-b832-adf10b2bfdc1` as `parent`, both profiles link through `co_parent_id`, and the accepted browser session resolves to `/dashboard` without the fallback edge-function path
- **Actual Result:** Passed. The email delivered through Resend, the Accept Invite page loaded normally, the native `accept_coparent_invitation` RPC completed through the real page flow, the invitee joined family `2b14a8e4-4ae2-4dd1-b832-adf10b2bfdc1` as `parent`, the parent profiles linked correctly, and the accepted session ended on `/dashboard`.
- **Pass / Fail:** Passed with notes
- **Notes:** Before this rerun, production `invitations.relationship` and `invitations.child_ids` were restored so the deployed invitation RPCs matched the repo contract again. The email link still points at `https://coparrent.com`, so the verifier rewrote the origin to the local current client before browser sign-in because the current public frontend target is still not the stable buyer-demo environment.
- **Screenshots / Video Evidence:** [verification report](E:/Files/.coparrent/docs/acquisition/diligence/evidence/invite-verification-20260325T151043Z-report.json), [co-parent dashboard screenshot](E:/Files/.coparrent/docs/acquisition/diligence/evidence/invite-verification-20260325T151043Z-coparent-dashboard.png)

### Entry 2026-03-25: Third-Party Acceptance (Native RPC Path)

- **Date:** 2026-03-25
- **Environment:** Local current client `http://127.0.0.1:4174` against production Supabase backend `jnxtskcpwzuxyxjzqrkv`
- **Tester:** inviter `coparrenttesting@yahoo.com` (`Parent A`), invitee `testingcoparrent@yahoo.com` (`Parent B`)
- **Scenario:** Re-run the live third-party acceptance flow after restoring the missing `invitations` columns in production, create the invite through the native `rpc_create_third_party_invite` RPC, then accept the invite by clicking the real Accept Invite page button so the native `accept_third_party_invitation` RPC runs through the current client
- **Expected Result:** The invite email is delivered, `get_invitation_by_token` resolves normally, the invitee joins family `2b14a8e4-4ae2-4dd1-b832-adf10b2bfdc1` as `third_party`, receives the `grandparent` relationship label, leaves `co_parent_id` unset, and the accepted browser session resolves to `/dashboard` without the fallback verifier-only insert or edge-function acceptance path
- **Actual Result:** Passed. The invitation was created through the native `rpc_create_third_party_invite` RPC, the email delivered through Resend, the Accept Invite page loaded normally, the native `accept_third_party_invitation` RPC completed through the real page flow, the invitee joined family `2b14a8e4-4ae2-4dd1-b832-adf10b2bfdc1` as `third_party`, received the `grandparent` label, left `co_parent_id` unset, and the accepted session ended on `/dashboard`.
- **Pass / Fail:** Passed with notes
- **Notes:** The invitee account was reset again between scenarios so the third-party role assignment stayed isolated from the co-parent pass. The email link still points at `https://coparrent.com`, so the verifier rewrote the origin to the local current client before browser sign-in because the current public frontend target is still not the stable buyer-demo environment.
- **Screenshots / Video Evidence:** [verification report](E:/Files/.coparrent/docs/acquisition/diligence/evidence/invite-verification-20260325T151043Z-report.json), [third-party dashboard screenshot](E:/Files/.coparrent/docs/acquisition/diligence/evidence/invite-verification-20260325T151043Z-third-party-dashboard.png)

## 3. Stripe Checkout Verification

### Entry 2026-03-24

- **Date:** 2026-03-24
- **Environment:** Local current client `http://127.0.0.1:4174` against live Stripe and production Supabase backend `jnxtskcpwzuxyxjzqrkv`
- **Tester:** `stripe-verification+1774315841966@coparrent.test` (`Stripe verification QA`)
- **Scenario:** Sign in as a fresh QA user, create a live Power checkout session, complete the checkout flow, and return to the app success state
- **Expected Result:** Checkout succeeds for the Power plan, the user returns to `/settings?success=true`, and the session is usable for the follow-on webhook and portal checks
- **Actual Result:** Passed. Checkout completed successfully for the live Power price `price_1Sz2IZHpttmwwVs1H4deOgQe`, the session returned to `/settings?success=true`, and the same QA account was then used for webhook and portal verification
- **Pass / Fail:** Passed with notes
- **Notes:** The deployed Stripe integration is currently on live keys, so a Stripe test card could not be used honestly against this environment. This run therefore used a no-charge one-day live trial checkout session with `payment_method_collection=if_required` so the real checkout path could be exercised without creating an immediate charge.
- **Screenshots / Video Evidence:** [verification report](E:/Files/.coparrent/docs/acquisition/diligence/evidence/stripe-verification-20260324T013041Z-report.json), [checkout success screenshot](E:/Files/.coparrent/docs/acquisition/diligence/evidence/stripe-verification-20260324T013041Z-checkout-success.png)

## 4. Stripe Webhook Verification

### Entry 2026-03-24

- **Date:** 2026-03-24
- **Environment:** Local current client `http://127.0.0.1:4174` against live Stripe and production Supabase backend `jnxtskcpwzuxyxjzqrkv`
- **Tester:** `stripe-verification+1774315841966@coparrent.test` (`Stripe verification QA`)
- **Scenario:** Complete a live Power checkout, wait for the Stripe webhook to update the QA profile, then invoke the deployed `check-subscription` function to confirm paid gating resolves correctly
- **Expected Result:** The webhook updates `profiles.subscription_status` and `profiles.subscription_tier`, and premium gating resolves to subscribed Power access for the same authenticated user
- **Actual Result:** Passed. The QA profile updated to `subscription_status=active`, `subscription_tier=power`, `free_premium_access=false`, and the deployed `check-subscription` function returned `subscribed=true`, `tier=power`, `status=trial`, and `product_id=prod_TwwA5VNxPgt62D`
- **Pass / Fail:** Passed with notes
- **Notes:** The live pass exposed a production bug in `check-subscription`: Stripe rejected the deep expand path `data.items.data.price.product` with `property_expansion_max_depth`, which caused a `500` until the function was fixed and redeployed on March 24, 2026. The evidence from this entry is from the rerun after that production fix.
- **Screenshots / Video Evidence:** [verification report](E:/Files/.coparrent/docs/acquisition/diligence/evidence/stripe-verification-20260324T013041Z-report.json)

## 5. Customer Portal Verification

### Entry 2026-03-24

- **Date:** 2026-03-24
- **Environment:** Local current client `http://127.0.0.1:4174` against live Stripe and production Supabase backend `jnxtskcpwzuxyxjzqrkv`
- **Tester:** `stripe-verification+1774315841966@coparrent.test` (`Stripe verification QA`)
- **Scenario:** Open a real customer-portal session for the freshly activated QA account and perform one safe portal action
- **Expected Result:** The portal session opens successfully, the user can perform a billing-management action, and the session does not fail because of stale billing state
- **Actual Result:** Passed. The deployed `customer-portal` function returned a live portal URL and the verifier successfully performed the `Update information` action inside the Stripe customer portal
- **Pass / Fail:** Passed with notes
- **Notes:** Production CORS correctly blocks localhost origins for edge functions, so the portal session was requested with the allowed origin `https://coparrent.com` even though the browser-driving portion of the verification was run from the local current client. No production localhost exception was reintroduced for this verification.
- **Screenshots / Video Evidence:** [verification report](E:/Files/.coparrent/docs/acquisition/diligence/evidence/stripe-verification-20260324T013041Z-report.json), [portal screenshot](E:/Files/.coparrent/docs/acquisition/diligence/evidence/stripe-verification-20260324T013041Z-portal.png), [portal action screenshot](E:/Files/.coparrent/docs/acquisition/diligence/evidence/stripe-verification-20260324T013041Z-portal-after-action.png)

## 6. OpenRouter Runtime Verification

### Entry 2026-03-24: Nurse Nancy

- **Date:** 2026-03-24
- **Environment:** Latest deployed frontend `https://coparrent-7ktmkbdyx-thomas-projects-6401cf21.vercel.app` against production Supabase backend `jnxtskcpwzuxyxjzqrkv`
- **Tester:** `coparrenttesting@yahoo.com` (`Parent A`)
- **Scenario:** Open Nurse Nancy from the deployed dashboard, create a fresh health chat, send a new symptom question, and confirm the user and assistant messages persist in production
- **Expected Result:** The deployed OpenRouter-backed Nurse Nancy flow accepts the tester request, returns a substantive assistant reply in the UI, and persists the thread plus messages without provider, role, or secret errors
- **Actual Result:** Passed. The deployed UI created a fresh Nurse Nancy thread, returned a substantive assistant reply, and persisted the thread plus both the user and assistant messages in production under thread `a43c4715-bf14-4c89-bfb8-576042379f68`
- **Pass / Fail:** Passed with notes
- **Notes:** The deployed frontend target is currently protected behind Vercel auth, so the verification used saved Vercel auth cookies plus the real tester session. The underlying production runtime path itself completed successfully.
- **Screenshots / Video Evidence:** [verification report](E:/Files/.coparrent/docs/acquisition/diligence/evidence/ai-runtime-20260324T025847Z-report.json), [Nurse Nancy screenshot](E:/Files/.coparrent/docs/acquisition/diligence/evidence/ai-runtime-20260324T025847Z-nurse-nancy.png)

### Entry 2026-03-24: kid-activity-generator

- **Date:** 2026-03-24
- **Environment:** Latest deployed frontend `https://coparrent-7ktmkbdyx-thomas-projects-6401cf21.vercel.app` against production Supabase backend `jnxtskcpwzuxyxjzqrkv`
- **Tester:** `coparrenttesting@yahoo.com` (`Parent A`)
- **Scenario:** Open the Activity Generator from the deployed dashboard, submit a fresh indoor calm-activity prompt, and confirm the live edge-function response returns structured activity content that also renders in the UI
- **Expected Result:** The deployed OpenRouter-backed activity flow accepts the tester request, returns a valid structured `activity` payload with title/materials/steps, and shows the generated activity in the UI without provider or access errors
- **Actual Result:** Passed. The deployed UI generated an activity, and the live edge-function response returned a structured `activity` payload with title `Paper City Architect`, age range `6-8 years`, 4 materials, and 6 steps. The generated activity also rendered in the deployed UI.
- **Pass / Fail:** Passed with notes
- **Notes:** This pass verifies the live runtime path through the deployed UI and the edge-function response itself. The current deployed frontend still lags the local repo, so this evidence should be read as runtime proof, not proof that the latest local UI polish is already deployed.
- **Screenshots / Video Evidence:** [verification report](E:/Files/.coparrent/docs/acquisition/diligence/evidence/ai-runtime-20260324T025847Z-report.json), [Activity Generator screenshot](E:/Files/.coparrent/docs/acquisition/diligence/evidence/ai-runtime-20260324T025847Z-activity-generator.png)

### Entry 2026-03-24: generate-coloring-page

- **Date:** 2026-03-24
- **Environment:** Latest deployed frontend `https://coparrent-7ktmkbdyx-thomas-projects-6401cf21.vercel.app` against production Supabase backend `jnxtskcpwzuxyxjzqrkv`
- **Tester:** `coparrenttesting@yahoo.com` (`Parent A`)
- **Scenario:** Open Coloring Page Creator from the deployed dashboard, submit a fresh prompt, wait for the generated image, and confirm the generated metadata persists in production
- **Expected Result:** The deployed OpenRouter-backed coloring-page flow returns a usable generated image in the UI and persists a new `coloring_pages` record with a non-empty image URL without provider or secret errors
- **Actual Result:** Passed. The deployed UI generated the coloring page successfully, and production persisted coloring-page record `61e0f1eb-02b7-479e-9273-b5c408da414e` with difficulty `medium` and a non-empty image URL.
- **Pass / Fail:** Passed with notes
- **Notes:** The production runtime completed on the deployed frontend against the live backend after the image-model fallback update. The saved screenshot and report artifacts are the current proof set for buyer diligence.
- **Screenshots / Video Evidence:** [verification report](E:/Files/.coparrent/docs/acquisition/diligence/evidence/ai-runtime-20260324T025847Z-report.json), [Coloring Page screenshot](E:/Files/.coparrent/docs/acquisition/diligence/evidence/ai-runtime-20260324T025847Z-coloring-page.png)

## 7. Daily Audio/Video Call Verification

### Entry 2026-03-27

- **Date:** 2026-03-27
- **Environment:** Current client `http://127.0.0.1:4174` against production Supabase backend `jnxtskcpwzuxyxjzqrkv` and the active Daily account/subdomain
- **Tester:** caller `coparrenttesting@yahoo.com` (`Parent A`), callee `testingcoparrent@yahoo.com` (`Parent B` / active `third_party` tester membership)
- **Scenario:** Run `scripts/verify-daily-calls.ts` to exercise two live call paths: a dashboard-started audio call using the contact-card launcher and a Messaging Hub-started video call from the direct-message thread header
- **Expected Result:** Both live call paths create a valid call session, ring the callee, reach accepted status, join the Daily room from both sides, render the active call surface, write actor-attributed `call_events` plus `call_participants` rows, write thread log messages for start/accept/end, and end cleanly
- **Actual Result:** Passed. The dashboard audio scenario completed with call session `08e40ccb-7f5a-49cf-8e60-47edefd48ee1`, and the Messaging Hub video scenario completed with call session `8ece4d77-26b2-4038-be63-82a343d2c22d`. Both paths reached the active Daily UI on caller and callee, produced the expected event sequence (`created`, `ringing`, `accepted`, `joined`, `joined`, `ended`, `left`), and wrote the expected Messaging Hub thread records.
- **Pass / Fail:** Passed with notes
- **Notes:** The live pass exposed a real Messaging Hub bug first: direct-message threads to third-party members were being dropped when `family_members -> profiles` came back `null` under RLS. The fix now falls back to the membership relationship label instead of hiding the thread, which is why the direct-message video path is now verifiable. The pass also confirmed that the verifier must isolate the dashboard and Messaging Hub scenarios in separate pages so the global call manager does not auto-join the second scenario from an old page. The production `get_callable_family_members` RPC is still not deployed, so the current client is using its fallback path successfully.
- **Screenshots / Video Evidence:** [verification report](E:/Files/.coparrent/docs/acquisition/diligence/evidence/daily-calls-20260327T082724Z-report.json), [dashboard audio caller screenshot](E:/Files/.coparrent/docs/acquisition/diligence/evidence/daily-calls-20260327T082724Z-dashboard-audio-caller.png), [dashboard audio callee screenshot](E:/Files/.coparrent/docs/acquisition/diligence/evidence/daily-calls-20260327T082724Z-dashboard-audio-callee.png), [Messaging Hub video caller screenshot](E:/Files/.coparrent/docs/acquisition/diligence/evidence/daily-calls-20260327T082724Z-messaging-video-caller.png), [Messaging Hub video callee screenshot](E:/Files/.coparrent/docs/acquisition/diligence/evidence/daily-calls-20260327T082724Z-messaging-video-callee.png)

### Entry 2026-03-27: Reverification After Callable-Member RPC Deployment

- **Date:** 2026-03-27
- **Environment:** Current client `http://127.0.0.1:4174` against production Supabase backend `jnxtskcpwzuxyxjzqrkv` and the active Daily account/subdomain
- **Tester:** caller `coparrenttesting@yahoo.com` (`Parent A`), callee `testingcoparrent@yahoo.com` (`Parent B` / active `third_party` tester membership)
- **Scenario:** Apply the production Daily schema helper to deploy `get_callable_family_members`, then rerun `scripts/verify-daily-calls.ts` end to end for the same dashboard audio and Messaging Hub video scenarios
- **Expected Result:** The same live call paths still pass after the missing callable-member RPC is deployed, and the verifier no longer needs to fall back because production now exposes the server-side callable-member path
- **Actual Result:** Passed. The dashboard audio scenario completed with call session `f9498b82-d93e-4c2b-8cbe-2193a6847b7c`, and the Messaging Hub video scenario completed with call session `41bad1d8-346c-4d43-8c42-776a6739a767`. Both paths again reached the active Daily UI on caller and callee, produced the expected event sequence, and wrote the expected actor-attributed Messaging Hub thread records. The rerun log no longer contains the earlier `get_callable_family_members` fallback warning.
- **Pass / Fail:** Passed with notes
- **Notes:** This rerun closes the remaining production caveat from the first March 27 pass. The client still keeps its direct-query fallback for resilience, but the production RPC is now deployed and the live verification no longer depends on it being missing. The verifier still needs to refresh the caller page before the active call panel appears in some scenarios, so that behavior remains part of the known call-flow notes.
- **Screenshots / Video Evidence:** [verification report](E:/Files/.coparrent/docs/acquisition/diligence/evidence/daily-calls-20260327T083711Z-report.json), [dashboard audio caller screenshot](E:/Files/.coparrent/docs/acquisition/diligence/evidence/daily-calls-20260327T083711Z-dashboard-audio-caller.png), [dashboard audio callee screenshot](E:/Files/.coparrent/docs/acquisition/diligence/evidence/daily-calls-20260327T083711Z-dashboard-audio-callee.png), [Messaging Hub video caller screenshot](E:/Files/.coparrent/docs/acquisition/diligence/evidence/daily-calls-20260327T083711Z-messaging-video-caller.png), [Messaging Hub video callee screenshot](E:/Files/.coparrent/docs/acquisition/diligence/evidence/daily-calls-20260327T083711Z-messaging-video-callee.png)

## 8. Push Notification Verification

### Entry 2026-03-24: Verification Harness Preflight

- **Date:** 2026-03-24
- **Environment:** Latest deployed frontend `https://coparrent-7ktmkbdyx-thomas-projects-6401cf21.vercel.app` against production Supabase backend `jnxtskcpwzuxyxjzqrkv`
- **Tester:** `coparrenttesting@yahoo.com` (`Parent A`)
- **Scenario:** Run the new `verify-push-pwa` harness to preflight desktop, Android, and iOS PWA push verification before the manual device pass
- **Expected Result:** The verifier can auto-register a desktop subscription, detect any existing Android/iOS subscriptions for the tester profile, and trigger targeted test notifications for each platform
- **Actual Result:** Blocked. The local verifier environment does not currently have `VITE_VAPID_PUBLIC_KEY` or `VAPID_PUBLIC_KEY`, so desktop auto-registration could not proceed. The tester profile also does not yet have active `android-pwa` or `ios-pwa` subscriptions in `push_subscriptions`, so there was nothing to target for the physical-device portion.
- **Pass / Fail:** Blocked
- **Notes:** This is an honest preflight result, not a completed device test. The backend pieces needed for real verification are now in place: `sync-push-subscription` was deployed, `send-push` now supports targeted platform sends, and the repo now includes `scripts/verify-push-pwa.ts`. The next step is the real phone/tablet/desktop pass after the public VAPID key is available locally and the tester account has subscribed on each device.
- **Screenshots / Video Evidence:** [verification report](E:/Files/.coparrent/docs/acquisition/diligence/evidence/push-pwa-20260324T043046Z-report.json)

### Entry 2026-03-25: Verification Harness Rerun

- **Date:** 2026-03-25
- **Environment:** Vercel preview `https://coparrent-dx92q8g95-thomas-projects-6401cf21.vercel.app` against production Supabase backend `jnxtskcpwzuxyxjzqrkv`
- **Tester:** `coparrenttesting@yahoo.com` (`Parent A`)
- **Scenario:** Re-run `verify-push-pwa` after fixing the local VAPID env and providing Vercel auth cookies for the protected preview target
- **Expected Result:** The verifier gets past missing-env and preview-auth blockers, auto-registers a desktop subscription if browser permissions allow it, and reports whether Android/iOS subscriptions already exist for the tester profile
- **Actual Result:** Blocked. The verifier got past the missing-VAPID and preview-auth blockers, but desktop auto-registration still failed with `AbortError: Registration failed - permission denied`, and there are still no active `android-pwa` or `ios-pwa` subscriptions registered for the tester profile.
- **Pass / Fail:** Blocked
- **Notes:** This is progress, not completion. The local env now exposes the VAPID public key, and preview auth is no longer the blocker. The remaining blockers are real subscribed device records plus the fact that automated desktop registration is still being denied in the Playwright browser context.
- **Screenshots / Video Evidence:** [verification report](E:/Files/.coparrent/docs/acquisition/diligence/evidence/push-pwa-20260325T154445Z-report.json)

### Suggested Separate Entries

- Android
- iOS PWA mode
- Desktop browser or desktop install

## 9. PWA Install Verification

### Entry Template

- **Date:** TBD
- **Environment:** TBD
- **Tester:** TBD
- **Scenario:** Install the app as a PWA on the intended platform and verify core install behavior
- **Expected Result:** Install prompts or manual install flows work as expected, icons render correctly, and the installed app launches cleanly
- **Actual Result:** TBD
- **Pass / Fail:** TBD
- **Notes:** TBD
- **Screenshots / Video Evidence:** TBD

### Suggested Separate Entries

- Android install flow
- iOS add-to-home-screen flow
- Desktop install flow

## 10. Preview Vs Production Alignment Verification

### Entry 2026-03-25

- **Date:** 2026-03-25
- **Environment:** Vercel preview `https://coparrent-dx92q8g95-thomas-projects-6401cf21.vercel.app` against production Supabase backend `jnxtskcpwzuxyxjzqrkv`
- **Tester:** `coparrenttesting@yahoo.com` (`Parent A`)
- **Scenario:** Inspect the buyer-facing preview target across the upgraded home/about/help/court-records pages, sign in as the tester, and confirm the authenticated dashboard surface reflects the newer repo state better than production
- **Expected Result:** The chosen demo environment reflects the current repo behavior closely enough that buyer walkthroughs do not depend on the stale production frontend
- **Actual Result:** Passed with notes. The preview shows the upgraded public pages and the newer dashboard surface, and tester sign-in now reaches `/dashboard` normally after redeploying `login-notification` with the shared wildcard-preview CORS config.
- **Pass / Fail:** Passed with notes
- **Notes:** This preview is now the current honest buyer-demo target, but it is still a preview. Production remains behind it, and the preview still emits low-severity `401 HEAD /` or `401 HEAD /login` probe noise in the browser console.
- **Screenshots / Video Evidence:** [verification report](E:/Files/.coparrent/docs/acquisition/diligence/evidence/preview-alignment-20260325-report.json), [home screenshot](E:/Files/.coparrent/docs/acquisition/diligence/evidence/preview-alignment-20260325-home.png), [dashboard screenshot](E:/Files/.coparrent/docs/acquisition/diligence/evidence/preview-alignment-20260325-dashboard.png)

## Working Notes

- If an item is buyer-sensitive, treat missing evidence as a blocker until proven otherwise.
- If a verification result depends on a temporary QA exception, state that explicitly in the notes.
- If the same scenario is tested more than once, keep the failed and passed entries both. Buyers care about the final state, but they also care whether the operator can show his work.
