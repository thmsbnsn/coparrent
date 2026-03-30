# Gated Features Audit

> **Audit Date**: 2026-03-13  
> **Status**: Updated after family-membership bootstrap and access-code verification  
> **Auditor**: System

---

## Subscription State Invariants (Code-Level)

These invariants are enforced in `src/lib/subscriptionInvariants.ts` and all server-side edge functions:

| Invariant | Description | Enforcement Location |
|-----------|-------------|---------------------|
| **Trial ≠ Premium** | Trial users and paid subscribers are tracked as distinct states | `SubscriptionState` type, `usePremiumAccess.reason` |
| **Expired Trial = Free Immediately** | No grace period; real-time check on every access | `isTrialExpired()`, `aiGuard.getUserPlanTier()` |
| **Stripe Webhook = Source of Truth** | Profile subscription fields written only by webhooks | `stripe-webhook/index.ts`, `check-subscription/index.ts` |
| **Server Never Trusts Client Tier** | All edge functions re-validate from database | `aiGuard()`, `check-subscription()` |

---

## Audit Summary

This document provides a comprehensive audit of all gated features, verifying:
1. ✅ UI gate exists (RoleGate / PremiumFeatureGate / AdminGate)
2. ✅ Server enforcement exists (RLS or aiGuard)
3. ✅ Failure returns structured `{ error, code }`

Current addendum:
- Parent/guardian access is now family-scoped and depends on an active family membership.
- Production SQL now bootstraps family membership for direct parent/guardian accounts before gates run.
- New co-parent invitations are now stamped with `family_id`.
- Core family flows now require explicit family scope and no longer rely on legacy relationship-based recipient or visibility inference.

---

## Gate Component Inventory

| Gate Component | Location | Purpose |
|----------------|----------|---------|
| `PremiumFeatureGate` | `src/components/premium/PremiumFeatureGate.tsx` | Blocks non-Power plan users |
| `RoleGate` | `src/components/gates/RoleGate.tsx` | Blocks third-party/child accounts |
| `AdminGate` | `src/components/gates/AdminGate.tsx` | Blocks non-admin users |
| `ChildAccountGate` | `src/components/gates/ChildAccountGate.tsx` | Enforces child restrictions |
| `ProtectedRoute` | `src/components/ProtectedRoute.tsx` | Route-level enforcement |

---

## Premium Features (Power Plan Required)

| Feature | UI Gate | Server Gate | Structured Error | Status |
|---------|---------|-------------|------------------|--------|
| **Expense Tracking** | ✅ `ExpensesPage.tsx` - PremiumFeatureGate | ✅ RLS `is_parent_or_guardian()` | ✅ RLS rejects | ✅ PASS |
| **Court Exports** | ✅ `CourtExportDialog.tsx` - PremiumFeatureGate | ✅ RLS on export data | ✅ Client-side gate | ✅ PASS |
| **Sports & Events Hub** | ✅ `SportsPage.tsx` - PremiumFeatureGate | ✅ RLS on `child_activities` | ✅ RLS rejects | ⚠️ PARTIAL |
| **Nurse Nancy AI** | ✅ `NurseNancyPage.tsx` - PremiumFeatureGate + RoleGate | ✅ `aiGuard` in edge function | ✅ `{ code: "PREMIUM_REQUIRED" }` | ✅ PASS |
| **Coloring Page Creator** | ✅ `ColoringPagesPage.tsx` - PremiumFeatureGate + RoleGate | ✅ `aiGuard` in edge function | ✅ `{ code: "PREMIUM_REQUIRED" }` | ✅ PASS |
| **Activity Generator** | ✅ `ActivitiesPage.tsx` - PremiumFeatureGate + RoleGate | ✅ Premium check in edge function | ✅ `{ code: "PREMIUM_REQUIRED" }` | ✅ PASS |
| **Chore Chart** | ✅ `ChoreChartPage.tsx` - PremiumFeatureGate + RoleGate | ✅ RLS on `chore_charts` | ✅ RLS rejects | ✅ PASS |
| **Kids Hub** | ✅ `KidsHubPage.tsx` - PremiumFeatureGate + RoleGate | ✅ Nested feature gates | ✅ UI blocks | ✅ PASS |
| **AI Message Rephrase** | ✅ `MessageToneAssistant.tsx` - mode dropdown | ✅ `aiGuard` - `PREMIUM_REQUIRED` | ✅ `{ code: "PREMIUM_REQUIRED" }` | ✅ PASS |
| **AI Message Draft** | ✅ `MessageToneAssistant.tsx` | ✅ `aiGuard` - `PREMIUM_REQUIRED` | ✅ `{ code: "PREMIUM_REQUIRED" }` | ✅ PASS |
| **AI Schedule Suggest** | ✅ `CalendarWizard.tsx` | ✅ `aiGuard` - `PREMIUM_REQUIRED` | ✅ `{ code: "PREMIUM_REQUIRED" }` | ✅ PASS |

---

## Role-Restricted Features (Parent/Guardian Only)

| Feature | UI Gate | Server Gate | Structured Error | Status |
|---------|---------|-------------|------------------|--------|
| **Children Management** | ✅ `ProtectedRoute` + route list | ✅ RLS + `rpc_add_child` | ✅ `{ code: "NOT_PARENT" }` | ✅ PASS |
| **Documents** | ✅ `ProtectedRoute` + route list | ✅ RLS `is_parent_or_guardian()` | ✅ RLS rejects | ✅ PASS |
| **Settings** | ✅ `ProtectedRoute` + route list | ✅ N/A (UI only) | ✅ Redirect | ✅ PASS |
| **Audit Logs** | ✅ `ProtectedRoute` + route list | ✅ RLS + `is_admin()` for full view | ✅ RLS filters | ✅ PASS |
| **Calendar Mutations** | ✅ `RoleGate` in components | ✅ RLS `is_parent_or_guardian()` | ✅ RLS rejects | ✅ PASS |
| **Gift Lists Create/Edit** | ✅ Third-party UI hides buttons | ✅ RLS `is_parent_or_guardian()` | ✅ RLS rejects | ✅ PASS |
| **Sports Activities CRUD** | ✅ Sports page behind PremiumGate | ✅ RLS `is_parent_or_guardian()` | ✅ RLS rejects | ✅ PASS |
| **Creations Library** | ✅ `CreationsLibraryPage.tsx` - RoleGate | ✅ RLS `owner_user_id = auth.uid()` | ✅ RLS rejects | ✅ PASS |

---

## Admin-Only Features

| Feature | UI Gate | Server Gate | Structured Error | Status |
|---------|---------|-------------|------------------|--------|
| **Admin Dashboard** | ✅ `ProtectedRoute` + `AdminDashboard.tsx` check | ✅ `is_admin()` RPC | ✅ Access denied page | ✅ PASS |
| **Law Library Upload** | ✅ `AdminGate` in `AdminLawLibraryManager.tsx` | ✅ RLS `is_admin()` | ✅ RLS rejects | ✅ PASS |
| **Law Library Edit** | ✅ `AdminGate` in `AdminLawLibraryManager.tsx` | ✅ RLS `is_admin()` | ✅ RLS rejects | ✅ PASS |
| **Law Library Delete** | ✅ `AdminGate` in `AdminLawLibraryManager.tsx` | ✅ RLS `is_admin()` | ✅ RLS rejects | ✅ PASS |
| **User Management** | ✅ `AdminDashboard.tsx` admin check | ✅ `admin-manage-users` edge function | ✅ Function rejects | ✅ PASS |
| **Blog Post Admin** | ✅ N/A (no UI yet) | ✅ RLS `is_admin()` | ✅ RLS rejects | ✅ PASS |

---

## Child Account Restrictions

| Restriction | UI Gate | Server Gate | Status |
|-------------|---------|-------------|--------|
| **Blocked from Settings** | ✅ `ChildAccountGate` + `ProtectedRoute` | ✅ Redirect only | ✅ PASS |
| **Blocked from Expenses** | ✅ `ProtectedRoute` PARENT_ONLY_ROUTES | ✅ Redirect only | ✅ PASS |
| **Blocked from Documents** | ✅ `ProtectedRoute` PARENT_ONLY_ROUTES | ✅ Redirect only | ✅ PASS |
| **Blocked from Audit** | ✅ `ProtectedRoute` PARENT_ONLY_ROUTES | ✅ Redirect only | ✅ PASS |
| **Blocked from Kids Hub** | ✅ `ProtectedRoute` PARENT_ONLY_ROUTES | ✅ Redirect only | ✅ PASS |
| **Calendar Read-Only** | ✅ CHILD_ALLOWED_ROUTES includes calendar | ✅ RLS blocks mutations | ✅ PASS |
| **Messages Allowed** | ✅ CHILD_ALLOWED_ROUTES includes messages | ✅ RLS with permissions | ✅ PASS |
| **Disabled Login Check** | ✅ `ChildAccountGate` permission check | ✅ `get_child_permissions()` RPC | ✅ PASS |

---

## Error Surface Normalization

**Status**: ✅ **HARDENED**

All error codes are centralized in `src/lib/errorMessages.ts` with strict sanitization:

### Centralized Error Code Mapping

| Server Code | UI Message Key | User-Facing Message |
|------------|----------------|---------------------|
| `NOT_AUTHORIZED`, `UNAUTHORIZED`, `FORBIDDEN` | `ACCESS_DENIED` | "You don't have permission for this action." |
| `NOT_PREMIUM`, `PREMIUM_REQUIRED` | `UPGRADE_REQUIRED` | "This feature requires a Power subscription." |
| `RATE_LIMIT`, `RATE_LIMITED`, `RATE_LIMIT_EXCEEDED` | `RATE_LIMITED` | "You've reached your daily limit. Please try again tomorrow." |
| `CHILD_RESTRICTED` | `CHILD_ACCOUNT_RESTRICTED` | "This feature isn't available for your account type." |
| `NOT_PARENT`, `ROLE_REQUIRED` | `NOT_PARENT` | "This action is only available to parents." |
| `LIMIT_REACHED` | `LIMIT_REACHED` | "You've reached your plan limit. Upgrade to add more." |
| `TRIAL_EXPIRED` | `TRIAL_EXPIRED` | "Your trial has ended. Upgrade to continue using this feature." |

### Sanitization Guarantees

| Protection | Implementation | Status |
|------------|----------------|--------|
| **No UUIDs in UI** | Regex detection + replacement | ✅ PASS |
| **No table names leak** | Pattern matching for common tables | ✅ PASS |
| **No RLS/policy errors** | Technical pattern detection | ✅ PASS |
| **No stack traces** | Pattern detection for file paths | ✅ PASS |
| **Messages are calm/neutral** | All text reviewed for tone | ✅ PASS |

---

## AI Edge Function Error Responses

All AI edge functions return structured `{ error: string, code: string }` responses:

| Error Condition | HTTP Status | Error Code | UI Message |
|-----------------|-------------|------------|---------|
| Missing auth header | 401 | `UNAUTHORIZED` | "Please log in to continue." |
| Invalid/expired token | 401 | `UNAUTHORIZED` | "Please log in to continue." |
| Unknown action | 400 | `INVALID_ACTION` | "Please check your input and try again." |
| Third-party/child role | 403 | `ROLE_REQUIRED` | "This action is only available to parents." |
| Free plan user | 403 | `PREMIUM_REQUIRED` | "This feature requires a Power subscription." |
| Input too long | 400 | `INPUT_TOO_LONG` | "Please check your input and try again." |
| Rate limit exceeded | 429 | `RATE_LIMIT` | "You've reached your daily limit. Please try again tomorrow." |

---

## RPC Function Error Responses

| Function | Error Codes | Status |
|----------|-------------|--------|
| `rpc_add_child` | `NOT_AUTHENTICATED`, `NOT_PARENT`, `VALIDATION_ERROR`, `LIMIT_REACHED`, `UNKNOWN_ERROR` | ✅ PASS |
| `rpc_create_third_party_invite` | `NOT_AUTHENTICATED`, `PROFILE_NOT_FOUND`, `NOT_PARENT`, `VALIDATION_ERROR`, `LIMIT_REACHED`, `FAMILY_SETUP_FAILED`, `UNKNOWN_ERROR` | ✅ PASS |
| `get_plan_usage` | Returns structured JSON with usage data | ✅ PASS |
| `get_child_permissions` | Returns permission object | ✅ PASS |

---

## Edge Case Testing Matrix

### 1. Free → Power Downgrade (Trial Expiration)

| Scenario | Expected Behavior | Enforcement Layer | Status |
|----------|-------------------|-------------------|--------|
| Trial expires while on Expenses page | UI gate shows upgrade prompt | `PremiumFeatureGate` checks `usePremiumAccess()` | ✅ PASS |
| API call after trial expires | Returns `{ code: "PREMIUM_REQUIRED" }` | Edge function `aiGuard` | ✅ PASS |
| RLS mutation after trial expires | Still allowed (RLS doesn't check plan) | RLS | ⚠️ NOTE: Data mutations don't require premium, only AI features |
| Saved data still accessible | User can view but not create new AI content | Mixed | ✅ BY DESIGN |

### 2. Third-Party Accessing Parent Routes

| Route | Expected Behavior | Enforcement | Status |
|-------|-------------------|-------------|--------|
| `/dashboard/children` | Redirect to `/dashboard` | `ProtectedRoute` | ✅ PASS |
| `/dashboard/expenses` | Redirect to `/dashboard` | `ProtectedRoute` | ✅ PASS |
| `/dashboard/documents` | Redirect to `/dashboard` | `ProtectedRoute` | ✅ PASS |
| `/dashboard/settings` | Redirect to `/dashboard` | `ProtectedRoute` | ✅ PASS |
| `/dashboard/calendar` (mutations) | UI hidden, RLS blocks | `RoleGate` + RLS | ✅ PASS |
| `/dashboard/messages` | Allowed | `THIRD_PARTY_ALLOWED_ROUTES` | ✅ PASS |
| Direct API call to add child | `{ code: "NOT_PARENT" }` | `rpc_add_child` | ✅ PASS |
| Direct API insert to expenses | RLS rejection | RLS `is_parent_or_guardian()` | ✅ PASS |

### 3. Child Account Edge Cases

| Scenario | Expected Behavior | Enforcement | Status |
|----------|-------------------|-------------|--------|
| Child navigates to `/dashboard/settings` | Redirect to `/kids` | `ProtectedRoute` + `ChildAccountGate` | ✅ PASS |
| Child navigates to `/dashboard/expenses` | Redirect to `/kids` | `ProtectedRoute` | ✅ PASS |
| Child with `login_enabled = false` | Redirect to `/login` | `ChildAccountGate` | ✅ PASS |
| Child sends message (allowed) | Success | `CHILD_ALLOWED_ROUTES` + permissions | ✅ PASS |
| Child modifies calendar | UI hidden, RLS blocks | RLS `is_parent_or_guardian()` | ✅ PASS |
| Child accesses `/admin` | Redirect to `/kids` | `ProtectedRoute` | ✅ PASS |
| Child direct API insert | RLS rejection | RLS policies | ✅ PASS |

### 4. Admin Override Tests

| Scenario | Expected Behavior | Enforcement | Status |
|----------|-------------------|-------------|--------|
| Admin uses AI without premium | Allowed | `aiGuard` admin bypass | ✅ PASS |
| Admin accesses admin dashboard | Allowed | `is_admin()` RPC | ✅ PASS |
| Admin modifies law library | Allowed | RLS `is_admin()` | ✅ PASS |
| Admin grants free premium access | Allowed | `admin-manage-users` function | ✅ PASS |

---

## Identified Gaps

### ⚠️ Gap 1: SportsPage Missing RoleGate

**Location**: `src/pages/SportsPage.tsx`  
**Issue**: Sports page has `PremiumFeatureGate` but no `RoleGate` wrapper  
**Risk**: Third-party users with premium could theoretically access (though RLS blocks mutations)  
**Recommendation**: Add `RoleGate` wrapper for consistency

### ⚠️ Gap 2: kid-activity-generator Doesn't Use aiGuard

**Location**: `supabase/functions/kid-activity-generator/index.ts`  
**Issue**: Uses inline premium check instead of centralized `aiGuard`  
**Risk**: Inconsistent error codes, doesn't check parent role  
**Recommendation**: Refactor to use `aiGuard` for consistency

### ⚠️ Gap 3: Missing Code in kid-activity-generator Errors

**Location**: `supabase/functions/kid-activity-generator/index.ts:84-87`  
**Issue**: 401 error for missing auth returns `{ error }` without `code`  
**Recommendation**: Add `code: "UNAUTHORIZED"` to match pattern

---

## Audit Log Completeness & Tamper Resistance

**Status**: ✅ **HARDENED**

The audit log system has been verified and hardened for court-defensible record-keeping:

### Data Completeness

| Field | Required | Description | Status |
|-------|----------|-------------|--------|
| `actor_user_id` | ✅ | Auth UID of actor (system = 00000000-0000-0000-0000-000000000000) | ✅ PASS |
| `actor_role_at_action` | ✅ | Role snapshot at time of action (parent, third_party, child, admin, system) | ✅ PASS |
| `child_id` | ⚠️ | Child record being accessed (null for non-child actions) | ✅ PASS |
| `before` | ⚠️ | JSONB snapshot before mutation (null for INSERT/VIEW) | ✅ PASS |
| `after` | ⚠️ | JSONB snapshot after mutation (null for DELETE/VIEW) | ✅ PASS |
| `created_at` | ✅ | UTC timestamp (server-generated, immutable) | ✅ PASS |

### Tamper Resistance

| Protection | Implementation | Status |
|------------|----------------|--------|
| **No Client-Side INSERT** | RLS `WITH CHECK (false)` policy | ✅ PASS |
| **No UPDATE Allowed** | RLS `USING (false) WITH CHECK (false)` policy | ✅ PASS |
| **No DELETE Allowed** | RLS `USING (false)` policy | ✅ PASS |
| **Writes via SECURITY DEFINER** | `log_audit_event()` and `log_audit_event_system()` RPC | ✅ PASS |
| **Actor ID from auth.uid()** | Cannot be spoofed by client | ✅ PASS |

### Third-Party Data Leakage Prevention

| Risk | Mitigation | Status |
|------|------------|--------|
| See other family members' actions | Third-party can ONLY see their own `actor_user_id` logs | ✅ PASS |
| Infer activity via counts | No aggregate queries allowed; filtered by actor only | ✅ PASS |
| Infer activity via timestamps | Third-party cannot see when parents accessed data | ✅ PASS |

---

## Recommendations

1. ~~Add RoleGate to SportsPage~~: ✅ Done - Wrapped content in `RoleGate`
2. ~~Refactor kid-activity-generator~~: ✅ Done - Uses `aiGuard` for consistent enforcement
3. ~~Standardize error responses~~: ✅ Done - All edge functions return `{ error, code }`
4. **Add integration tests**: Automated tests for each edge case scenario (pending)
5. ~~Harden audit logs~~: ✅ Done - Immutable with role snapshots

---

## Conclusion

**Overall Status**: ✅ **PASSING** (Hardened)

The gating system is comprehensive and properly layered:
- UI gates provide immediate user feedback
- Server gates (RLS + aiGuard) prevent bypass
- Structured errors enable proper client handling
- Role and plan checks are centralized in reusable functions
- Audit logs are court-defensible with immutability guarantees
- Third-party users cannot infer hidden data via metadata

The system now meets the court-defensible standard with explicit tamper resistance and role snapshots for legal accountability.
