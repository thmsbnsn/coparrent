# CoParrent Initial User Rollout Plan

Last updated: 2026-04-10

This plan assumes a controlled phase-1 rollout, not a public launch.

## Launch Recommendation

Current recommendation: **Hold external rollout until blocker closeout.**

Phase-1 is now close. Access codes are not the blocker. Billing is not the blocker. Login, signup, onboarding, and co-parent invite acceptance are not the blocker.

The remaining launch stop is narrower:

- the live third-party invite path is broken on production

First-cohort support and monitoring ownership is assigned to the CoParrent Development Team.

Complimentary access codes are not the blocker anymore:

- repo-ready
- production backend ready
- public production frontend ready
- live public-host proof complete

Only rerun access-code QA if that surface changes again before another batch.

## Rollout Principles

- Launch only what is repo-confirmed and either freshly verified or consciously accepted as out of scope.
- Do not promise push/PWA, async family challenges, child-install polish, exports, or Law Office Portal review unless those are explicitly reverified.
- Distribute redeem codes only through the proven complimentary-access operator flow and only in small batches.
- Keep support direct and human for the first cohort.
- Do not widen scope during the first cohort window.

## Scope Recommendation For The First Cohort

Recommended in-scope surfaces:

- public site
- login and signup under the current explicit no-captcha posture
- onboarding
- co-parent invite acceptance
- family switching and fail-closed family scope
- messaging
- calling
- subscription flow
- complimentary access-code distribution through the operator runbook
- problem reporting

Recommended out-of-scope surfaces unless reverified first:

- third-party invites, unless the production RPC drift is fixed and the full path is rerun
- exports
- Lawyer Portal / Law Office Portal review
- push/PWA as a promised feature
- async family challenges
- child-device rollout
- anything that depends on a brand-new production schema change during the cohort window

## Lawyer Portal Status For Rollout Planning

- **Present in repo:** Yes
- **Current function:** Assigned-family-scoped review of immutable family-wide court-record exports, stored artifact download, and receipt-backed verification
- **Phase-1 read-only:** Yes
- **In first-cohort scope:** No
- **Fresh public-host proof:** No
- **Operational rule:** Keep it out of first-cohort messaging until the live portal login, assigned-family selection, download, and verification actions are re-proven

## Milestone 1: First Internal Test Users

### Entry criteria

- Canonical public host is explicit and aligned to `https://coparrent.com`.
- Login, signup, onboarding, and co-parent invite acceptance have fresh public-host proof.
- Current-production billing proof is complete.
- Third-party invite is either fixed and re-proven or explicitly removed from this milestone.
- Support and monitoring ownership is assigned to the CoParrent Development Team.

### User count

- 2 to 5 trusted internal testers

### Goal

- Confirm the live production host is stable enough for non-developer users.

### Required actions

1. Repair the production third-party invite RPC drift or remove third-party invites from the milestone scope.
2. If repaired, rerun third-party invite creation and acceptance on `https://coparrent.com`.
3. Operate the documented support inbox, problem report, and production-log review cadence.
4. Keep the documented first-cohort Sentry posture unless Sentry is enabled before external users.
5. Confirm problem-report intake still works on current production.
6. Keep exports and Law Office Portal review explicitly out of this internal cohort unless they are deliberately reverified first.

### Exit criteria

- No unknowns remain for the in-scope public host flows.
- Any issues found are fixed or explicitly removed from first-cohort scope.

## Milestone 2: First External Pilot Users

### Entry criteria

- Internal milestone passed.
- Phase-1 scope has been frozen.
- No required launch changes remain unplanned.

### User count

- 5 to 20 external users max

### Goal

- Validate onboarding, family operations, billing posture, support load, and real-user comprehension.

### Operating model

- Manual support coverage during the pilot window
- Daily issue review
- No silent scope expansion during the pilot

### Exit criteria

- The in-scope invite flows remain stable under real-user usage.
- Support load is manageable.
- No unresolved critical launch bugs are found.

## Milestone 3: Redeem-Code-Enabled Rollout

### Entry criteria

- The access-code surface still matches the 2026-04-10 live-proofed implementation, or it has been re-QAed after any later change.
- The redeem-code runbook still matches the live system.
- Support team knows how to revoke or replace a bad code.

### Goal

- Start controlled distribution of a small code batch without improvising operations or reopening feature work.

### First batch guidance

- Start with a very small batch.
- Track each code issue and redemption outcome.
- Avoid large campaign distribution until the first batch is clean.

## First-Cohort Support Ownership

| Decision | Current state |
| --- | --- |
| Support inbox owner | CoParrent Development Team (`support@coparrent.com`) |
| General contact owner | CoParrent Development Team (`hello@coparrent.com`) |
| Legal / law-office inquiry owner | CoParrent Development Team (`legal@coparrent.com`) |
| Problem report triage owner | CoParrent Development Team |
| Edge-function / runtime log owner | CoParrent Development Team |
| Transactional sender mailbox | `no-reply@coparrent.com`; outbound only, not monitored for support |
| Sentry posture | Intentionally absent for first cohort unless enabled before external users |

Operating cadence:

- Check `support@coparrent.com` at least twice daily during pilot.
- Check problem reports daily.
- Review runtime / edge-function logs daily during pilot.
- Route legal or law-office requests through `legal@coparrent.com`.

## Exact Recommended Next 10 Actions In Order

1. Keep the launch posture aligned to `https://coparrent.com` as the canonical host.
2. Correct production so `public.rpc_create_third_party_invite` exposes the scoped `p_family_id` signature the current client sends.
3. Rerun third-party invite creation on `https://coparrent.com`.
4. Rerun third-party invite acceptance on `https://coparrent.com`.
5. Decide whether third-party invites stay in first-cohort scope if step 2 is not completed immediately.
6. Start the documented first-cohort support cadence: check `support@coparrent.com` twice daily and problem reports daily.
7. Start the documented daily runtime / edge-function log review during pilot.
8. Route legal or law-office requests through `legal@coparrent.com`.
9. Freeze the first-cohort scope and keep exports and Law Office Portal review out of that promise until they are deliberately reverified.
10. Start a very small internal cohort first, then external pilot users only after steps 2 through 9 are complete.

## Owner Suggestions

| Workstream | Suggested owner |
| --- | --- |
| Host decision and public launch posture | Founder + ops |
| Third-party invite repair and rerun | Engineering + QA |
| Billing proof refresh if the surface changes again | QA + engineering |
| Redeem-code distribution operations | Engineering + ops |
| Export and Law Office Portal verification before public launch | QA + engineering |
| Support readiness and monitoring | CoParrent Development Team |

## Rollback Posture

For the first external cohort:

- Avoid shipping unnecessary schema changes.
- Keep launch scope narrow.
- Keep the last known-good deployment reference available.
- If a critical auth, invite, or billing regression appears, stop external onboarding before expanding the cohort.

## Bottom Line

The shortest safe route is:

1. repair the live third-party invite path or explicitly remove it from first-cohort scope
2. operate the documented first-cohort support and monitoring cadence
3. keep exports and Law Office Portal review out of scope for the first cohort
4. keep the already-proven redeem-code surface unchanged unless you are willing to rerun QA
5. start tiny and expand only after the first clean passes

That is the right rollout shape for this repo as it exists today.
