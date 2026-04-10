export const FLAPPY_WORLD = {
  backgroundTileWidth: 800,
  backgroundSpeed: 18,
  flapVelocity: -410,
  gapSize: 204,
  gravity: 780,
  gravityBoost: 520,
  groundHeight: 71,
  groundSpeed: 212,
  groundTileWidth: 808,
  height: 480,
  maxFallSpeed: 560,
  obstacleSpawnEveryMs: 1460,
  obstacleWidth: 100,
  playerHeight: 73,
  playerStartY: 180,
  playerWidth: 88,
  playerX: 172,
  width: 800,
} as const;

export const FLAPPY_GROUND_TOP = FLAPPY_WORLD.height - FLAPPY_WORLD.groundHeight;

export type FlappyGameStatus = "ready" | "running" | "game_over";

export interface FlappyObstacle {
  gapSize: number;
  gapY: number;
  id: number;
  scored: boolean;
  x: number;
}

export interface FlappyGameState {
  backgroundOffset: number;
  bestScore: number;
  distance: number;
  groundOffset: number;
  nextObstacleId: number;
  obstacles: FlappyObstacle[];
  playerY: number;
  rngState: number;
  score: number;
  seed: number;
  spawnTimerMs: number;
  status: FlappyGameStatus;
  velocityY: number;
}

export interface FlappyStepEvents {
  gameOver: boolean;
  scored: boolean;
}

export interface FlappyStepResult {
  events: FlappyStepEvents;
  state: FlappyGameState;
}

const INITIAL_OBSTACLE_X = FLAPPY_WORLD.width + 224;
const OBSTACLE_SPAWN_LEAD_MS = 900;
const PLAYER_COLLISION_INSET = {
  bottom: 10,
  left: 14,
  right: 12,
  top: 10,
} as const;
const MAX_SEED = 2147483647;
const INITIAL_GAP_PADDING = 58;
const FINAL_GAP_PADDING = 40;
const INITIAL_GAP_SHIFT_LIMIT = 36;
const FINAL_GAP_SHIFT_LIMIT = 88;
const MAX_DIFFICULTY_OBSTACLE_INDEX = 14;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const lerp = (start: number, end: number, amount: number) => start + (end - start) * amount;
const easeOutCubic = (value: number) => 1 - (1 - value) ** 3;

const wrapOffset = (value: number, max: number) => {
  if (max <= 0) {
    return 0;
  }

  const wrapped = value % max;
  return wrapped < 0 ? wrapped + max : wrapped;
};

const getObstacleDifficulty = (obstacleId: number) =>
  clamp(obstacleId / MAX_DIFFICULTY_OBSTACLE_INDEX, 0, 1);

const getObstacleGapSize = (obstacleId: number) => {
  const difficulty = easeOutCubic(getObstacleDifficulty(obstacleId));
  return Math.round(lerp(220, 174, difficulty));
};

const getObstacleEdgePadding = (obstacleId: number) =>
  lerp(INITIAL_GAP_PADDING, FINAL_GAP_PADDING, getObstacleDifficulty(obstacleId));

const getObstacleShiftLimit = (obstacleId: number) =>
  lerp(INITIAL_GAP_SHIFT_LIMIT, FINAL_GAP_SHIFT_LIMIT, easeOutCubic(getObstacleDifficulty(obstacleId)));

const getPlayableGapRange = (gapSize: number, edgePadding: number) => {
  const gapHalf = gapSize / 2;
  const min = gapHalf + edgePadding;
  const max = FLAPPY_GROUND_TOP - gapHalf - edgePadding;
  return { max, min };
};

const getFlappyGravity = (velocityY: number) => {
  const normalizedFallSpeed = clamp(
    (velocityY + 80) / (FLAPPY_WORLD.maxFallSpeed + 80),
    0,
    1,
  );

  return FLAPPY_WORLD.gravity + easeOutCubic(normalizedFallSpeed) * FLAPPY_WORLD.gravityBoost;
};

export const normalizeFlappySeed = (seed: number | null | undefined) => {
  const parsed = Math.abs(Math.trunc(seed ?? 1)) % MAX_SEED;
  return parsed > 0 ? parsed : 1;
};

const advanceFlappySeed = (seed: number) => {
  const normalizedSeed = normalizeFlappySeed(seed);
  return (normalizedSeed * 48271) % MAX_SEED;
};

const pullSeededRandom = (seed: number) => {
  const nextSeed = advanceFlappySeed(seed);
  return {
    nextSeed,
    value: (nextSeed - 1) / (MAX_SEED - 1),
  };
};

export const getRandomGapY = (randomValue = Math.random()) => {
  const gapSize = FLAPPY_WORLD.gapSize;
  const edgePadding = INITIAL_GAP_PADDING;
  const { max, min } = getPlayableGapRange(gapSize, edgePadding);
  return min + clamp(randomValue, 0, 1) * (max - min);
};

export const createFlappyObstacle = (
  id: number,
  randomValue = Math.random(),
  x = INITIAL_OBSTACLE_X,
  previousGapY: number | null = null,
): FlappyObstacle => ({
  ...(() => {
    const gapSize = getObstacleGapSize(id);
    const edgePadding = getObstacleEdgePadding(id);
    const shiftLimit = getObstacleShiftLimit(id);
    const { max, min } = getPlayableGapRange(gapSize, edgePadding);
    const centeredGapY = previousGapY ?? (min + max) / 2;
    const rawGapY = min + clamp(randomValue, 0, 1) * (max - min);

    return {
      gapSize,
      gapY: clamp(
        rawGapY,
        Math.max(min, centeredGapY - shiftLimit),
        Math.min(max, centeredGapY + shiftLimit),
      ),
      id,
      scored: false,
      x,
    };
  })(),
});

export const createReadyFlappyState = (bestScore = 0, seed = 1): FlappyGameState => {
  const normalizedSeed = normalizeFlappySeed(seed);

  return {
    backgroundOffset: 0,
    bestScore: Math.max(0, Math.floor(bestScore)),
    distance: 0,
    groundOffset: 0,
    nextObstacleId: 0,
    obstacles: [],
    playerY: FLAPPY_WORLD.playerStartY,
    rngState: normalizedSeed,
    score: 0,
    seed: normalizedSeed,
    spawnTimerMs: OBSTACLE_SPAWN_LEAD_MS,
    status: "ready",
    velocityY: 0,
  };
};

export const createRunningFlappyState = (
  bestScore = 0,
  seed = 1,
): FlappyGameState => ({
  ...(() => {
    const normalizedSeed = normalizeFlappySeed(seed);
    const { nextSeed, value } = pullSeededRandom(normalizedSeed);

    return {
      ...createReadyFlappyState(bestScore, normalizedSeed),
      obstacles: [createFlappyObstacle(0, value)],
      rngState: nextSeed,
      seed: normalizedSeed,
    };
  })(),
  nextObstacleId: 1,
  status: "running",
});

export const flapFlappyGame = (state: FlappyGameState): FlappyGameState => {
  if (state.status !== "running") {
    return state;
  }

  return {
    ...state,
    velocityY: FLAPPY_WORLD.flapVelocity,
  };
};

export const getPlayerRotation = (velocityY: number) =>
  clamp(
    velocityY < 0
      ? -16 + (velocityY / Math.abs(FLAPPY_WORLD.flapVelocity)) * 10
      : (velocityY / FLAPPY_WORLD.maxFallSpeed) * 62,
    -18,
    70,
  );

export const getRenderedObstacleSegments = (obstacle: FlappyObstacle) => {
  const gapTop = obstacle.gapY - obstacle.gapSize / 2;
  const gapBottom = obstacle.gapY + obstacle.gapSize / 2;

  return {
    bottomHeight: Math.max(0, FLAPPY_GROUND_TOP - gapBottom),
    bottomY: gapBottom,
    topHeight: Math.max(0, gapTop),
  };
};

const endRound = (state: FlappyGameState): FlappyGameState => ({
  ...state,
  bestScore: Math.max(state.bestScore, state.score),
  status: "game_over",
  velocityY: 0,
});

export const stepFlappyGame = (
  state: FlappyGameState,
  deltaMs: number,
): FlappyStepResult => {
  if (state.status !== "running" || deltaMs <= 0) {
    return {
      events: { gameOver: false, scored: false },
      state,
    };
  }

  const deltaSeconds = Math.min(deltaMs, 32) / 1000;
  const gravity = getFlappyGravity(state.velocityY);
  let velocityY = Math.min(
    state.velocityY + gravity * deltaSeconds,
    FLAPPY_WORLD.maxFallSpeed,
  );
  let playerY = state.playerY + ((state.velocityY + velocityY) / 2) * deltaSeconds;

  if (playerY < 0) {
    playerY = 0;
    velocityY = Math.max(velocityY, -90);
  }

  let scored = false;
  let score = state.score;
  let bestScore = state.bestScore;
  let rngState = state.rngState;
  let distance = state.distance + FLAPPY_WORLD.groundSpeed * deltaSeconds;

  let obstacles = state.obstacles
    .map((obstacle) => ({
      ...obstacle,
      x: obstacle.x - FLAPPY_WORLD.groundSpeed * deltaSeconds,
    }))
    .filter((obstacle) => obstacle.x + FLAPPY_WORLD.obstacleWidth > -80)
    .map((obstacle) => {
      if (!obstacle.scored && obstacle.x + FLAPPY_WORLD.obstacleWidth < FLAPPY_WORLD.playerX) {
        scored = true;
        score += 1;
        bestScore = Math.max(bestScore, score);
        return {
          ...obstacle,
          scored: true,
        };
      }

      return obstacle;
    });

  let spawnTimerMs = state.spawnTimerMs - deltaMs;
  let nextObstacleId = state.nextObstacleId;

  while (spawnTimerMs <= 0) {
    const { nextSeed, value } = pullSeededRandom(rngState);
    rngState = nextSeed;
    const previousObstacle = obstacles[obstacles.length - 1] ?? null;
    obstacles = [
      ...obstacles,
      createFlappyObstacle(nextObstacleId, value, INITIAL_OBSTACLE_X, previousObstacle?.gapY ?? null),
    ];
    nextObstacleId += 1;
    spawnTimerMs += FLAPPY_WORLD.obstacleSpawnEveryMs;
  }

  const playerBounds = {
    bottom: playerY + FLAPPY_WORLD.playerHeight - PLAYER_COLLISION_INSET.bottom,
    left: FLAPPY_WORLD.playerX + PLAYER_COLLISION_INSET.left,
    right: FLAPPY_WORLD.playerX + FLAPPY_WORLD.playerWidth - PLAYER_COLLISION_INSET.right,
    top: playerY + PLAYER_COLLISION_INSET.top,
  };

  let nextState: FlappyGameState = {
    ...state,
    backgroundOffset: wrapOffset(
      state.backgroundOffset + FLAPPY_WORLD.backgroundSpeed * deltaSeconds,
      FLAPPY_WORLD.backgroundTileWidth,
    ),
    bestScore,
    distance,
    groundOffset: wrapOffset(
      state.groundOffset + FLAPPY_WORLD.groundSpeed * deltaSeconds,
      FLAPPY_WORLD.groundTileWidth,
    ),
    nextObstacleId,
    obstacles,
    playerY,
    rngState,
    score,
    spawnTimerMs,
    velocityY,
  };

  if (playerBounds.bottom >= FLAPPY_GROUND_TOP) {
    nextState = endRound({
      ...nextState,
      playerY: FLAPPY_GROUND_TOP - FLAPPY_WORLD.playerHeight,
    });

    return {
      events: { gameOver: true, scored },
      state: nextState,
    };
  }

  const hitObstacle = obstacles.some((obstacle) => {
    const overlapX =
      playerBounds.right > obstacle.x &&
      playerBounds.left < obstacle.x + FLAPPY_WORLD.obstacleWidth;

    if (!overlapX) {
      return false;
    }

    const gapTop = obstacle.gapY - obstacle.gapSize / 2;
    const gapBottom = obstacle.gapY + obstacle.gapSize / 2;

    return playerBounds.top < gapTop || playerBounds.bottom > gapBottom;
  });

  if (hitObstacle) {
    nextState = endRound(nextState);

    return {
      events: { gameOver: true, scored },
      state: nextState,
    };
  }

  return {
    events: { gameOver: false, scored },
    state: nextState,
  };
};
