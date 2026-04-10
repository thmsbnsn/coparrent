export const BEST_SCORE_STORAGE_KEY = "coparrent.games.flappy-plane.best-score";

export const readBestFlappyScore = () => {
  if (typeof window === "undefined") {
    return 0;
  }

  const rawValue = window.localStorage.getItem(BEST_SCORE_STORAGE_KEY);
  const parsed = Number.parseInt(rawValue ?? "0", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};
