import { TRAFFIC_CONFIG, TRAFFIC_MODELS } from "./config.js";

const ROAD_LANES = [-4.5, 0, 4.5];

export function randomTrafficLane() {
  return ROAD_LANES[Math.floor(Math.random() * ROAD_LANES.length)];
}

export function nextTrafficZ(cars, ignoredCarId = null) {
  const others = cars.filter((car) => car.id !== ignoredCarId);
  if (others.length === 0) return TRAFFIC_CONFIG.spawnZ;
  const farthestZ = Math.min(TRAFFIC_CONFIG.spawnZ, ...others.map((car) => car.z));
  const gap = TRAFFIC_CONFIG.minSpacing + Math.random() *
    (TRAFFIC_CONFIG.maxSpawnGap - TRAFFIC_CONFIG.minSpacing);
  // Always beyond every other car: no random retries or lane-only checks.
  return farthestZ - gap;
}

export function createTrafficCars() {
  const cars = [];
  for (const model of TRAFFIC_MODELS) {
    cars.push({
      id: `traffic-${cars.length}`,
      model,
      z: nextTrafficZ(cars),
      speed: TRAFFIC_CONFIG.minSpeed + Math.random() *
        (TRAFFIC_CONFIG.maxSpeed - TRAFFIC_CONFIG.minSpeed),
      lane: randomTrafficLane(),
      relativeSpeed: 0,
    });
  }
  return cars;
}

export function advanceTraffic(cars, playerSpeed, delta) {
  // Incoming cars travel toward +Z. Move the leading car first so followers
  // cannot catch up into the same row, even when they occupy different lanes.
  const ordered = [...cars].sort((a, b) => b.z - a.z);
  for (let i = 0; i < ordered.length; i++) {
    const car = ordered[i];
    const previousZ = car.z;
    const candidateZ = previousZ + (car.speed + playerSpeed) / 3.6 * delta;
    car.z = i === 0 ? candidateZ : Math.min(candidateZ,
      ordered[i - 1].z - TRAFFIC_CONFIG.minSpacing);
    car.relativeSpeed = delta > 0 ? (car.z - previousZ) / delta : 0;
  }
}
