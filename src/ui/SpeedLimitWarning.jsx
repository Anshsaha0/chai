import { useEffect, useRef } from "react";
import { setMediaGain } from "../game/audio/soundManager.js";
import { useGameStore } from "../store/useGameStore.js";

export default function SpeedLimitWarning() {
  const speedLimit = useGameStore((state) => state.speedLimit);
  const overLimit = useGameStore((state) => state.speed > state.speedLimit);
  const audioRef = useRef(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!overLimit || !audio) return;

    function playWarning() {
      setMediaGain(audio, 2);
      audio.pause();
      audio.currentTime = 0;
      audio.play().catch(() => {
        // If playback is blocked, retry on the next warning interval.
      });
    }

    playWarning();
    const timer = setInterval(playWarning, 3000);

    return () => {
      clearInterval(timer);
      audio.pause();
      audio.currentTime = 0;
    };
  }, [overLimit]);

  return (
    <>

      <audio
        ref={audioRef}
        src="/audio/speed_limit.mp3"
        preload="auto"
      />


      {overLimit && (

        <div
          role="alert"
          style={{
            position: "fixed",

            top: "115px",
            left: "50%",

            transform:
              "translateX(-50%)",

            zIndex: 9999,

            padding:
              "14px 28px",

            background:
              "rgba(180, 25, 25, 0.92)",

            color:
              "#ffffff",

            border:
              "2px solid rgba(255,255,255,0.8)",

            borderRadius:
              "10px",

            fontSize:
              "20px",

            fontWeight:
              "700",

            letterSpacing:
              "0.5px",

            pointerEvents:
              "none",
          }}
        >

          You're above the {speedLimit} km/h speed limit

        </div>
      )}

    </>
  );
}