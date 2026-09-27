import {
  useMemo,
  useRef,
} from "react";

import {
  useFrame,
  useThree,
} from "@react-three/fiber";

import {
  useGLTF,
} from "@react-three/drei";

import * as THREE from "three";

import useKeyboard from "../../hooks/useKeyboard.js";

import audioManager from "../../audioManager";

import {
  useGameStore,
} from "../../store/useGameStore.js";

import {
  PLAYER_MODEL,
  CAMERA_CONFIG,
  VEHICLE_CONFIG,
} from "../config.js";


/*
=========================================
ROAD LANES
=========================================

Left   = -4.5
Middle =  0
Right  = +4.5
*/

const ROAD_LANES = [
  -4.5,
  0,
  4.5,
];


/*
=========================================
GET NEAREST LANE
=========================================
*/

function getNearestLane(x) {
  let nearest =
    ROAD_LANES[0];

  let nearestDistance =
    Math.abs(
      x - nearest
    );

  for (
    let i = 1;
    i < ROAD_LANES.length;
    i++
  ) {
    const lane =
      ROAD_LANES[i];

    const distance =
      Math.abs(
        x - lane
      );

    if (
      distance <
      nearestDistance
    ) {
      nearest = lane;

      nearestDistance =
        distance;
    }
  }

  return nearest;
}


/*
=========================================
CHECK WHETHER LANE IS BLOCKED
=========================================

traffic.z:

negative → traffic ahead
0        → player
positive → traffic has passed player
*/

function isLaneBlocked(
  trafficCars,
  laneX
) {
  return trafficCars.some(
    (traffic) => {
      const sameLane =
        Math.abs(
          traffic.laneX -
          laneX
        ) < 1.55;


      /*
      Keep a fairly large safety zone
      while AI decides where to move.

      Ahead:
      48 metres

      Behind/passing:
      12 metres
      */

      const withinSafetyZone =
        traffic.z >
          -48 &&
        traffic.z <
          12;


      return (
        sameLane &&
        withinSafetyZone
      );
    }
  );
}


/*
=========================================
CHOOSE BEST SAFE LANE
=========================================

We prefer the closest safe lane.

If current lane is dangerous,
we specifically avoid returning
the current lane as a solution.
*/

function chooseSafeLane(
  trafficCars,
  currentLane,
  avoidLane = null
) {
  const safeLanes =
    ROAD_LANES.filter(
      (lane) => {
        if (
          avoidLane !== null &&
          lane === avoidLane
        ) {
          return false;
        }

        return !isLaneBlocked(
          trafficCars,
          lane
        );
      }
    );


  if (
    safeLanes.length === 0
  ) {
    return null;
  }


  safeLanes.sort(
    (a, b) =>
      Math.abs(
        a - currentLane
      ) -
      Math.abs(
        b - currentLane
      )
  );


  return safeLanes[0];
}



export default function PlayerCockpit({ onGameOver }) {

  /*
  =========================================
  REFS
  =========================================
  */

  const carRef =
    useRef(null);


  /*
  Current steering GLB rotates
  around LOCAL Y.
  */

  const wheelSpinRef =
    useRef(null);


  const speedRef =
    useRef(0);

  const laneXRef =
    useRef(0);

  const steeringRef =
    useRef(0);

  const parkedTimerRef =
    useRef(0);

  // Audio state guards
  const drivingAudioStartedRef =
    useRef(false);

  const endScreenAudioPlayedRef =
    useRef(false);

  // Maximum time allowed for the existing collision takeover failsafe.
  const autoTakeoverTimerRef =
    useRef(0);

  const autoReasonRef = useRef(null);

  const gameEndTriggeredRef =
    useRef(false);


  /*
  AUTO MODE MEMORY

  These refs remember what AI is
  currently trying to do.
  */

  const autoTargetLaneRef =
    useRef(null);

  const autoPhaseRef =
    useRef("NONE");


  /*
  Prevent instant return to left lane.

  AI will wait briefly after reaching
  temporary safe lane so incoming
  traffic actually gets time to pass.
  */

  const safeLaneWaitRef =
    useRef(0);


  const keyboard =
    useKeyboard();


  const { camera } =
    useThree();


  /*
  =========================================
  LOAD GLBS
  =========================================
  */

  const bodyGLTF =
    useGLTF(
      PLAYER_MODEL.body
    );


  const steeringGLTF =
    useGLTF(
      PLAYER_MODEL
        .steeringWheel
    );


  /*
  =========================================
  PREPARE BODY
  =========================================
  */

  const body =
    useMemo(() => {
      const clone =
        bodyGLTF.scene.clone(
          true
        );


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


      return clone;

    }, [
      bodyGLTF.scene,
    ]);


  /*
  =========================================
  PREPARE STEERING WHEEL
  =========================================

  Current wheel GLB has:

  wheel plane → XZ
  spin axis   → local Y

  We calculate actual visual centre
  automatically and put that centre
  at pivot origin.
  */

  const wheelData =
    useMemo(() => {
      const clone =
        steeringGLTF.scene.clone(
          true
        );


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


      const center =
        new THREE.Vector3();


      box.getCenter(
        center
      );


      return {
        scene: clone,

        offset: [
          -center.x,
          -center.y,
          -center.z,
        ],
      };

    }, [
      steeringGLTF.scene,
    ]);


  /*
  =========================================
  MAIN FRAME LOOP
  =========================================
  */

  useFrame(
    (
      _,
      frameDelta
    ) => {

      const delta =
        Math.min(
          frameDelta,
          0.05
        );


      const state =
        useGameStore.getState();


      let speed =
        speedRef.current;


      let laneX =
        laneXRef.current;


      let steering =
        steeringRef.current;


      /*
      =====================================
      MANUAL MODE
      =====================================
      */

      if (
        state.mode ===
        "MANUAL"
      ) {

        /*
        Reset AI memory whenever
        we're manually driving.
        */

        autoTargetLaneRef.current =
          null;

        autoPhaseRef.current =
          "NONE";

        safeLaneWaitRef.current =
          0;

        autoTakeoverTimerRef.current =
          0;
        autoReasonRef.current = null;

        gameEndTriggeredRef.current =
          false;


        /*
        Temporary keyboard steering.

        ESP gyro will eventually replace
        requestedSteering only.
        */

        let requestedSteering =
          0;


        if (
          keyboard.current.left
        ) {
          requestedSteering =
            -1;
        }


        if (
          keyboard.current.right
        ) {
          requestedSteering =
            1;
        }


        steering =
          THREE.MathUtils.lerp(
            steering,

            requestedSteering,

            1 -
              Math.exp(
                -8 *
                delta
              )
          );


        /*
        ACCELERATOR + DRIVING SFX

        Behaviour:

        1. First accelerator press -> driving SFX starts at 100%.
        2. Accelerator released while coasting -> volume becomes 50%.
        3. Brake pressed with no accelerator -> driving SFX stops fully.
        4. After stopping, accelerator must be pressed again to restart it.
        */

        const acceleratorPressed =
          keyboard.current.accelerator;

        const brakePressed =
          keyboard.current.brake;


        if (acceleratorPressed) {
          if (
            !drivingAudioStartedRef.current
          ) {
            drivingAudioStartedRef.current =
              true;

            audioManager.startDriving();
          }
          else {
            // If we were coasting at 50%, restore full volume.
            audioManager.setDrivingFullVolume();
          }

          speed +=
            VEHICLE_CONFIG
              .acceleration *
            delta;
        }

        else if (brakePressed) {
          /*
          Brake + no accelerator = driving SFX completely OFF.

          We also clear the ref so releasing the brake does NOT
          automatically restart the sound. A new accelerator press
          is required.
          */
          if (
            drivingAudioStartedRef.current
          ) {
            drivingAudioStartedRef.current =
              false;

            audioManager.stopDriving();
          }
        }

        else if (
          drivingAudioStartedRef.current
        ) {
          // No accelerator and no brake: car is coasting.
          audioManager.setDrivingCoastVolume();
        }


        /*
        BRAKE PHYSICS
        */

        if (brakePressed) {
          speed -=
            VEHICLE_CONFIG
              .normalBrake *
            delta;
        }


        /*
        NATURAL DRAG
        */

        if (
          !keyboard.current
            .accelerator &&
          !keyboard.current
            .brake
        ) {
          speed -=
            VEHICLE_CONFIG
              .drag *
            delta;
        }


        speed =
          Math.max(
            0,
            speed
          );


        /*
        If the car naturally reaches almost zero while coasting,
        stop the driving SFX too. It will only restart on the next
        accelerator press.
        */
        if (
          !acceleratorPressed &&
          speed < 0.2 &&
          drivingAudioStartedRef.current
        ) {
          drivingAudioStartedRef.current =
            false;

          audioManager.stopDriving();
        }


        /*
        Manual hard maximum; road-sign limits are advisory only.
        */
        speed =
          THREE.MathUtils.clamp(
            speed,

            0,

            VEHICLE_CONFIG.maxUserSpeed
          );


        /*
        CAR STEERING
        */

        const steeringEffect =
          THREE.MathUtils.clamp(
            speed /
              30,

            0,

            1
          );


        laneX +=
          steering *
          VEHICLE_CONFIG
            .steeringRate *
          steeringEffect *
          delta;


        laneX =
          THREE.MathUtils.clamp(
            laneX,

            -5.15,

            5.15
          );


        parkedTimerRef.current =
          0;
      }


      /*
      =====================================
      AUTOMATIC SAFETY MODE
      =====================================
      */

      else {

        // Automatic takeover means accelerator audio must be OFF.
        if (
          drivingAudioStartedRef.current
        ) {
          drivingAudioStartedRef.current =
            false;

          audioManager.stopDriving();
        }

        // A collision superseding a warning gets its own existing safety window.
        if (autoReasonRef.current !== state.takeoverReason) {
          autoReasonRef.current = state.takeoverReason;
          autoTakeoverTimerRef.current = 0;
          autoTargetLaneRef.current = null;
          autoPhaseRef.current = "NONE";
          safeLaneWaitRef.current = 0;
          parkedTimerRef.current = 0;
        }

        // Count how long this takeover has been active.
        autoTakeoverTimerRef.current +=
          delta;

        const drowsinessWarning = state.drowsinessSafetyPhase === "WARNING";
        const drowsinessTakeover = state.takeoverReason === "DROWSINESS";

        // Resume lane selection when an emergency stop becomes escapable.
        if (drowsinessTakeover && autoPhaseRef.current === "EMERGENCY_STOP") {
          autoTargetLaneRef.current = null;
        }

        const trafficCars =
          state.trafficCars ??
          [];


        const finalLeftLane =
          VEHICLE_CONFIG
            .parkingLaneX;


        const currentLane =
          getNearestLane(
            laneX
          );


        const currentBlocked =
          isLaneBlocked(
            trafficCars,
            currentLane
          );


        const leftBlocked =
          isLaneBlocked(
            trafficCars,
            finalLeftLane
          );


        /*
        ==================================
        INITIAL AI DECISION
        ==================================
        */

        if (
          autoTargetLaneRef.current ===
          null
        ) {

          /*
          Case A:

          Current lane itself is dangerous.

          Get out immediately into nearest
          free lane.
          */

          if (
            currentBlocked
          ) {

            const safeLane =
              chooseSafeLane(
                trafficCars,
                currentLane,
                currentLane
              );


            autoTargetLaneRef.current =
              safeLane;


            autoPhaseRef.current =
              "EVASIVE";
          }


          /*
          Case B:

          Current lane is safe.

          Left lane occupied.

          Stay where we are temporarily.
          */

          else if (
            leftBlocked || drowsinessWarning
          ) {

            autoTargetLaneRef.current =
              currentLane;


            autoPhaseRef.current =
              "WAITING";
          }


          /*
          Case C:

          Left lane already clear.

          Start moving directly toward
          final parking lane.
          */

          else {

            autoTargetLaneRef.current =
              finalLeftLane;


            autoPhaseRef.current =
              "RETURN_LEFT";
          }
        }


        /*
        ==================================
        CURRENT AI TARGET
        ==================================
        */

        let targetLane =
          autoTargetLaneRef.current;


        /*
        ==================================
        TARGET LANE BECOMES DANGEROUS
        ==================================

        Example:

        We were moving middle → left,

        but suddenly left has incoming car.

        Immediately choose another safe lane.
        */

        if (
          targetLane !== null &&
          isLaneBlocked(
            trafficCars,
            targetLane
          )
        ) {

          const alternateLane =
            chooseSafeLane(
              trafficCars,
              currentLane,
              targetLane
            );


          if (
            alternateLane !== null
          ) {

            targetLane =
              alternateLane;


            autoTargetLaneRef.current =
              alternateLane;


            autoPhaseRef.current =
              "EVASIVE";


            safeLaneWaitRef.current =
              0;
          }


          else {

            /*
            All alternative lanes dangerous.

            Keep current lane and brake.
            */

            targetLane =
              currentLane;


            autoTargetLaneRef.current =
              currentLane;


            autoPhaseRef.current =
              "EMERGENCY_STOP";
          }
        }


        /*
        ==================================
        CHECK ALL LANES
        ==================================
        */

        const allLanesBlocked =
          ROAD_LANES.every(
            (lane) =>
              isLaneBlocked(
                trafficCars,
                lane
              )
          );


        /*
        ==================================
        ALL LANES BLOCKED
        ==================================
        */

        if (
          allLanesBlocked
        ) {

          autoPhaseRef.current =
            "EMERGENCY_STOP";


          /*
          No safe lateral escape.
          Hard brake.
          */

          audioManager.collisionBrake();

          speed -=
            VEHICLE_CONFIG
              .emergencyBrake *
            delta;


          speed =
            Math.max(
              0,
              speed
            );


          steering =
            THREE.MathUtils.lerp(
              steering,

              0,

              1 -
                Math.exp(
                  -9 *
                    delta
                )
            );


          state.setParkingStage(
            "EMERGENCY_BRAKING"
          );
        }


        /*
        ==================================
        AT LEAST ONE SAFE LANE EXISTS
        ==================================
        */

        else {

          /*
          --------------------------------
          TEMP SAFE-LANE WAITING
          --------------------------------

          Once we reach temporary safe lane,
          wait there long enough for
          incoming vehicle to pass.
          */

          const reachedTarget =
            targetLane !== null &&
            Math.abs(
              laneX -
                targetLane
            ) <
            0.3;


          if (
            reachedTarget &&
            autoPhaseRef.current ===
              "EVASIVE"
          ) {

            safeLaneWaitRef.current +=
              delta;


            state.setParkingStage(
              "WAITING_FOR_TRAFFIC"
            );
          }


          /*
          After ~1 second at safe lane,
          if left is clear, begin final
          left parking sequence.
          */

          if (
            autoPhaseRef.current ===
              "EVASIVE" &&

            reachedTarget &&

            safeLaneWaitRef.current >
              1.0 &&

            !leftBlocked && !drowsinessWarning
          ) {

            targetLane =
              finalLeftLane;


            autoTargetLaneRef.current =
              finalLeftLane;


            autoPhaseRef.current =
              "RETURN_LEFT";


            safeLaneWaitRef.current =
              0;
          }


          /*
          If we were simply waiting
          because left was occupied,
          begin moving left as soon as
          it becomes safe.
          */

          if (
            autoPhaseRef.current ===
              "WAITING" &&

            !leftBlocked && !drowsinessWarning
          ) {

            targetLane =
              finalLeftLane;


            autoTargetLaneRef.current =
              finalLeftLane;


            autoPhaseRef.current =
              "RETURN_LEFT";
          }


          /*
          --------------------------------
          TARGET SPEED
          --------------------------------

          Car must MOVE while steering.

          No fake sideways drift.
          */

          let desiredSpeed =
            VEHICLE_CONFIG
              .autoManeuverSpeed ??
            30;


          /*
          Slow down when almost in
          final parking lane.
          */

          if (
            !drowsinessWarning &&
            autoPhaseRef.current ===
              "RETURN_LEFT" &&

            Math.abs(
              laneX -
                finalLeftLane
            ) <
            1.1
          ) {

            desiredSpeed =
              VEHICLE_CONFIG
                .autoParkingSpeed ??
              5;
          }


          /*
          When WAITING, still creep
          slowly instead of freezing
          completely in traffic path.
          */

          if (
            !drowsinessTakeover &&
            autoPhaseRef.current ===
              "WAITING"
          ) {

            desiredSpeed =
              5;
          }


          // Approach the target smoothly, without snapping a fast car to 30.
          if (speed < desiredSpeed) {
            speed = Math.min(desiredSpeed, speed +
              (VEHICLE_CONFIG.autoAcceleration ?? 12) * delta);
          } else if (speed > desiredSpeed) {
            speed = Math.max(desiredSpeed, speed -
              VEHICLE_CONFIG.normalBrake * delta);
          }


          /*
          --------------------------------
          STEER TOWARD TARGET
          --------------------------------
          */

          if (
            targetLane !== null
          ) {

            const lateralError =
              targetLane -
              laneX;


            const aiSteering =
              THREE.MathUtils.clamp(
                lateralError /
                  1.7,

                -1,

                1
              );


            steering =
              THREE.MathUtils.lerp(
                steering,

                aiSteering,

                1 -
                  Math.exp(
                    -7 *
                      delta
                  )
              );


            /*
            Critical:

            lateral movement is multiplied
            by actual forward speed.

            Therefore:

            speed = 0
            => lateral movement = 0

            No sideways stationary drift.
            */

            const movementFactor =
              THREE.MathUtils.clamp(
                speed /
                  (
                    VEHICLE_CONFIG
                      .autoManeuverSpeed ??
                    30
                  ),

                0,

                1
              );


            laneX +=
              steering *
              VEHICLE_CONFIG
                .autoLateralRate *
              movementFactor *
              delta;


            laneX =
              THREE.MathUtils.clamp(
                laneX,

                -5.15,

                5.15
              );
          }
        }


        /*
        ==================================
        FINAL LEFT-LANE PARKING
        ==================================
        */

        const reachedLeftLane =
          Math.abs(
            laneX -
              finalLeftLane
          ) <
          0.18;


        /*
        Only park if:

        - we're actually in left lane
        - left lane is clear
        - AI is in final return phase
        */

        if (
          !drowsinessWarning &&
          reachedLeftLane &&

          !leftBlocked &&

          autoPhaseRef.current ===
            "RETURN_LEFT"
        ) {

          state.setParkingStage(
            "PARKING"
          );


          /*
          Final brake.
          */

          speed -=
            VEHICLE_CONFIG
              .normalBrake *
            delta;


          speed =
            Math.max(
              0,
              speed
            );


          steering =
            THREE.MathUtils.lerp(
              steering,

              0,

              1 -
                Math.exp(
                  -8 *
                    delta
                )
            );


          if (
            speed <
            0.35
          ) {

            speed = 0;


            parkedTimerRef.current +=
              delta;


            if (
              parkedTimerRef.current >
              1.25
            ) {

              autoTargetLaneRef.current =
                null;


              autoPhaseRef.current =
                "NONE";


              safeLaneWaitRef.current =
                0;


              if (
                !gameEndTriggeredRef.current
              ) {
                gameEndTriggeredRef.current =
                  true;

                // Store first: preserves the simulator's original finish state.
                state.finishGame();

                if (
                  !endScreenAudioPlayedRef.current
                ) {
                  endScreenAudioPlayedRef.current =
                    true;

                  audioManager.gameOver();
                }

                // App.jsx uses this to actually show ResultScreen.
                onGameOver?.();
              }


              return;
            }
          }
        }


        else {

          parkedTimerRef.current =
            0;


          /*
          Update useful UI state.
          */

          if (
            autoPhaseRef.current ===
              "EVASIVE"
          ) {

            state.setParkingStage(
              "AVOIDING_TRAFFIC"
            );
          }


          else if (
            autoPhaseRef.current ===
              "RETURN_LEFT"
          ) {

            state.setParkingStage(
              "MOVING_LEFT"
            );
          }
        }
      }


      /*
      =====================================
      TAKEOVER FAILSAFE END
      =====================================

      Preserve the existing collision takeover timeout. Drowsiness
      must complete its recovery window and safe left-lane parking.

      Normal parking can finish earlier.
      If it does not, end safely after 7.5 s.
      */
      if (
        state.mode !== "MANUAL" &&
        state.takeoverReason !== "DROWSINESS" &&
        autoTakeoverTimerRef.current >=
          7.5 &&
        !gameEndTriggeredRef.current
      ) {
        gameEndTriggeredRef.current =
          true;

        speedRef.current = 0;
        steeringRef.current = 0;
        laneXRef.current = laneX;

        state.setParkingStage?.(
          "SAFE_STOPPED"
        );

        state.setVehicleState(
          0,
          laneX,
          0
        );

        state.finishGame();

        if (
          !endScreenAudioPlayedRef.current
        ) {
          endScreenAudioPlayedRef.current =
            true;

          audioManager.gameOver();
        }

        onGameOver?.();

        return;
      }


      /*
      =====================================
      SAVE PHYSICS STATE
      =====================================
      */

      speedRef.current =
        speed;


      laneXRef.current =
        laneX;


      steeringRef.current =
        steering;


      /*
      =====================================
      MOVE VEHICLE BODY
      =====================================
      */

      if (
        carRef.current
      ) {

        carRef.current
          .position.x =
          THREE.MathUtils.lerp(
            carRef.current
              .position.x,

            laneX,

            1 -
              Math.exp(
                -7 *
                  delta
              )
          );
      }


      /*
      =====================================
      STEERING WHEEL VISUAL
      =====================================

      Current uploaded wheel:

      plane = XZ
      axle  = LOCAL Y
      */

      if (
        wheelSpinRef.current
      ) {

        const targetWheelAngle =
          -steering *
          VEHICLE_CONFIG
            .maximumSteeringWheelAngle;


        wheelSpinRef.current
          .rotation.y =
          THREE.MathUtils.lerp(
            wheelSpinRef.current
              .rotation.y,

            targetWheelAngle,

            1 -
              Math.exp(
                -12 *
                  delta
              )
          );
      }


      /*
      =====================================
      FIRST-PERSON CAMERA
      =====================================

      Camera follows actual smoothed
      vehicle position.

      Driver doesn't slide separately.
      */

      if (
        carRef.current
      ) {

        const actualCarX =
          carRef.current
            .position.x;


        camera.position.set(
          actualCarX +
            CAMERA_CONFIG.x,

          CAMERA_CONFIG.y,

          CAMERA_CONFIG.z
        );


        camera.lookAt(
          actualCarX +
            CAMERA_CONFIG.x,

          CAMERA_CONFIG
            .lookHeight,

          -15
        );
      }


      /*
      =====================================
      UPDATE GLOBAL STORE
      =====================================
      */

      state.setVehicleState(
        speed,

        laneX,

        steering
      );
    }
  );


  /*
  =========================================
  RENDER
  =========================================
  */

  return (
    <group
      ref={
        carRef
      }

      position={[
        0,
        PLAYER_MODEL.bodyY,
        0,
      ]}
    >

      {/*
      ==============================
      PLAYER BODY
      ==============================
      */}

      <group
        rotation={[
          0,

          PLAYER_MODEL
            .bodyRotationY,

          0,
        ]}

        scale={
          PLAYER_MODEL.bodyScale
        }
      >

        <primitive
          object={
            body
          }
        />

      </group>


      {/*
      ==============================
      STEERING BASE
      ==============================

      Position/orientation of wheel
      inside cockpit.

      This group does NOT spin.
      */}

      <group
        position={
          PLAYER_MODEL
            .steeringPosition
        }

        rotation={
          PLAYER_MODEL
            .steeringBaseRotation
        }

        scale={
          PLAYER_MODEL
            .steeringScale
        }
      >

        {/*
        Current GLB steering spin
        axis = local Y.
        */}

        <group
          ref={
            wheelSpinRef
          }
        >

          {/*
          Shift actual GLB geometry
          so its geometric centre lies
          on our steering pivot.
          */}

          <group
            position={
              wheelData.offset
            }
          >

            <primitive
              object={
                wheelData.scene
              }
            />

          </group>

        </group>

      </group>

    </group>
  );
}


/*
=========================================
PRELOAD
=========================================
*/

useGLTF.preload(
  PLAYER_MODEL.body
);


useGLTF.preload(
  PLAYER_MODEL.steeringWheel
);