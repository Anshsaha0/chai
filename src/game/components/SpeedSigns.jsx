import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  useFrame,
} from "@react-three/fiber";

import * as THREE from "three";

import {
  useGameStore,
} from "../../store/useGameStore.js";

import {
  playSpeedSign,
} from "../audio/soundManager.js";

const SPEED_LIMITS = [
  30,
  50,
  60,
  80,
  100,
  120,
];

/*
Creates the circular speed-limit sign
as a texture using HTML canvas.
*/
function createSignTexture(limit) {
  const canvas =
    document.createElement(
      "canvas"
    );

  canvas.width = 512;
  canvas.height = 512;

  const ctx =
    canvas.getContext("2d");

  ctx.clearRect(
    0,
    0,
    512,
    512
  );

  /*
  White circle
  */
  ctx.beginPath();

  ctx.arc(
    256,
    256,
    200,
    0,
    Math.PI * 2
  );

  ctx.fillStyle = "white";
  ctx.fill();

  /*
  Red border
  */
  ctx.lineWidth = 45;

  ctx.strokeStyle =
    "#e21f2f";

  ctx.stroke();

  /*
  Speed number
  */
  ctx.fillStyle = "black";

  ctx.font =
    "bold 190px Arial";

  ctx.textAlign =
    "center";

  ctx.textBaseline =
    "middle";

  ctx.fillText(
    String(limit),
    256,
    270
  );

  const texture =
    new THREE.CanvasTexture(
      canvas
    );

  texture.colorSpace =
    THREE.SRGBColorSpace;

  texture.needsUpdate = true;

  return texture;
}

export default function SpeedSigns() {
  const groupRef =
    useRef();

  /*
  Tracks time until next sign.
  */
  const timerRef =
    useRef(0);

  /*
  First sign comes quickly
  for testing/demo.

  After that:
  every 20 seconds.
  */
  const firstSignRef =
    useRef(true);

  /*
  Prevents detecting
  the same sign repeatedly.
  */
  const detectedRef =
    useRef(false);

  const [sign, setSign] =
    useState(null);

  /*
  Create texture only when
  sign changes.
  */
  const texture =
    useMemo(() => {
      if (!sign) {
        return null;
      }

      return createSignTexture(
        sign.limit
      );
    }, [sign]);

  /*
  Dispose old texture
  when it changes/unmounts.
  */
  useEffect(() => {
    return () => {
      if (texture) {
        texture.dispose();
      }
    };
  }, [texture]);

  /*
  Whenever a new sign appears,
  reset its 3D position.
  */
  useEffect(() => {
    if (
      sign &&
      groupRef.current
    ) {
      groupRef.current.position.set(
        8.2,
        0,
        -65
      );

      detectedRef.current =
        false;
    }
  }, [sign]);

  useFrame(
    (_, frameDelta) => {
      const delta =
        Math.min(
          frameDelta,
          0.05
        );

      const game =
        useGameStore.getState();

      /*
      Don't count sign timer
      before the car starts driving.
      */
      if (
        game.speed > 1 &&
        game.mode === "MANUAL"
      ) {
        timerRef.current +=
          delta;
      }

      /*
      First sign after 5 sec.

      Every later sign after
      20 sec.
      */
      const spawnDelay =
        firstSignRef.current
          ? 5
          : 20;

      if (
        timerRef.current >=
          spawnDelay &&
        !sign
      ) {
        timerRef.current = 0;

        firstSignRef.current =
          false;

        const currentLimit =
          game.speedLimit;

        /*
        Avoid showing the same
        speed limit twice in a row.
        */
        const possibleLimits =
          SPEED_LIMITS.filter(
            (limit) =>
              limit !==
              currentLimit
          );

        const randomIndex =
          Math.floor(
            Math.random() *
              possibleLimits.length
          );

        const newLimit =
          possibleLimits[
            randomIndex
          ];

        setSign({
          id: Date.now(),
          limit: newLimit,
        });

        return;
      }

      /*
      Nothing else to do
      while no sign exists.
      */
      if (
        !sign ||
        !groupRef.current
      ) {
        return;
      }

      /*
      Move sign towards player
      based on car speed.

      Player car visually stays
      near Z = 0.
      */
      const speedMS =
        game.speed / 3.6;

      groupRef.current.position.z +=
        speedMS * delta;

      const signZ =
        groupRef.current.position.z;

      /*
      Apply the advisory limit once when the sign reaches/passes
      the player at Z = 0. New signs reset detectedRef above.
      */
      if (
        !detectedRef.current &&
        signZ >= 0
      ) {
        detectedRef.current =
          true;

        game.setSpeedLimit(
          sign.limit
        );

        playSpeedSign();
      }

      /*
      Remove sign after it
      goes behind the car.
      */
      if (
        signZ > 12
      ) {
        setSign(null);
      }
    }
  );

  if (
    !sign ||
    !texture
  ) {
    return null;
  }

  return (
    <group
      ref={groupRef}
      position={[
        8.2,
        0,
        -65,
      ]}
    >
      {/* POLE */}

      <mesh
        position={[
          0,
          1.4,
          0,
        ]}
        castShadow
      >
        <cylinderGeometry
          args={[
            0.06,
            0.06,
            2.8,
            16,
          ]}
        />

        <meshStandardMaterial
          color="#8b8b8b"
          roughness={0.7}
        />
      </mesh>

      {/* SIGN FACE */}

      <mesh
        position={[
          0,
          3.1,
          0,
        ]}
        castShadow
      >
        <planeGeometry
          args={[
            2.4,
            2.4,
          ]}
        />

        <meshBasicMaterial
          map={texture}
          transparent
          side={
            THREE.DoubleSide
          }
          toneMapped={false}
        />
      </mesh>

      {/* SMALL BACK SUPPORT */}

      <mesh
        position={[
          0,
          3.1,
          0.05,
        ]}
      >
        <cylinderGeometry
          args={[
            1.22,
            1.22,
            0.08,
            48,
          ]}
          rotation={[
            Math.PI / 2,
            0,
            0,
          ]}
        />

        <meshStandardMaterial
          color="#555555"
          roughness={0.8}
        />
      </mesh>
    </group>
  );
}