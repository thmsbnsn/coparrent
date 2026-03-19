# Gated Features Documentation

This document lists all premium, role-gated, and admin-restricted features in CoParrent,
along with where each gate is enforced (UI component + server-side).

**Last Updated:** 2026-03-13

---

## Enforcement Model

All gated features in CoParrent are enforced at the **server level**, never by UI logic alone.

| Enforcement Layer | Purpose |
|------------------|--------|
| Route Guards | Prevent unauthorized navigation |
| RPC / Edge Functions | Enforce plan limits and roles |
| Row Level Security (RLS) | Enforce data access rules |
| Storage Policies | Restrict file access |

Client-side checks are considered **advisory only**.

## Current Status Notes

- Parent and guardian accounts now bootstrap an active family membership before family-scoped gates run.
- New co-parent and third-party invitations are expected to carry a concrete `family_id` so invited users join an existing family instead of creating a new one during onboarding.
- Complimentary Power granted by access code is treated the same as paid Power for feature gating.
- All AI edge functions are intended to run through OpenRouter; production risk is now runtime verification, not provider ambiguity.

---

## Privacy Defaults

Unless explicitly shared by the owner:

- All creations are **private per parent**
- Co-parents do not see each other's generated content
- Children cannot generate or access creations
- Third-party users have no default visibility

Sharing is:
- Explicit
- Item-level
- Revocable at any time

---

## Role Capability Matrix

| Action | Parent (Owner) | Co-Parent | Third-Party | Child |
|------|---------------|----------|-------------|-------|
| Create Activities | ✅ | ❌ | ❌ | ❌ |
| Create Coloring Pages | ✅ | ❌ | ❌ | ❌ |
| View Private Creations | ✅ | ❌ | ❌ | ❌ |
| View Shared Creations | ✅ | ✅ | ❌ | ❌ |
| Edit Creations | ✅ | ❌ | ❌ | ❌ |
| Export / Print Shared | ✅ | ✅ | ❌ | ❌ |
| Manage Sharing | ✅ | ❌ | ❌ | ❌ |

---

## AI Tool Safety Scope

AI-powered tools in CoParrent are intentionally constrained:

- Provide **general, educational support only**
- Do **not** provide medical, legal, or diagnostic advice
- Always defer emergencies to **local emergency services**
- Enforce **rate limits** and safety rules server-side
- Preserve user privacy (no sensitive data logging)

---

## Intentional Limitations

The following limitations are **by design**, not omissions:

- No public sharing links
- No co-parent editing of privately owned creations
- No AI-generated diagnoses or treatment guidance
- No child-initiated AI content creation
- No family-wide default visibility

---

## Cross-Reference

- Security architecture: **`docs/SECURITY_MODEL.md`**
- Design principles: **`README.md`**

---

## Plan Structure

CoParrent uses a two-tier subscription model:

| Plan | Price | Max Kids | Max Third-Party | Key Features |
|------|-------|----------|-----------------|--------------|
| **Free** | $0 | 4 | 4 | Calendar, Messages, Children, Documents, Kid Center, Law Library |
| **Power** | $5/month | 6 | 6 | Everything in Free + Expenses, Court Exports, Sports Hub, AI Assist |

**Plan Configuration:** `src/lib/planLimits.ts`

---

## Gate Types

| Gate Type | Description | UI Component | Server Check |
|-----------|-------------|--------------|--------------|
| **PowerGate** | Requires Power subscription or trial | `PremiumFeatureGate` | Edge function `aiGuard` |
| **RoleGate** | Requires parent/guardian role in the active family | `RoleGate`, `ProtectedRoute` | RLS policies, edge function `aiGuard`, family bootstrap RPC |
| **AdminGate** | Requires admin role in user_roles table | `AdminGate` | `is_admin()` DB function, RLS |
| **ChildGate** | Enforces child account restrictions | `ChildAccountGate` | `get_child_permissions()` RPC |

## Family Bootstrap and Invitation Rules

- Direct parent and guardian accounts may create the first family automatically during signup/login bootstrap.
- Invited co-parents should join the inviter's family rather than create a new family.
- Invited third-party users should also join an existing family from the invitation context.
- Family-scoped pages should not rely on a parent account being globally marked as parent; they require an active family membership.

---

## Power-Gated Features

Features requiring Power subscription, trial, or free_access grant.

| Feature | UI Gate Location | Server Gate | Notes |
|---------|------------------|-------------|-------|
| Expenses Tracking | `ExpensesPage.tsx` - PremiumFeatureGate | RLS on `expenses` | Power-only |
| Court Exports | `CourtExportDialog.tsx` - PremiumFeatureGate | RLS on export data | Power-only |
| Sports & Events Hub | `SportsPage.tsx` - PremiumFeatureGate | RLS on `child_activities` | Power-only |
| AI Message Rephrase | `MessageToneAssistant.tsx` - mode dropdown | `ai-message-assist/index.ts` - aiGuard | quick-check allowed for all |
| AI Message Draft | `MessageToneAssistant.tsx` | `ai-message-assist/index.ts` - aiGuard | Power-only |
| AI Message Analyze | `MessageToneAssistant.tsx` | `ai-message-assist/index.ts` - aiGuard | Allowed for all auth users |
| AI Schedule Suggest | `CalendarWizard.tsx` | `ai-schedule-suggest/index.ts` - aiGuard | Parent/Admin + Power |

---

## Role-Gated Features (Parent/Guardian Only)

Features restricted from Third-Party members.

| Feature | UI Gate Location | Server Gate | Notes |
|---------|------------------|-------------|-------|
| Edit Calendar/Schedule | `ProtectedRoute`, `RoleGate` | RLS on `custody_schedules` | Third-party has read-only |
| Edit Children Info | `ProtectedRoute` - `/dashboard/children` | RLS on `children`, `parent_children` | |
| Manage Documents | `ProtectedRoute` - `/dashboard/documents` | RLS on `documents` | |
| Manage Expenses | `ProtectedRoute` - `/dashboard/expenses` | RLS on `expenses` | |
| Settings Access | `ProtectedRoute` - `/dashboard/settings` | Profile RLS | |
| Submit Schedule Requests | Component-level disable | RLS on `schedule_requests` | Third-party can view |
| Send Messages | Open for all family members | RLS on `thread_messages` | Family channel access for all |
| Add Message Reactions | Open for all family members | RLS on `message_reactions` | Emoji reactions on messages |

### Third-Party Allowed Routes (Read Access)
- `/dashboard` - Dashboard overview
- `/dashboard/messages` - Messaging Hub (can send in allowed threads)
- `/dashboard/calendar` - Calendar (view only)
- `/dashboard/journal` - Journal
- `/dashboard/law-library` - Law Library
- `/dashboard/blog` - Blog
- `/dashboard/notifications` - Notifications
- `/dashboard/kid-center` - Kid Center (premium features gated separately)
- `/dashboard/sports` - Sports activities
- `/dashboard/gifts` - Gift lists

---

## Admin-Gated Features

Features restricted to users with `admin` role in `user_roles` table.

| Feature | UI Gate Location | Server Gate | Notes |
|---------|------------------|-------------|-------|
| Law Library Upload | `AdminLawLibraryManager.tsx` + `AdminGate` | RLS on `law_library_resources` | |
| Law Library Edit | `AdminLawLibraryManager.tsx` + `AdminGate` | RLS on `law_library_resources` | |
| Law Library Delete | `AdminLawLibraryManager.tsx` + `AdminGate` | RLS, storage policies | |
| Admin Dashboard | `ProtectedRoute` - `/admin` | `is_admin()` function | |
| User Management | `AdminDashboard.tsx` | `admin-manage-users` edge function | |
| Push Notification Tester | `AdminPushTester.tsx` | `is_admin()` + audit logging | |
| PWA Diagnostics | `/pwa-diagnostics` | Open to authenticated users | Internal QA tool |

---

## AI Feature Permissions Matrix

| Action | Auth Required | Parent/Admin Required | Premium Required | Rate Limited |
|--------|---------------|----------------------|------------------|--------------|
| `quick-check` | ✅ | ❌ | ❌ | ❌ |
| `analyze` | ✅ | ✅ | ✅ | ✅ |
| `rephrase` | ✅ | ✅ | ✅ | ✅ |
| `draft` | ✅ | ✅ | ✅ | ✅ |
| `schedule-suggest` | ✅ | ✅ | ✅ | ✅ |

### AI Rewrite Modes (Premium Only)
- `neutral` - Default, available to all who can rephrase
- `deescalate` - Premium mode selector
- `facts_only` - Premium mode selector
- `boundary_setting` - Premium mode selector

---

## Messaging System Features

The messaging system uses a thread-based architecture with the following components:

### Data Model
| Table | Purpose | RLS Enforcement |
|-------|---------|-----------------|
| `message_threads` | Thread metadata (type, participants) | `is_family_member()` function |
| `thread_messages` | Message content and sender | `can_access_thread()` function |
| `message_read_receipts` | Read status per user per message | Reader ID = auth.uid() |
| `message_reactions` | Emoji reactions on messages | Family membership via thread access |
| `typing_indicators` | Real-time typing status | Thread participant only |
| `group_chat_participants` | Group membership | Participant ID = profile ID |

### Messaging Features by Access Level

| Feature | All Family Members | Parents Only | Notes |
|---------|-------------------|--------------|-------|
| View Family Channel | ✅ | - | All family members see family_channel |
| Send Messages | ✅ | - | Any thread they can access |
| Add Reactions | ✅ | - | Emoji reactions with toggle |
| Direct Messages | ✅ | - | 1:1 with any family member |
| Create Group Chats | ✅ | - | With any family members |
| View Unread Counts | ✅ | - | Per-thread and total |
| Search Messages | ✅ | - | Full-text search via RPC |
| Export to PDF | ✅ | - | Court-ready export |

### Unread Message Indicators

Unread counts are displayed when:
1. User has `notification_preferences.enabled = true`
2. User has `notification_preferences.new_messages = true`
3. Messages exist that the user hasn't read (no read receipt)

The indicator disappears when:
- The message is read (read receipt created)
- User disables notifications in settings

---

## Server-Side Enforcement

### Edge Functions with aiGuard
All AI edge functions use the shared `aiGuard` module which:
1. Validates JWT token from Authorization header
2. Fetches user profile and determines family role
3. Checks subscription/trial status via profile
4. Enforces action allowlist based on role + plan
5. Returns structured `{ error, code }` on rejection with appropriate HTTP status

### Database RLS Policies
All tables have Row Level Security enabled. Key patterns:
- User-owned data: `auth.uid() = user_id`
- Family-shared data: Uses `is_family_member()` function
- Admin data: Uses `is_admin()` function
- **Parent-only mutations**: Uses `is_parent_or_guardian()` function

### Parent-Only RLS Enforcement (Phase 6)

All mutation policies for parent-only resources now explicitly verify the user is not a third-party member or child account using the `is_parent_or_guardian()` function. This prevents bypass attacks even if UI gating fails.

**Tables with Parent-Only Mutation Policies:**

| Table | Operations Protected | Check Method |
|-------|---------------------|--------------|
| `expenses` | INSERT, UPDATE, DELETE | `is_parent_or_guardian(auth.uid())` |
| `documents` | INSERT, UPDATE, DELETE | `is_parent_or_guardian(auth.uid())` |
| `custody_schedules` | INSERT, UPDATE, DELETE | `is_parent_or_guardian(auth.uid())` |
| `schedule_requests` | INSERT | `is_parent_or_guardian(auth.uid())` |
| `child_activities` | INSERT, UPDATE, DELETE | `is_parent_or_guardian(auth.uid())` |
| `activity_events` | INSERT, UPDATE, DELETE | `is_parent_or_guardian(auth.uid())` |
| `child_photos` | INSERT, UPDATE, DELETE | `is_parent_or_guardian(auth.uid())` |
| `gift_lists` | INSERT, UPDATE, DELETE | `is_parent_or_guardian(auth.uid())` |
| `gift_items` | INSERT, UPDATE, DELETE | `is_parent_or_guardian(auth.uid())` |
| `children` | INSERT | Blocked (RPC only via `rpc_add_child`) |
| `parent_children` | INSERT | Blocked (RPC only) |

**is_parent_or_guardian() Function:**
```sql
-- Returns true only if user:
-- 1. Has a profile (is authenticated)
-- 2. Is NOT a child account (account_role != 'child')
-- 3. Is NOT a third-party member (no active record in family_members with role='third_party')
```

### Rate Limiting
AI functions use `aiRateLimit` module:
- Tracks daily usage in `ai_usage_daily` table
- Limits: Free=10/day, Trial=50/day, Power=200/day
- Returns HTTP 429 with `{ error, code: "RATE_LIMIT" }`

### Plan Limits Enforcement
Plan limits are defined in `src/lib/planLimits.ts`:
- `getPlanLimits(tier)` returns limits for max kids, third-party accounts
- `hasFeatureAccess(tier, feature)` checks if feature is available
- `normalizeTier(tier)` maps legacy tiers (premium, mvp) to "power"

### Server-Enforced Limits via RPC

All write operations for plan-limited resources go through secure RPC functions:

| RPC Function | Purpose | Enforces |
|--------------|---------|----------|
| `get_plan_usage(p_profile_id)` | Get current usage counts | Read-only |
| `rpc_add_child(p_name, p_date_of_birth)` | Add child with limit check | Max kids |
| `rpc_create_third_party_invite(...)` | Create invite with limit check | Max third-party |
| `rpc_revoke_third_party(p_invitation_id)` | Revoke third-party access | Parent check |

**RLS Policies:**
- `children` and `parent_children` tables block direct INSERT (RPC only)
- `invitations` table blocks direct INSERT for third-party type (RPC only)

**Error Codes Returned:**
| Code | Meaning | HTTP Status |
|------|---------|-------------|
| `NOT_AUTHENTICATED` | No valid session | 401 |
| `NOT_PARENT` | User is third-party, not parent | 403 |
| `LIMIT_REACHED` | Plan limit exceeded | 403 |
| `VALIDATION_ERROR` | Invalid input | 400 |

**Frontend Hook:**
```tsx
import { usePlanLimits } from "@/hooks/usePlanLimits";

const { kids_used, max_kids, canAddChild, isAtChildLimit } = usePlanLimits();
```

---

## Gate Component Usage

### PremiumFeatureGate
```tsx
<PremiumFeatureGate featureName="AI Analysis">
  <AIAnalysisPanel />
</PremiumFeatureGate>
```

### RoleGate
```tsx
<RoleGate requireParent restrictedMessage="Only parents can edit schedules">
  <ScheduleEditor />
</RoleGate>
```

### AdminGate
```tsx
<AdminGate>
  <AdminLawLibraryManager />
</AdminGate>
```

---

## Onboarding & User Experience

### Onboarding Tooltips System
New users see a guided tour of key dashboard features with dismissal persistence:

| Component | Purpose | Storage |
|-----------|---------|---------|
| `useOnboardingTooltips` | Hook for tooltip state and persistence | localStorage + profiles.preferences |
| `OnboardingOverlay` | Renders tooltip overlay and backdrop | N/A |
| `OnboardingTooltip` | Individual tooltip with progress indicator | N/A |

**Tooltip Targets:**
- `nav-calendar` - Custody Calendar
- `nav-messages` - Messaging Hub
- `nav-children` - Children Profiles
- `nav-expenses` - Expense Tracking
- `nav-journal` - Private Journal

**Persistence:**
- Dismissed tooltips stored in localStorage for quick access
- Synced to `profiles.preferences.onboarding_tooltips` for cross-device persistence
- Users can skip entire tour or dismiss individually

---

## Legal & Privacy Compliance

### GDPR Compliance

| Feature | Component | Status |
|---------|-----------|--------|
| Cookie Consent Banner | `CookieConsentBanner.tsx` | ✅ Active |
| Data Export (Right to Access) | `DataExportSection.tsx`, `export-user-data` function | ✅ Active |
| Data Retention Policy | `PrivacyPage.tsx` | ✅ Documented |
| Consent Preferences | localStorage + banner | ✅ Essential/Functional/Analytics |

### CCPA Compliance

| Requirement | Implementation | Status |
|-------------|----------------|--------|
| Right to Know | Data export feature | ✅ Active |
| Right to Delete | Manual process documented | ⚠️ Manual |
| Do Not Sell | No data selling (documented in Privacy Policy) | ✅ Documented |
| California-specific disclosures | Privacy Policy section | ✅ Active |

---

## Two-Factor Authentication

### 2FA Features

| Feature | Component | Server Gate | Status |
|---------|-----------|-------------|--------|
| TOTP Enrollment | `TwoFactorSetup.tsx` | Supabase MFA API | ✅ Active |
| 2FA Verification | `TwoFactorVerify.tsx` | Supabase MFA API | ✅ Active |
| Recovery Codes | `RecoveryCodes.tsx` | `manage-recovery-codes` function | ✅ Active |
| Trusted Devices | `TrustedDevicesManager.tsx` | `user_devices` table RLS | ✅ Active |

### Recovery Code Security

- Codes stored as SHA-256 hashes in `user_recovery_codes` table
- One-time use with `used_at` timestamp tracking
- Automatic expiration (1 year default)
- Remaining count tracked in `user_2fa_settings.recovery_codes_remaining`

---

## Push Notifications

### Platform Support

| Platform | Browser Mode | Installed PWA | Notes |
|----------|-------------|---------------|-------|
| **Android Chrome** | ✅ | ✅ | Full support in both modes |
| **iOS Safari 16.4+** | ❌ | ✅ | Must install to Home Screen |
| **Desktop Chrome/Edge** | ✅ | ✅ | Full support |
| **Firefox** | ✅ | ✅ | Full support |

### Push Payload Privacy

All push notifications follow strict privacy rules:
- **No message content** in payload
- **No internal identifiers** exposed
- **Neutral, short copy only** (e.g., "New message waiting")
- **Route link only** for deep-linking

### Admin Push Testing

Admins can send test push notifications via the Admin Dashboard:
- Uses existing push pipeline
- Rate-limited
- Audit-logged as `TEST_PUSH_SENT`
- Non-admins blocked server-side

---

## Email Notifications

### Supported Notification Types

| Type | Email Subject | Action URL |
|------|---------------|------------|
| `new_message` | "New message in CoParrent" | `/dashboard/messages` |
| `schedule_change` | "Schedule change request" | `/dashboard/calendar` |
| `schedule_response` | "Schedule request update" | `/dashboard/calendar` |
| `document_upload` | "New document shared" | `/dashboard/documents` |
| `child_update` | "Child information updated" | `/dashboard/children` |
| `exchange_reminder` | "Upcoming custody exchange" | `/dashboard/calendar` |

### Email Privacy Rules

- **No sensitive content** in email body
- **No message previews** (only "You have a new message")
- **Generic copy** referencing notification type
- **Clear CTA link** back to the app
- **Unsubscribe link** to settings

### Audit Logging

All email sends are logged to `audit_logs` with:
- `action`: `NOTIFICATION_EMAIL_SENT` or `NOTIFICATION_EMAIL_FAILED`
- `entity_type`: `notification`
- `metadata`: type, recipient_id, channel, success (no payload content)

---

## Security Notes

1. **Never trust client-side role checks alone** - Always enforce on server
2. **Admin role stored in separate `user_roles` table** - Not in profile to prevent escalation
3. **Use `SECURITY DEFINER` functions** for role checks to avoid RLS recursion
4. **Log access denials** for security auditing
5. **Structured error responses** - Always return `{ error, code }` for proper client handling
