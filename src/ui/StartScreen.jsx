import SimulationScreen from "./SimulationScreen.jsx";

export default function StartScreen({ onStart }) {
  return (
    <SimulationScreen
      title={<>AI DRIVING ASSISTANCE <span>SIMULATOR</span></>}
      subtitle="Experience how AI helps prevent collisions and drowsiness-related accidents."
      detail="Manual driving with intelligent automatic safety takeover."
      action="START"
      onAction={onStart}
    />
  );
}
