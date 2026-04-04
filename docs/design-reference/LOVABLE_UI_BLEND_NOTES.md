# Lovable UI Blend Notes

## Reference folder

- Reserved reference path: `docs/design-reference/coparrent-vision`
- Current status: cloned successfully from GitHub as a non-runtime design reference checkout.
- Reference commit: `4a2c23db9520193a90197caf7eeeedc68fabdf3a`

## Visual patterns adopted

- Shared surface tiers and production palette tokens were introduced in [`src/index.css`](/e:/Files/.coparrent/src/index.css):
  - `surface-hero`
  - `surface-primary`
  - `surface-standard`
  - `surface-secondary`
  - `surface-legal`
- The reference palette now drives:
  - public page ambient backgrounds
  - authenticated app shell background
  - elevated shadow scale
  - tinted support panels
- Shared hierarchy helpers were added for:
  - eyebrow pills
  - status pills
  - section titles and copy
  - public/app shell widths
- Shared UI primitives now mirror the reference repo structure without importing it:
  - [`src/components/ui/PageHero.tsx`](/e:/Files/.coparrent/src/components/ui/PageHero.tsx)
  - [`src/components/ui/SectionCard.tsx`](/e:/Files/.coparrent/src/components/ui/SectionCard.tsx)
  - [`src/components/ui/SectionHeader.tsx`](/e:/Files/.coparrent/src/components/ui/SectionHeader.tsx)
  - [`src/components/ui/StatusPill.tsx`](/e:/Files/.coparrent/src/components/ui/StatusPill.tsx)
- The landing page now leans into:
  - darker premium hero framing
  - stronger CTA hierarchy
  - more consistent card depth across feature and support sections
- Shared chrome now also follows the reference direction:
  - public navbar and footer
  - authenticated dashboard sidebar and top bar
  - public page shell background treatment
- Authenticated product pages now distinguish:
  - premium operational surfaces for dashboard and games
  - more formal document-style surfaces for legal review modes in messaging and calendar

## Files updated

- [`src/index.css`](/e:/Files/.coparrent/src/index.css)
- [`src/components/ui/PageHero.tsx`](/e:/Files/.coparrent/src/components/ui/PageHero.tsx)
- [`src/components/ui/SectionCard.tsx`](/e:/Files/.coparrent/src/components/ui/SectionCard.tsx)
- [`src/components/ui/SectionHeader.tsx`](/e:/Files/.coparrent/src/components/ui/SectionHeader.tsx)
- [`src/components/ui/StatusPill.tsx`](/e:/Files/.coparrent/src/components/ui/StatusPill.tsx)
- [`src/components/dashboard/DashboardLayout.tsx`](/e:/Files/.coparrent/src/components/dashboard/DashboardLayout.tsx)
- [`src/components/landing/PublicLayout.tsx`](/e:/Files/.coparrent/src/components/landing/PublicLayout.tsx)
- [`src/components/landing/Navbar.tsx`](/e:/Files/.coparrent/src/components/landing/Navbar.tsx)
- [`src/components/landing/Footer.tsx`](/e:/Files/.coparrent/src/components/landing/Footer.tsx)
- [`src/components/landing/Hero.tsx`](/e:/Files/.coparrent/src/components/landing/Hero.tsx)
- [`src/components/landing/Features.tsx`](/e:/Files/.coparrent/src/components/landing/Features.tsx)
- [`src/components/landing/HomeSections.tsx`](/e:/Files/.coparrent/src/components/landing/HomeSections.tsx)
- [`src/pages/Index.tsx`](/e:/Files/.coparrent/src/pages/Index.tsx)
- [`src/pages/Dashboard.tsx`](/e:/Files/.coparrent/src/pages/Dashboard.tsx)
- [`src/components/dashboard/BlogDashboardCard.tsx`](/e:/Files/.coparrent/src/components/dashboard/BlogDashboardCard.tsx)
- [`src/pages/Onboarding.tsx`](/e:/Files/.coparrent/src/pages/Onboarding.tsx)
- [`src/components/messages/CourtViewToggle.tsx`](/e:/Files/.coparrent/src/components/messages/CourtViewToggle.tsx)
- [`src/components/messages/ThreadSummaryBar.tsx`](/e:/Files/.coparrent/src/components/messages/ThreadSummaryBar.tsx)
- [`src/pages/MessagingHubPage.tsx`](/e:/Files/.coparrent/src/pages/MessagingHubPage.tsx)
- [`src/pages/CalendarPage.tsx`](/e:/Files/.coparrent/src/pages/CalendarPage.tsx)
- [`src/components/games/GameDashboardHero.tsx`](/e:/Files/.coparrent/src/components/games/GameDashboardHero.tsx)
- [`src/pages/GameDashboard.tsx`](/e:/Files/.coparrent/src/pages/GameDashboard.tsx)
- [`src/components/blog/BlogCard.tsx`](/e:/Files/.coparrent/src/components/blog/BlogCard.tsx)
- [`src/pages/BlogPage.tsx`](/e:/Files/.coparrent/src/pages/BlogPage.tsx)

## Patterns intentionally not copied

- No runtime dependency on the external design repo
- No changes to family scope, authorization, billing, or backend behavior
- No cross-family shortcuts or client-side scope inference
- No broad route or information-architecture redesign
- No renaming of internal `court` state or logic where it already drives legal/document modes safely

## Follow-up recommendations

- Compare any remaining page-specific details against the local `coparrent-vision` reference checkout and tighten any still-divergent spacing or art direction.
- Continue moving ad hoc cards and badges in lower-traffic product pages onto `PageHero`, `SectionCard`, `SectionHeader`, and `StatusPill` instead of extending page-local class stacks.
- Keep `Legal View` as the user-facing label in common app surfaces, but leave `court` terminology in exports and explicit legal/court review flows where the wording is materially accurate.
