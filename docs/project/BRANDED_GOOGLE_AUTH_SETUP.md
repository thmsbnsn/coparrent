# Branded Google Auth Setup

This project currently uses the default Supabase project domain `https://jnxtskcpwzuxyxjzqrkv.supabase.co` for Auth. That is why Google's account chooser currently says:

`to continue to jnxtskcpwzuxyxjzqrkv.supabase.co`

That text will not change from frontend code alone. The fix is to activate a Supabase custom domain for Auth and then point the app at that branded domain.

Official references:
- https://supabase.com/docs/guides/auth/social-login/auth-google
- https://supabase.com/docs/guides/platform/custom-domains

## Current Blocker

The current Supabase organization for this project is on the `Free` plan. Supabase's current docs state that both:
- custom domains
- vanity subdomains

require a paid organization.

That means the Google chooser cannot be changed away from `jnxtskcpwzuxyxjzqrkv.supabase.co` until the Supabase org is upgraded.

What can still be branded right now:
- Google app name
- Google app logo
- support email
- privacy policy URL
- terms URL

What cannot be branded yet on the current plan:
- the `to continue to ...` domain line in Google's chooser

## What We Want

Recommended branded auth domain:
- `auth.coparrent.com`

Current Supabase project domain:
- `jnxtskcpwzuxyxjzqrkv.supabase.co`

Current Google OAuth callback:
- `https://jnxtskcpwzuxyxjzqrkv.supabase.co/auth/v1/callback`

Target branded Google OAuth callback:
- `https://auth.coparrent.com/auth/v1/callback`

Public app callback after Supabase:
- `https://coparrent.com/auth/callback`

## Important Scope Note

The Google Auth docs section about Services IDs / Google pre-built buttons is not the fix for the `supabase.co` text in the current Google chooser. That section is useful if we later add One Tap or Google's pre-built sign-in UI, but the current branding problem is the Supabase Auth callback domain itself.

For this app's current `signInWithOAuth` flow, the branded fix is:
- create a Supabase custom domain
- add the new callback URI to Google
- activate the domain
- update the frontend Supabase URL

## Why This Repo Is Ready

The app is already set up to switch cleanly once the custom domain exists:
- [client.ts](/E:/Files/.coparrent/src/integrations-supabase/client.ts) reads `VITE_SUPABASE_URL`
- [authRedirects.ts](/E:/Files/.coparrent/src/lib/authRedirects.ts) already resolves the app callback host dynamically
- [SocialLoginButtons.tsx](/E:/Files/.coparrent/src/components/auth/SocialLoginButtons.tsx) already uses the shared callback helper

No new application code is required just to make Google's chooser show a branded domain.

## Step 1. Register The Custom Domain In Supabase

Use either the Supabase dashboard custom-domain flow or the CLI. The CLI shape from Supabase docs is:

```powershell
supabase domains create --project-ref jnxtskcpwzuxyxjzqrkv --custom-hostname auth.coparrent.com
```

Supabase will ask for:
- a `CNAME` pointing `auth.coparrent.com` to the Supabase project domain
- a TXT record for `_acme-challenge.auth.coparrent.com`

## Step 2. Add The DNS Records In Namecheap

Expected permanent record:
- `CNAME`
- `Host`: `auth`
- `Value`: `jnxtskcpwzuxyxjzqrkv.supabase.co`

Temporary validation record:
- `TXT`
- `Host`: `_acme-challenge.auth`
- `Value`: `<token returned by Supabase>`

Notes:
- Keep TTL low if Namecheap allows it.
- Namecheap host fields should usually be entered without the full root domain.
- Do not remove the existing `@` or `www` records for the public app.

## Step 3. Reverify And Wait For SSL

After the DNS records exist, reverify the domain until Supabase finishes issuing SSL.

CLI shape from Supabase docs:

```powershell
supabase domains reverify --project-ref jnxtskcpwzuxyxjzqrkv
```

Supabase notes that certificate issuance can take up to about 30 minutes after DNS is correct.

## Step 4. Update Google Before Activation

Before activating the custom domain, update the Google OAuth web client in Google Cloud and keep both callback URIs during the cutover:

- `https://jnxtskcpwzuxyxjzqrkv.supabase.co/auth/v1/callback`
- `https://auth.coparrent.com/auth/v1/callback`

Do this in:
- Google Cloud Console
- APIs & Services
- Credentials
- the OAuth 2.0 Web Client used by Supabase Google Auth

Also confirm the OAuth branding screen is complete:
- app name: `CoParrent`
- app logo
- home page: `https://coparrent.com`
- privacy policy URL
- terms URL
- support email

This improves the Google experience, but the chooser still will not stop showing `supabase.co` until the Supabase custom domain is activated.

## Step 5. Activate The Supabase Custom Domain

Once DNS is validated and Google already allows the new callback, activate the domain in Supabase.

CLI shape from Supabase docs:

```powershell
supabase domains activate --project-ref jnxtskcpwzuxyxjzqrkv
```

Supabase's custom-domain docs note two important things after activation:
- the original project domain still keeps working
- Auth starts advertising the custom domain callback immediately

That is the step that changes Google's chooser text away from the raw Supabase project domain.

## Step 6. Update Frontend Env Values

After activation, update the frontend Supabase URL anywhere the browser client is created.

Local / Vercel frontend value:

```env
VITE_SUPABASE_URL=https://auth.coparrent.com
```

Keep these the same:
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`

Public app URLs should remain:

```env
VITE_PUBLIC_APP_URL=https://coparrent.com
APP_URL=https://coparrent.com
PUBLIC_APP_URL=https://coparrent.com
SITE_URL=https://coparrent.com
```

These are the browser/app URL constants. The current launch docs now treat `https://coparrent.com` as canonical. `https://www.coparrent.com` still serves the same app today, but it is a non-canonical alias rather than the preferred public URL.

For now, backend tooling and Supabase CLI/runtime values can stay on the default project URL unless there is a deliberate reason to migrate them too. The current app only needs the browser client switched to get the branding benefit.

## Step 7. Redeploy Vercel

After `VITE_SUPABASE_URL` changes:
- redeploy preview
- redeploy production

This ensures the browser actually starts Auth through `https://auth.coparrent.com` instead of the old project domain.

## Step 8. Verify The Result

Expected result:
- Google chooser should say `to continue to auth.coparrent.com`
- not `to continue to jnxtskcpwzuxyxjzqrkv.supabase.co`

Test these flows:
- Google sign-in from `https://coparrent.com/login`
- Google sign-in from a preview deployment
- normal email/password login
- forgot-password
- signup email confirmation
- invite acceptance after auth callback

## Rollback Plan

If there is a problem during rollout:
1. Leave both Google callback URIs registered.
2. Change `VITE_SUPABASE_URL` back to `https://jnxtskcpwzuxyxjzqrkv.supabase.co`.
3. Redeploy Vercel.
4. Keep the custom domain in Supabase inactive until the issue is understood.

Because Supabase keeps the original project domain active, rollback is straightforward.

## Ready-To-Do Checklist

- [ ] Upgrade the Supabase organization from `Free` to a paid plan
- [ ] Register `auth.coparrent.com` in Supabase
- [ ] Add Namecheap `CNAME auth -> jnxtskcpwzuxyxjzqrkv.supabase.co`
- [ ] Add Namecheap `_acme-challenge.auth` TXT token from Supabase
- [ ] Reverify until SSL is issued
- [ ] Add `https://auth.coparrent.com/auth/v1/callback` to the Google OAuth client
- [ ] Keep the old Supabase callback during the cutover
- [ ] Activate the custom domain in Supabase
- [ ] Change Vercel `VITE_SUPABASE_URL` to `https://auth.coparrent.com`
- [ ] Redeploy preview and production
- [ ] Verify Google's chooser now shows the branded auth domain
