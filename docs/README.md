# Docs Index

Last reviewed: 2026-03-31

The `docs/` folder is organized by purpose so project-state material, security notes, operational history, and buyer-package work do not get mixed together.

## Claim Standard

Docs in this repo should distinguish between three kinds of statements:

- Repo-confirmed: can be supported directly by code, tests, migrations, scripts, or the current tree.
- Evidence-backed: supported by saved verification artifacts with a date and source.
- User-assisted confirmation still required: deployment behavior or physical-device checks that are not closed by repo inspection alone.

If a statement does not fit one of those categories, it should probably not be in the docs.

## Main Sections

- `project/`: current status, completion split, and near-term execution docs
- `security/`: trust boundaries, feature gates, and security architecture
- `operations/`: internal runbooks and operational notes
- `acquisition/`: outreach, demo, diligence, and internal sale-prep material
- `corrections/`: documentation cleanup notes and alignment fixes
- `archive/`: retired docs kept for history only

## Start Here

- Repo snapshot: [project/CURRENT_STATUS.md](project/CURRENT_STATUS.md)
- Completion split: [project/PROJECT_COMPLETION_REVIEW.md](project/PROJECT_COMPLETION_REVIEW.md)
- Next priorities: [project/next-10-tasks.md](project/next-10-tasks.md)
- Security model: [security/SECURITY_MODEL.md](security/SECURITY_MODEL.md)
- Feature gating: [security/GATED_FEATURES.md](security/GATED_FEATURES.md)
- Buyer package map: [acquisition/internal/BUYER_PACKAGE_INDEX.md](acquisition/internal/BUYER_PACKAGE_INDEX.md)

## Documentation Rules

- Use repo-relative Markdown links, not local absolute filesystem paths.
- Update `project/CURRENT_STATUS.md`, `project/PROJECT_COMPLETION_REVIEW.md`, and `project/next-10-tasks.md` whenever the current-state story changes.
- Keep buyer-facing claims aligned with the evidence log and current status docs.
- Do not describe legacy `co_parent_id` inference, profile-pair scoping, or ambiguous family resolution as current architecture.
