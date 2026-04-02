import { useGameLobby } from "@/hooks/useGameLobby";
import { FAMILY_GAMES } from "@/lib/gameRegistry";

export const useToyPlaneDashLobby = (sessionId: string | null) => {
  return useGameLobby({
    gameSlug: FAMILY_GAMES.flappyPlane.slug,
    sessionId,
  });
};
