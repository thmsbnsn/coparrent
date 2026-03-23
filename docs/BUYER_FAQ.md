# CoParrent Buyer FAQ

_Last updated: 2026-03-20_

## What is CoParrent?

CoParrent is a co-parenting platform built for separated or divorced families. It already covers the day-to-day coordination side of the category: scheduling, messaging, child info, documents, expenses, journaling, legal-content workflows, premium features, and some family-support tools.

## What is being sold?

The intended package is the software asset and the materials needed to transfer it cleanly, subject to final deal terms and what the seller controls directly. That typically means:

- application source code
- documentation
- deployment and configuration knowledge
- brand and product materials owned by the seller
- infrastructure handoff plan

The exact transfer list should be nailed down during diligence, not guessed up front.

## Is the product already built?

Yes. Substantially.

This is not an idea-stage prototype. It is a real product base with meaningful workflow depth and a working stack behind it.

## Is it live?

Yes, but with an important caveat: the local repo is ahead of the live frontend right now. So the product should be shown through the packaged demo and current documentation, not by assuming the public deployment reflects every recent repo change.

## What is already verified?

The current repo has a clean local engineering baseline:

- lint passes
- tests pass
- build passes
- targeted regression coverage exists for high-risk flows

Details live in:
- [CURRENT_STATUS.md](E:/Files/.coparrent/docs/CURRENT_STATUS.md)
- [PROJECT_COMPLETION_REVIEW.md](E:/Files/.coparrent/docs/PROJECT_COMPLETION_REVIEW.md)

## What is not fully verified yet?

The main remaining live checks are:

- fresh co-parent invite acceptance
- fresh third-party invite acceptance
- OpenRouter runtime verification after deployment
- live Stripe checkout, webhook, and portal verification
- push notifications and PWA behavior on real devices

That is sale-readiness work, not evidence that the product is vapor.

## Does it have immutable records?

Yes, in an important area.

Messaging is already built so messages cannot be edited or deleted after sending. That part is real and implemented.

What it does not yet have is the heavier evidence packaging some competitors use, such as certified export bundles, tamper-evident manifests, or affidavit-style record packaging.

## Does it have exchange check-ins?

Yes.

But they are timestamp-based, private, and not GPS-verified. If a buyer wants location-verified exchange evidence, that would be additional work.

## What is the AI setup?

The repo now uses **OpenRouter only** for AI.

Current AI areas include:

- message tone assistance
- schedule suggestions
- Nurse Nancy
- activity generation
- coloring-page generation

The provider direction is settled. The remaining work is runtime verification after deployment.

## What is the tech stack?

Primary stack:

- React
- TypeScript
- Vite
- Supabase
- Stripe
- OpenRouter
- Vercel

## Is the codebase documented?

Yes. More than most projects at this stage.

Key docs already exist for:

- project status
- security model
- gated features
- completion review
- architecture and product behavior

## Why is it being sold?

The simple answer is that the seller prefers building and packaging products more than running long commercialization cycles. That is a business preference, not a distress signal.

## Is there revenue?

Unless separate current numbers are provided by the seller, this should be treated as a product acquisition, not a revenue-multiple SaaS exit.

## What are the strongest reasons to buy this instead of building from scratch?

- broad vertical feature coverage already exists
- family-scoped auth and permissions are already modeled
- billing, premium gating, and docs already exist
- market-specific UX and data design work are already done
- the product is documented well enough to transfer
- a buyer can get to market much faster

## What are the biggest current risks?

- live verification is not yet fully closed
- temporary QA exceptions still need final cleanup
- the live frontend is not yet fully aligned with the current repo
- the professional-access story exists but still needs to be tightened

## What would most improve value before sale?

- closing the live verification gap
- packaging a proper buyer demo environment
- preparing a data room
- tightening ownership and transfer docs
- adding lightweight outside validation from attorneys, mediators, or design partners

In plain terms: close the diligence gaps, package the demo properly, and give buyers fewer reasons to hesitate.

## What kind of buyer is the best fit?

- strategic family-tech buyer
- legal-tech or documentation-focused buyer
- development studio that wants a vertical SaaS foundation
- software holding company or operator-buyer

## Can the product be rebranded?

Yes. That is one of the clearest uses for this acquisition.

The codebase is already in a form that could be rebranded, relaunched, or repositioned, assuming the final transfer scope is handled cleanly.

## What support can the seller provide after sale?

The most sensible post-sale support package would be:

- short transition support
- architecture walkthrough
- deployment and environment handoff
- product and workflow Q&A

That support should be defined clearly in the deal, not left vague.

## Where should a buyer look next?

- [ACQUISITION_ONE_PAGER.md](E:/Files/.coparrent/docs/ACQUISITION_ONE_PAGER.md)
- [DEMO_SCRIPT.md](E:/Files/.coparrent/docs/DEMO_SCRIPT.md)
- [DATA_ROOM_CHECKLIST.md](E:/Files/.coparrent/docs/DATA_ROOM_CHECKLIST.md)
- [SELL_READINESS_PLAN.md](E:/Files/.coparrent/docs/SELL_READINESS_PLAN.md)
