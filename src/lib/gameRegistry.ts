import { FLAPPY_ASSETS } from "@/assets/games/flappy";

export type FamilyGameSlug =
  | "flappy-plane"
  | "family-raceway"
  | "star-hopper"
  | "pirate-harbor";

export type FamilyGameAvailability = "playable" | "coming_soon";

export interface FamilyGameConfig {
  accentClass: string;
  availability: FamilyGameAvailability;
  dashboardDescription: string;
  dashboardEyebrow: string;
  defaultMaxPlayers: number;
  detailDescription: string;
  detailHighlights: readonly string[];
  detailStatusLabel: string;
  displayName: string;
  key: string;
  kidsPlayPath: string | null;
  launcherPath: string;
  playPath: string;
  previewArtAlt?: string;
  previewArtClassName?: string;
  previewArtSrc?: string;
  slug: FamilyGameSlug;
  supportsMultiplayer: boolean;
  teaserDescription: string;
  teaserLabel: string;
}

export const FAMILY_GAME_REGISTRY: Record<FamilyGameSlug, FamilyGameConfig> = {
  "family-raceway": {
    accentClass: "from-rose-500 via-orange-400 to-amber-300",
    availability: "coming_soon",
    dashboardDescription:
      "Friendly lap races built for side-by-side family competition with simple touch controls.",
    dashboardEyebrow: "Shared racing lane",
    defaultMaxPlayers: 4,
    detailDescription:
      "Family Raceway is the next shared game consumer planned for the reusable session foundation. The goal is a side-by-side family racer that keeps the same lobby, shared start, results, and child-safe posture already proven by Toy Plane Dash.",
    detailHighlights: [
      "Shared lobby, readiness, and start state will reuse the current family game session model.",
      "Child-safe multiplayer posture and game restrictions will stay family-scoped.",
      "The route and registry are already reserved so launch stays additive instead of one-off.",
    ],
    detailStatusLabel: "Platform route reserved",
    displayName: "Family Raceway",
    key: "familyRaceway",
    kidsPlayPath: null,
    launcherPath: "/dashboard/games/family-raceway/lobby",
    playPath: "/dashboard/games/family-raceway",
    slug: "family-raceway",
    supportsMultiplayer: true,
    teaserDescription:
      "Friendly lap races built for side-by-side family competition with simple touch controls.",
    teaserLabel: "Future racing",
  },
  "flappy-plane": {
    accentClass: "from-sky-500 via-cyan-500 to-emerald-400",
    availability: "playable",
    dashboardDescription:
      "Open a family lobby first, then launch the synchronized Toy Plane Dash race once everyone is ready.",
    dashboardEyebrow: "Playable now",
    defaultMaxPlayers: 4,
    detailDescription:
      "Toy Plane Dash is the first live consumer of the shared family game platform. Families can gather in one lobby, get the same shared seed, launch together, and resolve results back into one family-scoped session.",
    detailHighlights: [
      "Family-scoped lobby creation, join, ready, start, result, and rematch flow are already live.",
      "The race uses one shared seed and synchronized start time when launched from a session.",
      "Solo preview remains available when multiplayer or server availability is limited.",
    ],
    detailStatusLabel: "Live now",
    displayName: "Toy Plane Dash",
    key: "flappyPlane",
    kidsPlayPath: "/kids/games/flappy-plane",
    launcherPath: "/dashboard/games/flappy-plane/lobby",
    playPath: "/dashboard/games/flappy-plane",
    previewArtAlt: "Blue toy plane",
    previewArtClassName: "h-24 w-auto sm:h-28",
    previewArtSrc: FLAPPY_ASSETS.sprites.plane,
    slug: "flappy-plane",
    supportsMultiplayer: true,
    teaserDescription:
      "Synchronized family flappy races with one shared lobby, shared seed, and server-resolved results.",
    teaserLabel: "Shared arcade",
  },
  "pirate-harbor": {
    accentClass: "from-emerald-500 via-teal-500 to-cyan-400",
    availability: "coming_soon",
    dashboardDescription:
      "Treasure maps, shared puzzles, and playful pirate adventures without cluttered controls.",
    dashboardEyebrow: "Story co-op",
    defaultMaxPlayers: 4,
    detailDescription:
      "Pirate Harbor is planned as the more puzzle-forward shared family title. It should reuse the same registry, session, and presence posture while shifting the feel toward collaborative treasure hunts instead of straight racing.",
    detailHighlights: [
      "Shared family lobbies and activity presence can stay game-agnostic.",
      "The route and metadata are already in the shared registry for deliberate expansion.",
      "The eventual game can plug into the same result and child-safe multiplayer posture later.",
    ],
    detailStatusLabel: "Shared platform planned",
    displayName: "Pirate Harbor",
    key: "pirateHarbor",
    kidsPlayPath: null,
    launcherPath: "/dashboard/games/pirate-harbor/lobby",
    playPath: "/dashboard/games/pirate-harbor",
    slug: "pirate-harbor",
    supportsMultiplayer: true,
    teaserDescription:
      "Treasure maps, shared puzzles, and playful pirate adventures without cluttered controls.",
    teaserLabel: "Future pirate",
  },
  "star-hopper": {
    accentClass: "from-indigo-500 via-sky-500 to-cyan-300",
    availability: "coming_soon",
    dashboardDescription:
      "Picture-first space missions, quick co-op goals, and bright exploration moments.",
    dashboardEyebrow: "Mission co-op",
    defaultMaxPlayers: 4,
    detailDescription:
      "Star Hopper is reserved as the second shared game path for space-themed quick missions. It is intentionally set up through the registry now so the next multiplayer consumer can sit on the same session and activity foundation without rebuilding the platform layer.",
    detailHighlights: [
      "The future game can reuse family-scoped sessions, presence, and result handling.",
      "The overview route is live now so the dashboard no longer treats future titles as hard-coded placeholders.",
      "Child-safe game restrictions can later enable or block this title through the same shared posture.",
    ],
    detailStatusLabel: "Reserved next-game slot",
    displayName: "Star Hopper",
    key: "starHopper",
    kidsPlayPath: null,
    launcherPath: "/dashboard/games/star-hopper/lobby",
    playPath: "/dashboard/games/star-hopper",
    slug: "star-hopper",
    supportsMultiplayer: true,
    teaserDescription:
      "Picture-first space missions, quick co-op goals, and bright exploration moments.",
    teaserLabel: "Future space",
  },
};

export const FAMILY_GAMES = {
  familyRaceway: FAMILY_GAME_REGISTRY["family-raceway"],
  flappyPlane: FAMILY_GAME_REGISTRY["flappy-plane"],
  pirateHarbor: FAMILY_GAME_REGISTRY["pirate-harbor"],
  starHopper: FAMILY_GAME_REGISTRY["star-hopper"],
} as const;

export const FAMILY_GAME_LIST = Object.values(FAMILY_GAME_REGISTRY);

export const PLAYABLE_FAMILY_GAMES = FAMILY_GAME_LIST.filter(
  (game) => game.availability === "playable",
);

export const UPCOMING_FAMILY_GAMES = FAMILY_GAME_LIST.filter(
  (game) => game.availability === "coming_soon",
);

export const getFamilyGameBySlug = (slug: string | null | undefined) =>
  slug ? FAMILY_GAME_REGISTRY[slug as FamilyGameSlug] ?? null : null;
