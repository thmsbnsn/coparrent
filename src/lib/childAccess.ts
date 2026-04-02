import { FAMILY_GAME_REGISTRY } from "@/lib/gameRegistry";

export type ChildAllowedSignInMode = "standard_sign_in";

export interface ChildDeviceAccessSettingsSnapshot {
  allowed_game_slugs: string[];
  allowed_sign_in_mode: ChildAllowedSignInMode;
  child_email_reset_enabled: boolean;
  communication_enabled: boolean;
  games_enabled: boolean;
  multiplayer_enabled: boolean;
  quick_unlock_enabled: boolean;
  screen_time_daily_minutes: number | null;
  screen_time_enabled: boolean;
}

export const CHILD_APP_INSTALL_PATH = "/child-app";
export const CHILD_APP_INSTALL_INTENT_PATH = `${CHILD_APP_INSTALL_PATH}?install=1`;

export const CHILD_APP_MODE_FOUNDATION = {
  description:
    "Child-safe launch shell for a future dedicated child install mode from the same codebase.",
  displayName: "CoParrent Child Mode",
  orientation: "landscape-primary",
  shortName: "Child Mode",
  startUrl: CHILD_APP_INSTALL_PATH,
} as const;

export const CHILD_GAME_OPTIONS = [
  {
    displayName: FAMILY_GAME_REGISTRY["flappy-plane"].displayName,
    slug: FAMILY_GAME_REGISTRY["flappy-plane"].slug,
  },
] as const;

export const DEFAULT_CHILD_DEVICE_ACCESS_SETTINGS: ChildDeviceAccessSettingsSnapshot = {
  allowed_game_slugs: CHILD_GAME_OPTIONS.map((game) => game.slug),
  allowed_sign_in_mode: "standard_sign_in",
  child_email_reset_enabled: false,
  communication_enabled: true,
  games_enabled: true,
  multiplayer_enabled: true,
  quick_unlock_enabled: false,
  screen_time_daily_minutes: null,
  screen_time_enabled: false,
};

export const CLOSED_CHILD_DEVICE_ACCESS_SETTINGS: ChildDeviceAccessSettingsSnapshot = {
  allowed_game_slugs: [],
  allowed_sign_in_mode: "standard_sign_in",
  child_email_reset_enabled: false,
  communication_enabled: false,
  games_enabled: false,
  multiplayer_enabled: false,
  quick_unlock_enabled: false,
  screen_time_daily_minutes: null,
  screen_time_enabled: false,
};

export const isChildGameAllowed = (
  settings: Pick<ChildDeviceAccessSettingsSnapshot, "allowed_game_slugs" | "games_enabled">,
  gameSlug: string,
) => settings.games_enabled && Array.isArray(settings.allowed_game_slugs) && settings.allowed_game_slugs.includes(gameSlug);

export const getChildGameLabel = (gameSlug: string) =>
  CHILD_GAME_OPTIONS.find((game) => game.slug === gameSlug)?.displayName ?? gameSlug;

export const getChildAppLoginPath = (nextPath = CHILD_APP_INSTALL_PATH) =>
  `/login?next=${encodeURIComponent(nextPath)}`;
