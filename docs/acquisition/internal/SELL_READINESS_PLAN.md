# CoParrent Sale Readiness Plan

Last updated: 2026-03-31

## Purpose

This plan is about making CoParrent easier to trust, easier to transfer, and easier to evaluate as an asset sale.

It is not a consumer growth plan.
It is not a speculative SaaS valuation model.
It is not a justification for indefinite feature expansion.

## Current Position

### Strengths

- Broad product surface already exists in the repo: scheduling, messaging, documents, expenses, sports, Kids Hub tools, billing, admin, and support flows.
- The local engineering baseline is currently green: lint, build, and the full Vitest suite pass.
- Core architecture docs, security docs, and buyer-package docs all exist in the repo.
- The repo includes verification helpers and a March 2026 evidence log for several live-system checks.
- The family-scoped architecture and server-enforced billing model are clearer now than they were earlier in the project.
- Messaging Hub export integrity is a materially stronger evidentiary surface than it was earlier in the project.

### Gaps That Still Matter To Buyers

- Real-device push/PWA behavior is still not closed with physical-device evidence.
- Some deployment-sensitive claims still depend on user-assisted confirmation rather than repo inspection.
- The broader court-record story is still uneven across surfaces: strongest in Messaging Hub exports, partial in calling, and weaker in the older documents-page court-export flow.
- Buyer-demo preparation still needs a stable walkthrough target and polished demo assets.
- The data-room structure exists, but a buyer still benefits from a tighter, more curated package rather than a large pile of docs.

## What "Ready To Sell" Means

CoParrent is sale-ready when a serious buyer can see that:

- the codebase is understandable
- the system can be operated without undocumented founder knowledge
- the buyer package clearly separates repo-confirmed facts from deployment confirmations
- the infrastructure, accounts, secrets, and transfer steps are documented
- the remaining risks are explicit and bounded

## Tier 1: Finish Before Serious Buyer Outreach

### 1. Close the physical-device verification gap

- Complete real-device push/PWA validation on iOS, Android, and desktop.
- Save evidence in the diligence log instead of relying on summary prose.

### 2. Close the deployment-confirmation gap

- Confirm deployed captcha posture.
- Confirm localhost-origin posture for deployed edge functions.
- Confirm the canonical public host and redirect behavior.
- Treat these as deployment checks, not as repo-complete work.

### 3. Prepare a stable buyer demo target

- Preserve or seed one clean demo family.
- Ensure the strongest public pages and dashboard flows can be shown without caveats.
- Produce a short walkthrough that matches the current repo and evidence log.

### 4. Curate the diligence package

- Keep the data-room index current.
- Make the ownership, provider-account, and transfer docs easy to follow.
- Reduce duplicated or stale current-state language across the buyer package.

### 5. Keep legal and ownership posture explicit

- Keep ownership, transferability, and provider-account control documented.
- Keep no-revenue framing explicit unless commercial numbers are added later.

## Tier 2: Multipliers

These are not required to have a credible asset, but they can improve buyer confidence materially.

### 1. Lightweight market proof

- Gather a small set of serious buyer- or operator-relevant validation signals.
- Capture them in a concise memo instead of turning this into a long GTM project.

### 2. Sharper professional-access story

- Decide whether professional or law-office access is a near-term product angle or simply a future roadmap item.
- Do not present partial scaffolding as if it is already a product line.

### 3. Better demo collateral

- Capture a clean screenshot set.
- Record a short walkthrough.
- Keep collateral aligned with the evidence log and current status docs.

## What Not To Do

- Do not market the asset using claims that are not repo-confirmed or evidence-backed.
- Do not present deployment assumptions as settled if they still require user-assisted confirmation.
- Do not add broad new feature areas just to make the package feel bigger.
- Do not let older docs keep stale claims alive once the repo or deployment posture changes.

## Sale Readiness Checklist

- local lint/build/test status is green
- current-status docs are aligned with the repo
- live evidence is dated and linked
- device-validation status is explicit
- deployment posture is explicit
- ownership and transfer docs are current
- demo target and demo script are ready
- buyer-facing positioning stays in product-asset territory unless commercial evidence changes
