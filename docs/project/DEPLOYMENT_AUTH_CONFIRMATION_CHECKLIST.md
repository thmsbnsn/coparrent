# CoParrent Deployment/Auth Confirmation Checklist

_Last updated: 2026-04-10_

This checklist is for the remaining deployment and auth posture blockers. Do not mark any item complete until the evidence standard for that item is satisfied.

## Rules

- Treat `https://coparrent.com` as the canonical public URL for current launch docs. `https://www.coparrent.com` currently serves the same app and should be treated as a non-canonical alias until redirect cleanup happens.
- Do not infer production posture from local repo defaults alone. Repo defaults are evidence for expected behavior, not proof that deployed secrets and env flags match.
- If a check fails or remains ambiguous, keep it open and record the blocker.
- If passkeys remain unavailable, record that as a product posture decision rather than implying passkeys are live.

## Repo-Confirmable Baseline

These are facts that can be confirmed from the repo and config without touching production:

- If auth-captcha env is unset, the repo defaults to `required` in production:
  - [../../src/lib/authCapabilities.ts](../../src/lib/authCapabilities.ts)
  - [../../src/components/auth/AuthCaptcha.tsx](../../src/components/auth/AuthCaptcha.tsx)
  - [../../src/pages/Login.tsx](../../src/pages/Login.tsx)
  - [../../src/pages/Signup.tsx](../../src/pages/Signup.tsx)
- The current first-cohort public-host posture is not the repo default. It is an explicit launch decision:
  - `VITE_AUTH_CAPTCHA_ENABLED=false` on production frontend
  - public auth does not currently rely on captcha
  - direct auth API calls without captcha should therefore be described as current posture, not as an unexpected bypass
- Shared edge-function CORS defaults are narrow:
  - allowed origins default to `https://coparrent.com`, `https://www.coparrent.com`, and `https://coparrent.vercel.app`
  - preview wildcard origins require explicit env configuration
  - localhost origins are only allowed when `ALLOW_LOCALHOST_ORIGINS=true` or when running explicit local development
  - source: [../../supabase/functions/_shared/cors.ts](../../supabase/functions/_shared/cors.ts)
- `verify_jwt=false` endpoints in [../../supabase/config.toml](../../supabase/config.toml) are intentional operational, webhook, or manual paths and should be reviewed as exceptions, not as the baseline for normal client traffic.
- Passkeys are not launch-ready by default:
  - the repo flag template keeps `VITE_SUPABASE_PASSKEYS_ENABLED=false`
  - hosted Supabase for this project is still documented as lacking WebAuthn/passkey enrollment

## 1. Apex Host Confirmation

Goal:

- keep the canonical host decision explicit and make sure the public alias posture is still consistent

Run from at least two different networks if possible:

```bash
curl -I https://www.coparrent.com/
curl -I https://www.coparrent.com/login
curl -I https://coparrent.com/
curl -I https://coparrent.com/login
```

Pass criteria:

- `https://coparrent.com` stays explicit as canonical
- `https://www.coparrent.com` either redirects cleanly or intentionally serves the same app
- there are no TLS or certificate warnings

Evidence required:

- saved `curl -I` output for both hosts
- timestamp plus network/source used
- explicit note that the apex host is canonical now and whether `www` is redirecting or intentionally serving the same app

## 2. Deployed Public Auth Posture Confirmation

Goal:

- confirm the deployed public auth surface matches the current launch posture and remains usable

Current intended posture:

- public login and signup must work on `https://coparrent.com`
- public auth is currently running with captcha intentionally disabled for first cohort
- do not market this as captcha hardening

Manual checks:

1. Open `https://coparrent.com/login`
2. Open `https://coparrent.com/signup`
3. Confirm neither page shows the broken missing-site-key captcha warning
4. Confirm an existing user can log in successfully
5. Confirm a fresh user can sign up successfully
6. If captcha is later re-enabled, do not close the item until both:
   - the public site key renders correctly on login and signup
   - direct auth API calls without captcha are rejected server-side

Pass criteria:

- login and signup are usable on the public host
- current public auth posture is documented honestly
- there is no broken missing-site-key state in front of users

Blocked criteria:

- login or signup is unusable
- public auth posture is still ambiguous
- captcha is re-enabled without fresh public proof and server-side enforcement proof

Evidence required:

- fresh production auth proof in [../../docs/acquisition/diligence/LIVE_VERIFICATION_EVIDENCE_LOG.md](../../docs/acquisition/diligence/LIVE_VERIFICATION_EVIDENCE_LOG.md)
- explicit note on whether captcha is intentionally disabled or deliberately re-enabled

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

Use `MESSAGING_HUB_BASE_URL=https://coparrent.com` if you need to force the canonical host explicitly.

Pass criteria:

- localhost is blocked in the deployed posture unless explicitly retained with written justification
- the intended production origin passes
- preview-origin handling matches the current documented policy

Evidence required:

- verifier report or equivalent request and response evidence
- explicit note on `ALLOW_LOCALHOST_ORIGINS` final disposition
- any preview-origin exceptions that are intentionally kept

## 4. Passkey Posture Confirmation

Goal:

- keep passkey messaging honest while hosted Supabase for this project still lacks WebAuthn/passkey enrollment

Current repo-side expectation:

- do not market passkeys as live
- treat passkeys as unavailable or hidden unless hosted WebAuthn enrollment becomes real for this project

Decision options:

1. Keep passkeys hidden or disabled for launch and document that clearly
2. Treat hosted WebAuthn availability as a separate enablement track before a later public launch

Pass criteria:

- the launch posture is explicitly chosen and documented
- no public-facing doc claims passkeys are already available

## Closeout Standard

Only close the deployment and auth posture blocker when:

- apex host behavior is explicitly confirmed
- deployed public auth behavior is explicitly confirmed
- localhost-origin handling is explicitly confirmed
- passkey posture is explicitly decided and documented
