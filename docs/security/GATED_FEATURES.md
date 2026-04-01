# Gated Features

Last reviewed: 2026-04-01

This document summarizes the current feature-gating model in the repo. It focuses on where access is enforced and avoids claiming stronger enforcement than the code currently proves.

## Enforcement Rules

- Client-side gates improve UX, but they are not the source of truth.
- Server-side checks, RPCs, edge functions, and RLS remain authoritative.
- Family-scoped actions require explicit scope through `activeFamilyId` on the client and `family_id` on the server.
- Missing or ambiguous family scope should fail closed.

## Subscription Model

The current plan definition lives in [../../src/lib/planLimits.ts](../../src/lib/planLimits.ts).

| Plan | Limits | Feature Flags |
| --- | --- | --- |
| Free | 4 children, 4 third-party accounts, 2 parent accounts | no expenses, no sports hub entitlement, no AI assist entitlement, no court-export entitlement |
| Power | 6 children, 6 third-party accounts, 2 parent accounts | expenses, sports hub, AI assist, full message history, court-export entitlement |

Subscription state is resolved server-side. The current implementation explicitly handles:

- active subscriptions
- trials
- past-due grace windows
- canceled and expired states
- complimentary access granted server-side

## Role Model

The repo currently distinguishes between:

- parent
- guardian
- third-party
- child
- admin

Admin access is backed by `user_roles` and server checks. It is not a client-only concept.

## Main Gate Components

| Layer | Current Source |
| --- | --- |
| Route access | [../../src/lib/routeAccess.ts](../../src/lib/routeAccess.ts) |
| Protected route wrapper | [../../src/components/ProtectedRoute.tsx](../../src/components/ProtectedRoute.tsx) |
| Premium UI gate | [../../src/components/premium/PremiumFeatureGate.tsx](../../src/components/premium/PremiumFeatureGate.tsx) |
| Role UI gate | [../../src/components/gates/RoleGate.tsx](../../src/components/gates/RoleGate.tsx) |
| Child-account UI gate | [../../src/components/gates/ChildAccountGate.tsx](../../src/components/gates/ChildAccountGate.tsx) |
| Admin UI gate | [../../src/components/gates/AdminGate.tsx](../../src/components/gates/AdminGate.tsx) |
| AI server gate | [../../supabase/functions/_shared/aiGuard.ts](../../supabase/functions/_shared/aiGuard.ts) |
| Billing server truth | [../../supabase/functions/check-subscription/index.ts](../../supabase/functions/check-subscription/index.ts) and [../../supabase/functions/stripe-webhook/index.ts](../../supabase/functions/stripe-webhook/index.ts) |

## Current Route Posture

The route allowlist in [../../src/lib/routeAccess.ts](../../src/lib/routeAccess.ts) is the current source of truth.

High-level summary:

- Third-party users are allowed on a limited set of protected routes such as dashboard, calendar, messages, notifications, law library, blog, onboarding, and PWA diagnostics.
- Child accounts are allowed on an even smaller set, including `/kids`, calendar, messages, notifications, and PWA diagnostics.
- Parent-only or guardian-only operational routes include children, documents, settings, expenses, sports, gifts, kid-center, kids-hub, and audit.

## Current Feature-Gate Summary

| Surface | Current Access Story | Primary Enforcement |
| --- | --- | --- |
| Expenses | Parent/guardian flow with Power entitlement | `ProtectedRoute`, `PremiumFeatureGate`, server-side subscription resolution, RLS on expenses |
| Sports Hub | Parent/guardian flow with Power entitlement | `ProtectedRoute`, `RoleGate`, `PremiumFeatureGate`, family-scoped data access |
| Kids Hub | Parent/guardian flow with Power entitlement | `ProtectedRoute`, `RoleGate`, `PremiumFeatureGate` |
| Nurse Nancy | Parent/guardian flow with Power entitlement | `RoleGate`, `PremiumFeatureGate`, `aiGuard` |
| Activity Generator | Parent/guardian flow with Power entitlement | `RoleGate`, `PremiumFeatureGate`, `aiGuard` |
| Coloring Page Creator | Parent/guardian flow with Power entitlement | `RoleGate`, `PremiumFeatureGate`, `aiGuard` |
| AI message quick-check | Authenticated family-scoped use | `ai-message-assist` with `quick-check` action in `aiGuard` |
| AI message analyze / rephrase / draft | Parent/guardian flow with premium entitlement | `aiGuard` |
| AI schedule suggest | Parent/guardian flow with premium entitlement | `aiGuard` |
| Messaging Hub access | Family-scoped route for permitted roles | route allowlist plus thread-level server access |
| Messaging export receipts | Family-scoped thread export with Power entitlement | `messaging-thread-export` edge function requiring explicit `family_id`, thread access, server-side Power entitlement, and stored receipt verification |
| Daily calling | Family-scoped parent/guardian/third-party flow | callable-member checks plus `call_sessions` and `call_events` access limited to participants |
| Document export dialog | Parent/guardian family-wide export with Power entitlement | `PermissionButton` UX plus `court-record-export` edge function requiring explicit `family_id`, parent/guardian membership, server-side Power entitlement, immutable artifact storage, and stored receipt verification |
| Admin dashboard and admin management | Admin only | `AdminGate`, `is_admin()` checks, admin-backed queries/functions |

## Important Accuracy Notes

- `courtExports` is enforced server-side for both Messaging Hub export receipts and the family-wide court-record export flow.
- Export entry points are not identical on the client. Some surfaces still rely on backend denial instead of a dedicated `PremiumFeatureGate`, but the server is the authoritative enforcement layer.
- New court-record exports now share the same server-authoritative receipt, hashing, verification, and immutable-artifact model across Messaging Hub and the broader family export flow.
- Daily calling persists participant-visible session and event state, but the repo does not include recording, transcripts, or a dedicated immutable call-history export surface.
- Family-wide court-record exports include call session/event evidence only and document metadata/access history only. They do not include call media or raw document binaries.
- Historical docs that claimed broader third-party route access than `routeAccess.ts` are outdated. The route allowlist file is the current source of truth.

## Related Docs

- Security architecture: [SECURITY_MODEL.md](SECURITY_MODEL.md)
- Current status: [../project/CURRENT_STATUS.md](../project/CURRENT_STATUS.md)
