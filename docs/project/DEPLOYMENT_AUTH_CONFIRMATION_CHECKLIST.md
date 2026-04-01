# CoParrent Deployment/Auth Confirmation Checklist

_Last updated: 2026-03-30_

This checklist is for the remaining deployment/auth posture blockers. Do not mark any item complete until the evidence standard for that item is satisfied.

## Rules

- Keep `https://www.coparrent.com` as the canonical public URL until the apex host is confirmed clean from multiple networks.
- Do not infer production posture from local repo defaults alone. Repo defaults are evidence for expected behavior, not proof that deployed secrets and env flags match.
- If a check fails or remains ambiguous, keep it open and record the blocker.
- If passkeys remain unavailable, record that as a product posture decision rather than implying passkeys are live.

## Repo-Confirmable Baseline

These are facts that can be confirmed from the repo/config without touching production:

- Auth captcha defaults to required in production:
  - `src/lib/authCapabilities.ts`
  - `src/components/auth/AuthCaptcha.tsx`
  - `src/pages/Login.tsx`
  - `src/pages/Signup.tsx`
- Shared edge-function CORS defaults are narrow:
  - allowed origins default to `https://coparrent.com`, `https://www.coparrent.com`, and `https://coparrent.vercel.app`
  - preview wildcard origins require explicit env configuration
  - localhost origins are only allowed when `ALLOW_LOCALHOST_ORIGINS=true` or when running explicit local development
  - source: `supabase/functions/_shared/cors.ts`
- `verify_jwt=false` endpoints in `supabase/config.toml` are intentional operational/webhook/manual paths and should be reviewed as exceptions, not as the baseline for normal client traffic.
- Passkeys are not launch-ready by default:
  - the repo flag template keeps `VITE_SUPABASE_PASSKEYS_ENABLED=false`
  - hosted Supabase for this project is still documented as lacking WebAuthn/passkey enrollment

## 1. Apex Host Confirmation

Goal:
- determine whether `https://coparrent.com` is now clean enough to close the host-settling blocker

Run from at least two different networks if possible:

```bash
curl -I https://www.coparrent.com/
curl -I https://www.coparrent.com/login
curl -I https://coparrent.com/
curl -I https://coparrent.com/login
```

Browser checks:
1. Open `https://www.coparrent.com/`
2. Open `https://www.coparrent.com/login`
3. Open `https://coparrent.com/`
4. Open `https://coparrent.com/login`
5. Confirm there are no TLS/certificate warnings
6. Confirm the apex host either:
   - cleanly redirects to the intended canonical host, or
   - serves the correct site consistently without intermittent TLS or wrong-host behavior

Pass criteria:
- `www` is consistently healthy
- apex behavior is consistent from multiple networks
- the final canonical-host decision is explicit and documented

Blocked criteria:
- intermittent TLS/certificate failures
- inconsistent redirect behavior
- different behavior across networks that leaves the host ambiguous

Evidence required:
- saved `curl -I` output for both hosts
- screenshots of browser loads for `www` and apex
- timestamp plus network/source used
- explicit note on whether `www` remains canonical or the apex blocker is now closed

## 2. Deployed Auth Captcha Confirmation

Goal:
- confirm the deployed public auth surface still matches the repo posture that captcha is required in production

Manual checks:
1. Open `https://www.coparrent.com/login`
2. Open `https://www.coparrent.com/signup`
3. Confirm the hCaptcha widget renders on both pages
4. Confirm the form does not proceed without completing captcha
5. If the widget is missing, treat the auth posture as unconfirmed and check deployed env/secrets:
   - `VITE_AUTH_CAPTCHA_ENABLED`
   - `VITE_HCAPTCHA_SITE_KEY`
   - `HCAPTCHA_SECRET_KEY`

Pass criteria:
- captcha renders on the deployed login and signup pages
- submit is gated on captcha when required
- no temporary QA exception is silently disabling auth captcha in production

Blocked criteria:
- captcha widget missing
- forms bypass captcha unexpectedly
- deployed env values do not match the intended posture

Evidence required:
- screenshots of deployed login and signup showing captcha
- short note on whether the submit path was blocked until captcha completion
- if blocked, the exact missing/misconfigured env or observed runtime behavior

## 3. Localhost-Origin / CORS Confirmation

Goal:
- confirm the deployed edge-function posture does not allow localhost unless there is an explicit documented reason

Repo-side expectation:
- `ALLOW_LOCALHOST_ORIGINS` should be absent or `false` in production
- `ALLOWED_ORIGINS` should stay narrow
- `ALLOWED_ORIGIN_PATTERNS` should contain only intentional preview patterns

Recommended repeatable check:

```bash
npm run verify:messaging-hub
```

Use `MESSAGING_HUB_BASE_URL=https://www.coparrent.com` if you need to force the canonical host explicitly.

Review:
1. Confirm the report shows the allowed production origin passing
2. Confirm localhost preflight is blocked unless there is a deliberate temporary exception
3. Confirm any remaining localhost allowance is intentional, documented, and time-bounded

Pass criteria:
- localhost is blocked in the deployed posture unless explicitly retained with written justification
- the intended production origin passes
- preview-origin handling matches the current documented policy

Blocked criteria:
- localhost is unexpectedly allowed
- production origin fails strict CORS checks
- the deployment posture cannot be explained from env/config

Evidence required:
- verifier report or equivalent request/response evidence
- explicit note on `ALLOW_LOCALHOST_ORIGINS` final disposition
- any preview-origin exceptions that are intentionally kept

## 4. Passkey Posture Confirmation

Goal:
- keep passkey messaging honest while hosted Supabase for this project still lacks WebAuthn/passkey enrollment

Current repo-side expectation:
- do not market passkeys as live
- treat passkeys as unavailable/hidden unless hosted WebAuthn enrollment becomes real for this project

Decision options:
1. Keep passkeys hidden/disabled for launch and document that clearly
2. Treat hosted WebAuthn availability as a launch blocker and open a separate enablement ticket

Pass criteria:
- the launch posture is explicitly chosen and documented
- no public-facing doc claims passkeys are already available

Blocked criteria:
- launch messaging implies passkeys are live when enrollment still is not
- no explicit product decision has been recorded

Evidence required:
- written decision note in the status docs
- if changed later, a separate live verification artifact for real passkey enrollment/authentication

## Closeout Standard

Only close the deployment/auth posture blocker when:
- apex host behavior is explicitly confirmed
- deployed captcha posture is explicitly confirmed
- localhost-origin handling is explicitly confirmed
- passkey posture is explicitly decided and documented
