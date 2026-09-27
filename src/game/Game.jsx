import {
  Suspense,
  useEffect,
} from "react";

import {
  Canvas,
} from "@react-three/fiber";

import CityEnvironment from "./components/CityEnvironment.jsx";
import SkyBackdrop from "./components/SkyBackdrop.jsx";
import PlayerCockpit from "./components/PlayerCockpit.jsx";
import Road from "./components/Road.jsx";
import Traffic from "./components/Traffic.jsx";
import SpeedSigns from "./components/SpeedSigns.jsx";

import HUD from "../ui/HUD.jsx";
import SpeedLimitWarning from "../ui/SpeedLimitWarning.jsx";
import DriverMonitor from "../driver/DriverMonitor.jsx";
import { useGameStore } from "../store/useGameStore.js";

import {
  CAMERA_CONFIG,
} from "./config.js";

export default function Game({ onGameOver }) {
  useEffect(() => () => {
    useGameStore.getState().resetDrowsinessSafety();
  }, []);

  return (
    <div className="game">
      <Canvas
        shadows
        camera={{
          fov:
            CAMERA_CONFIG.fov,

          position: [
            CAMERA_CONFIG.x,
            CAMERA_CONFIG.y,
            CAMERA_CONFIG.z,
          ],

          near: 0.03,
          far: 800,
        }}
      >
        <color
          attach="background"
          args={[
            "#b9b6a7",
          ]}
        />

        <fog
          attach="fog"
          args={[
            "#b9b6a7",
            80,
            280,
          ]}
        />

        <ambientLight
          intensity={1.4}
        />

        <hemisphereLight
          intensity={1.2}
          color="#e8e0cb"
          groundColor="#4a4a44"
        />

        <directionalLight
          castShadow
          intensity={1.5}
          position={[
            -20,
            35,
            15,
          ]}
        />

        <Suspense
          fallback={null}
        >
          <Road />
          <SkyBackdrop />
          <CityEnvironment />

          <PlayerCockpit
            onGameOver={onGameOver}
          />

          <Traffic />
          <SpeedSigns />
        </Suspense>
      </Canvas>

      <DriverMonitor />
      <HUD />
      <SpeedLimitWarning />
    </div>
  );
}
