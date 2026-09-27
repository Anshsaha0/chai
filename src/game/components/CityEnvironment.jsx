import { assetUrl } from "../../assetUrl.js";
import {
  useMemo,
  useRef,
} from "react";

import {
  useFrame,
} from "@react-three/fiber";

import {
  useGLTF,
} from "@react-three/drei";

import * as THREE from "three";

import {
  useGameStore,
} from "../../store/useGameStore.js";


const CITY_BLOCK_LENGTH =
  40;


/*
=====================================
NORMALISE CITY GLB
=====================================
*/

function usePreparedCity(
  path,
  targetHeight = 18
) {
  const gltf =
    useGLTF(path);


  return useMemo(() => {
    const clone =
      gltf.scene.clone(true);


    clone.traverse(
      (child) => {
        if (
          !child.isMesh
        ) {
          return;
        }


        child.castShadow =
          true;

        child.receiveShadow =
          true;


        if (
          child.material
        ) {
          child.material =
            child.material.clone();


          if (
            child.material
              .transparent
          ) {
            child.material
              .depthWrite =
              false;
          }
        }
      }
    );


    clone.updateMatrixWorld(
      true
    );


    const box =
      new THREE.Box3()
        .setFromObject(
          clone
        );


    const size =
      new THREE.Vector3();


    const center =
      new THREE.Vector3();


    box.getSize(size);
    box.getCenter(center);


    /*
    Normalize based on height.
    */
    const scale =
      targetHeight /
      Math.max(
        size.y,
        0.001
      );


    /*
    Centre X/Z
    and put bottom on ground.
    */
    const offset =
      new THREE.Vector3(
        -center.x,
        -box.min.y,
        -center.z
      );


    return {
      scene: clone,

      scale,

      offset,

      originalSize:
        size,
    };

  }, [
    gltf.scene,
    targetHeight,
  ]);
}


/*
=====================================
ONE CITY BLOCK
=====================================
*/

function CityBlock({
  path,
  x,
  z,
  side,
}) {
  const groupRef =
    useRef(null);


  const city =
    usePreparedCity(
      path,
      18
    );


  useFrame(
    (_, delta) => {
      if (
        !groupRef.current
      ) {
        return;
      }


      const speed =
        useGameStore.getState()
          .speed;


      const movement =
        (speed / 3.6) *
        delta;


      groupRef.current
        .position.z +=
        movement;


      /*
      Recycle block after
      it goes behind player.
      */
      if (
        groupRef.current
          .position.z >
        55
      ) {
        groupRef.current
          .position.z -=
          CITY_BLOCK_LENGTH *
          4;
      }
    }
  );


  return (
    <group
      ref={groupRef}
      position={[
        x-5,
        -0.8,
        z,
      ]}
      rotation={[
        0,
        Math.PI/2,
        0,
      ]}
    >

      {/*
      Right side can be mirrored
      if needed.

      Since you already have separate
      left/right GLBs, scale stays positive.
      */}

      <group
        scale={[
          city.scale,
          city.scale,
          city.scale,
        ]}
      >
        <group
          position={[
            city.offset.x,
            city.offset.y,
            city.offset.z,
          ]}
        >
          <primitive
            object={
              city.scene
            }
          />
        </group>
      </group>

    </group>
  );
}


/*
=====================================
FULL REPEATING CITY
=====================================
*/

export default function CityEnvironment() {
  return (
    <group>

      {/*
      LEFT SIDE
      */}

      <CityBlock
        path={assetUrl("environment/city/city_left.glb")}
        x={-18}
        z={-20}
        side="left"
      />

      <CityBlock
        path={assetUrl("environment/city/city_left.glb")}
        x={-18}
        z={-62}
        side="left"
      />

      <CityBlock
        path={assetUrl("environment/city/city_left.glb")}
        x={-18}
        z={-104}
        side="left"
      />

      <CityBlock
        path={assetUrl("environment/city/city_left.glb")}
        x={-18}
        z={-146}
        side="left"
      />


      {/*
      RIGHT SIDE
      */}

      <CityBlock
        path={assetUrl("environment/city/city_right.glb")}
        x={18}
        z={-20}
        side="right"
      />

      <CityBlock
        path={assetUrl("environment/city/city_right.glb")}
        x={18}
        z={-62}
        side="right"
      />

      <CityBlock
        path={assetUrl("environment/city/city_right.glb")}
        x={18}
        z={-104}
        side="right"
      />

      <CityBlock
        path={assetUrl("environment/city/city_right.glb")}
        x={18}
        z={-146}
        side="right"
      />

    </group>
  );
}


useGLTF.preload(
  assetUrl("environment/city/city_left.glb")
);

useGLTF.preload(
  assetUrl("environment/city/city_right.glb")
);