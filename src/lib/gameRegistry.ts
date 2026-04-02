export type FamilyGameSlug =
  | "flappy-plane"
  | "family-raceway"
  | "star-hopper"
  | "pirate-harbor";

export interface FamilyGameConfig {
  defaultMaxPlayers: number;
  displayName: string;
  key: string;
  kidsPlayPath: string | null;
  launcherPath: string;
  playPath: string;
  slug: FamilyGameSlug;
  supportsMultiplayer: boolean;
}

export const FAMILY_GAME_REGISTRY: Record<FamilyGameSlug, FamilyGameConfig> = {
  "family-raceway": {
    defaultMaxPlayers: 4,
    displayName: "Family Raceway",
    key: "familyRaceway",
    kidsPlayPath: null,
    launcherPath: "/dashboard/games/family-raceway/lobby",
    playPath: "/dashboard/games/family-raceway",
    slug: "family-raceway",
    supportsMultiplayer: true,
  },
  "flappy-plane": {
    defaultMaxPlayers: 4,
    displayName: "Toy Plane Dash",
    key: "flappyPlane",
    kidsPlayPath: "/kids/games/flappy-plane",
    launcherPath: "/dashboard/games/flappy-plane/lobby",
    playPath: "/dashboard/games/flappy-plane",
    slug: "flappy-plane",
    supportsMultiplayer: true,
  },
  "pirate-harbor": {
    defaultMaxPlayers: 4,
    displayName: "Pirate Harbor",
    key: "pirateHarbor",
    kidsPlayPath: null,
    launcherPath: "/dashboard/games/pirate-harbor/lobby",
    playPath: "/dashboard/games/pirate-harbor",
    slug: "pirate-harbor",
    supportsMultiplayer: true,
  },
  "star-hopper": {
    defaultMaxPlayers: 4,
    displayName: "Star Hopper",
    key: "starHopper",
    kidsPlayPath: null,
    launcherPath: "/dashboard/games/star-hopper/lobby",
    playPath: "/dashboard/games/star-hopper",
    slug: "star-hopper",
    supportsMultiplayer: true,
  },
};

export const FAMILY_GAMES = {
  familyRaceway: FAMILY_GAME_REGISTRY["family-raceway"],
  flappyPlane: FAMILY_GAME_REGISTRY["flappy-plane"],
  pirateHarbor: FAMILY_GAME_REGISTRY["pirate-harbor"],
  starHopper: FAMILY_GAME_REGISTRY["star-hopper"],
} as const;

export const getFamilyGameBySlug = (slug: string | null | undefined) =>
  slug ? FAMILY_GAME_REGISTRY[slug as FamilyGameSlug] ?? null : null;
