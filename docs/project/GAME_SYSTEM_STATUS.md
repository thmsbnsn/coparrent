# CoParrent Game System Status

Last updated: 2026-04-02

This document explains how the shared game system is set up today, what is working, what is blocked, and what the next path should be.

It is intentionally grounded in the current repo and the current deployment state. It distinguishes between what is now in production and what is still unresolved about staging/bootstrap posture.

## 1. System Intent

The current game system is designed as a shared family play layer, not as a child-only toy surface.

Current product direction in the repo:

- adults use the shared [Game Dashboard](../../src/pages/GameDashboard.tsx)
- child accounts can reach explicitly allowed game routes through the existing route-access model
- shared multiplayer sessions are family-scoped
- Toy Plane Dash is the first real game on top of a reusable session/lobby foundation

## 2. Core Architecture

### Family Scope And Trust Boundaries

The game system follows the same core rule as the rest of CoParrent:

- client scope uses `activeFamilyId`
- privileged server operations require explicit `family_id`
- missing or ambiguous scope fails closed
- the client is not trusted to authorize membership, readiness, winners, or session ownership

### Shared Registry

Current source:

- [../../src/lib/gameRegistry.ts](../../src/lib/gameRegistry.ts)

The registry is the shared source of truth for:

- `game_slug`
- display name
- launcher path
- play path
- whether the game supports multiplayer

Current registered game slugs:

- `flappy-plane`
- `family-raceway`
- `star-hopper`
- `pirate-harbor`

Only `flappy-plane` is currently implemented as a real game. The others are placeholders for future work.

### Shared Client Session Layer

Current sources:

- [../../src/lib/gameSessions.ts](../../src/lib/gameSessions.ts)
- [../../src/hooks/useGameSessions.ts](../../src/hooks/useGameSessions.ts)
- [../../src/hooks/useGameLobby.ts](../../src/hooks/useGameLobby.ts)

What the shared layer currently handles:

- loading open sessions for a family and game slug
- creating/opening a family-scoped session
- joining a session
- ready state
- start state
- result reporting
- current-member lookup
- current results lookup
- rematch preparation
- family-scoped fail-closed handling

### Shared Presence Layer

Current sources:

- [../../src/hooks/useFamilyPresence.ts](../../src/hooks/useFamilyPresence.ts)
- [../../src/hooks/usePresenceHeartbeat.ts](../../src/hooks/usePresenceHeartbeat.ts)
- [../../src/lib/familyPresence.ts](../../src/lib/familyPresence.ts)

Presence is intended to show:

- inactive/offline
- active on dashboard
- active in lobby
- active in game

The shared game system uses that layer so the family can see who is browsing, waiting in a lobby, or currently playing.

## 3. Current Routes And UI Surfaces

### Shared Game Surfaces

Current pages:

- [../../src/pages/GameDashboard.tsx](../../src/pages/GameDashboard.tsx)
- [../../src/pages/GameLobbyPage.tsx](../../src/pages/GameLobbyPage.tsx)
- [../../src/pages/GameFlappyPage.tsx](../../src/pages/GameFlappyPage.tsx)

Current route shape:

- `/dashboard/games`
- `/dashboard/games/flappy-plane`
- `/dashboard/games/flappy-plane/lobby`
- `/dashboard/games/flappy-plane/lobby/:sessionId`

### Child-Safe Route

Current route:

- `/kids/games/flappy-plane`

That route still exists for child-safe direct play, but the shared games dashboard is the intended family play entry point.

### Main Toy Plane Dash Runtime

Current sources:

- [../../src/components/kids/games/FlappyPlaneGame.tsx](../../src/components/kids/games/FlappyPlaneGame.tsx)
- [../../src/components/kids/games/flappyGameLogic.ts](../../src/components/kids/games/flappyGameLogic.ts)
- [../../src/components/kids/games/GameShell.tsx](../../src/components/kids/games/GameShell.tsx)

Current game runtime supports:

- touch, click, and space-to-flap
- deterministic seeded obstacle generation
- synchronized auto-start signal
- local best score
- shared session result reporting
- fullscreen and sideways/orientation helpers in the shared shell

## 4. Current Database Model

Primary migrations:

- [../../supabase/migrations/20260402153000_add_family_presence_system.sql](../../supabase/migrations/20260402153000_add_family_presence_system.sql)
- [../../supabase/migrations/20260402174500_add_family_game_lobbies.sql](../../supabase/migrations/20260402174500_add_family_game_lobbies.sql)
- [../../supabase/migrations/20260402233000_add_family_game_race_sync_and_results.sql](../../supabase/migrations/20260402233000_add_family_game_race_sync_and_results.sql)
- [../../supabase/migrations/20260402234500_harden_family_game_helper_scope.sql](../../supabase/migrations/20260402234500_harden_family_game_helper_scope.sql)
- [../../supabase/migrations/20260402235500_add_family_game_session_rematch.sql](../../supabase/migrations/20260402235500_add_family_game_session_rematch.sql)

Current tables and concepts:

- `family_presence`
- `family_game_sessions`
- `family_game_session_members`
- `family_game_session_results`

Current server-side capabilities:

- explicit family-scoped presence overview
- explicit family-scoped session overview
- family-scoped lobby payload
- host-owned session start
- server-generated session `seed`
- server-set synchronized `start_time`
- result rows stored per session member
- server-owned winner resolution
- host-only rematch reset

## 5. What Works In The Repo Right Now

Repo-confirmed working pieces:

- the shared Game Dashboard exists and routes correctly
- Toy Plane Dash is playable
- the solo-preview path works in code
- the family lobby/session model is generic and implemented in code
- deterministic seeded race support exists in the game runtime
- session start countdown and result reporting exist in code
- server-side winner resolution and rematch flow exist in migrations
- the frontend now handles missing game/presence RPCs more gracefully with maintenance messaging and solo-preview fallback

Local verification also currently passes:

- `npm run lint`
- `npm run build`
- `npm run test -- --run`

## 6. What Is Working Live Right Now

Operationally confirmed on 2026-04-02:

- the production frontend is deployed at `https://coparrent.com`
- the latest shared-games frontend changes are included in that deploy
- the targeted production database bundle for:
  - child portal/call prerequisites
  - family presence
  - family game lobbies
  - race sync/results
  - family game rematch
  was applied successfully

That means the production environment now contains the shared-game RPC layer that had previously been missing.

## 7. What Is Still Not Fully Closed

The live production blocker that originally removed the family-lobby path is now addressed, but there are still important incomplete pieces:

- the first real two-user multiplayer verification pass still needs to run against a dedicated same-family setup
- a brand-new staging project still cannot be rebuilt from the local migration chain alone
- the frontend maintenance fallbacks remain valuable protection for partial or older environments, even though production now has the targeted game RPC bundle

## 8. Current Environment Blocker

The blocker is no longer the production game RPC rollout.

The blocker is reproducible staging/bootstrap posture.

What is currently true:

- a brand-new staging project does not reach the shared-game schema by replaying local migrations alone
- the first clean replay blocker is [../../supabase/migrations/20260315205438_expand_audit_logging.sql](../../supabase/migrations/20260315205438_expand_audit_logging.sql), which referenced `public.calendar_events` too early
- even after hardening that file, later replay steps show that the repo’s local migration history still assumes older baseline schema such as `public.families`

Because of that:

- staging is not yet a clean-room proof environment
- local development can target staging explicitly, but staging still needs either a production-derived baseline or missing historical migrations added back into local history

## 9. What Is Not Finished Yet

The game system is still incomplete in several important ways.

### Backend / rollout

- the migration chain still needs a reproducible staging/bootstrap answer
- staging needs a trustworthy baseline before it can serve as the clean proof environment
- the real two-user multiplayer verifier still needs to run against a dedicated test family

### Product / gameplay

- only one real game is implemented
- the current multiplayer model is synchronized parallel racing, not full real-time multiplayer
- future games in the registry are placeholders only
- async challenges are not built yet
- the shared games backend is generic, but only Toy Plane Dash is currently wired through it

### UX polish

- results and leaderboard flow have improved, but can still be polished further
- richer animation/reveal flow is still open
- broader post-race session loops and challenge surfaces are still open
- mobile behavior needs real-device verification after recent layout fixes

## 10. What The Current Fallback Behavior Does

Because partial environments can still exist, the frontend intentionally protects the user experience instead of showing raw database errors.

Current fallback behavior:

- missing game-session RPCs show a maintenance message
- shared games can fall back to solo preview
- missing family-presence RPCs show a maintenance message instead of raw schema-cache output

This is still useful even after the production RPC rollout, because staging or older deployments can still be partial.

## 11. Recommended Next Path

The safest and cleanest next sequence is:

1. Decide the staging/bootstrap path:
   - either backfill the missing historical Supabase baseline into local migrations
   - or formalize a production-derived staging bootstrap
2. Get the staging Supabase project to a trustworthy baseline.
3. Seed one dedicated test family and two real test users in staging.
4. Run the family-game verifier end to end:
   - create/open session
   - join second player
   - ready both
   - start session
   - confirm shared seed
   - confirm synchronized start time
   - report results
   - confirm winner resolution
5. Re-verify the shared games experience live after the production DB rollout.
6. Continue with next game-platform work:
   - stronger results/leaderboard animation flow
   - rematch/post-race refinement
   - async family challenges
   - more games using the same generic session foundation

## 12. Current Bottom Line

The shared game system is real and materially implemented in the repo.

What is true today:

- the frontend and session architecture exist
- the game registry and shared session model exist
- Toy Plane Dash is the first working game consumer
- the production frontend is deployed

What is also true today:

- the production shared-games backend bundle is now applied
- staging still cannot reach the same state cleanly because the repo migration history is not a full baseline
- live two-user verification is still pending

So the game system is best described as:

- architecturally in place
- locally verified
- production-deployed
- staging-bootstrap-blocked

## Related Docs

- [CURRENT_STATUS.md](CURRENT_STATUS.md)
- [PROJECT_COMPLETION_REVIEW.md](PROJECT_COMPLETION_REVIEW.md)
- [../security/GATED_FEATURES.md](../security/GATED_FEATURES.md)
- [../security/SECURITY_MODEL.md](../security/SECURITY_MODEL.md)
