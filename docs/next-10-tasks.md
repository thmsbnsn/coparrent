# CoParrent Next 10 Tasks

Ranked by immediate value after the March 19, 2026 cleanup pass that restored a clean local build, brought lint to zero warnings, raised the regression suite to 44 tests, removed stale runtime URLs, split the frontend into lazy-loaded route chunks, and added `npm run verify`.

## 1. Verify invite acceptance end-to-end

Owner: User-assisted

- Create a fresh co-parent invite and accept it with a clean account
- Create a fresh third-party invite and accept it with a clean account
- Confirm both users land in the inviter's existing family
- Confirm they do not create duplicate family records during onboarding
- Confirm family-scoped gates work immediately after acceptance

## 2. Restore or replace Lovable-backed AI configuration

Owner: User-assisted

- Restore or confirm `LOVABLE_API_KEY` for `nurse-nancy-chat`, `generate-coloring-page`, and `kid-activity-generator`
- Decide whether those functions should stay on Lovable or move to another provider
- Confirm any image-generation secrets required by `generate-coloring-page`
- Re-test all Lovable-backed AI flows after restoration

## 3. Run a full billing verification path

Owner: User-assisted

- Purchase Power in a controlled test
- Confirm Stripe webhook updates the profile correctly
- Confirm `useSubscription` reflects the live tier
- Confirm gated features unlock
- Confirm customer portal, cancellation, and past-due flows behave correctly

## 4. Validate push notifications and PWA behavior on real devices

Owner: User-assisted

- Verify subscription registration works
- Verify iOS PWA install flow
- Verify Android and desktop push delivery
- Verify admin push tester works against current config
- Confirm payload privacy rules hold on-device

## 5. Re-enable or tighten temporary QA exceptions

Owner: User-assisted

- Re-enable Supabase auth captcha after auth QA is complete
- Decide whether `ALLOW_LOCALHOST_ORIGINS=true` can be turned back off
- Confirm no preview or test flows still depend on those allowances
- Document the final rollback or retention decision

## 6. Operationalize the access-code beta path

Owner: User-assisted

- Define who can issue codes and where issuance is audited
- Decide whether codes stay closed-beta only or support broader launch outreach
- Document the verified code format and redemption behavior
- Decide whether code creation remains manual in Supabase or gets a product UI later

## 7. Expand regression and smoke coverage further

Owner: Codex

- Add smoke coverage for family switching and parent-only redirects
- Add verification around premium gating from real subscription payload shapes
- Add smoke coverage for post-login cross-route behavior after onboarding completes
- Add a thin Playwright smoke pass once the current preview target is agreed

## 8. Clean deployment and environment hygiene

Owner: Mixed

- Confirm which local env files are still authoritative
- Archive or delete stale env references like `_(2).env`
- Document the clean `supabase functions deploy` path
- Keep local-only and production env expectations separate

## 9. Add automated security regression checks

Owner: Codex

- Extend the current `securityAssertions` coverage into family role changes and admin-only paths
- Add tests around trial expiry and premium gating edge cases
- Re-verify push tooling and AI CORS/origin rules stay server-enforced
- Re-check secret-handling assumptions after provider decisions are final

## 10. Keep performance drift in check

Owner: Codex

- Watch the largest vendor chunks as features change
- Add a lightweight size-budget check if chunk growth starts regressing
- Keep route-level lazy loading intact as new pages/components are added
- Re-check PDF and chart vendor boundaries before the next production deploy
