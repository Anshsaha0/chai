import {
  useState,
} from "react";

import Game from "./game/Game.jsx";
import StartScreen from "./ui/StartScreen.jsx";
import ResultScreen from "./ui/ResultScreen.jsx";

import audioManager from "./audioManager.js";
import { useGameStore } from "./store/useGameStore.js";
import { unlockAudio } from "./game/audio/soundManager.js";

export default function App() {
  const [gameState, setGameState] =
    useState("START");

  const handleStart = () => {
    // Important: do NOT start driving.mp3 here.
    // It will start only while accelerator is pressed.
    audioManager.stopAll();
    useGameStore.getState().startGame();
    unlockAudio();

    setGameState("PLAYING");
  };

  const handleGameOver = () => {
    // Idempotent: safe even if PlayerCockpit already called gameOver().
    audioManager.gameOver();

    setGameState("GAME_OVER");
  };

  // Both actions start a fresh session; only the first visit shows Start.
  const handleRestart = handleStart;

  if (
    gameState === "START"
  ) {
    return (
      <StartScreen
        onStart={handleStart}
      />
    );
  }

  if (
    gameState === "GAME_OVER"
  ) {
    return (
      <ResultScreen
        onRestart={handleRestart}
      />
    );
  }

  return (
    <Game
      onGameOver={handleGameOver}
    />
  );
}
