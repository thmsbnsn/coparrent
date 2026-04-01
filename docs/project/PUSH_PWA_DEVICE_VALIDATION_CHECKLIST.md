# CoParrent Push/PWA Device Validation Checklist

_Last updated: 2026-03-30_

This checklist is for the real-device push/PWA pass. Do not mark push or PWA validation complete until a real device receives the notification and the evidence package below is captured.

## Rules

- Use `https://www.coparrent.com` unless there is a deliberate reason to validate a preview target instead.
- Do not treat `scripts/verify-push-pwa.ts` as final proof by itself. The verifier is a preflight and targeting tool; the device still has to receive the notification.
- Keep each platform as its own evidence entry: desktop browser, Android PWA, and iOS PWA.
- If a platform is blocked, keep the blocked result in the log. Do not overwrite it with a later pass.

## Prerequisites

1. Use the tester account that will receive the notification on the device. The account label must exist in `tester-accounts.local.md`.
2. Make sure local verifier env values are available before running the script:
   - `VITE_VAPID_PUBLIC_KEY` or `VAPID_PUBLIC_KEY`
   - `PUSH_PWA_BASE_URL` if you are not targeting the default deployed URL
   - `PUSH_PWA_TESTER_LABEL` if you are not using the default tester
   - `PUSH_PWA_VERCEL_COOKIES_PATH` only if the target deployment is still behind Vercel auth
3. Use the in-app routes below on the same device/session before capturing screenshots:
   - `/dashboard/notifications`
   - `/pwa-diagnostics`
4. Run the verifier from the repo root:

```bash
npm run verify:push-pwa
```

The verifier writes:
- JSON report: `docs/acquisition/diligence/evidence/push-pwa-<timestamp>-report.json`
- Markdown summary: `docs/acquisition/diligence/evidence/push-pwa-<timestamp>-summary.md`

## Required Evidence Per Platform

Capture all of the following for each platform you mark as passed:

- Device + platform details:
  - device model
  - OS version
  - browser or installed-PWA mode
- Screenshot of `/dashboard/notifications` showing the subscription-ready state
- Screenshot of `/pwa-diagnostics` showing the same device/session state
- Screenshot of the received notification on the real device
- Note whether tapping the notification opened the expected route
- The JSON report and markdown summary from the matching verifier run

Add the finished result as a new entry in [LIVE_VERIFICATION_EVIDENCE_LOG.md](/e:/Files/.coparrent/docs/acquisition/diligence/LIVE_VERIFICATION_EVIDENCE_LOG.md).

## Desktop Browser Checklist

Target mode: normal desktop browser tab, not installed desktop PWA.

1. Open `https://www.coparrent.com/dashboard/notifications`.
2. Sign in as the chosen tester account.
3. Enable notifications if they are not already enabled.
4. Open `https://www.coparrent.com/pwa-diagnostics`.
5. Confirm the page shows:
   - environment: desktop browser
   - service worker: registered
   - notification permission: granted
   - push support: supported
   - subscription: active subscription
6. Run `npm run verify:push-pwa` from the repo root.
7. Confirm the desktop scenario in the verifier summary is `passed`.
8. Confirm the actual desktop notification appears.
9. Capture the required evidence set.

Pass criteria:
- The verifier reports `desktop-browser` as `passed`
- The real desktop browser/device receives the notification
- The evidence set is complete

Blocked criteria:
- Browser permission is denied
- Service worker is missing
- The verifier cannot register or target the subscription
- The desktop device never shows the notification

## Android Checklist

Target mode: installed Android PWA, not plain browser tab.

1. Open `https://www.coparrent.com` in Chrome on Android.
2. Add the app to the home screen and launch the installed app.
3. Sign in as the chosen tester account inside the installed app.
4. Open `/dashboard/notifications` and enable notifications.
5. Open `/pwa-diagnostics` inside the installed app.
6. Confirm the page shows:
   - environment: Android PWA
   - service worker: registered
   - notification permission: granted
   - push support: supported
   - subscription: active subscription
7. Run `npm run verify:push-pwa` from the repo root.
8. Confirm the verifier summary shows `android-pwa` as `pending_manual_confirmation` rather than `blocked`.
9. Confirm the real Android device receives the targeted push notification.
10. Tap the notification and record whether it opens the expected route.
11. Capture the required evidence set.

Pass criteria:
- The verifier finds an active `android-pwa` subscription and targets it successfully
- The real Android device receives the notification
- The evidence set is complete

Blocked criteria:
- No `android-pwa` subscription exists yet
- The app is not running as an installed Android PWA
- The notification never arrives on the device

## iOS PWA Checklist

Target mode: installed iOS PWA on iOS 16.4+ via Safari Add to Home Screen.

1. Open `https://www.coparrent.com` in Safari on the iPhone/iPad.
2. Use Share → Add to Home Screen.
3. Launch the installed CoParrent icon from the home screen.
4. Sign in as the chosen tester account inside the installed app.
5. Open `/dashboard/notifications` and enable notifications.
6. Open `/pwa-diagnostics` inside the installed app.
7. Confirm the page shows:
   - environment: iOS PWA
   - service worker: registered
   - notification permission: granted
   - push support: supported
   - subscription: active subscription
8. Run `npm run verify:push-pwa` from the repo root.
9. Confirm the verifier summary shows `ios-pwa` as `pending_manual_confirmation` rather than `blocked`.
10. Confirm the real iOS device receives the targeted push notification.
11. Tap the notification and record whether it opens the expected route.
12. Capture the required evidence set.

Pass criteria:
- The verifier finds an active `ios-pwa` subscription and targets it successfully
- The real iOS PWA receives the notification
- The evidence set is complete

Blocked criteria:
- The app is still in Safari browser mode instead of installed PWA mode
- No `ios-pwa` subscription exists yet
- The notification never arrives on the device

## Logging Rules

- Keep desktop, Android, and iOS as separate evidence entries.
- Record the exact device, OS, browser/PWA mode, and target URL used.
- If the verifier shows `blocked`, include the blocker reason from the JSON or markdown artifact.
- If the verifier shows `pending_manual_confirmation`, do not convert that to `Passed` until the real device evidence is captured.
