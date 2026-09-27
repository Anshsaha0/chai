// src/audio/soundManager.js

let audioContext = null;

let lastWarningTime = 0;
let lastBrakeTime = 0;
let lastSpeedSignTime = 0;
let lastIndicatorTime = 0;
let lastSuccessTime = 0;


// ======================================================
// AUDIO CONTEXT
// ======================================================

function getAudioContext() {
  if (!audioContext) {
    const AudioContext =
      window.AudioContext ||
      window.webkitAudioContext;

    if (!AudioContext) {
      console.warn(
        "Web Audio API is not supported."
      );

      return null;
    }

    audioContext =
      new AudioContext();
  }

  if (
    audioContext.state ===
    "suspended"
  ) {
    audioContext
      .resume()
      .catch(() => {});
  }

  return audioContext;
}


// Keep one Web Audio route per element across repeated playback.
const mediaGains = new WeakMap();

export function setMediaGain(audio, multiplier) {
  const context = getAudioContext();
  if (!context) return;

  let gain = mediaGains.get(audio);
  if (!gain) {
    const source = context.createMediaElementSource(audio);
    gain = context.createGain();
    source.connect(gain);
    gain.connect(context.destination);
    mediaGains.set(audio, gain);
  }

  gain.gain.value = multiplier;
}


// ======================================================
// GENERIC TONE
// ======================================================

function playTone({
  frequency = 800,
  duration = 0.15,
  volume = 0.12,
  type = "sine",
  endFrequency = null,
  delay = 0,
}) {
  const context =
    getAudioContext();

  if (!context) return;

  const startTime =
    context.currentTime +
    delay;

  const oscillator =
    context.createOscillator();

  const gain =
    context.createGain();

  oscillator.type =
    type;

  oscillator.frequency.setValueAtTime(
    frequency,
    startTime
  );

  if (
    endFrequency !== null
  ) {
    oscillator.frequency.exponentialRampToValueAtTime(
      Math.max(
        1,
        endFrequency
      ),
      startTime +
        duration
    );
  }

  gain.gain.setValueAtTime(
    0.0001,
    startTime
  );

  gain.gain.exponentialRampToValueAtTime(
    volume,
    startTime +
      0.01
  );

  gain.gain.exponentialRampToValueAtTime(
    0.0001,
    startTime +
      duration
  );

  oscillator.connect(
    gain
  );

  gain.connect(
    context.destination
  );

  oscillator.start(
    startTime
  );

  oscillator.stop(
    startTime +
      duration +
      0.02
  );
}


// ======================================================
// UNLOCK AUDIO
// ======================================================

export function unlockAudio() {
  const context =
    getAudioContext();

  if (!context) return;

  if (
    context.state ===
    "suspended"
  ) {
    context
      .resume()
      .catch(() => {});
  }
}


// ======================================================
// COLLISION WARNING
// ======================================================

export function playWarning() {
  const now =
    performance.now();

  if (
    now -
      lastWarningTime <
    650
  ) {
    return;
  }

  lastWarningTime =
    now;

  playTone({
    frequency: 1050,
    duration: 0.11,
    volume: 0.13,
    type: "square",
  });

  playTone({
    frequency: 1450,
    duration: 0.12,
    volume: 0.12,
    type: "square",
    delay: 0.13,
  });
}


// ======================================================
// INDICATOR SOUND
// ======================================================

export function playIndicator() {
  const now =
    performance.now();

  if (
    now -
      lastIndicatorTime <
    250
  ) {
    return;
  }

  lastIndicatorTime =
    now;

  playTone({
    frequency: 520,
    duration: 0.055,
    volume: 0.07,
    type: "square",
  });
}


// ======================================================
// SPEED SIGN SOUND
// ======================================================

export function playSpeedSign() {
  const now =
    performance.now();

  /*
  SpeedSigns.jsx may remain inside
  a detection zone for multiple frames.
  Avoid repeated beeps.
  */

  if (
    now -
      lastSpeedSignTime <
    900
  ) {
    return;
  }

  lastSpeedSignTime =
    now;

  /*
  Small two-note notification.
  */

  playTone({
    frequency: 740,
    duration: 0.09,
    volume: 0.09,
    type: "sine",
  });

  playTone({
    frequency: 980,
    duration: 0.12,
    volume: 0.09,
    type: "sine",
    delay: 0.1,
  });
}


// ======================================================
// SUCCESS / PARKING COMPLETE
// ======================================================

export function playSuccess() {
  const now =
    performance.now();

  if (
    now -
      lastSuccessTime <
    1200
  ) {
    return;
  }

  lastSuccessTime =
    now;

  playTone({
    frequency: 523,
    duration: 0.12,
    volume: 0.09,
    type: "sine",
  });

  playTone({
    frequency: 659,
    duration: 0.12,
    volume: 0.09,
    type: "sine",
    delay: 0.13,
  });

  playTone({
    frequency: 784,
    duration: 0.2,
    volume: 0.1,
    type: "sine",
    delay: 0.27,
  });
}


// ======================================================
// OLD BRAKE SCREECH
// ======================================================

export function playBrakeScreech() {
  const now =
    performance.now();

  if (
    now -
      lastBrakeTime <
    1000
  ) {
    return;
  }

  lastBrakeTime =
    now;

  const context =
    getAudioContext();

  if (!context) return;

  const duration =
    0.65;

  const bufferSize =
    Math.floor(
      context.sampleRate *
        duration
    );

  const buffer =
    context.createBuffer(
      1,
      bufferSize,
      context.sampleRate
    );

  const data =
    buffer.getChannelData(0);

  for (
    let i = 0;
    i < bufferSize;
    i++
  ) {
    const fade =
      1 -
      i /
        bufferSize;

    data[i] =
      (
        Math.random() *
          2 -
        1
      ) *
      fade;
  }

  const source =
    context.createBufferSource();

  source.buffer =
    buffer;

  const filter =
    context.createBiquadFilter();

  filter.type =
    "bandpass";

  filter.frequency.value =
    1800;

  filter.Q.value =
    1.3;

  const gain =
    context.createGain();

  gain.gain.setValueAtTime(
    0.22,
    context.currentTime
  );

  gain.gain.exponentialRampToValueAtTime(
    0.0001,
    context.currentTime +
      duration
  );

  source.connect(
    filter
  );

  filter.connect(
    gain
  );

  gain.connect(
    context.destination
  );

  source.start();

  source.stop(
    context.currentTime +
      duration
  );
}


// ======================================================
// OPTIONAL COMPATIBILITY FUNCTION
// ======================================================

export function stopAllSounds() {
  /*
  These are short generated WebAudio sounds.
  No persistent loop lives here.
  */
}