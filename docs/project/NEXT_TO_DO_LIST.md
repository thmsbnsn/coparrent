# CoParrent Next To Do List

Last updated: 2026-04-14

This file is the current short list for what to do next in CoParrent after repo recovery and the latest production-backed access-code and messaging work.

## Current Starting Point

- Repo recovery from GitHub is complete enough for active development.
- The production-backed complimentary access-code rollout is already proven and is not an active launch blocker.
- The current first-cohort blocker in the launch docs is still the broken production third-party invite path.
- Local recovery is usable, but it is not fully closed until the remaining backend secrets and path cleanup work are finished.

## 1. Fix The Production Third-Party Invite Path

Owner: Engineering

Why this is first:
This is still the only documented first-cohort launch blocker.

Done when:
- production exposes the scoped RPC signature the current client sends
- create + accept third-party invite passes on `https://coparrent.com`
- evidence log and launch docs are updated with fresh proof

## 2. Commit The Recovery Docs That Only Exist Locally Right Now

Owner: Engineering

Why this matters:
Some recovery work is currently only durable on the local machine. That is not good enough after a drive-loss event.

Files to commit once the local workspace is stable:
- `.gitignore` recovery change
- `docs/acquisition/diligence/DEPLOYMENT_RUNBOOK.md`
- `docs/acquisition/diligence/SECRETS_AND_ENV_INVENTORY.md`

## 3. Recover Or Rotate The Remaining Backend Secrets

Owner: Operator + Engineering

Still unresolved:
- `STRIPE_WEBHOOK_SECRET`
- `DAILY_DOMAIN`
- `DAILY_WEBHOOK_SECRET`
- `VAPID_PRIVATE_KEY`
- export-signing keys for messaging / court exports

Why this matters:
The app can build and test locally, but the recovery is not complete until the full backend secret set is back under control.

## 4. Normalize The Local Workspace To `C:\Dev\coparrent`

Owner: Engineering

Why this matters:
The temporary `E:` compatibility setup exists only because the old drive died. It should not remain the long-term path model.

Done when:
- the repo, tools, and local notes no longer depend on the old `E:\Files\.coparrent` path
- stale machine-specific path debt is removed or documented as historical only

## 5. Rebuild The Local Operator Setup Cleanly

Owner: Engineering

Includes:
- verify `.env.local` against the final recovered secret set
- verify Vercel local linkage
- verify Supabase CLI auth and project linkage
- replace placeholder tester-account values with real local operator notes where needed

## 6. Clean Up Evidence And Doc Path Debt

Owner: Engineering

Why this matters:
Some evidence docs still reference old absolute machine paths from the dead drive.

Priority cleanup:
- normalize or explicitly mark old `E:/Files/.coparrent/...` references
- keep evidence links truthful instead of relying on temporary drive mappings

## 7. Re-Run The Minimal Live First-Cohort QA Pass After The Invite Fix

Owner: Engineering + Operator

Minimum pass:
- login
- signup
- onboarding
- co-parent invite
- third-party invite
- pricing entry / checkout / webhook / portal sanity check

Why this matters:
After the invite fix, the launch call should be based on fresh proof, not assumed carry-forward.

## 8. Keep Exports And Law Office Portal Out Of Scope Until Deliberately Reverified

Owner: Product + Engineering

Current truthful posture:
- exports are not first-cohort gating right now
- Law Office Portal is repo-present and phase-1 read-only
- neither should be promised again until deliberately re-proven on the live host

## 9. Decide Whether To Normalize The Design Docs

Owner: Product + Engineering

Open decision:
- keep `docs/design` and `docs/design-reference` as historical internal reference
- or rewrite / rename them into neutral CoParrent design docs

Why this is on the list:
Those folders still contain Lovable-branded documents, and that naming should not drift indefinitely if CoParrent is the canonical product repo.

## 10. Resume New Product Work Only After Recovery And Launch Gaps Are Closed

Owner: Product + Engineering

Do next only after items 1 through 7 are under control:
- new UX polish passes
- broader messaging enhancements
- new game work
- public-scope feature expansion

That sequencing matters. The repo is usable again, but launch-readiness and recovery durability still come before new feature drift.
