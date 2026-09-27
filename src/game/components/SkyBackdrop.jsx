import { assetUrl } from "../../assetUrl.js";
import {
  useLoader,
} from "@react-three/fiber";

import * as THREE from "three";


export default function SkyBackdrop() {
  const texture =
    useLoader(
      THREE.TextureLoader,
      assetUrl("environment/sky/sky.png")
    );


  texture.colorSpace =
    THREE.SRGBColorSpace;


  return (
    <mesh
      position={[
        0,
        35,
        -210,
      ]}
    >
      <planeGeometry
        args={[
          260,
          110,
        ]}
      />

      <meshBasicMaterial
        map={texture}

        side={
          THREE.DoubleSide
        }

        toneMapped={false}
      />
    </mesh>
  );
} 