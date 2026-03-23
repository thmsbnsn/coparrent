# Contributing

This project is developed and maintained by BNSN Solutions.
Owner: Thomas Benson
Website: https://www.bnsnsolutions.com

CoParrent is a private repository. Contributions should stay aligned with the documented product guardrails, security model, and current completion plan before code is changed.

## Before You Start

- Read [README.md](README.md) for architecture, routing, auth, and product rules.
- Check [docs/CURRENT_STATUS.md](docs/CURRENT_STATUS.md) for the current operational snapshot.
- Check [docs/PROJECT_COMPLETION_REVIEW.md](docs/PROJECT_COMPLETION_REVIEW.md) before starting work that is intended to unblock release readiness.
- Review [SECURITY.md](SECURITY.md) and [docs/SECURITY_MODEL.md](docs/SECURITY_MODEL.md) for any auth, billing, RLS, or child-data changes.

## Local Setup

This repo is currently pinned to the Node version in [.nvmrc](.nvmrc).

```bash
nvm use
npm ci
npm run dev
```

## Required Verification

Before opening a pull request or merging a change, run:

```bash
npm run verify
```

That command is the repo standard and currently runs:

- lint
- tests
- production build

## Change Expectations

- Keep changes scoped and reversible.
- Update docs when behavior, architecture, environment requirements, or release status changes.
- Prefer targeted tests with the change instead of widening unrelated scope.
- Preserve the current AI provider direction: OpenRouter only.
- Do not commit secrets, personal test data, or local environment files.

## Files and Folders to Treat Carefully

The following paths often contain local-only or generated material and should not be treated as normal source edits unless the task explicitly requires it:

- `.env`
- `_(2).env`
- `.materials/`
- `dev-dist/`
- `dist/`
- `output/`
- `tmp/`
- `supabase/.temp/`

## Pull Request Checklist

Include the following in each PR:

- concise summary of the change
- user-facing impact
- verification performed
- schema, env, billing, or auth implications
- docs updated when required
- screenshots or recordings for UI changes

## Database and Edge Function Changes

If you touch `supabase/`:

- document any new secrets or config requirements
- call out any RLS or family-authorization impact
- note whether live verification is still required after deploy

## Security Reporting

Do not file security issues publicly. Use the process in [SECURITY.md](SECURITY.md).
