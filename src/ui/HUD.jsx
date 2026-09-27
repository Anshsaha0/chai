import {
  useGameStore,
} from "../store/useGameStore.js";

export default function HUD() {
  const speed =
    useGameStore(
      (state) =>
        state.speed
    );

  const speedLimit =
    useGameStore(
      (state) =>
        state.speedLimit
    );

  const mode =
    useGameStore(
      (state) =>
        state.mode
    );

  const reason =
    useGameStore(
      (state) =>
        state.takeoverReason
    );

  const indicator =
    useGameStore(
      (state) =>
        state.leftIndicator
    );

  return (
    <>
      {/* TOP CENTRE SPEED */}

      <div className="speed-hud">
        <div className="speed-value">
          {Math.round(speed)}
        </div>

        <div className="speed-kmh">
          KM/H
        </div>

        <div className="speed-limit-text">
          LIMIT {speedLimit}
        </div>
      </div>

      {/* MODE */}

      <div
        className={`mode-panel ${
          mode === "AUTO"
            ? "auto-mode"
            : ""
        }`}
      >
        <span
          className="mode-dot"
        />

        {mode} MODE
      </div>

      {/* AUTO TAKEOVER */}

      {mode === "AUTO" && (
        <div className="takeover-warning">
          <strong>
            AI SAFETY TAKEOVER
          </strong>

          <span>
            {reason ===
            "DROWSINESS"
              ? "DROWSINESS DETECTED"
              : "COLLISION RISK DETECTED"}
          </span>

          <small>
            Automatic braking &
            parking active
          </small>
        </div>
      )}

      {/* INDICATOR */}

      {indicator && (
        <div className="indicator-hud">
          ←
        </div>
      )}

      <div className="keyboard-hint">
        W ACCELERATE · A/D
        STEER · S/SPACE BRAKE
      </div>
    </>
  );
}