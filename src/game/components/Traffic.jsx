import { useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

import {
  TRAFFIC_MODELS,
  TRAFFIC_CONFIG,
} from "../config.js";

import { useGameStore } from "../../store/useGameStore.js";

import {
  playWarning,
} from "../../game/audio/soundManager.js";

import audioManager from "../../audioManager";

import {
  advanceTraffic,
  createTrafficCars,
  nextTrafficZ,
  randomTrafficLane,
} from "../trafficMotion.js";

function IncomingCar({ car: initialCar, fleetRef }) {
  const { id, model } = initialCar;
  // Stable JSX placement; frame updates own the live transform.
  const [initialPosition] = useState(() => [initialCar.lane, TRAFFIC_CONFIG.y, initialCar.z]);
  const vehicleRef = useRef(null);
  const laneRef = useRef(initialCar.lane);

  const hasEnteredDetectionZone =
    useRef(false);

  // Play passing + honk only once per pass
  const hasPlayedPassingAudio =
    useRef(false);

  const gltf = useGLTF(model);

  const modelData = useMemo(() => {
    const clone =
      gltf.scene.clone(true);

    clone.traverse((child) => {
      if (!child.isMesh) return;

      child.castShadow = true;
      child.receiveShadow = true;

      if (child.material) {
        child.material =
          child.material.clone();

        if (
          child.material.transparent
        ) {
          child.material.depthWrite =
            false;
        }
      }
    });

    const box =
      new THREE.Box3().setFromObject(
        clone
      );

    const size =
      new THREE.Vector3();

    const center =
      new THREE.Vector3();

    box.getSize(size);
    box.getCenter(center);

    const scale =
      TRAFFIC_CONFIG.targetWidth /
      size.x;

    const offset =
      new THREE.Vector3(
        -center.x,
        -box.min.y,
        -center.z
      );

    const halfLength =
      (size.z * scale) / 2;

    return {
      scene: clone,
      scale,
      offset,
      halfLength,
    };
  }, [gltf.scene]);

  useFrame(() => {
    if (!vehicleRef.current) return;

    const car = fleetRef.current.find((item) => item.id === id);
    const game = useGameStore.getState();
    const closingSpeed = car.relativeSpeed;
    vehicleRef.current.position.z = car.z;

    const centreZ =
      vehicleRef.current.position.z;

    const frontZ =
      centreZ +
      modelData.halfLength;

    const distanceAhead =
      TRAFFIC_CONFIG.playerFrontZ -
      frontZ;

    /*
    Only enable collision detection
    when obstacle is actually near.
    */
    if (
      distanceAhead < 42 &&
      distanceAhead > 0
    ) {
      hasEnteredDetectionZone.current =
        true;
    }

    // Incoming traffic is dangerous even when the player is stopped.
    if (
      game.mode === "MANUAL" &&
      hasEnteredDetectionZone.current
    ) {
      const lateralDistance =
        Math.abs(
          game.playerX -
            laneRef.current
        );

      const sameLane =
        lateralDistance < 1.7;

      const nearby =
        distanceAhead > 1 &&
        distanceAhead <
          TRAFFIC_CONFIG
            .collisionCheckDistance;

      if (
        sameLane &&
        nearby &&
        closingSpeed > 1
      ) {
        const ttc =
          distanceAhead /
          closingSpeed;

        if (
          ttc <
          TRAFFIC_CONFIG
            .ttcDangerSeconds
        ) {
          playWarning();
          audioManager.collisionBrake();

          game.triggerTakeover(
            "COLLISION"
          );
        }
      }
    }

    /*
    Play passing-by + honk when traffic
    actually passes beside the player.

    We only trigger this when the vehicle
    is near the player's Z position and
    is laterally in a different lane.
    */
    const lateralDistanceFromPlayer =
      Math.abs(
        game.playerX -
          laneRef.current
      );

    const isBesidePlayer =
      centreZ > -3 &&
      centreZ < 3 &&
      lateralDistanceFromPlayer > 1.7;

    if (
      isBesidePlayer &&
      !hasPlayedPassingAudio.current
    ) {
      hasPlayedPassingAudio.current =
        true;

      audioManager.trafficPass();
    }

    /*
    Respawn after passing player.
    */
    const rearZ =
      centreZ -
      modelData.halfLength;

    if (rearZ > 15) {
      car.z = nextTrafficZ(fleetRef.current, id);
      vehicleRef.current.position.z = car.z;

      const newLane =
        randomTrafficLane();

      car.lane = newLane;
      laneRef.current =
        newLane;

      vehicleRef.current.position.x =
        newLane;

      hasEnteredDetectionZone.current =
        false;

      hasPlayedPassingAudio.current =
        false;

      // Publish the recycled lane/Z immediately, not the old passed position.
      useGameStore.getState().updateTrafficCar(id, car.lane, car.z);
    }
  });

  return (
    <group
      ref={vehicleRef}
      position={initialPosition}
      rotation={[
        0,
        TRAFFIC_CONFIG.rotationY,
        0,
      ]}
    >
      <group
        scale={modelData.scale}
      >
        <group
          position={[
            modelData.offset.x,
            modelData.offset.y,
            modelData.offset.z,
          ]}
        >
          <primitive
            object={modelData.scene}
          />
        </group>
      </group>
    </group>
  );
}

export default function Traffic() {
  const [cars] = useState(createTrafficCars);
  const fleetRef = useRef(null);
  if (fleetRef.current === null) {
    fleetRef.current = cars.map((car) => ({ ...car }));
  }

  // Run before player/traffic collision callbacks and publish the whole fleet
  // from the same frame. Negative priority preserves R3F's automatic rendering.
  useFrame((_, frameDelta) => {
    const game = useGameStore.getState();
    advanceTraffic(fleetRef.current, game.speed, Math.min(frameDelta, 0.05));
    for (const car of fleetRef.current) {
      game.updateTrafficCar(car.id, car.lane, car.z);
    }
  }, -2);

  return (
    <>
      {cars.map(
        (car) => (
          <IncomingCar
            key={car.id}
            car={car}
            fleetRef={fleetRef}
          />
        )
      )}
    </>
  );
}

TRAFFIC_MODELS.forEach(
  (model) => {
    useGLTF.preload(model);
  }
);