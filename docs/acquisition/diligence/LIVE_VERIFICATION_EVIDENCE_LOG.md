# CoParrent Live Verification Evidence Log

_Last updated: 2026-03-23_

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
| Invite acceptance verification | Not started | TBD | Yes |
| Stripe checkout verification | Not started | TBD | Yes |
| Stripe webhook verification | Not started | TBD | Yes |
| Customer portal verification | Not started | TBD | Yes |
| OpenRouter runtime verification | Not started | TBD | Yes |
| Push notification verification | Not started | TBD | Yes |
| PWA install verification | Not started | TBD | Yes |
| Preview vs production alignment verification | Not started | TBD | Yes |

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

### Entry Template

- **Date:** TBD
- **Environment:** TBD
- **Tester:** TBD
- **Scenario:** Fresh co-parent or third-party invite accepted with a clean account and real inbox
- **Expected Result:** The invited user joins the intended existing family, lands in the correct post-acceptance flow, and does not create a duplicate family record
- **Actual Result:** TBD
- **Pass / Fail:** TBD
- **Notes:** TBD
- **Screenshots / Video Evidence:** TBD

### Repeat As Needed

- Use one entry for co-parent acceptance
- Use one entry for third-party acceptance
- Add more entries if different environments or fix passes are involved

## 3. Stripe Checkout Verification

### Entry Template

- **Date:** TBD
- **Environment:** TBD
- **Tester:** TBD
- **Scenario:** Purchase Power through the live checkout flow using the intended billing path
- **Expected Result:** Checkout completes, the payment succeeds, and the user is returned to the expected success state
- **Actual Result:** TBD
- **Pass / Fail:** TBD
- **Notes:** TBD
- **Screenshots / Video Evidence:** TBD

## 4. Stripe Webhook Verification

### Entry Template

- **Date:** TBD
- **Environment:** TBD
- **Tester:** TBD
- **Scenario:** Confirm Stripe webhook updates the user subscription state after checkout or other billing event
- **Expected Result:** The webhook is received, processed, and reflected correctly in the profile or subscription UI
- **Actual Result:** TBD
- **Pass / Fail:** TBD
- **Notes:** TBD
- **Screenshots / Video Evidence:** TBD

## 5. Customer Portal Verification

### Entry Template

- **Date:** TBD
- **Environment:** TBD
- **Tester:** TBD
- **Scenario:** Open the Stripe customer portal from the app and perform the intended portal action
- **Expected Result:** The user reaches the correct portal session and can manage billing without broken redirects or stale subscription state
- **Actual Result:** TBD
- **Pass / Fail:** TBD
- **Notes:** TBD
- **Screenshots / Video Evidence:** TBD

## 6. OpenRouter Runtime Verification

### Entry Template

- **Date:** TBD
- **Environment:** TBD
- **Tester:** TBD
- **Scenario:** Run live OpenRouter-backed flows such as Nurse Nancy, activity generation, or coloring page generation in the deployed target
- **Expected Result:** Each flow completes successfully, uses the expected provider path, and returns usable output without provider or secret errors
- **Actual Result:** TBD
- **Pass / Fail:** TBD
- **Notes:** TBD
- **Screenshots / Video Evidence:** TBD

### Suggested Separate Entries

- Nurse Nancy
- kid activity generator
- coloring page generation

## 7. Push Notification Verification

### Entry Template

- **Date:** TBD
- **Environment:** TBD
- **Tester:** TBD
- **Scenario:** Register push subscriptions and trigger test or real notifications on the intended platform
- **Expected Result:** Subscription succeeds, delivery occurs, and the payload follows privacy rules
- **Actual Result:** TBD
- **Pass / Fail:** TBD
- **Notes:** TBD
- **Screenshots / Video Evidence:** TBD

### Suggested Separate Entries

- Android
- iOS PWA mode
- Desktop browser or desktop install

## 8. PWA Install Verification

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

## 9. Preview Vs Production Alignment Verification

### Entry Template

- **Date:** TBD
- **Environment:** TBD
- **Tester:** TBD
- **Scenario:** Compare the intended buyer demo target against current production and confirm whether the strongest repo state is represented accurately
- **Expected Result:** The chosen demo environment reflects the current repo behavior closely enough that buyer walkthroughs do not depend on stale deployment state
- **Actual Result:** TBD
- **Pass / Fail:** TBD
- **Notes:** TBD
- **Screenshots / Video Evidence:** TBD

## Working Notes

- If an item is buyer-sensitive, treat missing evidence as a blocker until proven otherwise.
- If a verification result depends on a temporary QA exception, state that explicitly in the notes.
- If the same scenario is tested more than once, keep the failed and passed entries both. Buyers care about the final state, but they also care whether the operator can show his work.
