import { assetUrl } from "../../assetUrl.js";
import {
  useMemo,
  useRef,
} from "react";

import {
  useFrame,
  useLoader,
} from "@react-three/fiber";

import {
  EXRLoader,
} from "three/examples/jsm/loaders/EXRLoader.js";

import * as THREE from "three";

import {
  useGameStore,
} from "../../store/useGameStore.js";


const ROAD_WIDTH = 15;
const ROAD_LENGTH = 260;

const DASH_SPACING = 12;


/*
=====================================
MOVING LANE MARKINGS
=====================================
*/

function MovingLaneDashes({
  x,
}) {
  const groupRef =
    useRef(null);

  const dashPositions =
    useMemo(() => {
      const positions = [];

      for (
        let z = -ROAD_LENGTH;
        z < 20;
        z += DASH_SPACING
      ) {
        positions.push(z);
      }

      return positions;
    }, []);


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


      groupRef.current.children.forEach(
        (dash) => {
          dash.position.z +=
            movement;


          if (
            dash.position.z >
            18
          ) {
            dash.position.z -=
              ROAD_LENGTH;
          }
        }
      );
    }
  );


  return (
    <group
      ref={groupRef}
    >
      {dashPositions.map(
        (z, index) => (
          <mesh
            key={`${x}-${index}`}
            position={[
              x,
              0.018,
              z,
            ]}
          >
            <boxGeometry
              args={[
                0.13,
                0.025,
                4.3,
              ]}
            />

            <meshStandardMaterial
              color="#f2f2f2"
              roughness={0.75}
            />
          </mesh>
        )
      )}
    </group>
  );
}


/*
=====================================
ROAD
=====================================
*/

export default function Road() {
  /*
  Diffuse JPG
  */
  const diffuse =
    useLoader(
      THREE.TextureLoader,
      assetUrl("environment/road/asphalt_track_diff_4k.jpg")
    );


  /*
  Normal EXR
  */
  const normal =
    useLoader(
      EXRLoader,
      assetUrl("environment/road/asphalt_track_nor_gl_4k.exr")
    );


  /*
  Roughness EXR
  */
  const roughness =
    useLoader(
      EXRLoader,
      assetUrl("environment/road/asphalt_track_rough_4k.exr")
    );


  /*
  Configure textures once.
  */
  useMemo(() => {
    const textures = [
      diffuse,
      normal,
      roughness,
    ];


    textures.forEach(
      (texture) => {
        texture.wrapS =
          THREE.RepeatWrapping;

        texture.wrapT =
          THREE.RepeatWrapping;

        texture.repeat.set(
          2.2,
          28
        );
      }
    );


    diffuse.colorSpace =
      THREE.SRGBColorSpace;


    normal.colorSpace =
      THREE.NoColorSpace;


    roughness.colorSpace =
      THREE.NoColorSpace;


    diffuse.anisotropy = 8;
    normal.anisotropy = 8;
    roughness.anisotropy = 8;


    diffuse.needsUpdate =
      true;

    normal.needsUpdate =
      true;

    roughness.needsUpdate =
      true;

  }, [
    diffuse,
    normal,
    roughness,
  ]);


  /*
  Animate road texture so road
  appears to flow beneath player.
  */
  useFrame(
    (_, delta) => {
      const speed =
        useGameStore.getState()
          .speed;


      const movement =
        (speed / 3.6) *
        delta;


      /*
      Because texture repeat is high,
      small UV movement is enough.
      */
      const uvMovement =
        movement /
        22;


      diffuse.offset.y -=
        uvMovement;

      normal.offset.y -=
        uvMovement;

      roughness.offset.y -=
        uvMovement;
    }
  );


  return (
    <group>

      {/*
      =============================
      MAIN PBR ROAD
      =============================
      */}

      <mesh
        rotation={[
          -Math.PI / 2,
          0,
          0,
        ]}
        position={[
          0,
          0,
          -105,
        ]}
        receiveShadow
      >

        <planeGeometry
          args={[
            ROAD_WIDTH,
            ROAD_LENGTH,
          ]}
        />


        <meshStandardMaterial
          map={diffuse}

          normalMap={normal}

          roughnessMap={
            roughness
          }

          roughness={1}

          metalness={0}

          normalScale={
            new THREE.Vector2(
              0.7,
              0.7
            )
          }
        />

      </mesh>


      {/*
      =============================
      ROAD EDGE LINES
      =============================
      */}

      <mesh
        position={[
          -7.25,
          0.025,
          -105,
        ]}
      >
        <boxGeometry
          args={[
            0.16,
            0.03,
            ROAD_LENGTH,
          ]}
        />

        <meshStandardMaterial
          color="#eeeeee"
        />
      </mesh>


      <mesh
        position={[
          7.25,
          0.025,
          -105,
        ]}
      >
        <boxGeometry
          args={[
            0.16,
            0.03,
            ROAD_LENGTH,
          ]}
        />

        <meshStandardMaterial
          color="#eeeeee"
        />
      </mesh>


      {/*
      =============================
      THREE-LANE MARKINGS
      =============================
      */}

      <MovingLaneDashes
        x={-2.25}
      />

      <MovingLaneDashes
        x={2.25}
      />


      {/*
      =============================
      SIDE BASE

      Temporary dark concrete base
      under city models.

      This replaces green grass.
      =============================
      */}

      <mesh
        rotation={[
          -Math.PI / 2,
          0,
          0,
        ]}
        position={[
          -32,
          -0.04,
          -105,
        ]}
        receiveShadow
      >
        <planeGeometry
          args={[
            50,
            ROAD_LENGTH,
          ]}
        />

        <meshStandardMaterial
          color="#494949"
          roughness={0.95}
        />
      </mesh>


      <mesh
        rotation={[
          -Math.PI / 2,
          0,
          0,
        ]}
        position={[
          32,
          -0.04,
          -105,
        ]}
        receiveShadow
      >
        <planeGeometry
          args={[
            50,
            ROAD_LENGTH,
          ]}
        />

        <meshStandardMaterial
          color="#494949"
          roughness={0.95}
        />
      </mesh>

    </group>
  );
}