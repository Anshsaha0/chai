import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import { TRAFFIC_CONFIG } from '../src/game/config.js';
import { createTrafficCars, advanceTraffic, nextTrafficZ, randomTrafficLane } from '../src/game/trafficMotion.js';

function checkSpacing(cars) {
  for (let i = 0; i < cars.length; i++) {
    for (let j = i + 1; j < cars.length; j++) {
      assert.ok(Math.abs(cars[i].z - cars[j].z) >= 50 - 1e-9);
    }
  }
}

test('six initial cars have safe spacing, valid lanes and fixed 24?30 km/h speeds', () => {
  for (let run = 0; run < 100; run++) {
    const cars = createTrafficCars();
    assert.equal(cars.length, 6); assert.equal(new Set(cars.map(c => c.id)).size, 6);
    checkSpacing(cars);
    for (const car of cars) {
      assert.ok([-4.5, 0, 4.5].includes(car.lane));
      assert.ok(car.speed >= 24 && car.speed <= 30);
    }
  }
});

test('incoming movement continues at zero player speed and uses positive relative velocity', () => {
  const car = { id: 'one', z: -90, speed: 27, lane: 0 };
  advanceTraffic([car], 0, 0.05); assert.equal(car.z, -89.625);
  advanceTraffic([car], 72, 0.05); assert.equal(car.z, -88.25);
  assert.equal(car.speed, 27);
});

test('cross-lane faster followers cannot close below 50m; zero delta remains finite', () => {
  const cars = [
    { id: 'lead', z: -50, lane: -4.5, speed: 24 },
    { id: 'follow', z: -100, lane: 4.5, speed: 30 },
  ];
  for (let i = 0; i < 100; i++) { advanceTraffic(cars, 0, 0.05); checkSpacing(cars); }
  assert.ok(cars.every(c => c.relativeSpeed > 0));
  advanceTraffic(cars, 0, 0); assert.ok(cars.every(c => c.relativeSpeed === 0));
});

test('long-running movement/recycling preserves all six cars and global spacing', () => {
  const cars = createTrafficCars(); let recycled = 0;
  const speeds = cars.map(c => c.speed);
  for (let frame = 0; frame < 20000; frame++) {
    advanceTraffic(cars, frame % 400 < 200 ? 0 : 150, 0.05);
    checkSpacing(cars);
    for (const car of cars) {
      if (car.z > 18) {
        const others = cars.filter(c => c.id !== car.id);
        car.z = nextTrafficZ(cars, car.id); car.lane = randomTrafficLane();
        assert.ok(others.every(c => c.z - car.z >= 50 - 1e-9));
        recycled++; checkSpacing(cars);
      }
    }
  }
  assert.ok(recycled > 100); assert.equal(cars.length, 6);
  assert.deepEqual(cars.map(c => c.speed), speeds);
});

test('actual frame callbacks publish current and recycled positions and retain collision trigger', () => {
  const source = fs.readFileSync(new URL('../src/game/components/Traffic.jsx', import.meta.url), 'utf8');
  const parentStart = source.indexOf('  useFrame((_, frameDelta)');
  const childStart = source.indexOf('  useFrame(() =>');
  const parentCode = source.slice(parentStart, source.indexOf('  }, -2);', parentStart) + 9);
  const childCode = source.slice(childStart, source.indexOf('  });', childStart) + 5);
  const fleetRef = { current: createTrafficCars() };
  const game = { speed: 0, mode: 'MANUAL', playerX: 0, trafficCars: [],
    updateTrafficCar(id, laneX, z) {
      const previous = this.trafficCars.find(c => c.id === id);
      if (previous) Object.assign(previous, { laneX, z });
      else this.trafficCars.push({ id, laneX, z });
    },
    triggerTakeover(reason) { this.reason = reason; },
  };
  let frame;
  const ctx = { TRAFFIC_CONFIG, advanceTraffic, nextTrafficZ, randomTrafficLane,
    fleetRef, useGameStore: { getState: () => game }, useFrame: (fn, priority) => {
      frame = fn; if (priority !== undefined) assert.equal(priority, -2);
    }, id: fleetRef.current[0].id, vehicleRef: { current: { position: { z: -90, x: 0 } } },
    laneRef: { current: 0 }, modelData: { halfLength: 2 },
    hasEnteredDetectionZone: { current: false }, hasPlayedPassingAudio: { current: false },
    audioManager: { collisionBrake() {}, trafficPass() {} }, playWarning() {},
  };
  vm.createContext(ctx); vm.runInContext(parentCode, ctx); const parentFrame = frame;
  vm.runInContext(childCode, ctx); const childFrame = frame;
  parentFrame(null, 0.05); childFrame();
  assert.equal(game.trafficCars.length, 6);
  for (const car of fleetRef.current) {
    const record = game.trafficCars.find(c => c.id === car.id);
    assert.equal(record.z, car.z); assert.equal(record.laneX, car.lane);
  }
  assert.equal(ctx.vehicleRef.current.position.z, fleetRef.current[0].z);
  const car = fleetRef.current[0]; car.z = 20;
  ctx.hasEnteredDetectionZone.current = true; ctx.hasPlayedPassingAudio.current = true;
  childFrame(); checkSpacing(fleetRef.current);
  const record = game.trafficCars.find(c => c.id === car.id);
  assert.equal(record.z, car.z); assert.equal(record.laneX, car.lane);
  assert.equal(ctx.vehicleRef.current.position.z, car.z);
  assert.equal(ctx.hasEnteredDetectionZone.current, false);
  assert.equal(ctx.hasPlayedPassingAudio.current, false);
  car.z = -20; car.relativeSpeed = 35; game.speed = 100;
  ctx.laneRef.current = game.playerX; childFrame(); assert.equal(game.reason, 'COLLISION');
  // A stopped or slow player must still trigger the existing TTC protection.
  for (const playerSpeed of [0, 4, 8]) {
    game.reason = null; game.speed = playerSpeed;
    car.z = -10; car.relativeSpeed = (24 + playerSpeed) / 3.6;
    ctx.hasEnteredDetectionZone.current = false;
    childFrame(); assert.equal(game.reason, 'COLLISION');
  }
  // React earlier: about 1.9 seconds before impact at a standstill.
  game.reason = null; game.speed = 0;
  car.z = -17; car.relativeSpeed = 24 / 3.6;
  childFrame(); assert.equal(game.reason, 'COLLISION');
  // Adjacent lanes and cars moving away must not cause false takeovers.
  game.reason = null; game.speed = 0; ctx.laneRef.current = 4.5;
  childFrame(); assert.equal(game.reason, null);
  ctx.laneRef.current = 0; car.relativeSpeed = 0;
  childFrame(); assert.equal(game.reason, null);
  car.relativeSpeed = 24 / 3.6; car.z = 8;
  childFrame(); assert.equal(game.reason, null);

});
