# Security Model

Last reviewed: 2026-04-01

This document defines the current security architecture and trust boundaries for CoParrent. It is written to stay aligned with the repo rather than with older assumptions or aspirational deployment claims.

## Claim Levels

Security documentation in this repo should distinguish between:

- Repo-confirmed controls: code, tests, migrations, and configuration present in this tree.
- Evidence-backed live checks: dated verification captured in the diligence evidence log.
- User-assisted confirmations still required: deployment posture or device behavior that repo inspection cannot settle alone.

## Core Principles

- Zero implicit trust in the client.
- Server-enforced rules over UI-only checks.
- Least privilege by default.
- Explicit family scope for family-operational data.
- Private-by-default ownership for generated or user-specific content.

## Trust Boundaries

### Client

The client may reflect state, but it is not trusted to define:

- authorization
- role
- subscription status
- plan entitlements
- family scope for privileged operations

### Server

Authoritative enforcement lives in:

- edge functions
- RPCs and database functions
- Row Level Security
- storage policy and bucket configuration

## Family-Scoped Authorization

Family-scoped operations use:

- `activeFamilyId` on the client
- explicit `family_id` on the server

Rules:

- family scope must be explicit
- cross-family inference is not allowed
- missing or ambiguous family scope should fail closed
- legacy profile-pair or `co_parent_id` inference is not part of the intended model

## Authorization Layers

### 1. Route And UI Gates

Current sources:

- [../../src/lib/routeAccess.ts](../../src/lib/routeAccess.ts)
- [../../src/components/ProtectedRoute.tsx](../../src/components/ProtectedRoute.tsx)
- [../../src/components/gates/RoleGate.tsx](../../src/components/gates/RoleGate.tsx)
- [../../src/components/gates/ChildAccountGate.tsx](../../src/components/gates/ChildAccountGate.tsx)
- [../../src/components/gates/AdminGate.tsx](../../src/components/gates/AdminGate.tsx)

These layers improve UX and fail closed for navigation, but they are not the final security boundary.

### 2. Edge Functions And RPCs

Current server-side examples include:

- `aiGuard` for AI role and entitlement checks
- `check-subscription` and `stripe-webhook` for billing state
- `messaging-thread-export` for family-scoped export creation, download, and verification
- invite and notification functions that validate family membership and ownership server-side

### 3. Row Level Security

RLS remains the primary data-enforcement layer. If RLS denies a read or mutation, client-side behavior does not matter.

## Role Model

Current roles in the repo:

- parent
- guardian
- third-party
- child
- admin

Important points:

- admin access is backed by `user_roles` and server-side checks
- child accounts have a smaller route and capability surface
- third-party users are limited to a narrower protected-route allowlist than parents and guardians

## Subscription And Billing Security

The current billing model is enforced server-side.

Repo-confirmed behavior includes:

- durable Stripe customer linking
- status normalization for active, trial, past-due, canceled, expired, and none
- past-due grace handling
- webhook idempotency tracking
- complimentary access handled as a server-side entitlement, not a client flag

Primary sources:

- [../../supabase/functions/check-subscription/index.ts](../../supabase/functions/check-subscription/index.ts)
- [../../supabase/functions/stripe-webhook/index.ts](../../supabase/functions/stripe-webhook/index.ts)

## AI Security Model

AI features are treated as constrained support tools, not autonomous decision-makers.

Repo-confirmed controls include:

- JWT validation
- explicit family-scope checks
- role checks
- subscription checks
- per-action allowlists
- input-length and usage-limit enforcement

Primary source:

- [../../supabase/functions/_shared/aiGuard.ts](../../supabase/functions/_shared/aiGuard.ts)

## Export And Evidence Security

Messaging Hub and family-wide court-record export integrity are now a significant part of the security posture for recorded communication and review packages.

Repo-confirmed controls include:

- explicit `family_id` requirement for export operations
- server-side role and Power-entitlement checks for export creation, listing, download, and verification
- server-generated evidence packages
- server-generated PDF artifacts
- immutable artifact uploads with stored object-version and retention metadata for new exports
- receipt verification paths
- receipt and artifact hashing metadata

Primary sources:

- [../../supabase/functions/messaging-thread-export/index.ts](../../supabase/functions/messaging-thread-export/index.ts)
- [../../supabase/functions/court-record-export/index.ts](../../supabase/functions/court-record-export/index.ts)
- [../../supabase/functions/_shared/courtExportAccess.ts](../../supabase/functions/_shared/courtExportAccess.ts)
- [../../supabase/functions/_shared/courtExportS3.ts](../../supabase/functions/_shared/courtExportS3.ts)
- [../../supabase/functions/_shared/messagingThreadExportIntegrity.ts](../../supabase/functions/_shared/messagingThreadExportIntegrity.ts)
- [../../supabase/functions/_shared/messagingThreadExportPdf.ts](../../supabase/functions/_shared/messagingThreadExportPdf.ts)
- [../../supabase/functions/_shared/courtRecordExportIntegrity.ts](../../supabase/functions/_shared/courtRecordExportIntegrity.ts)
- [../../supabase/functions/_shared/courtRecordExportPdf.ts](../../supabase/functions/_shared/courtRecordExportPdf.ts)
- [../../supabase/migrations/20260401193000_unify_court_exports_for_object_lock.sql](../../supabase/migrations/20260401193000_unify_court_exports_for_object_lock.sql)

Important boundaries:

- New Messaging Hub exports and new family-wide court-record exports now share the same server-side receipt, hash, verification, and immutable-artifact model.
- Daily calling persists session, participant, and event data, and call evidence in the unified export remains session/event history only. The repo does not include call recording or transcripts.
- Family-wide court-record exports include document metadata and access history, not raw document binaries.
- Legacy pre-cutover export artifacts can still exist outside the newer immutable-storage path. That compatibility posture should not be confused with the write-once handling used for newly generated exports.

## Storage And File Posture

Repo-confirmed storage-related surfaces include:

- private problem-report screenshot storage
- private messaging export artifact storage
- admin-only law-library management paths

These should be discussed as private-by-default storage surfaces unless a specific public-sharing mechanism is explicitly documented.

## Push And Notification Security

Repo-confirmed push-related pieces include:

- `push_subscriptions` usage
- `sync-push-subscription`
- shared push helpers
- server-side notification send paths

Physical-device validation is still separate from repo confirmation.

## Deployment Posture: What Is Still Not Fully Closed

The repo currently supports a stricter auth and origin posture than older versions, but some items still require user-assisted confirmation:

- deployed captcha configuration
- deployed localhost-origin posture
- final canonical public host posture
- final passkey posture

These are deployment questions, not code-only questions.

## Failure Handling

Security-sensitive failures should prefer:

- fail closed over silent fallback
- explicit error handling over guessed scope
- server logging over swallowed errors

Missing family scope, failed authorization, or ambiguous ownership should not silently continue.

## Executable References

Helpful repo references:

- [../../src/lib/securityAssertions.ts](../../src/lib/securityAssertions.ts)
- [../../src/lib/routeAccess.ts](../../src/lib/routeAccess.ts)
- [../../supabase/functions/_shared/checkSubscription.test.ts](../../supabase/functions/_shared/checkSubscription.test.ts)
- [../../supabase/functions/_shared/stripeWebhook.test.ts](../../supabase/functions/_shared/stripeWebhook.test.ts)
- [../../supabase/functions/_shared/messagingThreadExport.test.ts](../../supabase/functions/_shared/messagingThreadExport.test.ts)

## Related Docs

- Feature gating: [GATED_FEATURES.md](GATED_FEATURES.md)
- Current project snapshot: [../project/CURRENT_STATUS.md](../project/CURRENT_STATUS.md)
