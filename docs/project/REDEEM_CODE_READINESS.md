# CoParrent Redeem Code Readiness

Last updated: 2026-04-10

This file answers one narrow question: can CoParrent safely run a phase-1 complimentary access code rollout from the current repo state?

## Executive Summary

Current answer: **Yes.**

What now exists in the repo:

- access-code tables
- access-code redemption tracking
- secure redemption RPC
- authenticated edge-function wrapper
- user-facing redemption UI
- admin-only issuance path
- admin-only inventory listing
- admin-only deactivate flow
- targeted edge-function tests
- operator runbook

What is now live-verified:

- `admin-manage-access-codes` is deployed to production project `jnxtskcpwzuxyxjzqrkv`
- the public production frontend now exposes the admin `Access Codes` tab
- admin issuance, inventory visibility, and deactivation work on the live public host
- a real QA redemption on the live public host grants complimentary Power access on the target profile
- a deactivated code is blocked on the live public host with the exact inactive-code message
- both `https://www.coparrent.com/login` and `https://coparrent.com/login` returned the fresh production deploy immediately after rollout

What is still required before broad real distribution:

- train support on invalid, expired, exhausted, and inactive code handling
- distribute codes in small controlled batches rather than bulk

## Direct Audit Answers

### Does any redeem-code-like system already exist?

**Yes.**

Current evidence:

- [../../supabase/migrations/20260313120000_recover_access_code_system.sql](../../supabase/migrations/20260313120000_recover_access_code_system.sql)
- [../../supabase/functions/redeem-access-code/index.ts](../../supabase/functions/redeem-access-code/index.ts)
- [../../supabase/functions/admin-manage-access-codes/index.ts](../../supabase/functions/admin-manage-access-codes/index.ts)
- [../../src/components/settings/AccessCodeRedeemer.tsx](../../src/components/settings/AccessCodeRedeemer.tsx)
- [../../src/components/admin/AdminAccessCodeManager.tsx](../../src/components/admin/AdminAccessCodeManager.tsx)
- [../../src/pages/AdminDashboard.tsx](../../src/pages/AdminDashboard.tsx)

What it does now:

- accepts an authenticated complimentary access code
- hashes and validates the code server-side
- tracks redemptions
- grants complimentary Power access on the profile
- lets admins issue new codes server-side
- lets admins review code inventory without exposing raw secrets
- lets admins deactivate codes

This is a complimentary-access system, not a billing discount system.

### Is there already a Stripe coupon or promotion-code path?

**No.**

What was checked:

- `promotion_code`
- `coupon`
- `promo code`
- `discount`

What was found:

- live Stripe checkout and customer-portal flow
- no app-side Stripe promotion-code collection
- no checkout session promotion-code path
- no Stripe coupon issuance or redemption path wired into launch access

Primary evidence:

- [../../supabase/functions/create-checkout/index.ts](../../supabase/functions/create-checkout/index.ts)
- [../../supabase/functions/customer-portal/index.ts](../../supabase/functions/customer-portal/index.ts)
- [../../src/hooks/useSubscription.ts](../../src/hooks/useSubscription.ts)

### Is there already an internal access-code or beta-code path?

**Yes.**

Current path:

- `access_pass_codes`
- `access_pass_redemptions`
- `rpc_redeem_access_code`
- `redeem-access-code`
- `admin-manage-access-codes`

### Is there already an admin issuance flow?

**Yes.**

Current evidence:

- [../../supabase/functions/admin-manage-access-codes/index.ts](../../supabase/functions/admin-manage-access-codes/index.ts)
- [../../src/components/admin/AdminAccessCodeManager.tsx](../../src/components/admin/AdminAccessCodeManager.tsx)
- [../../src/pages/AdminDashboard.tsx](../../src/pages/AdminDashboard.tsx)

Current behavior:

- raw codes are generated server-side
- only hash plus preview and metadata are stored
- raw codes are returned only in the issuance response
- optional small batch issuance is supported
- only admins can issue codes

### Is there already admin listing and lifecycle management?

**Yes.**

Current behavior:

- admins can list current inventory
- list output includes preview, metadata, and derived operational state
- list output does not include raw codes or hashes
- admins can deactivate a code without deleting historical redemption records

### Is there already a code redemption UI?

**Yes.**

Primary evidence:

- [../../src/components/settings/AccessCodeRedeemer.tsx](../../src/components/settings/AccessCodeRedeemer.tsx)
- [../../src/pages/SettingsPage.tsx](../../src/pages/SettingsPage.tsx)

Operational note:

- the redemption UI remains simple and user-facing
- authorization and plan updates still happen server-side only

### Is there already DB schema support?

**Yes.**

Schema support exists for:

- code records
- redemption records
- uniqueness
- max redemptions
- expiration
- active or inactive state
- admin read policies
- user-own redemption visibility

Primary evidence:

- [../../supabase/migrations/20260313120000_recover_access_code_system.sql](../../supabase/migrations/20260313120000_recover_access_code_system.sql)

### Is there already test coverage?

**Yes, targeted edge-function coverage now exists.**

Current evidence:

- [../../supabase/functions/_shared/redeemAccessCode.test.ts](../../supabase/functions/_shared/redeemAccessCode.test.ts)
- [../../supabase/functions/_shared/adminManageAccessCodes.test.ts](../../supabase/functions/_shared/adminManageAccessCodes.test.ts)

Covered now:

- valid redemption
- invalid code
- expired code
- exhausted code
- inactive code
- already redeemed behavior
- issuance authorization
- management authorization
- issuance storage behavior
- deactivate behavior

## Current Risk Assessment

| Area | Status | Risk |
| --- | --- | --- |
| Redemption backend | Implemented | Low |
| Redemption UI | Implemented | Low |
| Admin issuance tooling | Deployed and public-host verified | Low |
| Admin deactivate flow | Deployed and public-host verified | Low |
| Operator runbook | Implemented and exercised in QA | Low |
| Targeted tests | Implemented in repo | Low |
| Live verification | Completed on the public production host | Low |

## Phase-1 Model

Phase-1 redeem codes are:

- complimentary Power-access codes
- not Stripe coupons
- not promotion codes
- not billing discounts

Current repo behavior stays aligned to the existing complimentary-access model:

- redemption sets complimentary Power access on the profile
- redemption remains server-side only
- client-side checks remain advisory only

## Minimum Remaining Steps Before Real Distribution

1. Confirm support follows the operator runbook.
2. Distribute the first real batch in small controlled slices.
3. Re-run the QA proof if the frontend or access-code surface changes again before the next batch.

## Smallest Acceptable Phase-1 Ops Model

What the repo now supports:

- admin-only server-side issuance
- admin-only inventory visibility
- admin-only deactivation
- authenticated end-user redemption
- one-time raw-code reveal at issuance time
- auditability through code and redemption records

What is still not acceptable operationally:

- distributing codes before the admin path is deployed
- storing raw codes in public docs, tickets, or long-lived chat threads
- using billing or Stripe language for these codes
- bypassing the code system by manually toggling profiles while pretending it is the same flow

## Bottom Line

The repo now supports a real phase-1 complimentary access code system.

More precise wording:

- **Repo-ready:** yes
- **Production backend ready:** yes
- **Public production frontend ready:** yes

The remaining work is now operational, not implementation work: follow the operator runbook, keep distribution controlled, and rerun the QA proof if the frontend or access-code surface changes again.
