# CoParrent - Modern Co-Parenting Custody Toolkit

<p align="center">
  <img src="src/assets/coparrent-logo.svg" alt="CoParrent Logo" width="200"/>
</p>

**CoParrent** is a comprehensive web application designed to help separated or divorced parents manage their co-parenting responsibilities with ease. The platform provides smart scheduling, secure messaging, document management, and court-ready exports to reduce conflict and keep children's well-being at the center.

---

## 📋 Table of Contents

- [Project Summary](#-project-summary)
- [Tech Stack](#-tech-stack)
- [Typography & Design System](#-typography--design-system)
- [3rd Party Connections](#-3rd-party-connections)
- [AI Assistant](#-ai-assistant)
- [Features & Components](#-features--components)
- [Application Wire Tree](#-application-wire-tree)
- [Database Schema](#-database-schema)
- [Getting Started](#-getting-started)
- [Incomplete Tasks / TODO](#-incomplete-tasks--todo)

---

## 🎯 Project Summary

CoParrent helps co-parents:

- **Coordinate custody schedules** with visual calendars showing each parent's time
- **Communicate securely** through the Messaging Hub with group and direct messaging (court-admissible)
- **Share children's information** including medical records, school details, and emergency contacts
- **Store and share documents** with access logging for legal purposes
- **Manage schedule changes** with formal request/approval workflows
- **Invite third-party members** (step-parents, grandparents, babysitters) via email invitation

The application is designed with a **calm, professional, court-friendly aesthetic** using navy blue and sage green as primary colors to reduce stress during what can be a difficult time.

---

## Design Principles

CoParrent is built around a small set of non-negotiable design principles that guide architecture, UX decisions, and feature boundaries:

- **Child-first clarity over convenience**  
- **Server-enforced rules over client trust**  
- **Documentation over memory**  
- **Private by default, share by choice**  
- **Calm, neutral UX over adversarial workflows**

These principles intentionally shape decisions such as role-based access, gated features, and private ownership of generated content.

---

## Data Ownership & Privacy Model

CoParrent uses a **family-scoped operational model** with **private-by-default owned content**:

- Shared family records are bound to a specific `family_id`.
- Private creations and generated content remain owner-scoped until explicitly shared.
- Content is **private by default**.
- Sharing is **explicit and revocable** per item.
- Shared access is **read-only** unless otherwise stated.
- No content is publicly accessible or indexed.

This model applies to schedules, requests, documents, messaging, and Kids Hub creations.

## Family-Scoped Architecture

Family-scoped features use `activeFamilyId` in the client and explicit `family_id` on the server as the single source of scope.

- Core reads, writes, notifications, and AI authorization do not infer family context from legacy profile relationships or global account assumptions.
- Multi-family users must operate inside an explicitly selected family context for every family-scoped action.
- Cross-family inference is not allowed. If a request does not carry clear family scope, it should not proceed.

---

## Feature Maturity Levels

Not all features evolve at the same pace. CoParrent tracks feature maturity explicitly:

| Feature | Status |
|------|------|
| Messaging | Stable |
| Calendar | Stable |
| Document Vault | Stable |
| Court Exports | Stable (v1) |
| Kids Hub – Activities | Stable |
| Kids Hub – Coloring Pages | Stable |
| Nurse Nancy | Support Tool (Non-diagnostic) |
| PWA & Push Notifications | Backend ready; real-device validation pending |

---

## PWA Support

CoParrent is a Progressive Web App (PWA) with the install flow, backend plumbing, and push registration path in place. Real-device validation is still pending before this should be marketed as fully verified:

| Platform | Installation | Push Notifications |
|----------|-------------|-------------------|
| **Android** | Install via browser "Add to Home Screen" | Ready in code; live device verification pending |
| **iOS 16.4+** | Add to Home Screen via Safari Share button | Ready in code; live device verification pending |
| **Desktop** | Install via browser address bar icon | Ready in code; live device verification pending |

### Enabling Push Notifications

1. Navigate to **Settings → Notifications**
2. Tap **Enable Notifications**
3. Grant permission when prompted
4. Verify status shows "Subscribed"

**iOS Users:** You must install the app to your Home Screen first. Safari browser mode does not support push.

### Verifying PWA Health

Internal diagnostics available at `/pwa-diagnostics` (authenticated users only) shows:
- Service worker status
- Push subscription state
- Platform detection
- Backend health

---

## Operational Guarantees

The following guarantees are enforced by design:

- Plan limits are enforced **server-side**
- Role permissions are enforced via **Row Level Security (RLS)**
- Exported documents are **deterministic**
- Private data is never auto-shared
- Deletions respect defined retention rules

---

## What CoParrent Is Not

To avoid misuse or misinterpretation:

- CoParrent is **not** a replacement for legal counsel
- CoParrent is **not** a medical advice platform
- CoParrent is **not** an emergency communication system
- CoParrent is **not** a surveillance or monitoring tool

For exact access rules and plan enforcement, see **`docs/security/GATED_FEATURES.md`**.
For security architecture, see **`docs/security/SECURITY_MODEL.md`**.

---

## 🧭 Project State

**Current Maturity:** Release-candidate — this section is a direct summary of `docs/project/CURRENT_STATUS.md` and should not diverge from it.

**Current Phase:** Stabilization + Production Verification  
**Environment:** Vercel + Supabase  
**Stripe Mode:** Live  
**Production Supabase Project:** `jnxtskcpwzuxyxjzqrkv`  
**Last Verified Build:** 2026-03-28
**Verified By:** Codex local verification (`npm run verify`) plus live production smoke and evidence-backed feature checks
**Last README Update:** 2026-03-29

> **Note:** The `Last Verified Build` and `Verified By` fields must be updated whenever a behavioral or architectural change is made.

### Done and Verified

- Local `npm run build`, `npm run lint`, `npm run test`, and `npm run verify` all pass.
- Local tests currently pass with **30** test files and **119** targeted regression tests.
- `https://www.coparrent.com` is serving the current pushed `origin/main` production build.
- The public marketing surface, mobile dashboard, Messaging Hub, and Daily calling flow have all been hardened through late-March verification passes.
- Messaging Hub thread creation, direct-message hydration, and live Daily audio/video calling are verified against the deployed backend.
- Google sign-in and forgot-password both work on production `https://www.coparrent.com`.
- Stripe checkout, webhook gating, and customer portal are verified live.
- OpenRouter-backed AI runtime is verified live for Nurse Nancy, activity generation, and coloring-page generation.
- `problem_reports` is live in production, including the optional screenshot-upload path.
- A fresh production smoke pass completed cleanly on March 28, 2026 across home, login, invite landing, dashboard, and Messaging Hub.

### Still Risky

- Real-device push/PWA validation on iPhone, Android, and desktop is still open.
- Passkeys are not live because hosted Supabase for this project does not yet expose WebAuthn/passkey enrollment.
- Repo-side production auth now requires captcha by default; deployed environments still need valid hCaptcha configuration.
- `https://coparrent.com` apex DNS/certificate cutover should still be treated as settling; `https://www.coparrent.com` remains the canonical public URL.

### Left Before Sale

- Complete real-device push/PWA proof with screenshots and evidence.
- Decide final passkey posture while Supabase still lacks hosted WebAuthn for this project.
- Confirm deployed auth captcha configuration and finalize any remaining localhost-origin exceptions.
- Finish env/config hygiene cleanup around stale local-only files and references.

For the current operational snapshot, see **`docs/project/CURRENT_STATUS.md`**.

---

## 🚀 Migration Notes

### Plan Structure Update (January 2026)

CoParrent now uses a simplified two-tier plan structure:

| Plan | Price | Max Kids | Max Third-Party | Features |
|------|-------|----------|-----------------|----------|
| **Free** | $0 | 4 | 4 | Calendar, Messages, Child Info Hub, Documents, Kid Center, Law Library, Blog |
| **Power** | $5/month | 6 | 6 | Everything in Free + Expenses Tracking, Court Exports, Sports & Events Hub, AI Assist |

**Migration Notes:**
- Legacy tiers (Premium, MVP) automatically map to Power tier
- Existing subscribers retain Power access with no action required
- `src/lib/planLimits.ts` is the single source of truth for limits and feature flags
- All tier checks use `normalizeTier()` function to handle legacy values
- Power-only features: Expenses (`/dashboard/expenses`), Sports Hub (`/dashboard/sports`), Court Exports

### Server-Enforced Plan Limits (January 2026)

Plan limits are now enforced at the database level via RPC functions:

| RPC Function | Purpose | Error Codes |
|--------------|---------|-------------|
| `get_plan_usage(p_profile_id)` | Returns current usage and limits | N/A |
| `rpc_add_child(p_name, p_dob)` | Adds child with limit check | `LIMIT_REACHED`, `NOT_PARENT` |
| `rpc_create_third_party_invite(...)` | Creates third-party invite with limit check | `LIMIT_REACHED`, `NOT_PARENT`, `PROFILE_NOT_FOUND`, `FAMILY_SETUP_FAILED` |
| `rpc_revoke_third_party(p_invitation_id)` | Revokes third-party access | `NOT_PARENT` |

**Error Response Format:**
```json
{
  "ok": false,
  "code": "LIMIT_REACHED",
  "message": "You've reached the maximum children for your plan",
  "meta": { "tier": "free", "current": "4", "max": "4" }
}
```

**Frontend Integration:**
- `usePlanLimits()` hook provides usage data and convenience booleans
- `parseRpcResult()` and `getErrorMessage()` helpers for structured error handling
- Children page shows usage progress bar and disables Add button at limit

This section documents recent architectural changes for developers migrating or maintaining the codebase.

### Database Tables Added (January 2026)

| Table | Purpose | Migration File |
|-------|---------|---------------|
| `message_reactions` | Emoji reactions on thread messages | `20260119035212_*.sql` |
| `message_read_receipts` | Read status tracking per user | Earlier migration |
| `typing_indicators` | Real-time typing status | Earlier migration |
| `group_chat_participants` | Group chat membership | Earlier migration |

### Major Architectural Decisions

1. **Message Threading Model**: The messaging system uses `thread_messages` as the single source of truth. The legacy `messages` table remains for historical 1:1 co-parent messages but is deprecated for new features. See `useMessagingHub.ts` for the authoritative implementation.

2. **Thread Creation via Edge Function**: Messaging Hub prefers the `create-message-thread` edge function for server-side validation of family membership. Live thread creation has now been verified against the deployed backend, and the frontend exposes setup failures clearly when local QA or environment issues still block a thread.

3. **Unread Counts Architecture**: Unread counts are calculated by comparing `thread_messages` against `message_read_receipts`. Indicators respect `notification_preferences` settings.

4. **Mobile-First Messaging**: The messaging hub includes pull-to-refresh, swipe navigation between tabs, and touch-friendly emoji reactions.

### Files Recently Touched (March 2026)

| File | Changes |
|------|---------|
| `src/hooks/useMessagingHub.ts` | Messaging thread setup hardening, clearer failure handling, and local QA recovery paths |
| `src/hooks/useFamilyRole.ts` | Fixed `primaryParentId` to return the actual parent profile ID instead of the family UUID |
| `src/pages/MessagingHubPage.tsx` | Mobile header/action cleanup plus explicit setup and empty states |
| `src/pages/Dashboard.tsx` | Stronger mobile-first summary and action layout |
| `src/pages/ChildrenPage.tsx` | Better mobile tabs, action layout, and child-management guidance |
| `src/pages/ExpensesPage.tsx` | Improved mobile header, filter layout, and empty state |
| `src/pages/SportsPage.tsx` | Mobile polish for Sports Hub layout and actions |
| `src/pages/KidsHubPage.tsx` | Mobile polish for Kids Hub layout and navigation |
| `src/pages/KidCenterPage.tsx` | Fixed mobile select-state crash path |
| `src/pages/ActivitiesPage.tsx` | Fixed generator/select crash path and tightened mobile flow |
| `src/pages/Index.tsx` / `src/components/landing/HomeSections.tsx` | Expanded the public landing page with stronger proof, workflow, and CTA sections |
| `src/pages/About.tsx`, `src/pages/HelpCenter.tsx`, `src/pages/BlogPage.tsx`, `src/pages/BlogPostPage.tsx`, `src/pages/CourtRecordsPage.tsx`, `src/pages/PaymentSuccess.tsx` | Public-site content and structure upgrade for buyer/demo readiness |

### Known TODOs / Intentional Limitations

1. **Legacy `messages` Table**: Retained for backward compatibility with `MessagesPage.tsx`. New features should use `thread_messages`.

2. **Reaction Aggregation**: Reactions are fetched and aggregated client-side. Consider a database view for performance at scale.

3. **Typing Indicator Cleanup**: Uses polling (2-second interval) to clean stale indicators. This is intentional for simplicity but could be optimized.

4. **Search Result Highlighting**: Uses React-based text highlighting (not `dangerouslySetInnerHTML`) for security.

### Local Development

This project runs identically in local environments:

```bash
npm install
npm run dev
```

Required environment variables for local or deployed environments:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`

There are no remaining legacy hosted-runtime dependencies in the application code.

---

### Current Focus

- Validate push delivery on iOS, Android, and desktop with current production config
- Keep `https://www.coparrent.com` as the canonical public/demo target while the apex cutover settles
- Confirm deployed auth captcha configuration remains in place
- Decide the final post-QA posture for passkeys and localhost-origin handling
- Archive or remove stale env/config references like `_(2).env`

### Known Blocking Issues

- Real-device push/PWA validation is still incomplete.
- Passkeys remain unavailable until Supabase exposes hosted WebAuthn or the product posture changes.
- Deployed auth posture still needs config confirmation: keep captcha configured and review any localhost-origin exceptions.

_Last updated: 2026-03-29_

---

## 📊 Feature Completion Matrix

This section inventories the app's major features and systems with their current implementation status.

### Authentication & User Management

| Feature | Description | Status | Dependencies | Known Gaps | Risk |
|---------|-------------|--------|--------------|------------|------|
| Email/Password Auth | Standard authentication with email confirmation | ✅ Complete | Supabase Auth | None | Low |
| Google OAuth | Social login via Google | ✅ Complete | Google OAuth credentials, Supabase Auth | Branded auth domain is pinned until Supabase plan upgrade | Low |
| Apple OAuth | Social login via Apple | ⚠️ Partial | Apple OAuth credentials | Not tested in production | Medium |
| Password Reset | Forgot password flow via email | ✅ Complete | Resend (email) | None | Low |
| Session Management | Active session tracking and logout | ✅ Complete | None | Session invalidation on permission change | Low |
| Two-Factor Auth | TOTP-based 2FA setup | ✅ Complete | Supabase MFA, user_2fa_settings | None | Low |
| Device Trust | Trusted device management | ⚠️ Partial | user_devices table | Login notification triggers need validation | Medium |
| Recovery Codes | Backup codes for 2FA | ✅ Complete | manage-recovery-codes function, user_recovery_codes | None | Low |

### Family Membership & Invitations

| Feature | Description | Status | Dependencies | Known Gaps | Risk |
|---------|-------------|--------|--------------|------------|------|
| Co-Parent Invitation | Email-based invitation system | ✅ Complete | Resend, invitations table | None | Low |
| Invite Family Binding | Invite acceptance joins the explicit family from the invitation | ✅ Complete | `invitations.family_id`, `family_members` | None | Low |
| Third-Party Invitations | Invite step-parents, grandparents, etc. | ✅ Complete | `family_members`, `invitations.family_id` | Plan limits not enforced in RLS | Medium |
| Role Detection | Parent vs third-party role resolution | ✅ Complete | useFamilyRole hook | None | Low |
| Feature Gating | Route/feature restrictions by role | ✅ Complete | ProtectedRoute, RoleGate | Some edge cases may bypass | Medium |

### Child Account System

| Feature | Description | Status | Dependencies | Known Gaps | Risk |
|---------|-------------|--------|--------------|------------|------|
| Child Profile Creation | Create child records with medical/school info | ✅ Complete | children table, RPC | None | Low |
| Child Account Linking | Link auth account to child profile | ✅ Complete | profiles.linked_child_id | None | Low |
| Permission Controls | Parent manages child permissions | ✅ Complete | child_permissions table | Needs real-world testing | Low |
| Kids Dashboard | Child-specific dashboard view | ✅ Complete | KidsDashboard component | Limited features exposed | Low |
| Login Enable/Disable | Parent can disable child login | ✅ Complete | profiles.login_enabled | None | Low |
| COPPA Compliance | Default-off notifications, no tracking | ✅ Complete | N/A | Legal review pending | Medium |

### Youth Sports Hub

| Feature | Description | Status | Dependencies | Known Gaps | Risk |
|---------|-------------|--------|--------------|------------|------|
| Activity Management | Create/edit child activities | ✅ Complete | child_activities table | None | Low |
| Event Scheduling | Create games, practices, tournaments | ✅ Complete | activity_events table | None | Low |
| Calendar Integration | Sports events show in custody calendar | ✅ Complete | useSportsEvents hook | Visual differentiation could improve | Low |
| Map Navigation | Directions to venues (Google/Apple/Waze) | ✅ Complete | useMapNavigation hook | Requires native app links | Low |
| Parent Responsibilities | Assign drop-off/pick-up per event | ✅ Complete | activity_events columns | None | Low |
| Smart Reminders | Leave-by time calculations | ⚠️ Partial | sports-event-reminders function | Not tested with real users | Medium |
| Equipment Checklists | Track required gear per event | ✅ Complete | equipment_needed JSON | None | Low |

### AI Features

| Feature | Description | Status | Dependencies | Known Gaps | Risk |
|---------|-------------|--------|--------------|------------|------|
| Message Tone Analysis | Analyze message for hostile patterns | ✅ Complete | ai-message-assist function | None | Low |
| Message Rephrasing | AI rewrites for court-appropriate tone | ✅ Complete | ai-message-assist function | None | Low |
| Quick Tone Check | Local pattern matching (no AI call) | ✅ Complete | Frontend only | None | Low |
| Schedule Suggestions | AI-powered custody pattern recommendations | ✅ Complete | ai-schedule-suggest function | Limited pattern library | Low |
| Rate Limiting | Per-user daily AI request limits | ✅ Complete | ai_usage_daily table | Limit thresholds need tuning | Low |

### Payments & Subscriptions

| Feature | Description | Status | Dependencies | Known Gaps | Risk |
|---------|-------------|--------|--------------|------------|------|
| Stripe Checkout | Create checkout sessions | ✅ Complete | Stripe, create-checkout function | None | Low |
| Subscription Webhooks | Handle Stripe events | ✅ Complete | stripe-webhook function | None | Low |
| Customer Portal | Manage billing in Stripe | ✅ Complete | customer-portal function | None | Low |
| Trial System | 7-day trial tracking | ✅ Complete | profiles.trial_ends_at | Auto-downgrade not tested | Medium |
| Feature Gating | Power features locked by tier | ✅ Complete | PremiumFeatureGate, usePremiumAccess | None | Low |
| Plan Limits | Free (4 kids, 4 third-party) / Power (6/6) | ✅ Complete | planLimits.ts, getPlanLimits() | Limits need RLS enforcement | Medium |

### Notifications & Reminders

| Feature | Description | Status | Dependencies | Known Gaps | Risk |
|---------|-------------|--------|--------------|------------|------|
| In-App Notifications | Notification bell and list | ✅ Complete | notifications table | None | Low |
| Browser Push | Web push notifications | ⚠️ Partial | usePushNotifications hook, `send-push`, `sync-push-subscription` | Real-device validation still needed | Medium |
| iOS Push | iOS PWA push support | ⚠️ Partial | Service worker, Push API | Limited iOS Safari support | High |
| Email Notifications | Transactional emails | ⚠️ Partial | Resend, edge functions | Not all events trigger emails | Medium |
| Exchange Reminders | Custody exchange alerts | ✅ Complete | exchange-reminders function | Cron trigger needs setup | Medium |
| Sports Reminders | Activity event reminders | ✅ Complete | sports-event-reminders function | Cron trigger needs setup | Medium |

### Exports (PDF / Calendar)

| Feature | Description | Status | Dependencies | Known Gaps | Risk |
|---------|-------------|--------|--------------|------------|------|
| Message PDF Export | Export messaging thread to PDF | ✅ Complete | jspdf, pdfExport.ts | Formatting could improve | Low |
| Expense Report PDF | Generate expense reports | ✅ Complete | generate-expense-report function | None | Low |
| Calendar Export (ICS) | Export schedule to ICS format | ✅ Complete | calendarExport.ts | None | Low |
| Court-Ready Exports | Comprehensive legal documentation | ⚠️ Partial | Court export UI, PDF export pipeline | Export v1 shipped; broader legal certification/export package still a gap | Medium |

### Admin & Moderation

| Feature | Description | Status | Dependencies | Known Gaps | Risk |
|---------|-------------|--------|--------------|------------|------|
| Admin Dashboard | User management interface | ✅ Complete | AdminDashboard, user_roles | Limited functionality | Low |
| Role Management | Admin/moderator role assignment | ✅ Complete | user_roles table, has_role RPC | None | Low |
| Law Library Admin | Upload/manage legal resources | ✅ Complete | AdminLawLibraryManager | None | Low |
| Blog Management | Create/edit blog posts | ✅ Complete | blog_posts table | No preview before publish | Low |
| User Administration | View/manage users | ⚠️ Partial | admin-manage-users function | Limited actions available | Medium |

### Security Guards & Rate Limiting

| Feature | Description | Status | Dependencies | Known Gaps | Risk |
|---------|-------------|--------|--------------|------------|------|
| Row Level Security | Database access control | ✅ Complete | RLS policies | Complex policies need audit | Medium |
| Route Guards | Protected route enforcement | ✅ Complete | ProtectedRoute component | None | Low |
| AI Rate Limiting | Per-user AI request limits | ✅ Complete | aiRateLimit.ts, aiGuard.ts | None | Low |
| Function Rate Limiting | Edge function abuse prevention | ✅ Complete | functionRateLimit.ts | Not applied to all functions | Medium |
| hCaptcha | Bot protection on auth forms | ✅ Complete | Supabase attack protection | Deployed environments must keep it configured | Low |
| Input Validation | Zod schema validation | ✅ Complete | validations.ts | Not comprehensive | Medium |
| Audit Logging | Change tracking | ✅ Complete | audit_logs table, log_audit_event | Comprehensive audit trail for all child data access and modifications | Medium |

### PWA & Offline

| Feature | Description | Status | Dependencies | Known Gaps | Risk |
|---------|-------------|--------|--------------|------------|------|
| PWA Manifest | App installation metadata | ✅ Complete | vite-plugin-pwa | None | Low |
| Service Worker | Offline caching | ✅ Complete | public/sw.js | Limited offline functionality | Medium |
| Offline Indicator | Show offline status | ✅ Complete | OfflineIndicator component | None | Low |
| Background Sync | Sync queued actions | ⚠️ Partial | Service worker | Not fully implemented | Medium |
| Install Prompt | PWA install suggestion | ✅ Complete | PWAInstallPrompt component | None | Low |

### Onboarding & UX

| Feature | Description | Status | Dependencies | Known Gaps | Risk |
|---------|-------------|--------|--------------|------------|------|
| Multi-Step Onboarding | Guided setup for new users | ✅ Complete | Onboarding.tsx | None | Low |
| Onboarding Tooltips | Guided tour of dashboard features | ✅ Complete | OnboardingOverlay, useOnboardingTooltips | None | Low |
| Tooltip Persistence | Remember dismissed tooltips | ✅ Complete | localStorage + profiles.preferences | None | Low |

---

## 🛠 Tech Stack

### Frontend

| Technology               | Version   | Purpose                     |
| ------------------------ | --------- | --------------------------- |
| **React**                | ^18.3.1   | UI Framework                |
| **TypeScript**           | -         | Type Safety                 |
| **Vite**                 | -         | Build Tool & Dev Server     |
| **Tailwind CSS**         | -         | Utility-First Styling       |
| **shadcn/ui**            | -         | Component Library           |
| **Framer Motion**        | ^12.23.26 | Animations                  |
| **React Router DOM**     | ^6.30.1   | Client-Side Routing         |
| **TanStack React Query** | ^5.83.0   | Data Fetching & Caching     |
| **React Hook Form**      | ^7.61.1   | Form Management             |
| **Zod**                  | ^3.25.76  | Schema Validation           |
| **date-fns**             | ^3.6.0    | Date Utilities              |
| **Recharts**             | ^2.15.4   | Charts & Data Visualization |
| **Lucide React**         | ^0.462.0  | Icon Library                |

### Backend (Vercel / Supabase)

| Technology                   | Purpose                                 |
| ---------------------------- | --------------------------------------- |
| **Supabase**                 | Database, Auth, Storage, Edge Functions |
| **PostgreSQL**               | Relational Database                     |
| **Row Level Security (RLS)** | Data Access Control                     |
| **Edge Functions (Deno)**    | Serverless Backend Logic                |

### PWA Support

| Technology          | Purpose                     |
| ------------------- | --------------------------- |
| **vite-plugin-pwa** | Progressive Web App Support |
| **Service Worker**  | Offline Caching             |

---

## 🧱 Architectural Guardrails

These rules should be preserved unless explicitly revised.

### Routing & Auth

- Public routes must never render authenticated layouts or sidebar navigation
- Protected routes must always be wrapped in auth guards
- SEO-critical pages (Blog, Pricing, About) must remain publicly accessible

### State & UI Safety

- No route or action should ever fail silently
- All async mutations must have loading + error states
- White/blank screens are considered critical bugs

### Payments

- Stripe webhooks are the source of truth for subscription state
- UI should never assume payment success without webhook confirmation

### Data Integrity

- All child-related data must be linked through parent-child junction tables
- No destructive action without confirmation and audit logging

## 🎨 Typography & Design System

### Fonts

- **Display Font**: `Outfit` (headings, titles) - Modern geometric sans-serif
- **Body Font**: `Inter` (body text, UI) - Highly legible system font

### Color Palette

#### Light Mode

| Token          | HSL Value   | Usage                                   |
| -------------- | ----------- | --------------------------------------- |
| `--primary`    | 222 47% 20% | Deep Navy Blue - Trust, Professionalism |
| `--secondary`  | 150 25% 92% | Warm Sage Green - Calm, Growth          |
| `--accent`     | 174 42% 90% | Soft Teal - Clarity, Balance            |
| `--background` | 210 25% 98% | Light gray background                   |
| `--foreground` | 222 47% 11% | Dark text                               |

#### Parent-Specific Colors

| Token        | Usage                              |
| ------------ | ---------------------------------- |
| `--parent-a` | Primary parent indicator (Blue)    |
| `--parent-b` | Secondary parent indicator (Green) |

#### Semantic Colors

- `--success`: Green for positive states
- `--warning`: Orange for alerts
- `--destructive`: Red for errors/deletions
- `--info`: Blue for informational messages

### Design Utilities

- `.glass` - Glassmorphism effect with blur
- `.shadow-elegant` - Subtle professional shadows
- `.shadow-glow` - Soft accent glow
- `.text-gradient` - Hero gradient text
- `.skeleton-shimmer` / `.skeleton-wave` - Loading animations

---

### Explicit Non-Goals (For Now)

The following are explicitly out of scope and should be treated as constraints unless explicitly revised:

- Real-time location tracking
- Legal advice or court filing automation
- Direct communication with courts
- Financial arbitration or forced payment handling
- Native mobile apps beyond PWA

These non-goals may be revisited later.

## 🔌 3rd Party Connections

### Integrated Services

| Service                   | Purpose                                                   | Status    |
| ------------------------- | --------------------------------------------------------- | --------- |
| **Supabase Auth**         | User authentication (Email, Google, Apple OAuth)          | ✅ Active |
| **Supabase Storage**      | Document storage with access logging                      | ✅ Active |
| **Stripe**                | Subscription payments & billing                           | ✅ Active |
| **Resend**                | Transactional emails (invitations, notifications)         | ✅ Active |
| **Supabase Auth Captcha** | Bot protection on auth flows                              | ⚠️ Temporarily disabled for QA |
| **Google OAuth**          | Social login                                              | ✅ Active |
| **Apple OAuth**           | Social login                                              | ✅ Active |
| **OpenRouter**            | All AI edge functions                                     | ✅ Active in repo |

### Environment Variables (Secrets)

- `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY`
- `STRIPE_SECRET_KEY`
- `RESEND_API_KEY`
- `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET`
- `HCAPTCHA_SECRET_KEY`
- `OPENROUTER_API_KEY` (AI edge functions)

Operational note:
- `OPENROUTER_API_KEY` is confirmed present in production Edge Function secrets.

---

## 🤖 AI Assistant

CoParrent integrates AI-powered features to help co-parents communicate professionally and create optimal custody arrangements. All AI interactions are authenticated and processed through secure edge functions.

### AI Capabilities

| Feature                   | Description                                                           | Edge Function         |
| ------------------------- | --------------------------------------------------------------------- | --------------------- |
| **Message Tone Analysis** | Analyzes messages for hostile or inflammatory language patterns       | `ai-message-assist`   |
| **Message Rephrasing**    | Rewrites messages to be court-appropriate and professional            | `ai-message-assist`   |
| **Quick Tone Check**      | Real-time pattern matching for problematic phrases                    | `ai-message-assist`   |
| **Schedule Suggestions**  | AI-powered custody schedule recommendations based on family situation | `ai-schedule-suggest` |
| **Nurse Nancy**           | Health-adjacent support assistant with non-diagnostic guardrails      | `nurse-nancy-chat`    |
| **Kid Activity Ideas**    | Child-friendly activity generation                                    | `kid-activity-generator` |
| **Coloring Page Creator** | Printable coloring page generation                                    | `generate-coloring-page` |

### AI Provider Status

- All AI edge functions in the repo now use OpenRouter-backed models.
- Live runtime verification was completed on March 24, 2026 for `nurse-nancy-chat`, `kid-activity-generator`, and `generate-coloring-page`.

Current repo model mapping:
- `ai-message-assist` -> `google/gemini-3-flash-preview`
- `ai-schedule-suggest` -> `google/gemini-2.0-flash-exp:free`
- `nurse-nancy-chat` -> `google/gemini-3-flash-preview`
- `kid-activity-generator` -> `google/gemini-3-flash-preview`
- `generate-coloring-page` -> `google/gemini-2.5-flash-image` with fallback `google/gemini-3.1-flash-image-preview`

### AI Files & Components

#### Edge Functions (Backend)

| File                                              | Purpose                                                                                          |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `supabase/functions/ai-message-assist/index.ts`   | Handles message tone analysis, rephrasing, and quick checks                                      |
| `supabase/functions/ai-schedule-suggest/index.ts` | Generates custody schedule suggestions based on children's ages, conflict level, and preferences |

#### Frontend Components

| File                                               | Purpose                                                           |
| -------------------------------------------------- | ----------------------------------------------------------------- |
| `src/components/messages/MessageToneAssistant.tsx` | UI component for tone analysis and message rephrasing suggestions |
| `src/components/calendar/CalendarWizard.tsx`       | Schedule setup wizard with AI-powered pattern suggestions         |

### AI Message Assist (`ai-message-assist`)

The message assistance function provides three actions:

1. **`quick-check`**: Pattern-based analysis without AI calls
   - Detects hostile patterns (e.g., "you always", "you never", personal attacks)
   - Checks for ALL CAPS usage
   - Returns immediate feedback with suggestions

2. **`analyze`**: Full AI-powered tone analysis
   - Returns overall tone (positive/neutral/concerning)
   - Tone score (1-10)
   - Child-focused assessment
   - Court-appropriateness evaluation
   - Specific suggestions and positive aspects

3. **`rephrase`**: AI-powered message rewriting
   - Removes emotional language and personal attacks
   - Focuses on facts and children's wellbeing
   - Maintains professional, business-like tone
   - Keeps requests clear and actionable

### AI Schedule Suggest (`ai-schedule-suggest`)

Generates custody schedule recommendations based on:

- **Children Information**: Count and ages
- **Conflict Level**: High-conflict vs standard co-parenting
- **State**: Jurisdiction for legal context
- **Preferences**: Parent-specified preferences

Returns 2-3 pattern suggestions with:

- Pattern name and description
- Pros and cons for the specific situation
- 14-day visual representation
- Holiday handling tips
- Exchange timing recommendations
- Age-appropriate considerations

### Tone Check Patterns

The quick-check system detects these patterns locally (no AI call required):

| Pattern              | Example                          | Suggestion                          |
| -------------------- | -------------------------------- | ----------------------------------- |
| Generalizations      | "you always", "you never"        | Focus on specific situations        |
| Blame                | "your fault", "blame you"        | Use 'I feel' statements             |
| Personal attacks     | "stupid", "idiot", "incompetent" | Remove attacks, focus on issue      |
| Demands              | "demand", "insist", "must"       | Use "request" or "would appreciate" |
| Multiple exclamation | "!!!"                            | One exclamation is sufficient       |
| Inflammatory         | "can't believe", "ridiculous"    | Express concerns calmly             |
| Threats              | "never see", "my lawyer"         | Focus on finding solutions          |
| ALL CAPS             | "THREE+ WORDS SHOUTING"          | Avoid shouting                      |

### Security & Authentication

All AI endpoints require authentication:

- JWT token verification before processing
- User ID logged for audit purposes
- No user data stored by AI services
- Rate limiting recommended (TODO)

### AI Model Configuration

AI model choice now varies by function. The current mapping above is the source of truth, with OpenRouter used across all AI edge functions.

### Environment Variables

| Variable             | Purpose                              |
| -------------------- | ------------------------------------ |
| `OPENROUTER_API_KEY` | Authentication for OpenRouter AI API |

### User Interaction Flow

```
User Types Message
       │
       ▼
┌──────────────────┐
│  Quick Check     │ ◄── Local pattern matching (no AI)
│  (500ms debounce)│
└──────────────────┘
       │
       ▼ (if issues found)
┌──────────────────┐
│  Show Warnings   │
│  + Analyze/      │
│    Rephrase      │
│    Buttons       │
└──────────────────┘
       │
       ├─────────────────────┐
       ▼                     ▼
┌──────────────┐     ┌──────────────┐
│   Analyze    │     │   Rephrase   │
│   (AI Call)  │     │   (AI Call)  │
└──────────────┘     └──────────────┘
       │                     │
       ▼                     ▼
┌──────────────┐     ┌──────────────┐
│  Show Full   │     │  Show        │
│  Analysis    │     │  Suggestion  │
│  Panel       │     │  + Apply Btn │
└──────────────┘     └──────────────┘
```

### Guidelines for AI Modifications

When modifying AI functionality:

1. **Never remove authentication** - All AI endpoints must verify JWT tokens
2. **Preserve audit logging** - Keep user ID logging for security audit
3. **Maintain court-friendly focus** - AI prompts must prioritize professional, court-appropriate output
4. **Child-focused messaging** - All suggestions should center on children's wellbeing
5. **No data persistence** - AI functions should not store user messages or children's information
6. **Error handling** - Return appropriate error responses, never expose internal errors to clients

## ✨ Features & Components

### 1. Landing Pages

| Feature  | Components                                            | Description                  |
| -------- | ----------------------------------------------------- | ---------------------------- |
| Homepage | `Navbar`, `Hero`, `Features`, `Footer`                | Marketing landing page       |
| Pricing  | `Pricing` page                                        | Subscription tier comparison |
| About    | `About` page                                          | Company/product information  |
| Blog     | `BlogPage`, `BlogPostPage`, `BlogCard`, `ShareDialog` | Content marketing            |

### 2. Authentication

| Feature          | Components                        | Description                   |
| ---------------- | --------------------------------- | ----------------------------- |
| Login            | `Login`, `SocialLoginButtons`     | Email/password + Google OAuth |
| Signup           | `Signup`, `SocialLoginButtons`    | User registration with trial  |
| Password Reset   | `ForgotPassword`, `ResetPassword` | Password recovery flow        |
| Protected Routes | `ProtectedRoute`, `AuthContext`   | Route guards                  |

### 3. Dashboard

| Feature          | Components                                  | Description                                |
| ---------------- | ------------------------------------------- | ------------------------------------------ |
| Main Dashboard   | `Dashboard`, `DashboardLayout`              | Overview with schedule, messages, children |
| Navigation       | `NavLink`, sidebar navigation               | Responsive sidebar with collapse           |
| Notifications    | `NotificationDropdown`, `NotificationsPage` | Real-time notification system              |
| Blog Integration | `BlogDashboardCard`                         | Latest blog posts in dashboard             |

### 4. Custody Calendar

| Feature                | Components              | Description                        |
| ---------------------- | ----------------------- | ---------------------------------- |
| Calendar View          | `CalendarPage`          | Visual custody schedule            |
| Schedule Setup         | `CalendarWizard`        | Pattern-based schedule creation    |
| Change Requests        | `ScheduleChangeRequest` | Formal swap/cancel requests        |
| Realtime Updates       | `useRealtimeSchedule`   | Live schedule synchronization      |
| **Sports Integration** | `SportsEventDetail`     | View sports events in calendar     |
| **Multi-Event Popup**  | `SportsEventListPopup`  | Select from multiple events on day |

### 5. Children Management

| Feature          | Components                           | Description                       |
| ---------------- | ------------------------------------ | --------------------------------- |
| Children List    | `ChildrenPage`                       | Child profile cards               |
| Child Details    | Medical, school, emergency info      | Comprehensive child records       |
| Realtime Sync    | `useRealtimeChildren`, `useChildren` | Live data updates                 |
| **Delete Child** | `DeleteChildDialog`                  | Cascade cleanup with confirmation |
| **Gift Lists**   | `GiftsPage`, `GiftListCard`          | Shared gift coordination          |
| **Gift Items**   | `GiftItemCard`, `AddGiftItemDialog`  | Gift claiming and tracking        |

### 6. Messaging Hub

| Feature                   | Components               | Description                              |
| ------------------------- | ------------------------ | ---------------------------------------- |
| **Family Channel**        | `MessagingHubPage`       | Group messaging for entire family        |
| **Direct Messages**       | `MessagingHubPage`       | 1-on-1 messaging between family members  |
| **Group Chats**           | `MessagingHubPage`       | Multi-person group conversations         |
| **AI Tone Assistant**     | `MessageToneAssistant`   | AI-powered message tone suggestions      |
| **Typing Indicators**     | `useTypingIndicator`     | Real-time typing status display          |
| **Message History**       | `useMessagingHub`        | Thread and message data management       |
| **Message Reactions**     | `MessageReactions`       | Emoji reactions on messages              |
| **Unread Counts**         | `useUnreadMessages`      | Per-thread and total unread tracking     |
| **Full-Text Search**      | `MessageSearch`          | Search across message history            |
| **Pull-to-Refresh**       | `usePullToRefresh`       | Mobile gesture to refresh messages       |
| **Swipe Navigation**      | `SwipeableTabs`          | Mobile swipe between conversation tabs   |
| **Role Badges**           | Visual role indicators   | Show parent/third-party role in messages |
| **Court-Friendly**        | Immutable messages       | Messages cannot be edited or deleted     |
| **PDF Export**            | Court-ready export       | Export conversation logs for court       |

### 7. Documents

| Feature              | Components                      | Description                   |
| -------------------- | ------------------------------- | ----------------------------- |
| **Document Library** | `DocumentsPage`, `DocumentCard` | File organization by category |
| **Upload**           | `DocumentUploadDialog`          | Drag-and-drop file upload     |
| **Access Logging**   | `DocumentAccessLogDialog`       | Court-ready access trail      |
| **Secure Storage**   | `useDocuments`                  | Cloud storage integration     |

### 8. Expenses

| Feature                    | Components         | Description                          |
| -------------------------- | ------------------ | ------------------------------------ |
| **Expense List**           | `ExpensesPage`     | Shared expense tracking              |
| **Expense Categories**     | Category filtering | Medical, education, activities, etc. |
| **Reimbursement Requests** | Request workflow   | Formal reimbursement approval system |
| **Expense Reports**        | PDF generation     | Court-ready expense documentation    |

### 9. Journal

| Feature             | Components      | Description                                |
| ------------------- | --------------- | ------------------------------------------ |
| **Journal Entries** | `JournalPage`   | Private journaling for custody notes       |
| **Mood Tracking**   | Mood indicators | Track emotional state during exchanges     |
| **Exchange Notes**  | Linked entries  | Journal entries tied to exchange check-ins |
| **Tags**            | Tag system      | Organize entries with custom tags          |

### 10. Youth Sports Hub (Premium)

| Feature                   | Components                              | Description                             |
| ------------------------- | --------------------------------------- | --------------------------------------- |
| **Sports Activities**     | `SportsPage`, `ActivityCard`            | Track sports/activities per child       |
| **Activity Events**       | `EventCard`, `CreateEventDialog`        | Games, practices, tournaments           |
| **Calendar Integration**  | `useSportsEvents`                       | Sports events show in calendar          |
| **Map Navigation**        | `DirectionsDialog`, `useMapNavigation`  | Get directions (Google/Apple/Waze)      |
| **Parent Responsibility** | Drop-off/pick-up assignments            | Per-event responsibility tracking       |
| **Equipment Checklist**   | Equipment needed per event              | Track required equipment                |
| **Venue Notes**           | Parking, field numbers, tips            | Location-specific information           |
| **Smart Reminders**       | `sports-event-reminders` edge function  | Leave-by time, responsibility reminders |
| **Edit/Cancel Events**    | `EditActivityDialog`, `EditEventDialog` | Full CRUD with cancel toggle            |

### 11. Law Library (Unified)

| Feature                   | Components                                | Description                                |
| ------------------------- | ----------------------------------------- | ------------------------------------------ |
| **Unified Law Library**   | `UnifiedLawLibraryPage`                   | Single page with state-grouped resources   |
| **State Accordion**       | Collapsible state sections                | Only shows states with content             |
| **Indiana Articles**      | Indiana Code Title 31 articles            | Chapter 31 family law integrated           |
| **PDF Resources**         | Downloadable legal documents              | State-specific legal documents             |
| **Search & Filter**       | Search by title, filter by type           | Articles vs PDFs tab filtering             |
| **Disclaimer**            | `LawLibraryDisclaimer`                    | Legal information disclaimer               |
| **Admin Cleanup Tool**    | `LawLibraryCleanupTool`                   | Scan and delete empty placeholder files    |
| **Backward-Compatible**   | `/law-library/resources` redirects        | Old URLs still work                        |

### 12. Settings & Account

| Feature                 | Components             | Description                             |
| ----------------------- | ---------------------- | --------------------------------------- |
| **Settings Page**       | `SettingsPage`         | Account management hub                  |
| **Co-Parent Invite**    | `CoParentInvite`       | Email invitation system                 |
| **Third-Party Manager** | `ThirdPartyManager`    | Invite step-parents, grandparents, etc. |
| **Trial Status**        | `TrialStatus`          | Subscription/trial tracking             |
| **Notifications**       | `NotificationSettings` | Notification preferences                |
| **Subscription**        | `useSubscription`      | Stripe subscription management          |
| **Role-Based Access**   | `useFamilyRole`        | Permission enforcement                  |

### 13. Admin

| Feature                   | Components                 | Description                          |
| ------------------------- | -------------------------- | ------------------------------------ |
| **Admin Dashboard**       | `AdminDashboard`           | User management, analytics           |
| **User Roles**            | Role-based access control  | admin, moderator, user roles         |
| **Law Library Manager**   | `AdminLawLibraryManager`   | Upload and manage legal resources    |
| **Placeholder Cleanup**   | `LawLibraryCleanupTool`    | Bulk delete empty/placeholder files  |
| **Blog Management**       | Blog CRUD                  | Create and edit blog posts           |

### 14. UI Components (shadcn/ui + Custom)

| Component                        | Variants/Features                                     |
| -------------------------------- | ----------------------------------------------------- |
| `Button`                         | default, destructive, outline, secondary, ghost, link |
| `Card`                           | Standard card with header, content, footer            |
| `Dialog` / `AlertDialog`         | Modal dialogs                                         |
| `Drawer` / `Sheet`               | Slide-out panels                                      |
| `Input` / `Textarea`             | Form inputs                                           |
| `Select` / `Checkbox` / `Switch` | Form controls                                         |
| `Tabs`                           | Tab navigation                                        |
| `Table`                          | Data tables                                           |
| `Toast` / `Sonner`               | Notifications                                         |
| `Skeleton`                       | shimmer, wave loading states                          |
| `LoadingSpinner`                 | Branded video loading animation                       |
| `Calendar`                       | Date picker                                           |
| `Avatar`                         | User avatars                                          |
| `Badge`                          | Status indicators                                     |
| `Tooltip` / `Popover`            | Contextual info                                       |
| `Logo`                           | Animated brand logo                                   |

### 14. Custom Hooks

| Hook                     | Purpose                                    | Status |
| ------------------------ | ------------------------------------------ | ------ |
| `useAuth`                | Authentication state management            | Active |
| `useFamilyRole`          | Family role detection (parent/third-party) | Active |
| `useMessagingHub`        | Primary messaging hook (threads, messages) | **Active** |
| `useUnreadMessages`      | Unread count tracking across threads       | Active |
| `useTypingIndicator`     | Typing indicator broadcast/subscribe       | Active |
| `usePullToRefresh`       | Mobile pull-to-refresh gesture             | Active |
| `useGiftLists`           | Gift list and item management              | Active |
| `useChildren`            | Children data CRUD                         | Active |
| `useRealtimeChildren`    | Realtime children updates                  | Active |
| `useDocuments`           | Document management                        | Active |
| `useMessages`            | **DEPRECATED** - Legacy 1:1 messaging      | Legacy |
| `useExpenses`            | Expense tracking and reimbursements        | Active |
| `useLawLibrary`          | Law library resource access                | Active |
| `useAdminLawLibrary`     | Admin law library management               | Active |
| `useNotifications`       | Notification management                    | Active |
| `useNotificationService` | Notification dispatch service              | Active |
| `usePushNotifications`   | Browser push notifications                 | Active |
| `useRealtimeSchedule`    | Live schedule updates                      | Active |
| `useSchedulePersistence` | Schedule data persistence                  | Active |
| `useScheduleRequests`    | Schedule change requests                   | Active |
| `useSubscription`        | Stripe subscription status                 | Active |
| `usePremiumAccess`       | Premium feature access checks              | Active |
| `useUserPreferences`     | User preference management                 | Active |
| `useLoginNotification`   | Device tracking and login alerts           | Active |
| `useMobile`              | Responsive breakpoint detection            | Active |
| `useToast`               | Toast notifications                        | Active |

---

## 🌳 Application Wire Tree

```
CoParrent Application
│
├── 🏠 PUBLIC ROUTES
│   ├── / (Index)
│   │   ├── Navbar
│   │   ├── Hero
│   │   ├── Features
│   │   └── Footer
│   │
│   ├── /pricing
│   ├── /about
│   ├── /features → redirects to /about
│   ├── /blog
│   │   └── Blog listing with cards
│   │
│   ├── /login
│   │   ├── Email/Password form
│   │   └── SocialLoginButtons (Google)
│   │
│   ├── /signup
│   │   ├── Registration form
│   │   └── SocialLoginButtons (Google)
│   │
│   ├── /forgot-password
│   ├── /reset-password
│   └── /accept-invite
│       └── Co-parent invitation acceptance
│
├── 🔒 PROTECTED ROUTES (require auth)
│   │
│   ├── /onboarding
│   │   └── Initial setup wizard
│   │
│   ├── /dashboard
│   │   ├── DashboardLayout (sidebar + header)
│   │   ├── Welcome section
│   │   ├── Today's Schedule card
│   │   ├── Quick Stats grid
│   │   │   ├── Upcoming Exchanges
│   │   │   ├── Recent Messages
│   │   │   └── Children Quick Access
│   │   └── BlogDashboardCard
│   │
│   ├── /dashboard/calendar
│   │   ├── Calendar view (parent-coded days)
│   │   ├── CalendarWizard (schedule setup)
│   │   └── ScheduleChangeRequest
│   │
│   ├── /dashboard/children
│   │   ├── Children cards grid
│   │   ├── Add child modal
│   │   └── Child details (medical, school, emergency)
│   │
│   ├── /dashboard/messages
│   │   ├── MessagingHub (tabs: Family/Direct)
│   │   ├── Family Channel (group chat)
│   │   ├── Direct Messages (1-on-1)
│   │   └── Message composer with PDF export
│   │
│   ├── /dashboard/documents
│   │   ├── Category tabs
│   │   ├── DocumentCard grid
│   │   ├── DocumentUploadDialog
│   │   └── DocumentAccessLogDialog
│   │
│   ├── /dashboard/settings
│   │   ├── Account settings
│   │   ├── CoParentInvite
│   │   ├── ThirdPartyManager
│   │   ├── NotificationSettings
│   │   └── TrialStatus
│   │
│   ├── /dashboard/notifications
│   │   └── Notification list
│   │
│   ├── /dashboard/blog
│   │   └── Blog listing (authenticated view)
│   │
│   ├── /dashboard/blog/:slug
│   │   └── Blog post detail
│   │
│   └── /admin
│       └── AdminDashboard (admin-only)
│
└── 🚫 404 - NotFound
```

### User Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              USER JOURNEY                                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
                    ┌────────────────────────────────┐
                    │        Landing Page (/)        │
                    │   Hero, Features, CTA          │
                    └────────────────────────────────┘
                                     │
              ┌──────────────────────┼──────────────────────┐
              ▼                      ▼                      ▼
    ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
    │     /signup     │    │     /login      │    │    /pricing     │
    │  Create Account │    │   Existing User │    │  Compare Plans  │
    └─────────────────┘    └─────────────────┘    └─────────────────┘
              │                      │
              └──────────┬───────────┘
                         ▼
              ┌─────────────────────┐
              │    /onboarding      │
              │  Initial Setup      │
              └─────────────────────┘
                         │
                         ▼
              ┌─────────────────────┐
              │    /dashboard       │◄────────────────┐
              │  Main Hub           │                 │
              └─────────────────────┘                 │
                         │                            │
    ┌────────────────────┼────────────────────┐       │
    ▼                    ▼                    ▼       │
┌────────┐         ┌──────────┐         ┌─────────┐  │
│Calendar│◄───────►│ Messages │◄───────►│Children │  │
└────────┘         └──────────┘         └─────────┘  │
    │                    │                    │       │
    │                    ▼                    │       │
    │              ┌──────────┐               │       │
    └─────────────►│Documents │◄──────────────┘       │
                   └──────────┘                       │
                         │                            │
                         ▼                            │
                   ┌──────────┐                       │
                   │ Settings │───────────────────────┘
                   │ Co-parent│
                   │ Invite   │
                   └──────────┘
                         │
                         ▼
              ┌─────────────────────┐
              │   /accept-invite    │
              │  (Co-parent joins)  │
              └─────────────────────┘
                         │
                         ▼
              ┌─────────────────────┐
              │  LINKED CO-PARENTS  │
              │  Shared calendar,   │
              │  messaging, docs    │
              └─────────────────────┘
```

---

## 🗄 Database Schema

### Core Tables

| Table                     | Description                                             |
| ------------------------- | ------------------------------------------------------- |
| `profiles`                | User profiles with subscription and account metadata    |
| `children`                | Child information (medical, school, emergency contacts) |
| `parent_children`         | Junction table linking parents to children              |
| `family_members`          | Active family memberships and role assignments          |
| `custody_schedules`       | Custody patterns and schedule definitions               |
| `schedule_requests`       | Schedule change requests                                |
| `exchange_checkins`       | Exchange confirmation records                           |
| `message_threads`         | Messaging threads (family channel + direct messages)    |
| `thread_messages`         | Immutable messages within threads                       |
| `typing_indicators`       | Real-time typing status for messaging                   |
| `group_chat_participants` | Participants in group chat threads                      |
| `message_read_receipts`   | Read receipt tracking for messages                      |
| `messages`                | Legacy co-parent messages (deprecated)                  |
| `gift_lists`              | Shared gift lists per child/occasion                    |
| `gift_items`              | Individual gift items with claim tracking               |
| `documents`               | Document metadata                                       |
| `document_access_logs`    | Document access audit trail                             |
| `expenses`                | Shared expense tracking                                 |
| `reimbursement_requests`  | Expense reimbursement workflows                         |
| `journal_entries`         | Private journal entries                                 |
| `notifications`           | User notifications                                      |
| `invitations`             | Co-parent and third-party invitations                   |
| `step_parents`            | Step-parent approval tracking                           |
| `user_devices`            | Trusted device tracking for login notifications         |
| `law_library_resources`   | State-specific legal documents                          |
| `blog_posts`              | Blog content                                            |
| `user_roles`              | Role-based access (admin, moderator, user)              |

### Edge Functions

| Function                   | Purpose                                          |
| -------------------------- | ------------------------------------------------ |
| `admin-manage-users`       | Admin user management                            |
| `ai-message-assist`        | AI-powered message tone analysis & rephrasing    |
| `ai-schedule-suggest`      | AI-powered schedule pattern recommendations      |
| `check-subscription`       | Verify Stripe subscription status                |
| `create-checkout`          | Create Stripe checkout session                   |
| `create-message-thread`    | Server-side message thread creation with RLS bypass |
| `customer-portal`          | Stripe customer portal access                    |
| `exchange-reminders`       | Automated exchange reminder notifications        |
| `generate-expense-report`  | PDF expense report generation                    |
| `login-notification`       | Device tracking and login alerts                 |
| `notify-third-party-added` | Notification when third-party joins family       |
| `send-coparent-invite`     | Send co-parent invitation emails                 |
| `send-third-party-invite`  | Send third-party invitation emails               |
| `send-notification`        | Push notification delivery                       |
| `stripe-webhook`           | Stripe webhook event processing                  |

---

## 🧠 Decision Log

| Date       | Decision                                | Reason                                    |
| ---------- | --------------------------------------- | ----------------------------------------- |
| 2025-12-26 | AI endpoints require JWT authentication | Security: prevent unauthorized AI usage   |
| 2025-12-26 | Shared Gift Lists for children          | Coordination and conflict reduction       |
| 2025-12-26 | Typing indicators via realtime table    | Low-latency UX for messaging              |
| 2025-12-26 | Step-Parent → Third-Party role rename   | More inclusive naming for extended family |
| 2025-12-26 | Third-Party invitation-only model       | Security: prevent unauthorized access     |
| 2025-12-26 | Messaging Hub replaces 1-on-1 messages  | Support group + DM within family group    |
| 2026-01-16 | Edge function for thread creation       | Bypass RLS complexity for DM/group creation |
| 2026-01-16 | Centralized display label maps          | Prevent raw IDs/tokens leaking into UI    |
| YYYY-MM-DD | Blog kept public and SEO-indexed        | Marketing + organic discovery             |
| YYYY-MM-DD | Stripe webhooks limited to 4 events     | Reduce noise + simplify edge logic        |
| YYYY-MM-DD | Dashboard UI gated strictly behind auth | Prevent data leakage                      |

> **Policy:** Decision Log entries must never be rewritten; new decisions are appended only.

---

## 🔄 Change Log

> **Policy:** Any change affecting routing, authentication, payments, data integrity, or user access must be recorded here. Do not remove existing entries.

### 2026-01-16

- **Major:** Server-Side Message Thread Creation
  - Created `create-message-thread` edge function to bypass RLS complexity
  - Handles DM, group chat, and family channel creation with server-side membership verification
  - Updated `useMessagingHub` hook to call edge function instead of direct table inserts
  - Resolves 403 RLS policy violations when creating new threads
- **Major:** Display Labels System
  - Created `src/lib/displayLabels.ts` with centralized label maps
  - Added typed constants for: subscription status/tier, member roles, invitation types, schedule requests
  - Updated `SubscriptionBanner`, `TrialStatus`, `MessagingHubPage`, `MessagesPage` to use display labels
  - Prevents raw IDs, tokens, and enum values from leaking into UI
  - All UI text now comes from mapped labels or safe fallbacks

### 2025-12-26

- **Security:** AI Edge Function Authentication
  - Added JWT token verification to `ai-message-assist` edge function
  - Added JWT token verification to `ai-schedule-suggest` edge function
  - All AI endpoints now require authenticated requests
  - User ID logged for audit purposes
- **Feature:** Shared Gift Lists
  - Created `gift_lists` and `gift_items` tables with RLS policies
  - Parents can create gift lists per child/occasion (Birthday, Holiday, Custom)
  - Family members can view and claim gifts to avoid duplicates
  - Third-party members have limited access (view, claim only)
  - Created `useGiftLists` hook for gift management
  - Created gift components: `GiftListCard`, `GiftItemCard`, `CreateGiftListDialog`, `AddGiftItemDialog`
  - Created `GiftsPage` for gift list management
- **Feature:** Typing Indicators
  - Created `typing_indicators` table with realtime enabled
  - Created `useTypingIndicator` hook for broadcast/subscribe
  - Added typing indicator display in MessagingHubPage
  - Animated dots show when other family members are typing
- **Feature:** Third-Party Join Notification
  - AcceptInvite page now triggers `notify-third-party-added` edge function
  - Parents notified when third-party members accept invitations

- **Major:** Third-Party Accounts System
  - Replaced Step-Parent concept with Third-Party role (step-parents, grandparents, babysitters, etc.)
  - Third-Party accounts can ONLY be added via email invitation from Parents/Guardians
  - Created `family_members` table with RLS policies
  - Created `ThirdPartyManager` component for invitation management
  - Created `send-third-party-invite` edge function
  - Plan limits enforced: Free (0), Pro (2), MVP (6) third-party members
- **Major:** Messaging Hub Implementation
  - Created new `MessagingHubPage` with Family Channel (group) and Direct Messages (1-on-1)
  - Users can only message people within their family group
  - Created `message_threads` and `thread_messages` tables with RLS
  - Messages are immutable (court-friendly) - no edit/delete
  - Role badges displayed in messages (Parent/Family)
  - Created `useMessagingHub` hook for messaging functionality
  - Created `useFamilyRole` hook for role detection
- **Major:** Permission System
  - Third-Party permissions enforced via route guards and RLS
  - Third-Party allowed: Messaging Hub, Journal, Law Library, Blog
  - Third-Party NOT allowed: Calendar edit, Children edit, Documents, Expenses, Settings, Admin
  - Navigation items hidden based on user role
  - `ProtectedRoute` component updated with role-based restrictions

### 2025-12-25

- **Added:** Law Library - Parenting time guidelines for 14 states (AZ, CA, CO, FL, GA, IL, NY, OH, PA, TX, WA, VA, Federal)
- **Added:** Law Library - Child support guidelines and calculators for all 50 states + DC
- **Added:** Law Library - Custody modification and enforcement laws for all 50 states + DC
- **Added:** Law Library - Relocation and move-away laws for all 50 states + DC
- **Fixed:** "Failed to add child" error - Updated `useRealtimeChildren` to use secure `create_child_with_link` RPC function instead of direct INSERT
- **Fixed:** White screen on create actions (Children, Expenses, Documents)
  - Added `isSaving` state with loading indicators to Children page Add/Edit dialogs
  - Wrapped async mutations in try-catch blocks with proper error handling
  - All three pages have ErrorBoundary wrappers
- **Fixed:** Blog route rendering authenticated layout when logged out
  - Created `PublicLayout` component with Navbar/Footer for public pages
  - Updated `/blog` and `/blog/:slug` routes to use public layout
  - Dashboard blog routes still available at `/dashboard/blog` for authenticated users
- **Added:** Comprehensive error boundary coverage
  - Created `RouteErrorBoundary` for route-level errors with navigation options
  - Created `FeatureErrorBoundary` for feature-level errors with retry capability
  - Wrapped all routes in `App.tsx` with `RouteErrorBoundary`
  - Updated Documents, Expenses, and Children pages to use `FeatureErrorBoundary`

### Previous Changes

- Integrated Stripe webhook via Supabase Edge Function
- Locked webhook events to the required Stripe event set

---

## 🧪 QA Acceptance Checks

### Plan Limits & Access

- Free users can add up to 4 children and 4 third-party members
- Power users can add up to 6 children and 6 third-party members
- Free users cannot access: Expenses, Court Exports, Sports Hub
- Power users have full access to all features
- Legacy Premium/MVP subscribers automatically have Power access

### Auth & Routing

- Logged-out users never see dashboard sidebar
- Blog page loads publicly and is crawlable
- Third-party users see filtered navigation

### Core CRUD

- Add Child opens a form or modal and saves successfully
- Add Expense never results in a blank page
- Add Document renders upload UI reliably

### Payments

- Subscription state updates only after webhook receipt
- Failed payments downgrade access correctly

### SEO & Public Pages

- Public routes render without auth context
- No dashboard UI or sidebar leaks on public pages
- Blog pages are crawlable without JavaScript auth

---

## 🚦 Production Readiness Checklist

This section provides an honest assessment of what must be completed before deploying to production.

### Security & Auth

| Item | Status | Notes |
|------|--------|-------|
| RLS policies enabled on all tables | ✅ Ready | All tables have RLS enabled |
| RLS policies tested for edge cases | ⚠️ Needs Validation | Complex family member policies need audit |
| Password strength requirements | ✅ Ready | Enforced on signup |
| Two-factor authentication persisted | ✅ Ready | TOTP state is persisted and recovery flows are wired |
| Recovery codes stored securely | ✅ Ready | Recovery codes are hashed and stored through the backend |
| Session timeout/invalidation | ⚠️ Needs Validation | Basic implementation exists |
| Rate limiting on auth endpoints | ⚠️ Needs Validation | hCaptcha is wired in the repo; deployed environments must keep it configured and validated |
| JWT token expiration configured | ✅ Ready | Supabase defaults |
| Admin role protection | ✅ Ready | has_role() RPC enforces |
| Child account isolation | ⚠️ Needs Validation | New feature, needs security review |

### Payments & Billing

| Item | Status | Notes |
|------|--------|-------|
| Stripe live mode configured | ✅ Ready | Live Power product and webhook path configured |
| Webhook signature verification | ✅ Ready | Implemented in stripe-webhook |
| Failed payment handling | ⚠️ Needs Validation | Logic exists, not tested live |
| Subscription cancellation flow | ✅ Ready | Customer portal handles |
| Trial expiration handling | ⚠️ Needs Validation | Auto-downgrade needs testing |
| Plan feature enforcement | ⚠️ Needs Validation | Some features may not gate properly |
| Refund handling | ❌ Missing | No refund workflow implemented |
| Invoice/receipt emails | ⚠️ Needs Validation | Stripe handles baseline receipts; custom templates still need review |
| Tax handling (VAT/Sales tax) | ❌ Missing | Not configured in Stripe |

### Legal & Compliance

| Item | Status | Notes |
|------|--------|-------|
| Terms of Service page | ✅ Done | `/terms` - Updated ToS with product disclaimers |
| Privacy Policy page | ✅ Done | `/privacy` - Covers data handling, COPPA, CCPA, third parties |
| Cookie consent banner | ✅ Done | GDPR-compliant with customizable preferences |
| COPPA compliance for child accounts | ⚠️ Needs Validation | Defaults are safe, legal review pending |
| GDPR data export capability | ✅ Done | "Download My Data" in Settings via edge function |
| GDPR data deletion capability | ⚠️ Needs Validation | Profile deletion exists, cascade unclear |
| CCPA compliance | ✅ Done | Privacy Policy updated with CCPA disclosures |
| Data retention policy | ✅ Done | Defined retention limits in Privacy Policy |
| Audit log completeness | ⚠️ Needs Validation | Partial coverage |

### Performance & Scalability

| Item | Status | Notes |
|------|--------|-------|
| Database indexes on common queries | ⚠️ Needs Validation | Some indexes exist, need audit |
| Image optimization | ⚠️ Needs Validation | Using src/assets, lazy loading partial |
| Bundle size optimization | ✅ Ready | Route splitting and focused production cleanup are in place |
| CDN configuration | ✅ Ready | Vercel provides edge delivery for the web app |
| API response times < 500ms | ⚠️ Needs Validation | Not benchmarked |
| Concurrent user testing | ❌ Missing | No load testing performed |
| Realtime subscription cleanup | ⚠️ Needs Validation | Some components may leak |
| Memory leak prevention | ⚠️ Needs Validation | Not profiled |

### Data Integrity & Backups

| Item | Status | Notes |
|------|--------|-------|
| Database backups configured | ✅ Ready | Supabase provides managed backups/PITR features |
| Point-in-time recovery | ✅ Ready | Supabase feature |
| Foreign key constraints | ⚠️ Needs Validation | Most exist, some missing |
| Cascade delete behavior | ⚠️ Needs Validation | Child deletion RPC exists |
| Data migration scripts | ✅ Ready | Migrations in supabase/migrations/ |
| Seed data for testing | ❌ Missing | No seed scripts |

### Monitoring & Observability

| Item | Status | Notes |
|------|--------|-------|
| Error tracking (Sentry/similar) | ❌ Missing | Not integrated |
| Application performance monitoring | ❌ Missing | Not integrated |
| Database query monitoring | ✅ Ready | Supabase dashboard |
| Edge function logs | ✅ Ready | Supabase dashboard |
| User action audit trail | ⚠️ Needs Validation | Partial implementation |
| Health check endpoint | ✅ Ready | Production health function exists |
| Alerting on failures | ❌ Missing | Not configured |

### UX & Edge Cases

| Item | Status | Notes |
|------|--------|-------|
| Empty states for all lists | ✅ Ready | Implemented |
| Loading states for all async | ✅ Ready | Implemented |
| Error handling with user feedback | ✅ Ready | Toast notifications |
| Offline fallback experience | ⚠️ Needs Validation | Basic implementation |
| Mobile responsive design | ✅ Ready | Tailwind responsive |
| Accessibility (a11y) audit | ⚠️ Needs Validation | Not formally audited |
| Browser compatibility testing | ⚠️ Needs Validation | Not systematically tested |
| Form validation feedback | ✅ Ready | React Hook Form + Zod |
| Deep link handling | ⚠️ Needs Validation | Basic routing works |

### Operational Readiness

| Item | Status | Notes |
|------|--------|-------|
| Domain configured | ✅ Ready | `https://www.coparrent.com` is active; apex is still settling |
| SSL certificate | ✅ Ready | Vercel-managed certificates are active |
| Environment variables documented | ✅ Ready | In README |
| Deployment pipeline | ✅ Ready | GitHub + Vercel production pipeline is active |
| Rollback procedure | ⚠️ Needs Validation | Git history available |
| Incident response plan | ❌ Missing | Not documented |
| User support channel | ✅ Ready | `support@coparrent.com` plus live in-app problem reporting |
| Status page | ❌ Missing | Not implemented |

### Known Risks & Constraints

| Risk | Severity | Mitigation |
|------|----------|------------|
| Real-device push/PWA proof still pending | High | Complete the remaining iPhone/Android/desktop device validation |
| Live billing config drift | High | Stripe dashboard, edge functions, and docs must stay aligned |
| Passkey posture unresolved | Medium | Keep passkeys hidden or revisit when Supabase exposes WebAuthn |
| Limited error monitoring | Medium | Bugs may go unnoticed; integrate Sentry or similar |
| Untested payment webhooks | Medium | Revenue issues possible; test with live Stripe events |
| Auth posture / localhost config | Medium | Keep deployed captcha configured and finalize localhost-origin posture |
| Apex host propagation | Low | Keep `https://www.coparrent.com` canonical until apex behavior is clean everywhere |

---

## 🚀 Getting Started

### Prerequisites

- Node.js (v18+)
- npm or bun

### Installation

```bash
# Clone the repository
git clone <YOUR_GIT_URL>

# Navigate to project directory
cd <YOUR_PROJECT_NAME>

# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at `http://localhost:8080`

### Environment Variables

Use `.env.example` as the source of truth for local development and deployed env configuration. The minimum client-side variables are:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`

---

## 📝 Incomplete Tasks / TODO

### High Priority

- [x] **Invite Acceptance Regression**: Verified fresh co-parent and third-party invites land users inside the existing family after acceptance
- [x] **Messaging Hub Live Verification**: Verified thread creation against the deployed backend without CORS or RLS surprises
- [x] **AI Runtime Verification**: Verified the OpenRouter-backed Nurse Nancy, activity generation, and coloring-page generation flows in the deployed environment
- [x] **Billing Verification**: Completed a live end-to-end Power checkout, webhook, and customer portal test
- [ ] **Push Device Validation**: Verify production push delivery on iOS, Android, and desktop
- [ ] **PWA Device Testing**: Run PWA Test Checklist on physical iOS/Android devices
- [ ] **Confirm Auth Captcha Deployment Config**: Keep hCaptcha configured in deployed environments and review localhost-origin posture

### Medium Priority

- [ ] **Email Notifications**: Send transactional emails for messages, schedule changes, document uploads
- [ ] **Holiday Schedules**: Add holiday/special occasion override scheduling with templates
- [ ] **Recurring Events**: Child activities, doctor appointments, school events scheduling
- [ ] **File Previews**: In-app document preview for PDFs and images without download
- [ ] **Mobile App**: Native iOS/Android apps (currently PWA only)
- [ ] **Grandparent Rights**: Add grandparent visitation laws to law library
- [ ] **Domestic Violence Resources**: Add protective order and DV resources to law library

### Low Priority / Nice to Have

- [ ] **Preview-Based Playwright Smoke**: Add a thin deployed smoke pass once the preview target is agreed
- [ ] **Multiple Children Calendars**: Per-child schedule overrides for split custody
- [ ] **Mileage Tracking**: Exchange location distance tracking and reimbursement
- [ ] **Integration with Family Law Portals**: Direct court filing integration
- [ ] **Mediation Scheduling**: Built-in mediation appointment booking
- [ ] **Co-parent Activity Feed**: Shared timeline of child activities and updates

### Completed Features ✅

- [x] **Visual Custody Calendar**: Interactive calendar with parent-coded days and pattern display
- [x] **Schedule Pattern Engine**: Complete pattern-based schedule generation (weekly, bi-weekly, custom)
- [x] **Expense Tracking & Reimbursements**: Full expense management with categories, receipts, and reimbursement requests
- [x] **Journal/Notes**: Private journaling with mood tracking, tags, and exchange notes
- [x] **Law Library - Parenting Time**: Guidelines for all 50 states + DC
- [x] **Law Library - Child Support**: Calculators and guidelines for all 50 states + DC
- [x] **Law Library - Custody Laws**: Modification and enforcement laws for all 50 states + DC
- [x] **Law Library - Relocation Laws**: Move-away requirements for all 50 states + DC
- [x] **AI Message Tone Assistant**: AI-powered suggestions for professional communication
- [x] **Exchange Check-ins**: Custody exchange confirmation and logging
- [x] **Real-time Updates**: Live data synchronization for schedules, children, and messages
- [x] **Document Management**: Upload, categorize, and share documents with access logging
- [x] **Co-Parent Invitations**: Email invitation system to link co-parents
- [x] **Step-Parent Access**: Dual-approval system for step-parent view access
- [x] **Admin Dashboard**: User management, analytics, and content management
- [x] **Blog System**: Full blog with categories, tags, and sharing
- [x] **Error Boundaries**: Comprehensive error handling with fallback UIs
- [x] **Children CRUD**: Add, edit, and manage child profiles with medical/school info
- [x] **Message Search**: Full-text search across message history with GIN index
- [x] **Message Reactions**: Emoji reactions on messages with toggle and realtime sync
- [x] **Unread Message Indicators**: Per-thread and total unread counts with notification settings
- [x] **Mobile Messaging UX**: Pull-to-refresh, swipe navigation, touch-friendly reactions
- [x] **Two-Factor Authentication**: TOTP-based 2FA with CoParrent branding in authenticator apps
- [x] **Recovery Codes**: Backup recovery codes for 2FA with secure hashing and persistence
- [x] **Cookie Consent Banner**: GDPR-compliant cookie consent with essential/functional/analytics preferences
- [x] **GDPR Data Export**: User data export feature in settings with JSON download
- [x] **Data Retention Policy**: Documented data retention schedules in Privacy Policy
- [x] **CCPA Compliance**: California Privacy Rights disclosures in Privacy Policy
- [x] **PWA Foundation & Push Plumbing**: Installability, service worker, push subscription sync, and backend delivery path are in place; real-device validation is still pending
- [x] **Per-Family Role Authorization**: Family-scoped roles with RLS enforcement
- [x] **Family Membership Bootstrap**: Parent/guardian signup/login now ensures an active family before family-gated features run
- [x] **Invite Family Binding**: New co-parent invites are created with the inviter's `family_id`
- [x] **Family-Scoped Core Flows**: AI guard, third-party management, schedules, schedule requests, and document flow now require explicit active-family scope
- [x] **Rate Limiting & Cost Control**: Unified rate limiter with tier-based limits and abuse telemetry
- [x] **Stripe Billing Integrity**: Idempotent webhook handling with signature verification

### Technical Debt

- [x] **Critical Regression Tests**: Added Vitest coverage for invite classification, family bootstrap helpers, plan limits, route/security gating, and reminder helpers on March 19, 2026
- [x] **Broader Unit/Component Coverage**: Extended the Vitest suite across route guards, invite flows, auth redirects, family switching, premium gating, and kids-route smoke coverage on March 19, 2026
- [ ] **E2E Tests**: Expand Playwright end-to-end testing coverage
- [ ] **Accessibility Audit**: Full WCAG 2.1 AA compliance review
- [x] **Route Lazy Loading & Bundle Splitting**: Implemented on March 19, 2026
- [x] **API Rate Limiting**: Unified rate limiter implemented for all edge functions
- [x] **Audit Logging**: Comprehensive audit trail for all data changes

### Known Issues to Verify

- [x] Verify co-parent acceptance flow works end-to-end in production after family bootstrap changes
- [x] Verify third-party acceptance flow works end-to-end in production after family bootstrap changes
- [x] Test subscription webhook handling with live Stripe events
- [ ] Validate realtime subscriptions cleanup on component unmount
- [ ] Test law library file downloads with actual uploaded PDFs
- [ ] Run PWA Test Checklist on iOS and Android devices before production release

---

## 📜 README Governance

The `README.md` is the **authoritative reference** for architecture, routing, authentication, and behavioral expectations for the CoParrent project.

### Pre-Implementation Validation Checklist

Before implementing any change, verify the following:

- [ ] **Routing**: Does this change affect public vs protected routes? Check [Application Wire Tree](#-application-wire-tree)
- [ ] **Auth**: Does this touch authentication flow? Review [Architectural Guardrails > Routing & Auth](#routing--auth)
- [ ] **Payments**: Does this affect subscription or billing? Check [Architectural Guardrails > Payments](#payments)
- [ ] **Data**: Does this modify database schema or RLS? Review [Database Schema](#-database-schema)
- [ ] **Non-Goals**: Does this introduce a feature listed in [Explicit Non-Goals](#explicit-non-goals-for-now)? If yes, stop and clarify.
- [ ] **Blocking Issues**: Is this related to a [Known Blocking Issue](#known-blocking-issues)? Prioritize accordingly.

### Conflict Resolution

If a requested change conflicts with documented architecture or guardrails:

1. **Pause execution** — do not proceed with implementation
2. **Cite the conflict** — reference the specific README section
3. **Request clarification** — ask whether the README should be updated or the request revised
4. **Document decision** — if proceeding, add entry to Decision Log

### Post-Implementation Updates

After completing changes:

| Change Type                     | Update Required                         |
| ------------------------------- | --------------------------------------- |
| Fixed a blocking issue          | Update **Project State** → Known Issues |
| Changed routing, auth, payments | Add entry to **Change Log**             |
| Made architectural decision     | Append to **Decision Log**              |
| Behavioral or structural change | Update **Last Verified Build** date     |

### Rules

1. If a requested change conflicts with the README, execution should pause and request clarification before proceeding.
2. When implementing fixes or changes, update:
   - **Project State** if the issue is blocking
   - **Change Log** once resolved
3. Decision Log entries must never be rewritten; new decisions are appended only.
4. The README should evolve incrementally, not be rewritten wholesale.

---

## 📄 License

This project is proprietary software. All rights reserved. Unauthorized reproduction, distribution, or reverse engineering is prohibited.

---

## 🤝 Contributing

This is a private project. For access or contribution inquiries, please contact the project maintainers.

---

<p align="center">
  <strong>CoParrent</strong> - Putting children first through organized co-parenting
</p>
