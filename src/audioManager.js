import { setMediaGain } from "./game/audio/soundManager.js";

class AudioManager {
  constructor() {
    // MP3 files are served from /public/audio
    this.driving = new Audio("/audio/driving.mp3");
    this.brake = new Audio("/audio/brake.mp3");
    this.passing = new Audio("/audio/car_passing_by.mp3");
    this.honk = new Audio("/audio/honk.mp3");
    this.endScreen = new Audio("/audio/end_screen.mp3");
    this.drowsinessAlarm = new Audio("/audio/alarm.mp3");
    this.drowsinessAlarmActive = false;

    // Driving sound loops
    this.driving.loop = true;

    // Volume levels
    this.drivingFullVolume = 0.35;

    this.drivingCoastVolume =
      this.drivingFullVolume * 0.5;

    this.driving.volume =
      this.drivingFullVolume;

    this.brake.volume = 0.9;
    this.passing.volume = 0.75;
    this.honk.volume = 0.375; // Half the previous honk volume.
    this.endScreen.volume = 0.75;

    this.gameEnded = false;

    this.lastBrakeTime = 0;
    this.lastPassingTime = 0;
    this.lastHonkTime = 0;
  }

  startDrowsinessAlarm() {
    if (this.gameEnded || this.drowsinessAlarmActive) return;
    this.drowsinessAlarmActive = true;
    this.drowsinessAlarm.currentTime = 0;
    this.drowsinessAlarm.loop = true;
    this.play(this.drowsinessAlarm);
  }

  stopDrowsinessAlarm() {
    this.drowsinessAlarmActive = false;
    this.stopAudio(this.drowsinessAlarm);
    this.drowsinessAlarm.loop = false;
  }

  // ======================================================
  // GENERIC PLAY
  // ======================================================

  play(audio, restart = false) {
    if (!audio) return;

    if (audio === this.endScreen) {
      setMediaGain(audio, 2);
    }

    if (restart) {
      audio.currentTime = 0;
    }

    audio.play().catch((error) => {
      console.log(
        "Audio blocked:",
        error
      );
    });
  }

  // ======================================================
  // DRIVING AUDIO
  // ======================================================

  startDriving() {
    if (this.gameEnded) return;

    // Accelerator pressed = full volume
    this.driving.volume =
      this.drivingFullVolume;

    if (this.driving.paused) {
      this.play(this.driving);
    }
  }

  setDrivingFullVolume() {
    if (this.gameEnded) return;

    this.driving.volume =
      this.drivingFullVolume;
  }

  setDrivingCoastVolume() {
    if (this.gameEnded) return;

    /*
    IMPORTANT:
    This does NOT start the sound.

    It only reduces volume if
    driving sound is already playing.
    */

    if (!this.driving.paused) {
      this.driving.volume =
        this.drivingCoastVolume;
    }
  }

  stopDriving() {
    this.driving.pause();

    this.driving.currentTime = 0;

    // Reset volume for next acceleration
    this.driving.volume =
      this.drivingFullVolume;
  }

  // ======================================================
  // COLLISION BRAKE AUDIO
  // ======================================================

  collisionBrake() {
    if (this.gameEnded) return;

    const now =
      performance.now();

    /*
    Collision detection may run
    every frame, so prevent repeated
    brake sound spam.
    */

    if (
      now -
        this.lastBrakeTime <
      1000
    ) {
      return;
    }

    this.lastBrakeTime =
      now;

    this.play(
      this.brake,
      true
    );
  }

  // ======================================================
  // TRAFFIC PASSING AUDIO
  // ======================================================

  trafficPass() {
    if (this.gameEnded) return;

    const now =
      performance.now();

    if (
      now -
        this.lastPassingTime <
      800
    ) {
      return;
    }

    this.lastPassingTime =
      now;

    this.play(
      this.passing,
      true
    );

    // Slightly delayed honk
    setTimeout(() => {
      if (!this.gameEnded) {
        this.playHonk();
      }
    }, 150);
  }

  // ======================================================
  // HONK
  // ======================================================

  playHonk() {
    if (this.gameEnded) return;

    const now =
      performance.now();

    if (
      now -
        this.lastHonkTime <
      1000
    ) {
      return;
    }

    this.lastHonkTime =
      now;

    this.play(
      this.honk,
      true
    );
  }

  // ======================================================
  // GENERIC STOP
  // ======================================================

  stopAudio(audio) {
    if (!audio) return;

    audio.pause();

    audio.currentTime = 0;
  }

  // ======================================================
  // GAME OVER
  // ======================================================

  gameOver(
    indicatorAudio = null
  ) {
    if (this.gameEnded) {
      return;
    }

    this.stopDrowsinessAlarm();
    this.gameEnded = true;

    // Stop gameplay audio
    this.stopAudio(
      this.driving
    );

    this.stopAudio(
      this.brake
    );

    this.stopAudio(
      this.passing
    );

    this.stopAudio(
      this.honk
    );

    // Stop indicator sound if supplied
    if (indicatorAudio) {
      try {
        indicatorAudio.pause();

        indicatorAudio.currentTime =
          0;
      } catch (error) {
        console.log(
          "Could not stop indicator audio:",
          error
        );
      }
    }

    // Play end screen music
    this.play(
      this.endScreen,
      true
    );
  }

  // ======================================================
  // RESTART
  // ======================================================

  restart() {
    this.stopDrowsinessAlarm();
    /*
    Restart must NOT automatically
    start driving audio.
    */

    this.stopAudio(
      this.endScreen
    );

    this.stopAudio(
      this.driving
    );

    this.stopAudio(
      this.brake
    );

    this.stopAudio(
      this.passing
    );

    this.stopAudio(
      this.honk
    );

    this.driving.volume =
      this.drivingFullVolume;

    this.gameEnded = false;

    this.lastBrakeTime = 0;

    this.lastPassingTime = 0;

    this.lastHonkTime = 0;
  }

  // ======================================================
  // STOP EVERYTHING / NEW GAME
  // ======================================================

  stopAll() {
    this.stopDrowsinessAlarm();
    this.stopAudio(
      this.driving
    );

    this.stopAudio(
      this.brake
    );

    this.stopAudio(
      this.passing
    );

    this.stopAudio(
      this.honk
    );

    this.stopAudio(
      this.endScreen
    );

    this.driving.volume =
      this.drivingFullVolume;

    this.gameEnded = false;

    this.lastBrakeTime = 0;

    this.lastPassingTime = 0;

    this.lastHonkTime = 0;
  }
}

const audioManager =
  new AudioManager();

export default audioManager;