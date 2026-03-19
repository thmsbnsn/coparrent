# CoParrent Recovery File List

This workspace is the only active copy to keep working from.

## Recreated in this workspace

- `src/components/help/HelpPage.tsx`
- `src/pages/help/topics.tsx`
- `src/pages/help/HelpGettingStarted.tsx`
- `src/pages/help/HelpScheduling.tsx`
- `src/pages/help/HelpMessaging.tsx`
- `src/pages/help/HelpDocuments.tsx`
- `src/pages/help/HelpExpenses.tsx`
- `src/pages/help/HelpAccount.tsx`
- `src/pages/help/HelpPrivacy.tsx`
- `src/pages/help/HelpTrialEnding.tsx`
- `src/pages/help/HelpScheduleChangeRequests.tsx`
- `src/pages/help/HelpInvitations.tsx`
- `src/pages/help/HelpDocumentExports.tsx`
- `src/pages/help/HelpSchedulePatterns.tsx`
- `src/pages/help/HelpContact.tsx`
- `src/pages/help/HelpSecurity.tsx`
- `src/pages/PWADiagnosticsPage.tsx`
- `src/integrations/supabase/client.ts`
- `src/integrations/supabase/types.ts`
- `src/contexts/FamilyContext.tsx`
- `src/components/family/FamilySwitcher.tsx`
- `src/components/admin/AdminPushTester.tsx`
- `src/components/messages/CourtViewToggle.tsx`
- `src/components/messages/DeliberateComposer.tsx`
- `src/components/messages/EvidencePanel.tsx`
- `src/components/messages/ThreadSummaryBar.tsx`
- `src/hooks/useChoreCharts.ts`
- `src/components/chores/HouseholdToggle.tsx`
- `src/components/chores/ChoreListEditor.tsx`
- `src/components/chores/ChoreChartView.tsx`
- `src/components/chores/ChoreChartExport.tsx`
- `src/components/onboarding/CreationsPrivacyTooltip.tsx`
- `src/components/settings/AccessCodeRedeemer.tsx`

## Source recovery status

All previously confirmed missing imports have now been restored in this workspace.

Latest verification:

- `npm run build` succeeds as of March 13, 2026
- output includes `dist/assets/index-DTnygDj4.js`
- output includes `dist/assets/index-954hyO-c.css`
- PWA build also generates `dist/sw.js` and `dist/workbox-5ed99a37.js`

## Remaining recovery caveats

The workspace now compiles, but some recovered areas are pragmatic reconstructions rather than recovered originals:

- `src/components/admin/AdminPushTester.tsx` is rebuilt around the current push hook and self-targeted `send-notification` testing
- the messaging hub UI components were rebuilt to preserve the intended court-ready structure
- the chore chart stack was rebuilt as a local-storage-backed feature because no surviving server-side chore schema was found in this checkout
- `src/components/onboarding/CreationsPrivacyTooltip.tsx` was recreated as a one-time privacy explainer
- the access-code system is now recovered into the repo from production, and the user-facing redemption UI in Settings has been exercised end to end with a fresh tester account

## Environment and config notes

- Vercel production currently has these confirmed frontend variables configured:
  - `VITE_STRIPE_PUBLISHABLE_KEY`
  - `VITE_STRIPE_POWER_PRICE_ID`
  - `VITE_STRIPE_POWER_PRODUCT_ID`
  - `VITE_VAPID_PUBLIC_KEY`
- The deployed Vercel publishable key is a `pk_live_...` key, so the frontend production environment is using live Stripe mode.
- Stripe dashboard verification on March 13, 2026 confirms:
  - active product: `CoParrent Power`
  - live product ID: `prod_TwwA5VNxPgt62D`
  - live recurring price ID: `price_1Sz2IZHpttmwwVs1H4deOgQe`
- `src/lib/stripe.ts`, `supabase/functions/create-checkout/index.ts`, `supabase/functions/check-subscription/index.ts`, and `supabase/functions/stripe-webhook/index.ts` all currently include the active live Power IDs.
- Legacy live and test IDs are still intentionally preserved in code for subscriber migration safety.
- New backend consistency finding from March 13, 2026:
  - Vercel production frontend env points at project `jnxtskcpwzuxyxjzqrkv`
  - local `.env` also points at `jnxtskcpwzuxyxjzqrkv`
  - `_(2).env` was found pointing at old project `znxiydmycxcjkflihfxn`
  - `supabase/config.toml` originally pointed at old project `znxiydmycxcjkflihfxn` and has now been corrected to `jnxtskcpwzuxyxjzqrkv`
- Supabase CLI is authenticated and can list projects/functions for `jnxtskcpwzuxyxjzqrkv`.
- `supabase secrets list --project-ref jnxtskcpwzuxyxjzqrkv` currently returns `403 Forbidden`, so CLI-based secret inspection is still blocked by project permissions or token scope.
- Production-only backend drift recovered on March 13, 2026:
  - `supabase/functions/send-push/index.ts`
  - `supabase/functions/redeem-access-code/index.ts`
  - `supabase/migrations/20260313120000_recover_access_code_system.sql`
  - `supabase/migrations/20260313133000_recover_rpc_add_child.sql`
- Live access-code findings from production:
  - `redeem-access-code` delegates grant logic to `public.rpc_redeem_access_code(text)`
  - codes are stored hashed via SHA-256 of the upper-trimmed code
  - redemption checks enforce `active`, `expires_at`, `max_redemptions`, and duplicate prevention
  - successful redemption grants `free_premium_access = true`, `subscription_status = 'active'`, and `subscription_tier = 'power'`
- Controlled beta verification completed on March 13, 2026:
  - created production code `BETA-0313-PWR-ALPHA`
  - created tester auth user `coparrenttesting@yahoo.com`
  - confirmed profile changed from `none/free/false` to `active/power/true`
  - confirmed a redemption row was written and `redeemed_count` incremented to `1`
  - confirmed the second redemption attempt returns `ALREADY_REDEEMED`
- Production bug found and fixed on March 13, 2026:
  - the live `rpc_redeem_access_code` function originally failed because it called unqualified `digest(...)` while `digest` exists in the `extensions` schema
  - the repo migration now uses `extensions.digest(...)`
  - the production function was patched to the same qualified call during verification
- QA fixes verified on March 13, 2026:
  - the shared edge-function CORS policy now accepts localhost when `ALLOW_LOCALHOST_ORIGINS=true`
  - that secret flag was set in the production Supabase project for controlled local QA
  - `check-subscription`, `login-notification`, `redeem-access-code`, `send-coparent-invite`, `create-checkout`, `customer-portal`, and `send-push` were redeployed with the updated CORS helper
  - local preview now reaches the production backend cleanly for subscription and login-notification flows
  - onboarding child creation now succeeds after correcting the frontend RPC argument from `p_date_of_birth` to `p_dob`
- Fresh-account access-code verification completed on March 13, 2026:
  - second tester account `testingcoparrent@yahoo.com` was confirmed in Supabase Auth and signed into the local preview
  - created production code `BETA-0313-PWR-BRAVO`
  - initial in-app redemption exposed a backend bug in `supabase/functions/redeem-access-code/index.ts`
  - root cause: the edge function authenticated the request, then called `rpc_redeem_access_code` with the service-role client, which stripped `auth.uid()` and caused `AUTH_REQUIRED`
  - fixed by calling the RPC through the authenticated client instead
  - redeployed the patched `redeem-access-code` function to production
  - reran the same redemption through the Settings UI and confirmed the account upgraded to complimentary Power with `Beta Tester` reason
  - immediate repeat redemption now returns `ALREADY_REDEEMED`
- Family bootstrap verification completed on March 13, 2026:
  - production SQL now ensures parent and guardian accounts bootstrap a family membership before family-scoped gates run
  - local app verification confirmed the parent tester no longer hits `No family selected` or `Parent Access Only` on Nurse Nancy after a fresh load
  - a newly created co-parent invitation was verified in production SQL with the same `family_id` as the inviter
  - full co-parent and third-party acceptance regression testing is still pending
- Remaining backend gap:
  - CLI secret inspection is still blocked, but dashboard inspection on March 13, 2026 confirmed these production Edge Function secrets exist: `RESEND_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_POWER_PRODUCT_ID`, `STRIPE_POWER_PRICE_ID`, `STRIPE_ALLOWED_PRICE_IDS`, `OPENROUTER_API_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `SUPPORT_EMAIL`, `ALLOWED_ORIGINS`, and `ALLOW_LOCALHOST_ORIGINS`
  - `LOVABLE_API_KEY` was not present on the production Edge Function secrets page when searched directly
  - because `nurse-nancy-chat`, `generate-coloring-page`, and `kid-activity-generator` all require `LOVABLE_API_KEY`, those AI features should be treated as high-risk or currently broken until runtime-tested or the secret is restored
  - the root repo `.env` file still contains malformed content for direct Supabase CLI deploys, so deployments currently need either a clean temp workdir or an env-file cleanup
  - Supabase auth captcha was disabled temporarily for QA and should be re-enabled after testing

## AI configuration notes

- `ai-message-assist` uses OpenRouter with model `google/gemini-2.0-flash-exp:free`
- `ai-schedule-suggest` uses OpenRouter with model `google/gemini-2.0-flash-exp:free`
- `nurse-nancy-chat` uses Lovable AI Gateway with model `google/gemini-3-flash-preview`
- `generate-coloring-page` uses `google/gemini-2.5-flash-image-preview`
- `kid-activity-generator` uses `google/gemini-3-flash-preview`
- `README.md` AI model notes are partly stale because they do not reflect the current multi-model setup across all AI functions

## Notes

- Duplicate project folders outside this workspace were moved to the Recycle Bin to keep this repo as the only active copy.
- The next phase is no longer file recovery. It is verification: billing truth, AI behavior, push delivery, security checks, and documentation cleanup.
