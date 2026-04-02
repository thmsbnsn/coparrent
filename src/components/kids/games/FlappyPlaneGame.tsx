import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { Play, RotateCcw, Trophy } from "lucide-react";
import { FLAPPY_ASSETS } from "@/assets/games/flappy";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  FLAPPY_GROUND_TOP,
  FLAPPY_WORLD,
  normalizeFlappySeed,
  createReadyFlappyState,
  createRunningFlappyState,
  flapFlappyGame,
  getPlayerRotation,
  getRenderedObstacleSegments,
  stepFlappyGame,
  type FlappyGameState,
} from "./flappyGameLogic";

const BEST_SCORE_STORAGE_KEY = "coparrent.games.flappy-plane.best-score";

const readBestScore = () => {
  if (typeof window === "undefined") {
    return 0;
  }

  const rawValue = window.localStorage.getItem(BEST_SCORE_STORAGE_KEY);
  const parsed = Number.parseInt(rawValue ?? "0", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

const playSound = (src: string, volume: number) => {
  if (typeof Audio === "undefined") {
    return;
  }

  const audio = new Audio(src);
  audio.volume = volume;
  void audio.play().catch(() => undefined);
};

const stopOverlayPointer = (event: PointerEvent<HTMLElement>) => {
  event.stopPropagation();
};

export interface FlappyRoundSummary {
  bestScore: number;
  distance: number;
  score: number;
  seed: number;
}

interface FlappyPlaneGameProps {
  autoStartSignal?: number;
  className?: string;
  gameOverDescription?: string;
  gameOverTitle?: string;
  manualStartEnabled?: boolean;
  onRoundEnd?: (summary: FlappyRoundSummary) => void;
  readyDescription?: string;
  readyTitle?: string;
  seed?: number | null;
}

export const FlappyPlaneGame = ({
  autoStartSignal,
  className,
  gameOverDescription,
  gameOverTitle = "Nice flight",
  manualStartEnabled = true,
  onRoundEnd,
  readyDescription = "Fly through the rocky gaps. Tap, click, or press space to stay in the sky.",
  readyTitle = "Toy Plane Dash",
  seed = null,
}: FlappyPlaneGameProps) => {
  const providedSeed = useMemo(
    () => (seed === null || seed === undefined ? null : normalizeFlappySeed(seed)),
    [seed],
  );
  const roundSeedRef = useRef(
    providedSeed ?? normalizeFlappySeed(Math.floor(Math.random() * 2147483646) + 1),
  );
  const [gameState, setGameState] = useState<FlappyGameState>(() =>
    createReadyFlappyState(readBestScore(), roundSeedRef.current),
  );
  const stateRef = useRef(gameState);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const previousFrameRef = useRef<number | null>(null);
  const onRoundEndRef = useRef(onRoundEnd);
  const autoStartSignalRef = useRef(autoStartSignal);

  useEffect(() => {
    stateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    onRoundEndRef.current = onRoundEnd;
  }, [onRoundEnd]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(BEST_SCORE_STORAGE_KEY, String(gameState.bestScore));
  }, [gameState.bestScore]);

  useEffect(() => {
    stageRef.current?.focus();
  }, []);

  const commitState = useCallback((nextState: FlappyGameState) => {
    stateRef.current = nextState;
    setGameState(nextState);
  }, []);

  const startRound = useCallback(() => {
    if (stateRef.current.status === "running") {
      return;
    }

    const nextSeed =
      providedSeed ?? normalizeFlappySeed(Math.floor(Math.random() * 2147483646) + 1);
    roundSeedRef.current = nextSeed;
    playSound(FLAPPY_ASSETS.audio.buttonPress, 0.32);
    previousFrameRef.current = null;
    commitState(createRunningFlappyState(stateRef.current.bestScore, nextSeed));
    stageRef.current?.focus();
  }, [commitState, providedSeed]);

  const flap = useCallback(() => {
    if (stateRef.current.status !== "running") {
      return;
    }

    playSound(FLAPPY_ASSETS.audio.flap, 0.22);
    commitState(flapFlappyGame(stateRef.current));
  }, [commitState]);

  useEffect(() => {
    if (gameState.status !== "running") {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      animationFrameRef.current = null;
      previousFrameRef.current = null;
      return;
    }

    const tick = (timestamp: number) => {
      const previousFrame = previousFrameRef.current ?? timestamp - 16;
      const deltaMs = Math.min(timestamp - previousFrame, 32);
      previousFrameRef.current = timestamp;

      const { events, state } = stepFlappyGame(stateRef.current, deltaMs);

      if (events.scored) {
        playSound(FLAPPY_ASSETS.audio.scorePoint, 0.3);
      }

      if (events.gameOver) {
        playSound(FLAPPY_ASSETS.audio.gameOver, 0.34);
        onRoundEndRef.current?.({
          bestScore: state.bestScore,
          distance: Math.round(state.distance),
          score: state.score,
          seed: state.seed,
        });
      }

      commitState(state);

      if (state.status === "running") {
        animationFrameRef.current = requestAnimationFrame(tick);
      }
    };

    animationFrameRef.current = requestAnimationFrame(tick);

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [commitState, gameState.status]);

  useEffect(() => {
    autoStartSignalRef.current = autoStartSignal;
  }, [autoStartSignal]);

  useEffect(() => {
    roundSeedRef.current =
      providedSeed ?? normalizeFlappySeed(Math.floor(Math.random() * 2147483646) + 1);
    commitState(createReadyFlappyState(readBestScore(), roundSeedRef.current));
    previousFrameRef.current = null;
  }, [commitState, providedSeed]);

  useEffect(() => {
    if (autoStartSignal === undefined || autoStartSignal === null) {
      autoStartSignalRef.current = autoStartSignal;
      return;
    }

    if (autoStartSignalRef.current === autoStartSignal) {
      return;
    }

    autoStartSignalRef.current = autoStartSignal;
    startRound();
  }, [autoStartSignal, startRound]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Space") {
        return;
      }

      event.preventDefault();

      if (stateRef.current.status === "running") {
        flap();
        return;
      }

      if (!manualStartEnabled) {
        return;
      }

      startRound();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [flap, manualStartEnabled, startRound]);

  const handleStagePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (stateRef.current.status !== "running") {
      return;
    }

    event.preventDefault();
    flap();
  };

  const planeRotation = getPlayerRotation(gameState.velocityY);
  const topScoreLabel = gameState.status === "running" ? "Score" : "Last";

  return (
    <section className={cn("rounded-[2rem] border border-border bg-white/90 p-3 shadow-sm", className)}>
      <div
        ref={stageRef}
        tabIndex={0}
        onPointerDown={handleStagePointerDown}
        className="relative aspect-[5/3] overflow-hidden rounded-[1.75rem] border border-white/50 bg-sky-100 outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-sky-300"
        style={{ touchAction: "manipulation" }}
      >
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            backgroundImage: `url(${FLAPPY_ASSETS.backgrounds.skyDefault})`,
            backgroundPositionX: `${-gameState.backgroundOffset}px`,
            backgroundRepeat: "repeat-x",
            backgroundSize: "auto 100%",
          }}
        />

        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between p-4 sm:p-5">
          <div className="rounded-full bg-slate-950/80 px-4 py-2 text-sm font-semibold text-white shadow-sm backdrop-blur">
            {topScoreLabel}: {gameState.score}
          </div>
          <div className="rounded-full bg-white/90 px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm">
            Best: {gameState.bestScore}
          </div>
        </div>

        {gameState.obstacles.map((obstacle) => {
          const { bottomHeight, bottomY, topHeight } = getRenderedObstacleSegments(obstacle);
          const left = `${(obstacle.x / FLAPPY_WORLD.width) * 100}%`;
          const width = `${(FLAPPY_WORLD.obstacleWidth / FLAPPY_WORLD.width) * 100}%`;

          return (
            <div key={obstacle.id} className="pointer-events-none absolute inset-0">
              <img
                alt=""
                src={FLAPPY_ASSETS.sprites.obstacles.up}
                className="absolute select-none object-fill drop-shadow-[0_10px_16px_rgba(15,23,42,0.18)]"
                style={{
                  height: `${(topHeight / FLAPPY_WORLD.height) * 100}%`,
                  left,
                  top: 0,
                  width,
                }}
              />
              <img
                alt=""
                src={FLAPPY_ASSETS.sprites.obstacles.down}
                className="absolute select-none object-fill drop-shadow-[0_10px_16px_rgba(15,23,42,0.18)]"
                style={{
                  height: `${(bottomHeight / FLAPPY_WORLD.height) * 100}%`,
                  left,
                  top: `${(bottomY / FLAPPY_WORLD.height) * 100}%`,
                  width,
                }}
              />
            </div>
          );
        })}

        <img
          alt=""
          aria-hidden="true"
          src={FLAPPY_ASSETS.sprites.plane}
          className="pointer-events-none absolute z-30 select-none drop-shadow-[0_14px_20px_rgba(15,23,42,0.2)]"
          style={{
            height: `${(FLAPPY_WORLD.playerHeight / FLAPPY_WORLD.height) * 100}%`,
            left: `${(FLAPPY_WORLD.playerX / FLAPPY_WORLD.width) * 100}%`,
            top: `${(gameState.playerY / FLAPPY_WORLD.height) * 100}%`,
            transform: `rotate(${planeRotation}deg)`,
            transformOrigin: "center center",
            width: `${(FLAPPY_WORLD.playerWidth / FLAPPY_WORLD.width) * 100}%`,
          }}
        />

        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 z-20"
          style={{
            backgroundImage: `url(${FLAPPY_ASSETS.backgrounds.groundGrass})`,
            backgroundPositionX: `${-gameState.groundOffset}px`,
            backgroundRepeat: "repeat-x",
            backgroundSize: "auto 100%",
            height: `${(FLAPPY_WORLD.groundHeight / FLAPPY_WORLD.height) * 100}%`,
          }}
        />

        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 z-10 bg-gradient-to-b from-white/20 to-transparent"
          style={{
            height: `${(FLAPPY_GROUND_TOP / FLAPPY_WORLD.height) * 100}%`,
          }}
        />

        {gameState.status === "ready" && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-slate-950/18 p-4 backdrop-blur-[2px]">
            <div className="max-w-sm rounded-[2rem] bg-white/96 p-6 text-center shadow-[0_22px_60px_rgba(15,23,42,0.18)]">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-sky-100 text-sky-700">
                <Play className="h-8 w-8" />
              </div>
              <h2 className="mt-4 text-2xl font-display font-semibold text-slate-950">
                {readyTitle}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {readyDescription}
              </p>
              {manualStartEnabled ? (
                <Button
                  type="button"
                  data-overlay-action="true"
                  className="mt-5 h-12 rounded-full bg-sky-600 px-8 text-base text-white hover:bg-sky-500"
                  onPointerDown={stopOverlayPointer}
                  onClick={startRound}
                >
                  <Play className="mr-2 h-5 w-5" />
                  Play
                </Button>
              ) : (
                <div className="mt-5 rounded-full bg-sky-50 px-4 py-3 text-sm font-medium text-sky-700">
                  Waiting for the family race countdown.
                </div>
              )}
            </div>
          </div>
        )}

        {gameState.status === "game_over" && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-slate-950/25 p-4 backdrop-blur-[2px]">
            <div className="max-w-sm rounded-[2rem] bg-white/96 p-6 text-center shadow-[0_22px_60px_rgba(15,23,42,0.18)]">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                <Trophy className="h-8 w-8" />
              </div>
              <h2 className="mt-4 text-2xl font-display font-semibold text-slate-950">
                {gameOverTitle}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {gameOverDescription ?? `Score ${gameState.score}. Best ${gameState.bestScore}.`}
              </p>
              {manualStartEnabled ? (
                <Button
                  type="button"
                  data-overlay-action="true"
                  className="mt-5 h-12 rounded-full bg-slate-950 px-8 text-base text-white hover:bg-slate-800"
                  onPointerDown={stopOverlayPointer}
                  onClick={startRound}
                >
                  <RotateCcw className="mr-2 h-5 w-5" />
                  Fly again
                </Button>
              ) : null}
            </div>
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 px-1 text-sm text-slate-600">
        <p>Landscape-first, touch-friendly, and light enough for the kids dashboard.</p>
        <p className="font-medium text-slate-900">
          {gameState.status === "running" ? "Keep the plane above the grass." : "Ready when you are."}
        </p>
      </div>
    </section>
  );
};
