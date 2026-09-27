import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';
import * as THREE from 'three';
import { VEHICLE_CONFIG } from '../src/game/config.js';

// Exercise the real store and frame callback without webcam/WebGL hardware.
let now = 0;
let nextTimer = 1;
const timers = new Map();
globalThis.performance = { now: () => now };
globalThis.setTimeout = (fn, delay) => {
  const id = nextTimer++;
  timers.set(id, { fn, due: now + delay });
  return id;
};
globalThis.clearTimeout = id => timers.delete(id);
globalThis.Audio = class {
  constructor(src) { this.src = src; this.paused = true; this.currentTime = 0; this.plays = 0; }
  play() { this.paused = false; this.plays++; return Promise.resolve(); }
  pause() { this.paused = true; }
};
globalThis.window = { AudioContext: class {
  state = 'running';
  destination = {};
  createMediaElementSource() { return { connect() {} }; }
  createGain() { return { gain: { value: 1 }, connect() {} }; }
} };
const { useGameStore } = await import('../src/store/useGameStore.js');
const { default: audio } = await import('../src/audioManager.js');
const state = () => useGameStore.getState();
const source = fs.readFileSync(new URL('../src/game/components/PlayerCockpit.jsx', import.meta.url), 'utf8');
const helpers = source.slice(source.indexOf('const ROAD_LANES'), source.indexOf('export default function'));
const frameStart = source.indexOf('  useFrame(');
const frameCode = source.slice(frameStart, source.indexOf('\n  );', frameStart) + 6);

function advance(ms) {
  now += ms;
  for (const [id, timer] of [...timers]) {
    if (timer.due <= now) { timers.delete(id); timer.fn(); }
  }
}
function reset() {
  state().restart(); audio.restart(); now += 20000;
  state().startGame();
}
function drowsy() {
  state().setDriverState('DROWSY'); state().triggerTakeover('DROWSINESS');
}
function cockpit(speed = 30, lane = 0) {
  let frame;
  let ended = 0;
  const context = { THREE, VEHICLE_CONFIG, useGameStore, audioManager: audio,
    useFrame: fn => { frame = fn; }, onGameOver: () => { ended++; },
    keyboard: { current: { accelerator: false, brake: false, left: false, right: false } } };
  for (const match of source.matchAll(/const (\w+Ref)\s*=\s*useRef\((null|false|true|0|"NONE")\);/g)) {
    context[match[1]] = { current: JSON.parse(match[2]) };
  }
  context.speedRef.current = speed; context.laneXRef.current = lane;
  context.wheelSpinRef.current = { rotation: { x: 0, y: 0, z: 0 } };
  vm.createContext(context); vm.runInContext(helpers + frameCode, context);
  return { context, ended: () => ended, step(n = 1) {
    for (let i = 0; i < n && state().screen !== 'RESULT'; i++) {
      frame(null, 0.05); advance(50);
    }
  } };
}
function traffic(lanes) {
  useGameStore.setState({ trafficCars: lanes.map((laneX, id) => ({ id, laneX, z: -20 })) });
}

test('manual control and advisory 150 km/h cap remain independent', () => {
  reset(); const sim = cockpit(149); state().setSpeedLimit(30);
  sim.context.keyboard.current.accelerator = true; sim.step(10);
  assert.equal(state().speed, 150); assert.equal(state().mode, 'MANUAL');
  assert.equal(timers.size, 0); assert.equal(audio.drowsinessAlarm.paused, true);
});

test('warning starts once, decelerates smoothly, recovers immediately, then can recur', () => {
  reset(); const sim = cockpit(100); const before = audio.drowsinessAlarm.plays;
  drowsy(); const started = state().drowsinessStartedAt;
  state().triggerTakeover('DROWSINESS');
  assert.equal(audio.drowsinessAlarm.plays, before + 1); assert.equal(timers.size, 1);
  assert.equal(audio.drowsinessAlarm.loop, true);
  assert.equal(state().drowsinessStartedAt, started);
  sim.step(); assert.ok(state().speed < 100 && state().speed > 30);
  sim.step(59); state().setDriverState('ACTIVE');
  assert.equal(state().mode, 'MANUAL'); assert.equal(timers.size, 0);
  assert.equal(audio.drowsinessAlarm.paused, true); assert.equal(audio.drowsinessAlarm.currentTime, 0);
  assert.equal(audio.drowsinessAlarm.loop, false);
  sim.context.keyboard.current.accelerator = true; const speed = state().speed;
  sim.step(); assert.ok(state().speed > speed);
  advance(8000); assert.equal(state().mode, 'MANUAL');
  drowsy(); assert.equal(audio.drowsinessAlarm.plays, before + 2); assert.equal(timers.size, 1);
});

test('warning cannot park or hit the 7.5s failsafe; full deadline commits parking', () => {
  reset(); const sim = cockpit(30, -4.5); drowsy(); sim.step(199);
  assert.equal(state().drowsinessSafetyPhase, 'WARNING'); assert.equal(state().speed, 30);
  assert.equal(state().screen, 'DRIVING'); assert.equal(sim.ended(), 0);
  sim.step(); assert.equal(state().drowsinessSafetyPhase, 'AUTO_PARK');
  assert.equal(audio.drowsinessAlarm.paused, true); assert.equal(timers.size, 0);
  state().setDriverState('ACTIVE'); assert.equal(state().mode, 'AUTO');
  sim.step(400); assert.equal(state().screen, 'RESULT'); assert.equal(state().speed, 0);
  assert.equal(sim.ended(), 1);
});

test('current and left blocked selects third lane, then returns left to park', () => {
  reset(); const sim = cockpit(); traffic([-4.5, 0]); drowsy(); sim.step();
  assert.equal(sim.context.autoTargetLaneRef.current, 4.5);
  sim.step(205); assert.equal(state().drowsinessSafetyPhase, 'AUTO_PARK');
  assert.ok(state().playerX > 4); assert.equal(state().speed, 30);
  assert.equal(state().screen, 'DRIVING');
  traffic([]); sim.step(1000); assert.equal(state().screen, 'RESULT');
  assert.ok(Math.abs(state().playerX + 4.5) < 0.18);
});

test('left-lane danger evades; all-lanes danger brakes with no lateral movement', () => {
  reset(); let sim = cockpit(30, -4.5); traffic([-4.5]); drowsy(); sim.step();
  assert.equal(sim.context.autoTargetLaneRef.current, 0);
  assert.ok(state().speed > 0);
  reset(); sim = cockpit(1, 0); traffic([-4.5, 0, 4.5]); drowsy(); sim.step(200);
  assert.equal(state().speed, 0); assert.equal(state().playerX, 0);
  assert.equal(state().screen, 'DRIVING');
  traffic([-4.5, 0]); sim.step(5); assert.ok(state().speed > 0);
  assert.equal(sim.context.autoTargetLaneRef.current, 4.5);
  traffic([]); sim.step(1000); assert.equal(state().screen, 'RESULT');
});

test('reset, session end, and unmount cleanup clear countdown and alarm', () => {
  for (const action of ['restart', 'startGame', 'finishGame', 'resetDrowsinessSafety']) {
    reset(); drowsy(); state()[action]();
    assert.equal(timers.size, 0); assert.equal(audio.drowsinessAlarm.paused, true);
    assert.equal(state().drowsinessStartedAt, null);
    advance(11000); assert.equal(state().drowsinessSafetyPhase, 'NONE');
  }
});

test('late ACTIVE cannot extend recovery window; collision recovery stays AUTO', () => {
  reset(); drowsy(); now += 10000; state().setDriverState('ACTIVE');
  assert.equal(state().mode, 'AUTO'); assert.equal(state().drowsinessSafetyPhase, 'AUTO_PARK');
  reset(); state().triggerTakeover('COLLISION'); state().setDriverState('ACTIVE');
  assert.equal(state().mode, 'AUTO'); assert.equal(timers.size, 0);
  const sim = cockpit(); traffic([-4.5, 0, 4.5]); sim.step(152);
  assert.equal(state().screen, 'RESULT');
  reset(); const promoted = cockpit(); drowsy(); promoted.step(160);
  state().triggerTakeover('COLLISION'); state().setDriverState('ACTIVE'); promoted.step();
  assert.equal(state().mode, 'AUTO'); assert.equal(state().screen, 'DRIVING');
  assert.equal(audio.drowsinessAlarm.paused, true); assert.equal(timers.size, 0);
  assert.ok(promoted.context.autoTakeoverTimerRef.current < 1);
});

test('wheel visual continues to rotate on local Y only', () => {
  reset(); const sim = cockpit(); sim.context.keyboard.current.right = true; sim.step();
  const { rotation } = sim.context.wheelSpinRef.current;
  assert.equal(rotation.x, 0); assert.equal(rotation.z, 0); assert.notEqual(rotation.y, 0);
  assert.ok(fs.statSync(new URL('../public/audio/alarm.mp3', import.meta.url)).size > 0);
});


test('Start and repeated Restart reset the session directly into PLAYING without reload', () => {
  reset();
  const app = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.ok(!app.includes('location.reload'));
  const handlers = app.slice(app.indexOf('  const handleStart'), app.indexOf('\n  if ('));
  let screen = 'START';
  const ctx = { audioManager: audio, useGameStore, unlockAudio() {},
    setGameState: value => { screen = value; } };
  vm.createContext(ctx);
  vm.runInContext(handlers + '\nglobalThis.actions = { handleStart, handleRestart, handleGameOver };', ctx);
  ctx.actions.handleStart(); assert.equal(screen, 'PLAYING');
  for (let attempt = 0; attempt < 3; attempt++) {
    drowsy(); state().setVehicleState(90, 4.5, 1); state().setSpeedLimit(120);
    state().finishGame(); ctx.actions.handleGameOver(); assert.equal(screen, 'GAME_OVER');
    ctx.actions.handleRestart();
    assert.equal(screen, 'PLAYING'); assert.equal(state().screen, 'DRIVING');
    assert.equal(state().mode, 'MANUAL'); assert.equal(state().driverState, 'ACTIVE');
    assert.equal(state().speed, 0); assert.equal(state().playerX, 0);
    assert.equal(state().speedLimit, 60); assert.equal(state().trafficCars.length, 0);
    assert.equal(timers.size, 0); assert.equal(audio.gameEnded, false);
    assert.equal(audio.endScreen.paused, true); assert.equal(audio.drowsinessAlarm.paused, true);
  }
});
