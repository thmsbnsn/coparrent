# CoParrent Acquisition One-Pager

_Last updated: 2026-03-20_

Prepared by:
- **BNSN Solutions**
- **Owner:** Thomas Benson
- **Website:** https://www.bnsnsolutions.com

## What This Is

CoParrent is a real co-parenting product, not a concept deck and not a half-finished UI shell. It already covers the main workflows a buyer would expect in this category: calendar and scheduling, family messaging, child information, documents, expenses, journaling, premium gating, and a few family-adjacent extensions like sports, kids tools, and AI-assisted features.

The right way to look at it is as a serious vertical product foundation. A buyer is not saving a week of design or frontend work here. A buyer is skipping months of product decisions, permissions work, billing setup, data modeling, and category-specific problem solving.

## What Exists Today

The product already includes:

- co-parenting calendar and schedule management
- family messaging with immutable records
- child profiles with medical, school, and emergency details
- secure document management
- expense tracking and reimbursement workflows
- private journaling and exchange-linked notes
- invitation flows for co-parents and third parties
- law-library content and admin support
- kids hub and creative tools
- sports and events coordination
- premium gating with Stripe architecture
- OpenRouter-backed AI features
- PWA install and push support

## Why It Is Worth Buying

The value here is not just that there is a lot of code. The value is that the code already reflects the shape of the market.

CoParrent has already made the hard product decisions around:

- family-scoped access
- role differences between parents, kids, and third parties
- court-aware messaging and records
- child-info structure
- premium feature boundaries
- privacy-sensitive workflow design

That is the work that usually burns time on a vertical product. It has already been done.

## Where It Stands Technically

The current local repo is in good shape:

- `npm run verify` passes
- lint passes cleanly
- tests pass
- targeted regression coverage exists for the higher-risk flows

There are also a few important caveats that should be stated plainly:

- messaging records are already immutable
- exchange check-ins exist, but they are timestamp-based and not GPS-verified
- AI in the repo is standardized on OpenRouter only
- the local repo is ahead of the live frontend, so the public deployment should not be treated as the exact latest state

## What Still Needs To Be Closed Before Full Buyer Outreach

The remaining work is mostly diligence and launch confidence work, not major product construction:

- close the remaining live verification items
- verify the OpenRouter-backed runtime flows after deployment
- verify live Stripe checkout, webhook, and portal behavior
- validate push and PWA behavior on real devices
- remove or formally justify temporary QA exceptions
- package a proper demo environment and buyer data room

## Best Buyer Fit

The strongest buyer fits are straightforward:

- a family-tech company that wants to add a co-parenting product quickly
- a legal-tech or documentation-focused buyer
- a development studio that wants a strong vertical SaaS base to own or rework
- a software holding company looking for a specialized product with real workflow depth

## How I Would Position The Deal

I would not pitch CoParrent as a mature SaaS company unless current revenue, pilots, or active customer numbers are added separately. I would pitch it as a strong product acquisition.

The practical buyer benefit is simple: if a buyer wants to be in this category, buying this is faster and cleaner than starting from zero.

The best deal shape is likely:

- asset acquisition
- short transition support from seller
- pricing based on replacement cost avoided and strategic fit, not commodity development pricing

## Straight Disclosure

This package should currently be presented as a product and software asset sale. If commercial traction is added later, that should be layered on top of the story, not implied where it does not yet exist.

## Next Docs

- [BUYER_FAQ.md](E:/Files/.coparrent/docs/BUYER_FAQ.md)
- [DEMO_SCRIPT.md](E:/Files/.coparrent/docs/DEMO_SCRIPT.md)
- [DATA_ROOM_CHECKLIST.md](E:/Files/.coparrent/docs/DATA_ROOM_CHECKLIST.md)
- [SELL_READINESS_PLAN.md](E:/Files/.coparrent/docs/SELL_READINESS_PLAN.md)
