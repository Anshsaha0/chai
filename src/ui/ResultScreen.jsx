import SimulationScreen from "./SimulationScreen.jsx";
import { useGameStore } from "../store/useGameStore.js";

export default function ResultScreen({ onRestart }) {
  const reason = useGameStore((state) => state.takeoverReason);
  const savedFrom = reason === "DROWSINESS" ? "Drowsiness" :
    reason === "COLLISION" ? "Collision" : "Drowsiness / Collision";
  return (
    <SimulationScreen
      result
      title={<>YOU WERE <span>JUST SAVED</span></>}
      subtitle="Thanks to AI. Be Careful."
      detail={`Saved from ${savedFrom}`}
      action="RESTART"
      onAction={onRestart}
    />
  );
}
