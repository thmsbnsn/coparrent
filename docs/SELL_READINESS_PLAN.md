# CoParrent Sale Readiness Plan

_Last updated: 2026-03-20_

Prepared for:
- **BNSN Solutions**
- **Owner:** Thomas Benson
- **Website:** https://www.bnsnsolutions.com

## Purpose

This document is about getting **CoParrent** ready to sell well.

It is not a consumer growth plan.
It is not a "keep adding features forever" plan.
It is not a fake SaaS valuation exercise.

The job here is to make the asset easier to trust, easier to transfer, and easier to price.

## Core Thesis

If this gets sold before it has meaningful revenue, buyers will not price it like a mature SaaS business. They will price it like a product asset.

That means the payout will come from:

- how complete it feels
- how clean the diligence is
- how believable the handoff is
- how much time it saves the buyer
- how easy it is to see where it fits in the market

It will not come from adding random features just because competitors have them.

## Current Position

### Current strengths

- Broad feature footprint: calendar, messaging, child info, documents, expenses, journal, law library, kids hub, sports hub, AI assistance, push/PWA.
- Clean local engineering baseline: `npm run verify` passes, lint passes cleanly, and the targeted regression suite is in place.
- Buyer-relevant documentation already exists in:
  - `docs/CURRENT_STATUS.md`
  - `docs/PROJECT_COMPLETION_REVIEW.md`
  - `docs/SECURITY_MODEL.md`
  - `README.md`
- Messaging already supports immutable records for court-friendliness.
- Exchange check-ins already exist, but they are timestamp-based and not GPS-verified.
- Billing, auth, gating, and AI provider direction are already defined in the repo.

### Current blockers to sale-readiness

- Live verification is still incomplete in a few buyer-sensitive areas: invite acceptance, AI runtime, Stripe, and real-device push/PWA behavior.
- Temporary QA exceptions still exist.
- The local repo is ahead of the live frontend.
- The product still needs a real data room and a tight transfer package.
- The professional-access angle exists, but it is not packaged cleanly enough yet.

## Best Buyer Types

The buyers most likely to pay well are:

1. **Strategic software buyers**
   - family-tech, legal-tech, parenting, or health-adjacent software companies
   - buyers who want to add co-parenting workflow quickly

2. **Development companies / product studios**
   - agencies or studios that buy strong foundations and rebrand / reposition them
   - this matches the product's current value as a build head start

3. **Operator-buyers**
   - small software holding companies or acquisition entrepreneurs
   - more price-sensitive than strategic buyers
   - usually care more about transferability and less about vision

4. **Law-office / court-adjacent service providers**
   - only worth targeting if the professional-access story gets tightened first

## What "Ready to Sell" Means

CoParrent is ready to sell when a serious buyer can say:

- the codebase is understandable
- the system can be run without the founder living inside it
- the live product behavior matches the repo
- the legal/IP chain is clear
- the infrastructure and secrets are mapped
- the known risks are documented
- there is a credible reason to believe the asset can be commercialized quickly

That is the real bar.

## Tier 1: Must Finish Before Buyer Outreach

These items should be treated as required.

### 1. Close the live-system verification gap

Complete and document:

- fresh co-parent invite acceptance test with a clean inbox/account
- fresh third-party invite acceptance test with a clean inbox/account
- OpenRouter runtime verification for Nurse Nancy, activity generation, and coloring-page generation
- live Stripe checkout, webhook, downgrade, and customer-portal verification
- push notification and PWA validation on real iOS, Android, and desktop devices
- preview and production sync so the buyer is not evaluating a stale live build

This is the fastest way to remove the worst kind of buyer doubt: "Looks good, but does it really work?"

### 2. Remove temporary security exceptions

Complete and document:

- re-enable auth captcha if it is still intended for launch posture
- disable `ALLOW_LOCALHOST_ORIGINS` in production unless there is a documented permanent reason not to
- finalize the access-code policy
- confirm production secrets and environment inventory

No serious buyer likes finding temporary launch shortcuts in the middle of diligence.

### 3. Build a buyer-ready demo environment

Create a stable demo package:

- 2-3 seeded demo accounts with realistic data
- one parent/co-parent family
- one third-party/professional access scenario
- one paid/power scenario
- one short "happy path" demo script
- a 5-10 minute recorded walkthrough
- screenshot set for listing materials

The buyer should be able to understand the product without doing setup work for you.

### 4. Create the acquisition data room

Assemble a folder or doc set with:

- product overview memo
- system architecture diagram
- environment and secret inventory
- deployment runbook
- Supabase schema and function map
- feature matrix
- test and verification summary
- known issues and open risks
- dependency/provider inventory
- domain, hosting, and account ownership list
- post-sale transition plan

For a product asset like this, the data room matters a lot. Good packaging can move price. Bad packaging can kill momentum.

### 5. Finish legal and IP hygiene

Before selling, the following must be explicit:

- BNSN Solutions owns the code and sale rights
- Thomas Benson is the authorized seller
- domains and product assets are under transferable control
- all third-party libraries and services are documented
- no unclear license obligations remain
- no contributor or contractor ownership ambiguity remains
- privacy policy, terms, and security docs align with the actual operating company

If ownership is fuzzy, price drops fast.

### 6. Prepare sale collateral

At minimum, create:

- one-page acquisition summary
- product feature summary
- technical summary
- buyer FAQ
- known limitations and roadmap memo
- list of buyer-fit angles:
  - family-tech platform
  - legal-tech / court-record tool
  - parenting/family SaaS expansion
  - development-studio acceleration asset

This material should read like it was prepared by someone who knows the product cold, because it was.

## Tier 2: High-Payout Multipliers

These items are not strictly required to approach buyers, but they are the most likely to improve price materially.

### 1. Add demand proof without building a full user base

Because the goal is not to spend the next year grinding out a user base, the right move is lightweight validation, not a full go-to-market campaign.

Best options:

- 2-5 interviews with family-law attorneys, mediators, or parenting coordinators
- 2-3 written endorsements or validation emails
- 1-3 design partners or pilot conversations
- one buyer-quality memo summarizing who wants the product and why

For a pre-revenue asset, this usually does more for value than another month of feature work.

### 2. Tighten the professional-access story

The repo already contains law-office scaffolding, but it should either be:

- made real enough to demo confidently, or
- clearly reframed as future roadmap rather than active product capability

Half-built positioning creates buyer hesitation.

### 3. Upgrade the court-record package

CoParrent already has immutable message records.

The bigger value opportunity is:

- export authentication IDs
- tamper-evident export hashes
- manifest of included records and timestamps
- stronger affidavit / certification support
- polished evidence package UX

This is a better use of time than chasing broad feature sprawl.

### 4. Package the market story more sharply

The buyer should immediately understand where CoParrent fits:

- calmer alternative to high-conflict-only tools
- court-aware without being legal advice
- broader family coordination than messaging-only apps
- expandable into professional workflows, payments, or certified records

Buyers do not just buy code. They buy where the code fits.

## Tier 3: Defer Unless Buyer Demand Justifies It

These features may be valuable eventually, but they should **not** be built before outreach unless a buyer, advisor, or design partner explicitly confirms they matter.

- native iOS/Android apps
- in-app audio/video calls with recording/transcripts
- direct money movement / payment rails
- GPS-verified check-ins
- shared family photo/moments layer
- broad solo / non-user workflow support

These are expensive scope expansions. They may help later, but they can also waste months without moving the final number.

## Recommended Sale Process

### Phase 1: Finish the asset

Complete Tier 1.

### Phase 2: Increase confidence

Complete the strongest Tier 2 items:

- light market validation
- professional workflow clarification
- stronger court-record package

### Phase 3: Prepare materials

Create:

- teaser
- acquisition memo / CIM-lite
- demo video
- screenshot set
- buyer FAQ
- data room

### Phase 4: Approach the right buyers

Start with:

- strategic family-tech / legal-tech buyers
- product studios and agencies
- software holding companies and operator-buyers

If the ask is going to live above low six figures, it is worth considering an M&A advisor who actually understands software deals.

## What Not to Do

To maximize payout, avoid these mistakes:

- do not keep adding random features with no buyer validation
- do not present the live product if it is behind the repo
- do not claim launch-readiness while temporary QA exceptions remain
- do not go to market without a transfer package
- do not anchor valuation to public SaaS multiples if there is no revenue
- do not let a buyer discover basic diligence gaps before you show them yourself

Nothing kills leverage faster than avoidable surprises.

## Sale Readiness Checklist

The project should be considered "sale ready" only when all of the following are true:

- live core flows are verified
- security exceptions are resolved or explicitly justified
- local repo and live product are aligned
- demo accounts exist
- demo walkthrough exists
- data room exists
- legal/IP ownership is clean
- buyer memo exists
- known risks are documented
- transition plan exists

## Valuation Context

The market data is useful, but it needs to be applied honestly.

- Acquire.com's February 11, 2026 report says profitable SaaS businesses on its platform sold at a **median profit multiple of 3.9x** in both 2024 and 2025.
- The same report notes public SaaS revenue multiples fell to roughly **5.5x by the end of 2025**.
- Acquire.com also notes that **pre-revenue businesses are a hard sell** and require evidence of market understanding, problem/solution fit, and growth potential rather than just projections.

Those multiples do not apply directly here unless the product has real recurring revenue.

For CoParrent, the real valuation drivers are:

- replacement cost avoided by the buyer
- product completeness
- vertical specificity
- code and infrastructure quality
- diligence readiness
- buyer fit
- demand evidence

## My Market Value Estimate

This is not a formal appraisal. It is a practical estimate based on:

- the current repo state
- the amount of completed product surface
- the lack of verified recurring revenue
- current private software market conditions
- the kind of buyer most likely to acquire this asset

### Estimated current value today

If sold now, before the full sell-readiness work is finished:

- **Likely fair market value:** **$35,000-$90,000**

Reason:
- strong build depth
- weak revenue proof
- unresolved live verification and diligence friction

### Estimated value after completing this plan

If Tier 1 is completed and the strongest Tier 2 items are packaged well:

- **Likely fair market value:** **$100,000-$225,000**
- **Most realistic midpoint target:** **about $165,000**

### Stretch outcome

A sale above **$250,000** becomes more plausible only if at least one of these is added:

- signed pilot / design partner interest
- early recurring revenue
- strong professional-buyer validation
- buyer competition created through a structured outreach process

Without that proof, pushing far above this range will likely reduce buyer seriousness.

## Bottom Line

The best way to get paid well is not to keep building forever.

It is to:

1. finish the live verification and security cleanup
2. package the product like a serious acquisition target
3. produce a buyer-ready demo and data room
4. gather lightweight but credible market validation
5. approach strategic buyers with a clean story and a realistic ask

If executed well, CoParrent can be positioned as a strong strategic software asset rather than just a source-code repository.

## External Reference Notes

These references informed the strategy and valuation context in this document:

- Acquire.com Biannual Acquisition Multiples Report, February 11, 2026  
  https://blog.acquire.com/acquire-com-biannual-acquisition-multiples-report-jan-2026/
- Acquire.com, What Buyers Look For When Doing Technical Diligence on Your Company  
  https://blog.acquire.com/how-buyers-do-technical-diligence/
- Acquire.com, 8 Steps in the Acquisition Due Diligence Checklist  
  https://blog.acquire.com/acquisition-due-diligence-checklist-2/
- Acquire.com, How to Properly Prepare for an Acquisition as a Seller  
  https://blog.acquire.com/how-to-properly-prepare-for-an-acquisition-as-a-seller-webinar/
- Acquire.com, Getting Deal Ready: How to Prep for a Smooth, Profitable Exit  
  https://blog.acquire.com/getting-deal-ready-how-to-prep-for-a-smooth-profitable-exit-webinar-recap/
- Axial, How to Value a Technology Company: A Guide for Business Owners, March 3, 2026  
  https://www.axial.net/forum/how-to-value-a-technology-company/
