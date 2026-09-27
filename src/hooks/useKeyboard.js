import { useEffect, useRef } from "react";

export default function useKeyboard() {
  const keys = useRef({
    accelerator: false,
    brake: false,
    left: false,
    right: false,
  });

  useEffect(() => {
    function keyDown(event) {
      switch (event.code) {
        case "KeyW":
        case "ArrowUp":
          keys.current.accelerator = true;
          break;

        case "KeyS":
        case "ArrowDown":
        case "Space":
          keys.current.brake = true;
          break;

        case "KeyA":
        case "ArrowLeft":
          keys.current.left = true;
          break;

        case "KeyD":
        case "ArrowRight":
          keys.current.right = true;
          break;

        default:
          break;
      }
    }

    function keyUp(event) {
      switch (event.code) {
        case "KeyW":
        case "ArrowUp":
          keys.current.accelerator = false;
          break;

        case "KeyS":
        case "ArrowDown":
        case "Space":
          keys.current.brake = false;
          break;

        case "KeyA":
        case "ArrowLeft":
          keys.current.left = false;
          break;

        case "KeyD":
        case "ArrowRight":
          keys.current.right = false;
          break;

        default:
          break;
      }
    }

    window.addEventListener("keydown", keyDown);
    window.addEventListener("keyup", keyUp);

    return () => {
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
    };
  }, []);

  return keys;
}