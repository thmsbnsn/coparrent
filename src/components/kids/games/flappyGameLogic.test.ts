import { describe, expect, it } from "vitest";
import {
  FLAPPY_GROUND_TOP,
  FLAPPY_WORLD,
  createRunningFlappyState,
  flapFlappyGame,
  normalizeFlappySeed,
  stepFlappyGame,
} from "@/components/kids/games/flappyGameLogic";

describe("flappyGameLogic", () => {
  it("normalizes the same input seed into the same deterministic sequence", () => {
    const firstState = createRunningFlappyState(3, 48271);
    const secondState = createRunningFlappyState(3, 48271);

    expect(firstState.seed).toBe(normalizeFlappySeed(48271));
    expect(secondState.seed).toBe(firstState.seed);
    expect(secondState.obstacles).toEqual(firstState.obstacles);

    const firstStep = stepFlappyGame(firstState, 1325);
    const secondStep = stepFlappyGame(secondState, 1325);

    expect(firstStep.state.obstacles).toEqual(secondStep.state.obstacles);
  });

  it("starts a running round with the first obstacle already queued", () => {
    const state = createRunningFlappyState(3, 48271);

    expect(state.status).toBe("running");
    expect(state.bestScore).toBe(3);
    expect(state.score).toBe(0);
    expect(state.obstacles).toHaveLength(1);
    expect(state.nextObstacleId).toBe(1);
  });

  it("applies an upward flap while the round is running", () => {
    const state = createRunningFlappyState(0, 48271);
    const nextState = flapFlappyGame(state);

    expect(nextState.velocityY).toBe(FLAPPY_WORLD.flapVelocity);
  });

  it("increments the score after the plane passes an obstacle pair", () => {
    const state = {
      ...createRunningFlappyState(0, 0.5),
      obstacles: [
        {
          gapY: 220,
          id: 0,
          scored: false,
          x: FLAPPY_WORLD.playerX - FLAPPY_WORLD.obstacleWidth - 6,
        },
      ],
      velocityY: 0,
    };

    const result = stepFlappyGame(state, 16);

    expect(result.events.scored).toBe(true);
    expect(result.state.score).toBe(1);
    expect(result.state.bestScore).toBe(1);
    expect(result.state.obstacles[0]?.scored).toBe(true);
    expect(result.state.distance).toBeGreaterThan(0);
  });

  it("ends the round when the plane hits the ground", () => {
    const state = {
      ...createRunningFlappyState(0, 0.5),
      obstacles: [],
      playerY: FLAPPY_GROUND_TOP - FLAPPY_WORLD.playerHeight + 2,
      velocityY: 420,
    };

    const result = stepFlappyGame(state, 16);

    expect(result.events.gameOver).toBe(true);
    expect(result.state.status).toBe("game_over");
    expect(result.state.playerY).toBe(FLAPPY_GROUND_TOP - FLAPPY_WORLD.playerHeight);
  });

  it("ends the round when the plane clips an obstacle body", () => {
    const state = {
      ...createRunningFlappyState(0, 0.5),
      obstacles: [
        {
          gapY: 96,
          id: 0,
          scored: false,
          x: FLAPPY_WORLD.playerX + 18,
        },
      ],
      playerY: 180,
      velocityY: 0,
    };

    const result = stepFlappyGame(state, 16);

    expect(result.events.gameOver).toBe(true);
    expect(result.state.status).toBe("game_over");
  });
});
