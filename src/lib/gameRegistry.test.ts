import { describe, expect, it } from "vitest";
import { FAMILY_GAME_REGISTRY, FAMILY_GAMES, getFamilyGameBySlug } from "@/lib/gameRegistry";

describe("gameRegistry", () => {
  it("keeps Toy Plane Dash configured as the first shared playable game", () => {
    expect(FAMILY_GAMES.flappyPlane.displayName).toBe("Toy Plane Dash");
    expect(FAMILY_GAMES.flappyPlane.slug).toBe("flappy-plane");
    expect(FAMILY_GAMES.flappyPlane.launcherPath).toBe("/dashboard/games/flappy-plane/lobby");
    expect(FAMILY_GAMES.flappyPlane.playPath).toBe("/dashboard/games/flappy-plane");
    expect(FAMILY_GAMES.flappyPlane.supportsMultiplayer).toBe(true);
  });

  it("looks up shared game metadata by slug", () => {
    expect(getFamilyGameBySlug("star-hopper")).toEqual(FAMILY_GAME_REGISTRY["star-hopper"]);
    expect(getFamilyGameBySlug("missing-game")).toBeNull();
  });
});
