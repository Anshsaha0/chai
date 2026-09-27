import { assetUrl } from "../assetUrl.js";
export const PLAYER_MODEL = {
  body: assetUrl("models/car/body.glb"),

  steeringWheel:
    assetUrl("models/car/steering_wheel.glb"),

  bodyRotationY: Math.PI,

  bodyScale: 1,
  bodyY: 0,

  steeringPosition: [
    -0.41,
    0.60,
    -0.75,
  ],

  steeringBaseRotation: [
    Math.PI/2,
    Math.PI,
    0,
  ],

  steeringScale: 0.15,
};


export const CAMERA_CONFIG = {
  x: -0.34,

  y: 0.93,

  z: -0.12,

  lookHeight: 0.92,

  fov: 72,
};


export const VEHICLE_CONFIG = {
  maxUserSpeed: 150,

  acceleration: 24,

  normalBrake: 42,

  emergencyBrake: 65,

  drag: 6,

  steeringRate: 3,

  autoLateralRate: 3,

  /*
    Final parking lane
  */
  parkingLaneX: -4.5,

  /*
    AI lane-change movement speed.
    Car will maintain a small forward
    speed instead of drifting sideways.
  */
  autoManeuverSpeed: 30,

  drowsinessWarningMs: 10000,

  /*
    Gentle acceleration used by AI
    during lane changes.
  */
  autoAcceleration: 12,

  /*
    Slower speed while entering
    final parking position.
  */
  autoParkingSpeed: 5,

  maximumSteeringWheelAngle:
    Math.PI * 0.75,
};


export const TRAFFIC_MODELS = [
  assetUrl("models/traffic/car1.glb"),
  assetUrl("models/traffic/car2.glb"),
  assetUrl("models/traffic/car3.glb"),
  assetUrl("models/traffic/car4.glb"),
  assetUrl("models/traffic/car5.glb"),
  assetUrl("models/traffic/car6.glb"),
];


export const TRAFFIC_CONFIG = {
  minSpacing: 50,
  maxSpawnGap: 65,
  minSpeed: 24,
  maxSpeed: 30,
  spawnZ: -90,

  /*
    All traffic models are automatically
    resized to roughly this width.
  */
  targetWidth: 1.9,

  /*
    Road ground level
  */
  y: 0,

  /*
    Your checked traffic GLBs face +Z.

    They move from negative Z toward
    positive Z, so rotation remains 0.
  */
  rotationY: 0,

  /*
    Collision prediction only starts
    when car is actually close enough.
  */
  collisionCheckDistance: 30,

  /*
    Predictive takeover threshold
    in seconds.
  */
  ttcDangerSeconds: 2.0,

  /*
    Approximate front bumper
    position of player car.
  */
  playerFrontZ: -2.4,
};