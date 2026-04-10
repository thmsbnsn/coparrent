# CoParrent Redeem Code Operator Runbook

Last updated: 2026-04-10

This runbook covers phase-1 complimentary Power-access codes only.

These codes are:

- complimentary access codes
- not Stripe coupons
- not Stripe promotion codes
- not billing discounts

## Preconditions

Do not mint or distribute any code until all of the following are true:

- `admin-manage-access-codes` is deployed to the target Supabase project
- the current frontend bundle with the inactive-code error-handling fix is deployed to the target host
- the operator is signed in with an admin account
- the target environment has already passed current auth and onboarding verification
- support knows how to respond to invalid, expired, exhausted, and inactive-code cases

## Current Verified State

As of 2026-04-10:

- `admin-manage-access-codes` is deployed to production Supabase project `jnxtskcpwzuxyxjzqrkv`
- production-backed QA proved issuance, inventory visibility, redemption, and deactivation
- that proof used the current local client against the production backend because the public production frontend bundle still needs a clean deploy to expose the new admin access-code UI

Do not treat the public production host as verified for this feature until that frontend deploy is complete.

## Exact Apply Step

Use the project ref explicitly. Do not rely on the repo's local Supabase link state.

```powershell
supabase functions deploy admin-manage-access-codes --project-ref jnxtskcpwzuxyxjzqrkv
```

No new feature-specific secrets were required for this function beyond the existing Supabase runtime env already used by production.

## How To Mint A Code

1. Sign in as an admin.
2. Open the admin dashboard.
3. Open the `Access Codes` tab.
4. Fill in the issuance form.
5. Click `Issue code` or `Issue codes`.
6. Copy the raw code output immediately.
7. Store the raw codes in the approved operator-only handoff location.
8. Dismiss the raw-code panel after copying.

Raw codes are shown once at issuance time. The management list will only show preview and metadata after that point.

## Metadata To Set

Set the metadata deliberately. Do not improvise it.

- `Label`: Short operational name for the batch or campaign.
  Example: `Pilot Cohort April`
- `Access reason`: Exact reason that should land on the profile when redeemed.
  Example: `phase_1_complimentary_power`
- `Audience`: Use the closest audience tag available.
  Example: `partner`, `friend`, `family`, `promoter`, or `custom`
- `Redemption limit`: Default to `1` unless there is a specific reason to allow shared multi-redemption use.
- `Quantity`: Default to the smallest batch you actually need.
- `Expiration`: Set a real expiration for any limited campaign. Leave blank only when that is a conscious decision.

## Safe Distribution Rules

Do:

- distribute only the raw code, not screenshots of the admin dashboard
- send codes only through the approved recipient channel
- keep a separate operator record of who received which code or batch
- start with very small batches

Do not:

- paste raw codes into public Slack channels, issue trackers, or shared docs
- share the admin inventory table as a substitute for sending the raw code
- describe these as billing discounts
- issue large batches before one QA redemption is proven clean

## How To Deactivate A Code

1. Open the admin dashboard.
2. Open the `Access Codes` tab.
3. Find the code by preview, label, audience, or state.
4. Click `Deactivate`.
5. Confirm the action.
6. Refresh the inventory and confirm the code now shows `Inactive`.

Deactivation stops future redemption immediately. It does not remove complimentary access from users who already redeemed the code.

## Support Handling

### Invalid code

User-facing meaning:

- the entered code does not match a stored code
- or the user entered it incorrectly

Support action:

1. Ask the user to copy and paste the code exactly.
2. Confirm the intended code was actually issued.
3. If the code was mistyped in distribution, replace it with the correct code.
4. If the code was never issued, do not guess. Escalate to the operator who distributed it.

### Expired code

User-facing meaning:

- the code existed but is past its expiration

Support action:

1. Confirm the expiration was intentional.
2. If access should still be granted, issue a replacement code instead of reactivating the expired one blindly.

### Exhausted code

User-facing meaning:

- the code hit its redemption limit

Support action:

1. Confirm whether the limit was intentional.
2. If additional redemptions are approved, issue a new code.
3. Do not increase limits ad hoc without an explicit operator decision.

### Inactive code

User-facing meaning:

- the code was deliberately deactivated

Support action:

1. Confirm whether the deactivation was intentional.
2. If the user should still receive access, issue a replacement code.
3. Do not reactivate by manual DB editing during normal support flow.

## QA Proof Steps For One Real End-To-End Redemption

Run this before sending any real external batch.

1. Sign in as an admin in the target environment.
2. Mint one single-use code with a clear QA label.
3. Copy the raw code and dismiss the one-time reveal.
4. Open a separate QA user account.
5. Navigate to Settings and redeem the code through the normal user UI.
6. Confirm the UI returns a success or already-redeemed result from the server.
7. Confirm the profile now shows complimentary Power access under the existing subscription/access model.
8. Return to the admin dashboard and confirm the code inventory reflects the redemption count.
9. Issue a second QA code, deactivate it, and confirm a separate QA user sees the inactive-code message if they try to redeem it.
10. Record the result in the launch evidence log or QA record.

Expected inactive-code message on a current build:

- `That access code is no longer active.`

If a QA user instead sees a generic edge-function transport error on the frontend, stop and verify that the target host is serving the current frontend bundle.

## What Not To Do

Do not:

- generate codes outside the server path
- generate final codes in the browser
- store raw codes in the database
- expose raw codes in the admin inventory list
- use this system as a Stripe discount substitute
- manually toggle `free_premium_access` for code campaigns unless you are doing break-glass remediation and documenting it as such
- distribute a batch without first proving one end-to-end redemption in the target environment

## Break-Glass Rule

If the code system is unavailable during a live support incident:

1. Stop new code distribution.
2. Escalate to engineering.
3. If a user must be unblocked immediately, use the existing admin user-access override only as a documented exception.
4. Record who was manually granted access and why.
5. Do not call that a successful redeem-code flow.
