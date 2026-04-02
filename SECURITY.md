# Security Policy

Last reviewed: 2026-03-31

CoParrent is a private project. If you discover a security issue, report it privately and do not open a public issue or pull request.

## Reporting

- Primary contact: `security@coparrent.com`
- Fallback support contact: `support@coparrent.com`

Please include:

- a clear description of the issue
- affected route, feature, table, RPC, or edge function
- reproduction steps
- expected impact
- screenshots, logs, or proof-of-concept details if available
- whether the issue involves family-scoped data, child accounts, billing, or authentication

## Response Targets

- Initial acknowledgement target: within 2 business days
- Status update target: within 14 calendar days

These are operational targets, not guarantees.

## Scope

This policy applies to:

- the Vite/React frontend
- Supabase edge functions and RPC-backed flows
- family-scoped authorization and RLS enforcement
- billing and subscription enforcement
- push notifications, file handling, and AI-assisted features

## Out Of Scope

The following are generally not treated as security reports:

- feature requests
- support requests
- issues caused only by local misconfiguration
- vulnerabilities in third-party services without a CoParrent-specific exploit path

## Safe Testing Rules

- Do not access or modify data that does not belong to you.
- Stop testing once you have demonstrated the issue.
- Do not run destructive load or availability tests without explicit permission.
- Share enough detail to reproduce the issue, but do not publish the report publicly.

## Reference Docs

- Security architecture: [docs/security/SECURITY_MODEL.md](docs/security/SECURITY_MODEL.md)
- Feature gating and access rules: [docs/security/GATED_FEATURES.md](docs/security/GATED_FEATURES.md)
