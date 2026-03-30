# Docs Index

The `docs/` folder is organized by purpose so project-state material, security notes, and buyer-package work do not get mixed together.

## Main Sections

- `project/`: active status, completion, and near-term execution docs
- `security/`: access model, gating rules, and security architecture
- `operations/`: internal runbooks and historical operational notes worth keeping
- `acquisition/outreach/`: buyer-facing materials and outreach docs
- `acquisition/demo/`: demo scripts, demo environment planning, and seeded-account templates
- `acquisition/diligence/`: diligence-room docs, ownership notes, and transfer inventories
- `acquisition/internal/`: internal sale strategy, packaging, and pricing docs
- `archive/`: retired docs kept only for historical reference

## Start Here

- Product snapshot: [CURRENT_STATUS.md](/E:/Files/.coparrent/docs/project/CURRENT_STATUS.md)
- Remaining completion items: [PROJECT_COMPLETION_REVIEW.md](/E:/Files/.coparrent/docs/project/PROJECT_COMPLETION_REVIEW.md)
- Daily calling plan: [DAILY_CALLING_BUILD_PLAN.md](/E:/Files/.coparrent/docs/project/DAILY_CALLING_BUILD_PLAN.md)
- Branded Google auth setup: [BRANDED_GOOGLE_AUTH_SETUP.md](/E:/Files/.coparrent/docs/project/BRANDED_GOOGLE_AUTH_SETUP.md)
- Problem report setup: [PROBLEM_REPORT_SETUP.md](/E:/Files/.coparrent/docs/project/PROBLEM_REPORT_SETUP.md)
- Security model: [SECURITY_MODEL.md](/E:/Files/.coparrent/docs/security/SECURITY_MODEL.md)
- Buyer package map: [BUYER_PACKAGE_INDEX.md](/E:/Files/.coparrent/docs/acquisition/internal/BUYER_PACKAGE_INDEX.md)

## Notes

- Historical documents should move into `archive/` instead of staying at the root.
- New docs should be added to the closest topical folder and linked from the relevant index doc when appropriate.
- Family-scoped architecture uses `activeFamilyId` and explicit `family_id` as the source of truth for core operational flows; docs should not describe legacy relationship inference as current architecture.
