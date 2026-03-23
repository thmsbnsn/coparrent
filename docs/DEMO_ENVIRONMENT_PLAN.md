# CoParrent Demo Environment Plan

_Last updated: 2026-03-22_

Prepared for:
- **BNSN Solutions**
- **Owner:** Thomas Benson
- **Website:** https://www.bnsnsolutions.com

## Purpose

This is the internal plan for demoing CoParrent to a buyer.

The buyer should not have to create accounts, imagine missing data, or guess what the product is supposed to do.

The demo environment needs to answer a simple question:

"If we bought this, what would we actually be getting?"

## Demo Rules

- Show what is real now.
- Do not claim features that are still future work.
- Do not use empty screens if seeded data can fix the problem.
- Do not use obviously fake filler text.
- Do not make the buyer work to understand the product.

This needs to feel like a working product, not a dev environment.

## What The Demo Needs To Prove

The demo should make these points clear without needing a long explanation:

- the product has real workflow depth
- the product is broader than a messaging-only co-parenting app
- the product is already organized around real user roles
- premium architecture exists
- court-aware recordkeeping is already part of the product direction
- the codebase and documentation are not a mess

## Best Demo Setup

Use one environment only.

Best order of preference:

1. a preview deployment that matches the current repo state
2. production, only if production is fully aligned and verified

Do not switch between environments mid-demo.

## Accounts To Prepare

Use dedicated demo accounts tracked in `docs/tester-accounts-template.md` and the local gitignored credential file.

Prepare at least these accounts:

1. **Primary parent account**
   - fully onboarded
   - active family membership
   - realistic dashboard data

2. **Co-parent account**
   - already joined to the same family
   - enough content to show shared workflow

3. **Third-party account**
   - limited access scenario already accepted
   - good for showing professional or support-role boundaries

4. **Child account**
   - working child-facing view
   - tied to realistic family content

5. **Power / premium parent account**
   - active paid or complimentary Power state
   - used to show premium gating and unlocked features

If possible, the primary parent account should also have a pending invitation history so the data feels lived in.

## Data To Seed

The demo family should look believable at a glance.

Recommended baseline:

- 2 children
- recurring parenting schedule
- upcoming custody exchange
- 6-10 calendar events
- 10-20 message-thread items
- 3-5 expense entries
- 2-3 reimbursement-related examples
- 3-5 documents
- child health and school info filled in
- 2-3 journal entries
- one sports-related item and reminder
- one exchange check-in record

The goal is not to stuff the product with noise. It is to avoid dead air.

## Suggested Demo Story

Use the same story every time.

Recommended setup:

- two separated parents sharing care for two children
- one third-party role such as a grandparent, sitter, therapist, or other support adult
- one child-facing view that shows the product is not just an admin shell
- one premium path so the buyer can see monetization structure already exists

## Demo Flow

Keep the live walkthrough between 7 and 10 minutes.

### 1. Start at the parent dashboard

Show:

- that the account lands in a real working home view
- that family context is already established
- that the product does not feel empty

### 2. Show calendar and schedules

Show:

- recurring schedule depth
- exchanges and event structure
- that this is not just a static calendar widget

Important note:

- exchange check-ins are timestamp-based only
- do not describe them as GPS-verified

### 3. Show messaging and record posture

Show:

- thread structure
- that the product is built for communication history
- that the product already takes immutable records seriously

Do not overstate this:

- immutable record posture is real
- certified or notarized record packaging is not fully there yet

### 4. Show child info, documents, and journal depth

Show:

- child profile information
- practical family-document handling
- journal/history value

This is where the product starts to feel broader than the competitors that are mostly communication-first.

### 5. Show expenses and premium gating

Show:

- tracked expenses
- reimbursement workflow
- that premium structure already exists

If using the premium account, show one locked state and one unlocked state.

### 6. Show third-party access boundaries

Show:

- that not every role sees everything
- that the product already understands restricted access

This helps the buyer see professional and support-role expansion potential.

### 7. Show the child-facing or kids view

Show:

- that the app is not purely administrative
- that there is room for family engagement, not just conflict management

### 8. End with the honest close

Say plainly:

- what is already real
- what still needs final live verification
- what the next owner could turn into a stronger market position

Do not improvise new roadmap promises in the room.

## Recorded Demo Checklist

Before recording:

- use the same environment that will be shown live
- make sure seeded data is visible in the first minute
- close unrelated tabs and developer tools
- confirm no personal or production-sensitive data is on screen
- test the login flow before recording

The recorded demo should be:

- short
- clean
- voiceover optional
- easy to send after buyer interest is confirmed

## Screenshots To Capture

Prepare a simple screenshot set for outreach and follow-up:

- parent dashboard
- calendar / schedule view
- message thread
- child info or document screen
- expense or reimbursement view
- premium gate or unlocked premium feature
- third-party or child-facing screen

## Demo Honesty Checklist

Do not say any of these unless they are actually true in the environment being shown:

- "GPS check-ins"
- "native iOS and Android apps"
- "certified court export package"
- "fully launch-ready live system"
- "production traffic"
- "active paying user base"

The fastest way to lose leverage is to make a buyer discover an avoidable overstatement.

## Open Items Still Requiring Manual Closure

These are not blockers to preparing the demo package, but they still need to be handled before heavy buyer diligence:

- fresh co-parent invite acceptance using a clean inbox
- fresh third-party invite acceptance using a clean inbox
- live Stripe checkout and webhook verification
- OpenRouter runtime verification in the deployed environment
- push/PWA validation on real devices
- preview and production alignment

## Bottom Line

The demo environment is not just a convenience.

It is part of the sale.

If the buyer can log in and immediately understand the product, the conversation stays about value.
If the buyer hits setup friction, the conversation turns into doubt.
