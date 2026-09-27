import { create } from "zustand";
import audioManager from "../audioManager.js";
import { VEHICLE_CONFIG } from "../game/config.js";

let drowsinessTimer = null;

function clearDrowsinessWarning() {
  clearTimeout(drowsinessTimer);
  drowsinessTimer = null;
  audioManager.stopDrowsinessAlarm();
}

export const useGameStore = create((set, get) => ({
  screen: "START",

  mode: "MANUAL",

  driverState: "ACTIVE",

  speed: 0,
  speedLimit: 60,

  playerX: 0,
  steering: 0,

  takeoverReason: null,
  drowsinessSafetyPhase: "NONE",
  drowsinessStartedAt: null,

  leftIndicator: false,

  parkingStage: "NONE",

  /*
    Live positions of traffic cars.

    Example:
    [
      {
        id: "traffic-0",
        laneX: -4.5,
        z: -20
      }
    ]
  */
  trafficCars: [],

  startGame: () => {
    clearDrowsinessWarning();
    set({
      screen: "DRIVING",

      mode: "MANUAL",

      driverState: "ACTIVE",

      speed: 0,
      speedLimit: 60,

      playerX: 0,
      steering: 0,

      takeoverReason: null,
      drowsinessSafetyPhase: "NONE",
      drowsinessStartedAt: null,

      leftIndicator: false,

      parkingStage: "NONE",

      trafficCars: [],
    });
  },

  setVehicleState: (
    speed,
    playerX,
    steering
  ) =>
    set({
      speed,
      playerX,
      steering,
    }),

  setSpeedLimit: (speedLimit) =>
    set({
      speedLimit,
    }),

  setDriverState: (driverState) => {
    const state = get();
    if (driverState === "ACTIVE" && state.drowsinessSafetyPhase === "WARNING") {
      // A delayed timer callback must not extend the recovery window.
      const recoveredInTime = performance.now() - state.drowsinessStartedAt <
        VEHICLE_CONFIG.drowsinessWarningMs;
      clearDrowsinessWarning();
      set(recoveredInTime ? {
        driverState,
        mode: "MANUAL",
        takeoverReason: null,
        drowsinessSafetyPhase: "NONE",
        drowsinessStartedAt: null,
        parkingStage: "NONE",
        leftIndicator: false,
      } : {
        driverState,
        drowsinessSafetyPhase: "AUTO_PARK",
        drowsinessStartedAt: null,
        parkingStage: "BRAKING",
        leftIndicator: true,
      });
      return;
    }
    set({ driverState });
  },

  resetDrowsinessSafety: () => {
    clearDrowsinessWarning();
    set({ drowsinessSafetyPhase: "NONE", drowsinessStartedAt: null });
  },

  /*
    Traffic.jsx calls this every frame.

    It updates ONE traffic car
    without deleting the others.
  */
  updateTrafficCar: (
    id,
    laneX,
    z
  ) => {
    const cars =
      get().trafficCars;

    const existingIndex =
      cars.findIndex(
        (car) =>
          car.id === id
      );

    if (
      existingIndex === -1
    ) {
      set({
        trafficCars: [
          ...cars,
          {
            id,
            laneX,
            z,
          },
        ],
      });

      return;
    }

    const updated =
      [...cars];

    updated[
      existingIndex
    ] = {
      id,
      laneX,
      z,
    };

    set({
      trafficCars: updated,
    });
  },

  triggerTakeover: (reason) => {
    const state = get();
    if (state.screen === "RESULT") return;
    // Recovery must never cancel a separately committed collision takeover.
    if (state.mode === "AUTO") {
      if (reason === "COLLISION" && state.drowsinessSafetyPhase === "WARNING") {
        clearDrowsinessWarning();
        set({ takeoverReason: reason, drowsinessSafetyPhase: "NONE",
          drowsinessStartedAt: null, parkingStage: "BRAKING", leftIndicator: true });
      }
      return;
    }

    const drowsiness = reason === "DROWSINESS";
    const startedAt = drowsiness ? performance.now() : null;
    set({
      mode: "AUTO",
      takeoverReason: reason,
      leftIndicator: !drowsiness,
      parkingStage: drowsiness ? "DROWSINESS_WARNING" : "BRAKING",
      drowsinessSafetyPhase: drowsiness ? "WARNING" : "NONE",
      drowsinessStartedAt: startedAt,
    });

    if (drowsiness) {
      audioManager.startDrowsinessAlarm();
      drowsinessTimer = setTimeout(() => {
        const current = get();
        if (current.drowsinessSafetyPhase !== "WARNING" ||
            current.drowsinessStartedAt !== startedAt) return;
        clearDrowsinessWarning();
        set({ drowsinessSafetyPhase: "AUTO_PARK", drowsinessStartedAt: null,
          parkingStage: "BRAKING", leftIndicator: true });
      }, VEHICLE_CONFIG.drowsinessWarningMs);
    }
  },

  setParkingStage: (
    parkingStage
  ) =>
    set({
      parkingStage,
    }),

  finishGame: () => {
    clearDrowsinessWarning();
    set({
      drowsinessSafetyPhase: "NONE",
      drowsinessStartedAt: null,
      screen: "RESULT",

      speed: 0,

      steering: 0,

      parkingStage:
        "PARKED",
    });
  },

  restart: () => {
    clearDrowsinessWarning();
    set({
      screen: "START",

      mode: "MANUAL",

      driverState: "ACTIVE",

      speed: 0,
      speedLimit: 60,

      playerX: 0,
      steering: 0,

      takeoverReason: null,
      drowsinessSafetyPhase: "NONE",
      drowsinessStartedAt: null,

      leftIndicator: false,

      parkingStage: "NONE",

      trafficCars: [],
    });
  },
}));