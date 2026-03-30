# Security Policy

Project owner: Thomas Benson
Company: BNSN Solutions
Website: https://www.bnsnsolutions.com

CoParrent is a private project. If you discover a security issue, report it privately and do not open a public issue or pull request.

## Reporting

- Email: `security@coparrent.com`
- Fallback support contact: `support@coparrent.com`

Please include:

- a clear description of the issue
- affected route, feature, table, or edge function
- reproduction steps
- expected impact
- screenshots, logs, or proof-of-concept details if available
- whether the issue involves family data, child accounts, billing, or authentication

## Response Expectations

- Initial acknowledgement target: within 2 business days
- Status update target: within 14 calendar days

These are operational targets, not guarantees.

## Scope

This policy applies to:

- the Vite/React frontend
- Supabase edge functions and RPC-backed flows
- family-scoped authorization and RLS enforcement
- billing and subscription enforcement
- push notifications, email notifications, and AI-assisted features

## Out of Scope

The following are generally not treated as security reports:

- feature requests
- support requests
- issues caused only by local misconfiguration
- vulnerabilities in third-party services without a CoParrent-specific exploit path

## Handling

- Please avoid accessing or modifying data that does not belong to you.
- Please stop testing once you have demonstrated the issue.
- We may ask for validation details or a retest after a fix is prepared.

## Architecture Reference

Implementation details and trust-boundary notes live in [docs/security/SECURITY_MODEL.md](docs/security/SECURITY_MODEL.md).
