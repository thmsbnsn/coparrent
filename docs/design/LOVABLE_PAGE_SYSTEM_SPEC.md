# CoParrent Lovable Page System Spec

## Purpose

This document is the design-system and page-structure handoff for Lovable's first major CoParrent design batch. Its purpose is to let Lovable design a cohesive, premium front-end system without inventing product structure, security assumptions, or page hierarchy that the product does not actually use.

This is a UI and layout specification only.

- It is not implementation code.
- It does not change route behavior, authorization, role handling, or server enforcement.
- It must preserve CoParrent's existing family-scope model and fail-closed behavior.

## Repo-Grounded Scope

This spec is grounded in the current repo structure and route truth, primarily:

- `src/pages/Index.tsx`
- `src/components/landing/Navbar.tsx`
- `src/components/landing/Hero.tsx`
- `src/components/landing/Features.tsx`
- `src/components/landing/HomeSections.tsx`
- `src/components/landing/Footer.tsx`
- `src/pages/Dashboard.tsx`
- `src/components/dashboard/DashboardLayout.tsx`
- `src/components/dashboard/SubscriptionBanner.tsx`
- `src/components/dashboard/BlogDashboardCard.tsx`
- `src/pages/Onboarding.tsx`
- `src/pages/MessagingHubPage.tsx`
- `src/hooks/useMessagingHub.ts`
- `src/components/messages/ThreadSummaryBar.tsx`
- `src/components/messages/CourtViewToggle.tsx`
- `src/components/messages/EvidencePanel.tsx`
- `src/components/messages/DeliberateComposer.tsx`
- `src/pages/GameDashboard.tsx`
- `src/components/games/GameDashboardHero.tsx`
- `src/components/games/FamilyGameActivityPanel.tsx`
- `src/components/games/GameChallengeLeaderboard.tsx`
- `src/pages/LawOfficeDashboard.tsx`
- `src/pages/CalendarPage.tsx`
- `src/pages/BlogPage.tsx`
- `src/components/blog/BlogCard.tsx`
- `src/pages/Pricing.tsx`
- `src/pages/HelpCenter.tsx`
- `src/pages/help/topics.tsx`
- `src/pages/CourtRecordsPage.tsx`
- `src/contexts/FamilyContext.tsx`
- `src/lib/routeAccess.ts`
- `docs/security/SECURITY_MODEL.md`

## Non-Negotiable Architecture Guardrails

Lovable must treat the following as fixed product rules, not optional design interpretation:

- Family-scoped operations rely on `activeFamilyId` on the client and explicit `family_id` on the server.
- Missing or ambiguous family scope must fail closed.
- The client is never trusted for authorization, role, subscription tier, or plan decisions.
- Family-scoped pages should visually communicate scope, but the UI does not define scope or permissions.
- Lovable is designing UI structure only, not changing the security model.
- Do not reintroduce `co_parent_id` logic, implicit profile-pair assumptions, or cross-family fallback logic.
- Multi-family users must always operate inside an explicitly selected family context.
- Server enforcement remains the source of truth for family membership, permissions, exports, and immutable records.

Design implication:

- If a page depends on family context, its empty or blocked state must be explicit and visible.
- The UI must never imply that CoParrent guesses the correct family, record, or legal scope automatically.

## Element ID Conventions

All handoff IDs in this document are stable design-mapping IDs, not a requirement to match current React DOM IDs.

Use this pattern consistently:

- Page wrapper: `{page}-page`
- Hero/header block: `{page}-hero`
- Primary CTA zone: `{page}-primary-cta`
- Secondary CTA zone: `{page}-secondary-cta`
- Section wrapper: `{page}-{section}`
- Card/panel: `{page}-{section}-card`
- Filters/toggles: `{page}-{control}`
- Grid/list/table surface: `{page}-{surface}`
- Loading/empty/error states: `{page}-state-loading`, `{page}-state-empty`, `{page}-state-error`

IDs should be:

- human-readable
- durable
- implementation-friendly
- descriptive enough to survive design revisions

## Global Design System Guidance

### Visual Tone

CoParrent should feel:

- very modern
- tomorrow-facing, but not trendy for trend's sake
- premium but calm
- trustworthy for families
- organized enough for legal review surfaces
- emotionally steady, never noisy

The product should read as a high-end coordination system, not a startup landing page and not a playful family scrapbook.

### Color Direction

Base the palette on the current product direction:

- deep cobalt trust blue as the main brand anchor
- electric blue into teal or cyan gradient energy
- slate and mist neutrals for calm structure
- subtle glow and atmospheric gradients, not neon overload
- bright accents reserved for emphasis, not constant decoration

Recommended palette behavior:

- Public and family-operational pages: deep navy, cobalt, mist blue, teal glow
- Professional and legal pages: warm-neutral white, slate, muted amber accents, restrained teal only where useful
- Child-safe or game-adjacent energy: slightly brighter cobalt/teal, but still within the same ecosystem

### Typography Direction

Use the current brand spirit:

- strong display typography in the same family as `Outfit`
- clean, readable UI/body typography in the same family as `Inter`
- tight headline tracking, confident hierarchy, no whimsical type

Typography rules:

- Landing, dashboard, games, and blog can use larger, more expressive display moments
- Messaging, calendar, and law office surfaces should prioritize scanning and legibility over expression
- Court-aware views should tighten typography and reduce decorative styling

### Layout Grid and Spacing Rules

Lovable should treat layout rhythm as a shared system, not a page-by-page choice.

Max-width guidance:

- public marketing content: target `1200px` to `1280px` readable width, with occasional hero artwork bleeding wider
- authenticated dashboard content: target `1280px` to `1360px` working width
- law-office review content: target `1120px` to `1240px` for tighter reading and denser tables
- full-bleed exceptions: calendar grid, messaging split layout, and selected game hero may extend wider as long as the reading column remains controlled

Grid behavior:

- desktop: 12-column grid with `24px` gutter and consistent outer page padding
- tablet: 8-column grid with `20px` gutter and simplified card nesting
- mobile: 4-column grid with `16px` gutter and a single dominant reading path
- split layouts: keep primary content dominant; secondary panels should collapse before the primary working surface becomes cramped

Section spacing rhythm:

- public hero to first section: `72px` to `96px` desktop, `56px` to `72px` tablet, `40px` to `56px` mobile
- major page sections: `40px` to `56px` desktop, `32px` to `40px` tablet, `24px` to `32px` mobile
- subsection spacing inside cards: `16px` to `24px`
- compact metadata stacks: `8px` to `12px`

Card padding guidance:

- hero cards: `32px` to `48px` desktop, `24px` to `32px` mobile
- standard cards: `24px` to `32px` desktop, `20px` to `24px` mobile
- dense operational cards: `18px` to `24px`
- legal review cards: `20px` to `24px` with tighter title-to-metadata spacing

Hero spacing rules:

- every hero should hold title, supporting copy, key status, and primary action without feeling empty
- public heroes can breathe more; authenticated heroes should compress faster and hand off quickly to the working surface
- on mobile, hero copy should shorten before actions stack into two dense rows

List and grid gaps:

- card grids: `20px` to `24px`
- operational lists: `12px` to `16px`
- pills, inline filters, and segmented controls: `8px` to `12px`
- dense metadata rows: `8px`

Modal and dialog spacing:

- modal shell padding: `24px` to `32px`
- header-to-body and body-to-footer spacing: `20px` to `24px`
- footer actions should stay visually grouped and aligned
- avoid edge-to-edge form controls inside dialogs unless the pattern is intentionally dense and operational

### Spacing and Card Philosophy

The current app already leans on generous rounded cards, layered surfaces, and roomy padding. Preserve that, but make it more systematic:

- heroes: spacious, cinematic, and intentional
- major section cards: soft-large radius, premium framing, light internal hierarchy
- operational cards: structured, readable, dense enough to scan quickly
- legal cards: flatter, more disciplined, reduced decorative energy

Cards should feel like purpose-built product surfaces, not generic white rectangles.

### Elevation, Borders, and Glow

Use a layered system:

- subtle border first
- soft shadow second
- glow only when signaling priority, premium, or active context

Rules:

- use glow on hero surfaces, premium CTA moments, and select active states
- avoid glow on legal verification, receipts, hashes, and read-only review cards
- use light inner highlights and glass treatment only where it improves depth without reducing clarity

### Mobile-First Expectations

Mobile must be treated as first-class, not compressed desktop:

- preserve clear hierarchy in one-column flow
- keep page heroes concise on mobile
- prioritize summary before depth
- treat sticky or floating utilities carefully around device safe areas
- preserve thumb reach for primary actions

### Consistency Rules Across All Pages

Every page in this batch should visibly belong to the same product family:

- shared gradient language
- shared card radii and border behavior
- shared button language
- shared hero construction
- shared status-pill logic
- shared loader, empty, error, and blocked-state language

Cross-page consistency requirements:

- Primary buttons should feel assertive and premium, never loud.
- Secondary buttons should feel clear and present, never invisible.
- Status pills should be compact and legible.
- Section intros should use a consistent eyebrow plus heading plus supporting-copy rhythm.
- Empty states should explain what is missing, why it matters, and what the next action is.

### Family-Friendly vs Court-Professional Pages

The visual system must deliberately split into two emotional modes:

#### Warmer / family-operational mode

Use for:

- landing
- dashboard
- onboarding
- game dashboard
- blog
- calendar default view

Traits:

- slightly richer gradients
- more glow
- softer illustration or imagery opportunity
- more welcoming language
- still disciplined and premium

#### Structured / court-aware / professional mode

Use for:

- messaging hub, especially court view
- law dashboard
- calendar court view
- export and verification surfaces

Traits:

- lower motion
- higher contrast
- flatter cards
- denser information grouping
- more restrained decorative treatment
- stronger emphasis on labels, timestamps, and metadata

## Global Shell Requirements

### Shared Shell Types

### Public Shell

Applies to:

- landing
- public blog
- pricing
- help-adjacent public surfaces

Required elements:

- `public-top-nav`
- `public-logo`
- `public-primary-nav`
- `public-auth-actions`
- `public-mobile-nav`
- `public-main`
- `public-footer`

Notes:

- Public shell can support a transparent or near-transparent nav over dark hero surfaces.
- Footer should feel authoritative and clean, not crowded.

### App Shell

Applies to:

- dashboard
- onboarding only in a limited brand-bar sense
- messaging hub
- game dashboard
- calendar
- authenticated blog route if Lovable chooses to shell-adapt it

Required elements:

- `app-sidebar`
- `app-sidebar-logo`
- `app-family-switcher`
- `app-primary-nav`
- `app-topbar`
- `app-topbar-header-actions`
- `app-family-presence-toggle`
- `app-theme-toggle`
- `app-notifications`
- `app-user-chip`
- `app-main`

Notes:

- Family switcher is mandatory anywhere family scope matters.
- App header must visually reserve room for page-specific header actions.
- Sidebar active-state styling should feel premium and clearly current.

### Law Office Shell

Applies to:

- law office dashboard

Required elements:

- `law-sidebar`
- `law-sidebar-logo`
- `law-topbar`
- `law-user-chip`
- `law-main`

Notes:

- This shell should share the global system but feel more restrained and formal.
- It should not look like a parent-facing dashboard with a different title.

### Shared Repeating Blocks

### Page Hero

Required IDs:

- `page-hero-eyebrow`
- `page-hero-title`
- `page-hero-copy`
- `page-hero-metadata`
- `page-hero-actions`

Rules:

- Heroes must communicate page purpose in under three seconds.
- Heroes should summarize status before the user reaches the main content.

### Section Cards

Required IDs:

- `section-card`
- `section-card-header`
- `section-card-title`
- `section-card-copy`
- `section-card-actions`

Rules:

- Cards should always have a clear top-line label or purpose.
- Mixed-purpose cards should be avoided.

### CTA Styles

Required variants:

- `cta-primary`
- `cta-secondary`
- `cta-quiet`
- `cta-destructive`

Rules:

- Primary CTA: cobalt-led, confident, used sparingly
- Secondary CTA: clear outline or tonal fill, never weak
- Quiet CTA: low emphasis utility
- Destructive CTA: reserved for explicit risk actions only

### Badges and Pills

Required families:

- `status-pill-neutral`
- `status-pill-active`
- `status-pill-warning`
- `status-pill-error`
- `status-pill-read-only`
- `status-pill-scope`

Rules:

- Pills must read at a glance.
- Pill color cannot be the only signal; labels matter.

### Status Blocks

Required pattern:

- title
- short explanation
- next action if recoverable

Required IDs:

- `state-loading`
- `state-empty`
- `state-error`
- `state-blocked`
- `state-read-only`

### Empty States

Every empty state must answer:

- what is missing
- why it matters
- what to do next

No vague "nothing here yet" fillers on critical operational pages.

### Loaders

Loaders must be calm and credible:

- no playful pulsing
- no excessive shimmer
- support an explanatory line under the spinner on operational pages

### Problem-Report Launcher Safe-Area Awareness

The repo already reserves mobile safe-area space for the floating problem-report launcher. Lovable designs must preserve a safe bottom-right interaction zone.

Required IDs:

- `global-problem-report-spacer`
- `global-problem-report-launcher`

Rules:

- Do not place persistent bottom-right controls where the launcher will collide.
- On mobile, leave bottom safe-area breathing room for the floating launcher.

### Mobile Treatment Rules

- Conversation lists, filters, and secondary panels should collapse into sheets, drawers, or stacked zones.
- Important status summaries must remain above the fold.
- Avoid three-column layouts on mobile.
- Sticky action bars should not hide timestamps, status, or key record context.

### Navigation Behavior Rules

Navigation must feel like one coherent product shell, not separate page comps with unrelated navigation decisions.

Desktop sidebar behavior:

- dashboard, messaging, games, and calendar should use a persistent left sidebar
- the current route should have strong active emphasis through shape, contrast, and state, not just a color change
- family switcher should sit high in the sidebar hierarchy, above or immediately adjacent to primary route navigation
- sidebar density should stay scannable; do not create long, noisy nav stacks with equal emphasis everywhere

Mobile drawer behavior:

- authenticated navigation should collapse into a drawer or sheet opened from the topbar
- the family switcher must remain high-priority on mobile and should appear near the top of the drawer, not buried in account settings
- mobile drawers should separate navigation, scope controls, and account utilities into clear groups
- conversation lists and filters may use secondary sheets, but the selected record or working context should remain visible behind the overlay language

Active-route and context treatment:

- active routes need a clear visual anchor that survives dark and light surfaces
- selected subviews such as messaging mode, calendar view, and blog filters should preserve state when users navigate within the same product area
- route changes should not reset obvious working context without reason

Topbar and header action rules:

- topbar actions should stay utility-oriented: notifications, theme, family presence, account
- page-specific actions belong in the page hero or section header, not crammed into the global topbar
- if a page has more than two strong actions, one should usually become secondary or move into a contextual overflow

Breadcrumbs and secondary navigation:

- use breadcrumbs sparingly on public pages
- use secondary navigation where the product actually has modes or content groupings, such as blog categories or law-office review subviews
- messaging lane tabs and calendar view toggles should read as mode controls, not breadcrumbs

Route transition expectations:

- warm operational pages can use short fade or slide transitions
- legal and verification flows should use minimal motion
- transitions should preserve confidence and continuity, never theatrical reveal effects

Family switcher visibility and priority:

- any page that depends on family scope must visibly expose family context in the shell
- if no family is selected, the shell should still show the family switcher and the page should move into an explicit blocked state
- law-office pages should not show a parent-style switcher when assignment is read-only; they should show assigned-family context instead

## Shared Component Library

Lovable should treat the following as the shared CoParrent component library for this design batch. The goal is consistency, not one-off invention.

| Component | Purpose | Visual tone | Typical use cases | Should not be used for |
| --- | --- | --- | --- | --- |
| `PrimaryButton` | Primary decisive action | premium, cobalt-led, confident | create family, continue onboarding, open main workflow, send deliberate action | routine utilities, low-value tertiary links, repeated row actions |
| `SecondaryButton` | Companion or lower-emphasis action | clear, visible, supportive | alternate route, view details, compare option, safe fallback action | being so quiet it disappears, destructive actions, icon-only tools |
| `QuietButton` / `UtilityButton` | Low-emphasis tool action | restrained, operational, clean | refresh, open filters, edit metadata, toggle helper panels | primary conversion actions, empty-state recovery CTAs |
| `HeroCard` | High-importance summary or framing surface | atmospheric, premium, slightly luminous | landing hero, dashboard hero, featured game, premium status block | dense tables, hash comparison panels, long forms |
| `StandardCard` | Default content container | calm, structured, spacious | dashboard modules, onboarding helper panels, blog feature blocks | highly dense operational metadata or legal verification readouts |
| `DenseOperationalCard` | Compact working surface for scanning | efficient, restrained, data-forward | schedule snapshots, message meta, filter panels, activity summaries | marketing stories, emotional reassurance sections |
| `LegalReviewCard` | Read-only, high-trust review surface | formal, crisp, low-glow | export receipts, verification details, immutable metadata | family-friendly feature cards, playful game surfaces |
| `StatusPill` | Compact at-a-glance state label | sharp, legible, compact | active family, read-only, warning, synced, challenge live | long explanatory text, standalone banners, color-only meaning |
| `SectionHeader` | Repeatable heading pattern for grouped content | clean, authoritative, consistent | section introductions, list headers, dashboard modules | tiny card subtitles or decorative micro-headings everywhere |
| `EmptyStateBlock` | Explain a missing or blocked condition | calm, informative, recovery-oriented | no family selected, no thread, no exports, no blog results | vague placeholder copy or decorative illustration dumps |
| `LoaderBlock` | Hold structure while data resolves | credible, low-motion, calm | page loading, panel refresh, timeline fetch, legal verification in progress | playful skeleton theater or full-screen interruption for minor loads |
| `Modal` / `Dialog` | Focused, interruptive task or confirmation | controlled, high-clarity | new conversation, verification input, confirmation, create group | primary navigation, long multi-step onboarding, dense browsing flows |
| `Mobile Drawer` / `Sheet` | Mobile navigation or secondary workspace | compact, layered, context-preserving | sidebar nav, thread list, filters, action menus | replacing desktop information hierarchy or hiding core context by default |
| `DataList` / `DataTable` | Structured rows of comparable information | operational, ordered, scan-heavy | exports, posts, participants, legal receipts, filtered records | public landing storytelling or hero-led discovery content |
| `Messaging Timeline` | Chronological record of authored and system events | trustworthy, court-aware, readable | message history, system notices, court view chronology | casual social-chat mimicry, decorative comment feeds |
| `Form Section` | Group related inputs and validation | clear, reassuring, disciplined | onboarding steps, invite flows, filters, verification forms | wrapping unrelated controls only for decoration |
| `Summary Metric Card` | Surface one key metric or status quickly | concise, premium, metrics-first | dashboard counters, law summary metrics, schedule counts | replacing explanation where nuance matters |
| `Filter Bar` | Concentrate search, filters, scope, sort, and result count | compact, operational, tidy | blog category filters, calendar controls, messaging filters, law review controls | public marketing nav or the main hero action row |
| `Search Input` | Focused content retrieval | precise, unobtrusive | posts, threads, exports, help content | being the only navigation pattern or replacing explicit structure |
| `Tab` / `Segmented Toggle` | Mutually exclusive mode switch | deliberate, structured, high clarity | chat vs court view, month vs week, content category modes | routing across too many destinations or hiding unrelated pages |
| `Verification Result Panel` | Present trusted match, mismatch, or pending verification state | sober, high-confidence, low-drama | law dashboard verification, messaging export verification | casual alerts, celebratory states, gamified success moments |

Additional component rules:

- reuse one button language across public and authenticated surfaces
- use `LegalReviewCard` and `Verification Result Panel` only where the product is presenting evidence, receipts, hashes, or read-only legal review states
- `HeroCard` should never become the default wrapper for every section on an authenticated page
- `Messaging Timeline` must always prioritize timestamp, attribution, and chronology over decorative avatars or chat bubbles

## Interaction Patterns

Interactive styling should feel intentional and predictable across the system.

### Core State Behavior

Hover:

- family-facing surfaces may use a soft lift, border brightening, or subtle glow increase
- operational dashboard surfaces should prefer contrast shift over dramatic lift
- legal and verification surfaces should use minimal lift and clearer border or background response instead

Focus:

- all interactive controls require a visible focus state that survives light and dark backgrounds
- use a cobalt or cyan focus ring with enough offset and contrast to remain accessible
- legal surfaces should add outline clarity, not just soft glow

Active / pressed:

- pressed states should tighten, darken, or inset slightly
- no rubbery scaling or playful bounce effects
- destructive actions should strengthen contrast rather than animate aggressively

Selected:

- selected states must combine at least two signals: contrast, border, icon, checkmark, or text change
- selected tabs, pills, and cards should remain obvious even when color perception is limited
- family scope selection should always read as explicit and singular

Disabled:

- disabled controls should reduce saturation and emphasis without becoming unreadable
- if a critical action is disabled, pair it with a short reason nearby
- do not hide blocked state by making the page appear empty

Loading:

- preserve layout during loading whenever possible
- prefer local panel loading to full-page interruption when only part of the screen is resolving
- verification, export, and legal review loading should feel stable and serious

Expandable / collapsible surfaces:

- keep the collapsed summary visible and useful
- animate height and opacity lightly
- avoid hiding critical metadata inside accordions on legal or court-aware pages

Drawers / sheets:

- drawers should preserve the sense of place; users should understand what surface they came from
- mobile sheets should open with a short, controlled motion and a clear close affordance
- do not place the only family-scope context entirely inside a drawer without some visible top-level indicator

Tabs / toggles:

- use segmented controls for a small number of mutually exclusive views
- active segments should feel locked in, not merely highlighted
- chat/court and month/week toggles should read as serious mode changes, not decorative pills

Pagination and list filters:

- keep filter bars close to the list they control
- preserve filter state when users change sort, view mode, or page
- show result count or scope summary where the list meaning may otherwise be ambiguous

### Surface-Specific Interaction Tone

Family-facing surfaces:

- allow more softness, more gradient energy, and slightly friendlier hover cues
- motion can be present but should remain controlled and premium

Operational dashboard surfaces:

- prioritize fast recognition and predictable response
- use restrained motion and clearer selected states

Legal / professional surfaces:

- reduce glow, reduce playful motion, and prefer contrast, borders, and typography changes
- interactions should feel precise, deliberate, and trustworthy

## Data Density Rules

Lovable should design each page family at the density the product purpose requires.

| Page family | Target density | What should dominate | Density guidance |
| --- | --- | --- | --- |
| Landing | low to medium | narrative clarity and trust signals | lead with a few strong sections, generous spacing, and clear conversion hierarchy; avoid stacking too many equal-weight proof cards at once |
| Dashboard | medium | summary and next action | surface today, next action, and family status first; keep supporting content readable without turning the page into a feed |
| Onboarding | low to medium | one decision at a time | limit simultaneous choices, keep form sections roomy, and compress helper copy before reducing label clarity |
| Messaging Hub | medium to high | conversation record and thread context | denser metadata is acceptable in thread header, filters, and export panels; preserve a readable main timeline column |
| Game Dashboard | medium | featured play and family presence | keep the hero and featured game roomy, while challenge and activity panels can tighten slightly |
| Law Dashboard | high | metadata accuracy and verification clarity | dense labels, receipts, and tables are acceptable; use whitespace to separate evidence blocks, not to make the page feel empty |
| Calendar | high | planning grid and selected-day detail | the schedule grid is the primary surface; supporting legends, toggles, and day detail can be compact if hierarchy stays obvious |
| Blog | medium | editorial hierarchy and browsing clarity | give the featured story room, then tighten list and filter density for scanning |

General density rules:

- summarize first, then allow drill-down
- denser metadata is acceptable when the user is reviewing records, schedules, exports, or conversation history
- breathing room matters more on landing, onboarding, featured game, and editorial hero surfaces
- on mobile, compress by collapsing secondary panels, shortening helper copy, and tightening card padding before removing critical labels or scope context

## Page Specs

### 1. Index / Landing Page

- Route / repo truth: `/`
- Current source truth: `src/pages/Index.tsx` using `Navbar`, `Hero`, `Features`, `HomeSections`, and `Footer`
- Adjacent public routes that should inform the design story: `/pricing`, `/help`, `/court-records`
- Primary user type: prospective parent, guardian, or invited adult evaluating the platform
- Page purpose: establish premium trust, explain product breadth, and convert interest into sign-up or dashboard entry
- Visual mood: calm authority, premium trust, dark-hero confidence

### Required Structure in Display Order

| Order | Section | Required IDs | UX purpose |
| --- | --- | --- | --- |
| 1 | Page wrapper | `landing-page`, `landing-main` | Public-shell wrapper for the complete marketing surface |
| 2 | Top navigation | `landing-top-nav`, `landing-nav-logo`, `landing-nav-links`, `landing-nav-signin`, `landing-nav-get-started`, `landing-nav-dashboard`, `landing-mobile-nav` | Immediate trust, product navigation, clear auth entry |
| 3 | Hero | `landing-hero`, `landing-hero-eyebrow`, `landing-hero-title`, `landing-hero-copy`, `landing-primary-cta`, `landing-secondary-cta`, `landing-trust-signals` | Explain the product in one glance and drive the primary conversion |
| 4 | Platform overview | `landing-feature-overview`, `landing-feature-grid`, `landing-feature-card-scheduling`, `landing-feature-card-messaging`, `landing-feature-card-children`, `landing-feature-card-documents`, `landing-feature-card-expenses` | Show CoParrent as one operating system, not one feature |
| 5 | Coordination proof | `landing-family-coordination-section`, `landing-proof-grid`, `landing-proof-card-schedule`, `landing-proof-card-messaging`, `landing-proof-card-records`, `landing-proof-card-boundaries` | Reinforce why the system works in daily life |
| 6 | Court-record credibility | `landing-court-record-section`, `landing-court-record-title`, `landing-court-record-copy`, `landing-court-record-highlights`, `landing-court-record-cta` | Establish serious documentation capability without overclaiming legal outcomes |
| 7 | Family support and roles | `landing-family-support-section`, `landing-role-grid`, `landing-role-card-parents`, `landing-role-card-professionals`, `landing-role-card-record-heavy-families`, `landing-kids-support-section` | Show the product supports real family structures and support adults |
| 8 | Workflow explanation | `landing-workflow-section`, `landing-workflow-step-1`, `landing-workflow-step-2`, `landing-workflow-step-3` | Explain the operational loop: setup, coordinate, retain record |
| 9 | Pricing preview | `landing-pricing-preview`, `landing-pricing-card-free`, `landing-pricing-card-power`, `landing-pricing-preview-cta` | Recommended inline conversion section based on the real `/pricing` page |
| 10 | Proof or testimonials | `landing-proof-zone`, `landing-proof-quote-1`, `landing-proof-quote-2`, `landing-proof-stats` | Recommended trust-building block if Lovable adds social proof |
| 11 | FAQ and reassurance | `landing-faq`, `landing-faq-item-setup`, `landing-faq-item-records`, `landing-faq-item-privacy`, `landing-faq-item-pricing`, `landing-help-cta` | Recommended reassurance layer that routes into Help Center and Court Records |
| 12 | Footer | `landing-footer`, `landing-footer-product-links`, `landing-footer-support-links`, `landing-footer-legal-links` | Close with structured trust and route clarity |

### Required States and Variants

- `landing-state-default`: logged-out visitor
- `landing-state-authenticated`: primary CTA shifts to dashboard
- `landing-state-mobile-nav-open`
- `landing-state-proof-optional`: if testimonials are not ready, use a product-proof metric band instead

### Copy Direction

- direct, sober, premium
- no "better parenting starts here" softness
- emphasize clarity, documentation, coordination, and reduced friction
- use language similar to current repo truth: schedules, messages, child records, documents, expenses, court-aware exports

### Notes for Lovable

- The current repo does not place pricing, testimonials, or FAQ directly on `/`; those live across adjacent surfaces. Lovable should design them as recommended inline landing sections while preserving route-level IA for `/pricing`, `/help`, and `/court-records`.
- The court-record section must feel credible and specific. Use proof language tied to real export content, not vague "legally accepted" claims.
- The first impression should be "premium family coordination platform with serious records," not "cute family app."

### 2. Dashboard

- Route / repo truth: `/dashboard`
- Current source truth: `src/pages/Dashboard.tsx`
- Primary user type: parent or guardian first, limited-access third-party second
- Page purpose: answer "what is happening today?" immediately for the currently active family
- Visual mood: premium command center, warm-operational, fast to scan

### Required Structure in Display Order

| Order | Section | Required IDs | UX purpose |
| --- | --- | --- | --- |
| 1 | Page wrapper | `dashboard-page` | Main authenticated dashboard wrapper |
| 2 | Banner zone | `dashboard-banner-zone`, `dashboard-subscription-banner` | Surface billing or trial context without dominating the page |
| 3 | Hero greeting | `dashboard-hero`, `dashboard-hero-eyebrow`, `dashboard-hero-title`, `dashboard-hero-copy`, `dashboard-call-action` | Establish current context and current family state |
| 4 | Family connection summary | `dashboard-family-connection-card`, `dashboard-current-focus-card` | Show whether the family workspace is fully connected or still needs setup |
| 5 | Status card row | `dashboard-status-cards`, `dashboard-status-card-children`, `dashboard-status-card-schedule`, `dashboard-status-card-journal` | Show family health at a glance |
| 6 | Quick shortcuts | `dashboard-quick-links`, `dashboard-quick-link-calendar`, `dashboard-quick-link-messages`, `dashboard-quick-link-children`, `dashboard-quick-link-expenses` | Fast path into the most important destinations |
| 7 | Schedule snapshot | `dashboard-schedule-snapshot`, `dashboard-schedule-primary-card`, `dashboard-schedule-next-step-card` | Make today's parenting time obvious |
| 8 | Exchange check-in | `dashboard-exchange-checkin` | Only visible when exchange day logic is active |
| 9 | Recent communication | `dashboard-recent-communication`, `dashboard-recent-message-list`, `dashboard-recent-message-empty`, `dashboard-view-all-messages` | Make current written activity visible quickly |
| 10 | Child and family summary | `dashboard-family-summary`, `dashboard-children-list`, `dashboard-children-empty`, `dashboard-manage-children` | Quick access to child profiles and shared family anchors |
| 11 | Private journal summary | `dashboard-journal-card`, `dashboard-journal-metric`, `dashboard-journal-cta` | Reinforce private recordkeeping behavior |
| 12 | Blog surface | `dashboard-blog-card`, `dashboard-blog-list`, `dashboard-blog-empty`, `dashboard-blog-cta` | Keep educational content inside the ecosystem |

### Required States and Variants

- `dashboard-state-loading`
- `dashboard-state-no-family-scope`
- `dashboard-state-setup-needed`: family exists but co-parent or schedule setup is incomplete
- `dashboard-state-exchange-day`
- `dashboard-state-no-messages`
- `dashboard-state-no-children`
- `dashboard-state-trial`
- `dashboard-state-past-due`
- `dashboard-state-subscribed-no-banner`
- `dashboard-state-third-party-limited`

### Copy Direction

- quick, calm, operational
- orient around today, next move, shared record, and setup completeness
- avoid generic "welcome back" filler

### Notes for Lovable

- The dashboard hero must make family status and next action visible within seconds.
- "Today's Parenting Time" is not a secondary card. It is the central orientation block.
- Subscription context should feel premium and contained, not like an ad.

### 3. Onboarding

- Route / repo truth: `/onboarding`
- Current source truth: `src/pages/Onboarding.tsx`
- Primary user type: newly authenticated parent or guardian preparing the initial family workspace
- Page purpose: move a new account into explicit role selection, explicit family setup, child entry, and co-parent invitation
- Visual mood: warm, guided, friction-reducing, confident

### Required Structure in Display Order

| Order | Section | Required IDs | UX purpose |
| --- | --- | --- | --- |
| 1 | Page wrapper | `onboarding-page` | Full-screen onboarding wrapper |
| 2 | Brand header | `onboarding-brand-bar`, `onboarding-logo` | Keep trust and brand continuity visible |
| 3 | Progress header | `onboarding-progress-header`, `onboarding-step-indicators`, `onboarding-step-1`, `onboarding-step-2`, `onboarding-step-3`, `onboarding-step-4` | Show clear progress and reduce uncertainty |
| 4 | Welcome and role step | `onboarding-role-step`, `onboarding-role-title`, `onboarding-role-copy`, `onboarding-role-grid`, `onboarding-role-option-father`, `onboarding-role-option-mother`, `onboarding-role-option-guardian`, `onboarding-role-option-other`, `onboarding-primary-cta` | First decisive choice that personalizes the workspace |
| 5 | Family scope explanation | `onboarding-family-setup-step`, `onboarding-family-path-create`, `onboarding-family-path-invite`, `onboarding-family-scope-note` | Explain that family access is explicit and not inferred |
| 6 | Child setup step | `onboarding-children-step`, `onboarding-child-list`, `onboarding-child-card`, `onboarding-add-child`, `onboarding-children-next` | Capture child anchors early |
| 7 | Invite step | `onboarding-invite-step`, `onboarding-invite-input`, `onboarding-invite-send`, `onboarding-invite-skip`, `onboarding-secondary-cta` | Invite the other parent or guardian without pressure |
| 8 | Completion step | `onboarding-complete-step`, `onboarding-complete-title`, `onboarding-complete-copy`, `onboarding-complete-cta` | Clear finish line and route into dashboard |
| 9 | Helper and reassurance block | `onboarding-helper-panel`, `onboarding-helper-copy`, `onboarding-helper-support-link` | Keep the tone calm and reduce abandonment |

### Required States and Variants

- `onboarding-state-auth-loading`
- `onboarding-state-role-blocked`
- `onboarding-state-family-prep-blocked`
- `onboarding-state-children-saving`
- `onboarding-state-child-limit-reached`
- `onboarding-state-invite-duplicate`
- `onboarding-state-invite-error`
- `onboarding-state-skip-invite`
- `onboarding-state-complete`

### Copy Direction

- "We’ll get your family workspace ready."
- "Select your role."
- "Add the people and structure first."
- Never imply inferred family relationships or guessed family membership.

### Notes for Lovable

- The repo currently auto-ensures family membership during onboarding, but the design should still explain explicit family creation or invite-based joining as a trust rule.
- Progress should feel steady and calm, not like a growth funnel.

### 4. Messaging Hub

- Route / repo truth: `/dashboard/messages`
- Current source truth: `src/pages/MessagingHubPage.tsx`
- Primary user type: parent, guardian, third-party member, or child account with messaging access
- Page purpose: provide a recorded communication system with first-class court-aware review
- Visual mood: structured, trustworthy, conversation-first, not chatty

### Required Structure in Display Order

| Order | Section | Required IDs | UX purpose |
| --- | --- | --- | --- |
| 1 | Page wrapper | `messaging-page` | Full page wrapper for the messaging system |
| 2 | Hero and identity block | `messaging-hero`, `messaging-hero-title`, `messaging-hero-copy`, `messaging-mode-pill`, `messaging-thread-type-pill`, `messaging-thread-status-pill`, `messaging-selected-thread-card`, `messaging-mobile-conversations-button` | Establish current mode, selected conversation, and seriousness of the record |
| 3 | Setup warning | `messaging-setup-alert`, `messaging-setup-retry` | Show backend setup issues clearly |
| 4 | Main split layout | `messaging-main-layout` | Split conversation navigation from active thread |
| 5 | Conversation lanes panel | `messaging-sidebar`, `messaging-lanes-header`, `messaging-lanes-tabs`, `messaging-family-tab`, `messaging-groups-tab`, `messaging-direct-tab` | Help users choose the right communication lane |
| 6 | Family lane content | `messaging-family-channel-card`, `messaging-family-members-card`, `messaging-family-members-list` | Make the family channel the default shared record |
| 7 | Group lane content | `messaging-group-create`, `messaging-group-list`, `messaging-group-empty` | Support narrower group coordination |
| 8 | Direct lane content | `messaging-direct-create`, `messaging-thread-list`, `messaging-thread-card`, `messaging-thread-empty` | Support direct one-to-one record surfaces |
| 9 | Selected thread shell | `messaging-thread-shell` | Main active conversation container |
| 10 | Selected thread header | `messaging-thread-header`, `messaging-thread-identity`, `messaging-thread-meta`, `messaging-call-controls`, `messaging-view-toggle`, `messaging-refresh-button`, `messaging-more-actions` | Context, attribution, and top-level utilities |
| 11 | Thread summary bar | `messaging-thread-summary-bar` | Put urgency and record state before scrolling |
| 12 | Record timeline section | `messaging-record-section`, `messaging-record-header`, `messaging-record-state`, `messaging-evidence-panel` | Show messages and system events as the primary evidence surface |
| 13 | Composer section | `messaging-composer-section`, `messaging-composer-header`, `messaging-composer`, `messaging-tone-assistant`, `messaging-send-action` | Separate action from evidence and reinforce deliberate writing |
| 14 | Export receipt panel | `messaging-export-receipt-panel`, `messaging-export-receipt-status`, `messaging-export-receipt-id`, `messaging-export-pdf-hash`, `messaging-export-download-pdf`, `messaging-export-download-json`, `messaging-export-verify`, `messaging-export-refresh` | Surface recorded export receipts and verification flows |
| 15 | Search dialog | `messaging-search-dialog`, `messaging-search-input`, `messaging-search-results` | Search current thread history |
| 16 | Verify dialog | `messaging-verify-dialog`, `messaging-verify-receipt-list`, `messaging-verify-package-upload`, `messaging-verify-pdf-upload`, `messaging-verify-source`, `messaging-verify-result` | Verify stored or uploaded evidence against the server-generated receipt |
| 17 | New conversation dialog | `messaging-new-conversation-dialog`, `messaging-recipient-list`, `messaging-selected-recipients`, `messaging-start-conversation` | Start direct or group threads explicitly |
| 18 | Create group dialog | `messaging-create-group-dialog`, `messaging-group-name-input`, `messaging-group-member-list`, `messaging-group-confirm` | Create group threads with explicit participants |

### Required States and Variants

- `messaging-state-loading`
- `messaging-state-setup-error`
- `messaging-state-no-thread-selected`
- `messaging-state-loading-existing-thread`
- `messaging-state-loading-empty-thread`
- `messaging-state-history-unavailable`
- `messaging-state-thread-error`
- `messaging-state-empty-thread`
- `messaging-state-existing-thread`
- `messaging-state-chat-view`
- `messaging-state-court-view`
- `messaging-state-export-scope-required`
- `messaging-state-no-export-receipt`
- `messaging-state-verification-match`
- `messaging-state-verification-mismatch`
- `messaging-state-mobile-sidebar-open`
- `messaging-state-direct-call-available`
- `messaging-state-child-restricted`

### Copy Direction

- use "record," "thread," "reply," "family channel," "court view"
- avoid playful chat language
- reinforce attribution, timestamps, and permanent record
- message composer helper text should encourage factual, neutral communication

### Notes for Lovable

- This page must never look like a consumer messenger.
- The family channel should visually read as the primary shared record.
- Court view must be instantly discoverable and credible.
- Evidence and composer must feel intentionally separated.
- On mobile, conversation selection should become a sheet or drawer, but the selected-thread identity, mode toggle, and record state must stay visible.

### 5. Game Dashboard

- Route / repo truth: `/dashboard/games`
- Current source truth: `src/pages/GameDashboard.tsx`
- Primary user type: family member inside an active family scope, including allowed child accounts
- Page purpose: provide a family-scoped play layer that still belongs inside CoParrent
- Visual mood: energetic, premium, family-safe, clearly within the same brand system

### Required Structure in Display Order

| Order | Section | Required IDs | UX purpose |
| --- | --- | --- | --- |
| 1 | Page wrapper | `games-page` | Main family games wrapper |
| 2 | Hero | `games-hero`, `games-hero-title`, `games-hero-copy`, `games-primary-cta`, `games-active-family-pill`, `games-family-players` | Establish shared family play, not random arcade play |
| 3 | Featured game block | `games-featured-section`, `games-featured-card`, `games-featured-primary-cta`, `games-featured-secondary-cta` | Highlight the current playable family game |
| 4 | Lobby and availability block | `games-available-now`, `games-lobby-status-card`, `games-lobby-primary-cta`, `games-lobby-secondary-cta`, `games-available-grid` | Explain current lobby or solo-preview state |
| 5 | Family presence activity | `games-family-activity-panel`, `games-family-activity-list`, `games-family-activity-error` | Show who is active in family-scoped play |
| 6 | Challenge snapshot | `games-challenge-section`, `games-challenge-status-pill`, `games-challenge-leader-card`, `games-challenge-participants-card`, `games-challenge-leaderboard`, `games-challenge-primary-cta`, `games-challenge-secondary-cta` | Surface async competition without losing the family tone |
| 7 | Coming soon | `games-coming-soon`, `games-coming-soon-grid`, `games-coming-soon-card` | Show future game roadmap in-system |
| 8 | Multiplayer lane explainer | `games-multiplayer-lane`, `games-multiplayer-copy` | Explain how games stay family-scoped and ecosystem-consistent |

### Required States and Variants

- `games-state-loading`
- `games-state-family-scope-required`
- `games-state-child-scope-error`
- `games-state-child-not-allowed`
- `games-state-multiplayer-disabled`
- `games-state-lobby-loading`
- `games-state-lobby-open`
- `games-state-no-lobby`
- `games-state-lobby-rollout`
- `games-state-challenge-loading`
- `games-state-no-challenge`
- `games-state-challenge-active`
- `games-state-challenge-awaiting-accept`
- `games-state-challenge-error`
- `games-state-no-scores`

### Copy Direction

- light and energetic, but never childish
- emphasize shared play, family presence, quick rounds, and challenge participation
- avoid casino language, excessive hype, or competitive aggression

### Notes for Lovable

- This page should feel like the play layer of CoParrent, not a disconnected mini-site.
- Retain cobalt and teal energy, but keep enough calm structure that the page still belongs beside dashboard and calendar.
- Presence and lobby state are core, not decorative.

### 6. Law Dashboard

- Route / repo truth: `/law-office/dashboard`
- Current source truth: `src/pages/LawOfficeDashboard.tsx`
- Primary user type: law-office account reviewing family export receipts
- Page purpose: read-only review of immutable export artifacts and verification results
- Visual mood: professional, premium, credible, restrained

### Required Structure in Display Order

| Order | Section | Required IDs | UX purpose |
| --- | --- | --- | --- |
| 1 | Page wrapper | `law-dashboard-page` | Law-office portal wrapper |
| 2 | Hero | `law-dashboard-hero`, `law-dashboard-badge`, `law-dashboard-title`, `law-dashboard-copy` | Establish read-only legal-review posture |
| 3 | Assigned family and guardrails | `law-assigned-family-card`, `law-guardrails-card` | Clarify scope and read-only restrictions immediately |
| 4 | Summary metrics | `law-dashboard-stats`, `law-receipts-count-card`, `law-latest-export-card`, `law-verification-status-card` | Make receipt volume and status legible |
| 5 | Assigned family scope panel | `law-family-scope-panel`, `law-family-scope-current`, `law-family-scope-includes` | Reinforce that review stays inside the selected assignment |
| 6 | Immutable export selection | `law-export-selection-panel`, `law-export-select`, `law-export-empty` | Select a stored export receipt |
| 7 | Export metadata display | `law-export-receipt-summary`, `law-export-storage-posture`, `law-export-object-lock`, `law-export-version-id` | Show receipt and storage posture clearly |
| 8 | Download controls | `law-download-pdf`, `law-download-package` | Download only stored immutable artifacts |
| 9 | Verification controls | `law-verify-source`, `law-verify-stored-pdf` | Trigger verification against stored receipt data |
| 10 | Verification result | `law-verification-result`, `law-verification-status`, `law-computed-hash-card`, `law-stored-hash-card` | Display verification outcome in a calm, credible layout |

### Required States and Variants

- `law-dashboard-state-family-loading`
- `law-dashboard-state-no-assignment`
- `law-dashboard-state-no-active-family-selected`
- `law-dashboard-state-no-exports`
- `law-dashboard-state-export-selected`
- `law-dashboard-state-download-pending`
- `law-dashboard-state-verification-idle`
- `law-dashboard-state-verification-match`
- `law-dashboard-state-verification-mismatch`

### Copy Direction

- precise, read-only, compliance-aware
- use "assigned family," "immutable receipt," "stored artifact," "verification result"
- avoid warm marketing phrasing here

### Notes for Lovable

- This page should feel like a premium legal review workstation.
- Do not borrow parent-dashboard warmth here.
- Verification states must be legible without alarmism.

### 7. Calendar

- Route / repo truth: `/dashboard/calendar`
- Current source truth: `src/pages/CalendarPage.tsx`
- Primary user type: parent or guardian, with view-only variants for limited-access users
- Page purpose: show the saved parenting-time plan clearly, allow controlled changes, and support print/export
- Visual mood: planning-first, structured, premium, court-capable second

### Required Structure in Display Order

| Order | Section | Required IDs | UX purpose |
| --- | --- | --- | --- |
| 1 | Page wrapper | `calendar-page` | Family-scoped calendar wrapper |
| 2 | Hero | `calendar-hero`, `calendar-hero-title`, `calendar-hero-copy` | Explain family-scoped planning and fail-closed behavior |
| 3 | Top status cards | `calendar-active-family-card`, `calendar-access-card`, `calendar-schedule-state-card`, `calendar-family-scope-card`, `calendar-quick-actions` | Surface scope, access level, and schedule state before the grid |
| 4 | Read-only alert | `calendar-view-only-alert`, `calendar-view-only-badge` | Explain review-only posture when relevant |
| 5 | Missing family blocker | `calendar-no-family-state`, `calendar-no-family-copy`, `calendar-no-family-next-step` | Fail closed when active family is missing |
| 6 | No-schedule blocker | `calendar-no-schedule-state`, `calendar-setup-schedule-cta`, `calendar-sync-disabled` | Prevent implied schedule assumptions |
| 7 | Saved plan summary | `calendar-plan-summary`, `calendar-plan-actions`, `calendar-request-change-cta`, `calendar-print-action`, `calendar-sync-action`, `calendar-edit-schedule-cta` | Summarize the active plan and expose actions |
| 8 | Schedule metadata cards | `calendar-exchange-info-card`, `calendar-holiday-overrides-card` | Show exchange details and override count |
| 9 | Legend and view toggle | `calendar-legend`, `calendar-view-toggle`, `calendar-view-calendar`, `calendar-view-court` | Keep mode switching and ownership legend obvious |
| 10 | Calendar grid shell | `calendar-grid-shell`, `calendar-month-nav`, `calendar-month-prev`, `calendar-month-next`, `calendar-weekday-row`, `calendar-grid` | Main monthly planning surface |
| 11 | Day cells | `calendar-day-cell`, `calendar-day-cell-today`, `calendar-day-cell-parent-a`, `calendar-day-cell-parent-b`, `calendar-day-cell-sports` | Show day ownership and event markers |
| 12 | Selected day details | `calendar-selected-day-panel`, `calendar-selected-day-header`, `calendar-selected-day-meta`, `calendar-selected-day-events` | Recommended explicit detail surface tied to current date selection |
| 13 | Court summary view | `calendar-court-summary-view`, `calendar-court-summary-title`, `calendar-court-summary-holidays` | Structured review view for print or legal reference |
| 14 | Dialogs and overlays | `calendar-setup-dialog`, `calendar-change-request-dialog`, `calendar-export-dialog`, `calendar-sports-event-dialog`, `calendar-sports-list-dialog` | Support setup, change request, sync, and event detail flows |

### Required States and Variants

- `calendar-state-resolving-family-scope`
- `calendar-state-no-family-scope`
- `calendar-state-loading-schedule`
- `calendar-state-no-schedule`
- `calendar-state-saved-schedule`
- `calendar-state-calendar-view`
- `calendar-state-court-view`
- `calendar-state-view-only`
- `calendar-state-export-scope-error`
- `calendar-state-sports-events-present`
- `calendar-state-selected-day`
- `calendar-state-saving`

### Copy Direction

- explicit, clear, planning-oriented
- never imply schedule inference
- reinforce that edits and exports stay tied to the selected family

### Notes for Lovable

- The calendar must first answer "who has the children and when."
- Court capability is important, but secondary to daily planning clarity.
- Court view should feel more structured and print-ready, not simply recolored.

### 8. Blog Surface / Blog Dashboard

- Route / repo truth: `/blog` and `/dashboard/blog` currently both render `src/pages/BlogPage.tsx`
- Companion dashboard module truth: `src/components/dashboard/BlogDashboardCard.tsx`
- Primary user type: prospect or logged-in family member seeking useful guidance
- Page purpose: build trust through useful editorial content while staying visually consistent with the product
- Visual mood: editorial, modern, calm, brand-consistent

### Required Structure in Display Order

| Order | Section | Required IDs | UX purpose |
| --- | --- | --- | --- |
| 1 | Page wrapper | `blog-page` | Blog surface wrapper adaptable to public or authenticated shell |
| 2 | Hero | `blog-hero`, `blog-hero-badge`, `blog-hero-title`, `blog-hero-copy` | Establish editorial purpose without drifting into generic content marketing |
| 3 | Overview stats | `blog-overview-stats`, `blog-published-stat`, `blog-topics-stat`, `blog-help-cta-card` | Quantify content and route product help separately |
| 4 | Filter bar | `blog-filter-bar`, `blog-search-input`, `blog-category-filter`, `blog-filter-clear` | Help users find specific content fast |
| 5 | Featured article | `blog-featured-article`, `blog-featured-meta`, `blog-featured-primary-cta`, `blog-featured-secondary-cta`, `blog-featured-image` | Lead with the strongest current article |
| 6 | Post collection | `blog-post-section`, `blog-results-header`, `blog-post-grid`, `blog-post-card`, `blog-post-share` | Main article browsing surface |
| 7 | Follow or newsletter block | `blog-follow-cta`, `blog-newsletter-cta` | Recommended optional retention surface if added |
| 8 | Empty state | `blog-empty-state`, `blog-empty-copy`, `blog-empty-reset` | Handle search and filter misses gracefully |
| 9 | Dashboard module companion | `dashboard-blog-card`, `dashboard-blog-card-list`, `dashboard-blog-card-empty`, `dashboard-blog-card-cta` | Compact summary card for the main dashboard |

### Required States and Variants

- `blog-state-loading`
- `blog-state-default`
- `blog-state-filtered`
- `blog-state-no-results`
- `blog-state-no-posts`
- `blog-state-public-shell`
- `blog-state-authenticated-shell`

### Copy Direction

- practical, useful, calm
- categories should align to real product and family concerns: communication, schedules, records, privacy, billing, setup
- avoid vague inspirational parenting language

### Notes for Lovable

- The repo truth is not a distinct internal "blog dashboard" page. It is a shared blog surface plus a compact dashboard card. Design accordingly.
- The public and authenticated blog versions can share the same editorial core but should adapt to shell context cleanly.

## Cross-Page Visual Consistency Matrix

| Page | Warmth | Structure | Hero treatment | Glow usage | Motion guidance |
| --- | --- | --- | --- | --- | --- |
| Landing | Medium-high | High | Cinematic dark hero | Strongest in batch, still restrained | Subtle reveal, staggered sections acceptable |
| Dashboard | Medium | High | Premium app hero with status cards | Moderate on hero and key cards | Light motion only |
| Onboarding | Medium-high | Medium-high | Focused, centered, reassuring | Moderate, mainly on progress and CTA | Gentle transitions between steps |
| Messaging Hub | Low-medium | Very high | Dark serious hero and thread identity | Low outside active pills and subtle emphasis | Minimal; avoid playful micro-motion |
| Game Dashboard | High | Medium-high | Energetic branded hero | Moderate-high but contained | Slightly more motion allowed |
| Law Dashboard | Low | Very high | Formal, premium, read-only | Minimal | Prefer almost static behavior |
| Calendar | Medium | Very high | Status-led hero | Low-moderate | Minimal, utility-first |
| Blog | Medium | Medium-high | Editorial, open, clean | Moderate in hero and featured article | Light reveal only |

## Shared Language Rules

### Shared Card Language

- Use one clear card family across the system.
- Hero cards can be deeper, glossier, and more atmospheric.
- Operational cards should prioritize scanning and clean hierarchy.
- Legal cards should flatten decoration and increase metadata clarity.

### Shared Button Language

- Primary buttons: cobalt-led, premium, rounded, decisive
- Secondary buttons: outline or tonal surface, fully visible
- Utility buttons: compact and quiet
- Buttons on legal surfaces should feel controlled and less promotional

### Shared Hero Language

- eyebrow
- direct title
- one concise support paragraph
- one clear primary action
- optional secondary action
- supporting status pills only if meaningful

### Glow and Gradient Rules

- Landing, dashboard, blog, and games can use atmospheric gradients and soft glow
- Messaging header can use subtle dark atmospheric depth
- Calendar uses softer gradient polish, not drama
- Law dashboard and verification cards should largely avoid glow

### Motion Rules

Use motion most on:

- landing
- onboarding step changes
- game dashboard hero and cards

Use motion carefully on:

- dashboard
- blog
- calendar

Avoid decorative motion on:

- law dashboard
- messaging court view
- verification and receipt panels

## Anti-Patterns for Lovable

Do not do the following:

- Do not make Messaging Hub feel like WhatsApp, iMessage, Discord, or a casual social chat product.
- Do not use playful visuals, sticker energy, emoji-forward UI, or celebratory motion on court-aware, legal, export, or professional surfaces.
- Do not create ambiguous family-scope states. If family scope is missing, show an explicit blocked state and visible family-context control.
- Do not imply that CoParrent automatically infers the correct family, co-parent, recipient, or legal record.
- Do not reintroduce `co_parent_id` assumptions, profile-pair logic, or cross-family fallback language in the design.
- Do not use color alone to communicate critical meaning. Pair state with text, iconography, or structure.
- Do not over-glow the UI. Glow is an accent, not the default surface treatment.
- Do not turn every page into a marketing hero. Working pages should orient the user first and decorate second.
- Do not create disconnected visual languages between landing, dashboard, messaging, calendar, games, law, and blog.
- Do not make professional surfaces feel like a parent dashboard with a new title. Law and verification views need their own restrained posture.
- Do not place decorative cards, oversized illustrations, or stacked promotional blocks ahead of core content on mobile.
- Do not hide the real working state behind overlays, oversized banners, or excessive empty-state art.
- Do not bury family switcher or assigned-family context below low-priority utilities.
- Do not let export, verification, or court-view surfaces feel gamified, conversational, or casual.
- Do not use dense glassmorphism, heavy blur, or low-contrast overlays that weaken legibility on operational pages.

## Final Guidance for Lovable

- Design the pages as one intentional system, not eight independent screens.
- Respect the family-scope model visually. Wherever scope matters, make it visible and explicit.
- Preserve the current product truth that CoParrent is both family-supportive and court-aware.
- Use the newer logo/icon palette direction as the visual north star: cobalt trust, teal lift, subtle premium energy.
- Do not over-soften legal or record-heavy surfaces.
- Do not over-harden the family-facing surfaces into sterile enterprise screens.
- The right result is premium calm: modern, sophisticated, structured, and credible.
