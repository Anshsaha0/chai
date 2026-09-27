import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  FaceLandmarker,
  FilesetResolver,
} from "@mediapipe/tasks-vision";

import { useGameStore } from "../store/useGameStore.js";

const MODEL_PATH =
  "/models/face_landmarker.task";

const WASM_PATH =
  "/mediapipe-wasm";

/*
Normal blinks should NOT trigger drowsiness.

These are initial DEMO thresholds.
We'll calibrate them later with your face/camera.
*/

const CLOSED_THRESHOLD = 0.68;

const DROWSY_DURATION_MS = 1500;

const NO_FACE_DROWSY_MS = 2200;

const STARTUP_GRACE_MS = 5000;

function getBlendshape(
  categories,
  name
) {
  const category = categories.find(
    (item) =>
      item.categoryName === name ||
      item.displayName === name
  );

  return category?.score ?? 0;
}

export default function DriverMonitor() {
  const videoRef = useRef(null);

  const [cameraError, setCameraError] =
    useState("");

  const driverState = useGameStore(
    (state) => state.driverState
  );

  const setDriverState = useGameStore(
    (state) => state.setDriverState
  );

  const triggerTakeover = useGameStore(
    (state) => state.triggerTakeover
  );

  useEffect(() => {
    let stream = null;

    let faceLandmarker = null;

    let animationFrame = null;

    let running = true;

    let lastVideoTime = -1;

    let lastDetectionTime = 0;

    let eyeClosedSince = null;

    let noFaceSince = null;

    const startTime = performance.now();

    async function createLandmarker(
      vision,
      delegate
    ) {
      return FaceLandmarker.createFromOptions(
        vision,
        {
          baseOptions: {
            modelAssetPath: MODEL_PATH,
            delegate,
          },

          runningMode: "VIDEO",

          numFaces: 1,

          outputFaceBlendshapes: true,

          minFaceDetectionConfidence: 0.5,

          minFacePresenceConfidence: 0.5,

          minTrackingConfidence: 0.5,
        }
      );
    }

    async function start() {
      try {
        stream =
          await navigator.mediaDevices.getUserMedia(
            {
              video: {
                width: {
                  ideal: 640,
                },

                height: {
                  ideal: 480,
                },

                facingMode: "user",
              },

              audio: false,
            }
          );

        if (!running || !videoRef.current) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        videoRef.current.srcObject =
          stream;

        await videoRef.current.play();
        if (!running) return;

        const vision =
          await FilesetResolver.forVisionTasks(
            WASM_PATH
          );
        if (!running) return;

        /*
        Try GPU first.

        If GPU initialization fails,
        automatically fall back to CPU.
        */

        try {
          faceLandmarker =
            await createLandmarker(
              vision,
              "GPU"
            );
        } catch (gpuError) {
          if (!running) return;
          console.warn(
            "MediaPipe GPU failed. Using CPU.",
            gpuError
          );

          faceLandmarker =
            await createLandmarker(
              vision,
              "CPU"
            );
        }

        if (!running) {
          faceLandmarker.close();
          return;
        }
        detect();
      } catch (error) {
        if (!running) return;
        console.error(error);

        setCameraError(
          "Camera / Face Landmarker could not start."
        );
      }
    }

    function setState(nextState) {
      const current =
        useGameStore.getState();

      if (
        current.driverState !== nextState
      ) {
        setDriverState(nextState);
      }

      if (
        nextState === "DROWSY" &&
        current.mode === "MANUAL"
      ) {
        triggerTakeover(
          "DROWSINESS"
        );
      }
    }

    function detect() {
      if (!running) return;

      const now =
        performance.now();

      const video =
        videoRef.current;

      /*
      Don't run MediaPipe at full 60 FPS.

      ~10 detections/sec is enough
      for this simulator.
      */

      if (
        faceLandmarker &&
        video &&
        video.readyState >= 2 &&
        now - lastDetectionTime >= 100 &&
        video.currentTime !==
          lastVideoTime
      ) {
        lastDetectionTime = now;

        lastVideoTime =
          video.currentTime;

        try {
          const result =
            faceLandmarker.detectForVideo(
              video,
              now
            );

          const blendshapes =
            result.faceBlendshapes?.[0]
              ?.categories;

          /*
          Give the driver a few seconds
          after entering the simulator.
          */

          const graceFinished =
            now - startTime >
            STARTUP_GRACE_MS;

          if (
            !blendshapes ||
            blendshapes.length === 0
          ) {
            eyeClosedSince = null;

            if (noFaceSince === null) {
              noFaceSince = now;
            }

            if (
              graceFinished &&
              now - noFaceSince >
                NO_FACE_DROWSY_MS
            ) {
              setState("DROWSY");
            }
          } else {
            noFaceSince = null;

            const leftBlink =
              getBlendshape(
                blendshapes,
                "eyeBlinkLeft"
              );

            const rightBlink =
              getBlendshape(
                blendshapes,
                "eyeBlinkRight"
              );

            const averageClosure =
              (leftBlink +
                rightBlink) /
              2;

            const eyesClosed =
              averageClosure >
              CLOSED_THRESHOLD;

            if (eyesClosed) {
              if (
                eyeClosedSince === null
              ) {
                eyeClosedSince = now;
              }

              if (
                graceFinished &&
                now - eyeClosedSince >
                  DROWSY_DURATION_MS
              ) {
                setState("DROWSY");
              }
            } else {
              eyeClosedSince = null;

              setState("ACTIVE");
            }
          }
        } catch (error) {
          console.warn(
            "Face detection frame failed:",
            error
          );
        }
      }

      animationFrame =
        requestAnimationFrame(
          detect
        );
    }

    start();

    return () => {
      running = false;

      if (animationFrame) {
        cancelAnimationFrame(
          animationFrame
        );
      }

      if (stream) {
        stream
          .getTracks()
          .forEach((track) =>
            track.stop()
          );
      }

      if (faceLandmarker) {
        faceLandmarker.close();
      }
    };
  }, [
    setDriverState,
    triggerTakeover,
  ]);

  return (
    <div className="driver-monitor">
      <div className="driver-video-container">
        <video
          ref={videoRef}
          muted
          playsInline
          className="driver-video"
        />

        <div
          className={`driver-state ${
            driverState ===
            "DROWSY"
              ? "drowsy"
              : "active"
          }`}
        >
          {driverState}
        </div>
      </div>

      {cameraError && (
        <div className="camera-error">
          {cameraError}
        </div>
      )}
    </div>
  );
}