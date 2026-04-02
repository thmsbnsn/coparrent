import backgroundSkyDefault from "./backgrounds/background-sky-default.png";
import groundGrass from "./backgrounds/ground-grass.png";
import sfxHitGameOver from "./audio/sfx-hit-game-over.ogg";
import sfxPlayerFlap from "./audio/sfx-player-flap.ogg";
import sfxScorePoint from "./audio/sfx-score-point.ogg";
import sfxUiButtonPress from "./audio/sfx-ui-button-press.ogg";
import obstacleRockGrassDown from "./sprites/obstacles/obstacle-rock-grass-down.png";
import obstacleRockGrassUp from "./sprites/obstacles/obstacle-rock-grass-up.png";
import planeBlue02 from "./sprites/planes/plane-blue-02.png";

export const FLAPPY_ASSETS = {
  audio: {
    buttonPress: sfxUiButtonPress,
    flap: sfxPlayerFlap, // Provisional export per asset notes.
    gameOver: sfxHitGameOver,
    scorePoint: sfxScorePoint,
  },
  backgrounds: {
    groundGrass,
    skyDefault: backgroundSkyDefault,
  },
  sprites: {
    obstacles: {
      down: obstacleRockGrassDown,
      up: obstacleRockGrassUp,
    },
    plane: planeBlue02,
  },
} as const;
