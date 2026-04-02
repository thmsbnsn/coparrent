# CoParrent Game System Status

Last updated: 2026-04-02

This document explains how the shared game system is set up today, what is working, what remains unfinished, and what the next path should be.

It is intentionally grounded in the current repo and the current deployment state. It distinguishes between what is now in production, what is verified in staging, and what is still unfinished at the product level.

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
- availability and shared-dashboard copy
- upcoming-game overview content
- whether the game supports multiplayer

Current registered game slugs:

- `flappy-plane`
- `family-raceway`
- `star-hopper`
- `pirate-harbor`

Only `flappy-plane` is currently implemented as a real playable game. The others now have dedicated overview routes, but they are still future-work entries rather than playable games.

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
- `/dashboard/games/:gameSlug` for registry-backed future game overviews
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
- richer post-race results summaries, placement spotlighting, and rematch guidance

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
- a direct production RPC probe now returns `Authentication required` for the shared game and family-presence endpoints instead of the earlier missing-function schema-cache error

That means the production environment now contains the shared-game RPC layer that had previously been missing.

## 7. What Recently Closed

The live production blocker that originally removed the family-lobby path is now addressed.

Recently completed:

- the first real two-user multiplayer verification pass has been completed against the dedicated staging same-family setup
- the staging project has been repaired to the current schema and can now serve as the safe multiplayer proof environment
- the frontend maintenance fallbacks remain in place as protection for genuinely partial or older environments, even though production now has the targeted game RPC bundle

## 8. Current Environment State

The blocker is no longer the production game RPC rollout or staging bootstrap posture.

What is currently true:

- the staging project now reaches the current shared-game schema
- the repo contains the explicit-family bridge migration that was missing during earlier replay attempts:
  - [../../supabase/migrations/20260324000000_add_explicit_family_scope_baseline.sql](../../supabase/migrations/20260324000000_add_explicit_family_scope_baseline.sql)
- the March/April 2026 replay defects found during staging repair were corrected directly in the tracked migrations
- local development can target staging explicitly, and the dedicated family-game verifier now succeeds there end to end

Because of that:

- staging is now the trustworthy proof environment for shared games
- production and staging both have the shared-game/session/presence backend layer

## 9. What Is Not Finished Yet

The game system is still incomplete in several important ways.

### Backend / rollout

- the migration chain repair should be kept healthy as later DB changes land
- the staging family-game seed + verifier flow should be rerun after meaningful multiplayer/backend changes

### Product / gameplay

- only one real game is implemented
- the current multiplayer model is synchronized parallel racing, not full real-time multiplayer
- future games in the registry have overview routes, but they are not playable yet
- async challenges are not built yet
- the shared games backend is generic, but only Toy Plane Dash is currently wired through it

### UX polish

- results and leaderboard flow have materially improved, but richer animation/reveal polish is still open
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

1. Keep the staging verifier path healthy:
   - `npm run seed:family-games:staging`
   - `npm run verify:family-games`
2. Re-verify the shared games experience live after meaningful game/backend releases.
3. Continue with next game-platform work:
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
- staging is wired and verified for the same family-game backend path

What is also true today:

- the production shared-games backend bundle is now applied
- the staging multiplayer fixture is seeded and the dedicated family-game verifier passes there
- live same-family UI verification on real devices is still worth doing after future releases

So the game system is best described as:

- architecturally in place
- locally verified
- production-deployed
- staging-verified

## Related Docs

- [CURRENT_STATUS.md](CURRENT_STATUS.md)
- [PROJECT_COMPLETION_REVIEW.md](PROJECT_COMPLETION_REVIEW.md)
- [../security/GATED_FEATURES.md](../security/GATED_FEATURES.md)
- [../security/SECURITY_MODEL.md](../security/SECURITY_MODEL.md)
