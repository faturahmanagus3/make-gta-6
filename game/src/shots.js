// shots.js - deterministic screenshot scenes behind ?shot=<name>&seed=<n>.
// Each scene stages the real game state (never a fake picture): the same
// traffic, police, missions and HUD the player gets, arranged so one frame
// shows as many systems as possible. The cover scene is the police chase.

import { createCar } from './vehicles.js';
import { forceWanted } from './police.js';
import { spawnTireSmoke, spawnSparks } from './particles.js';

export function readShotRequest(search) {
  const params = new URLSearchParams(search || '');
  const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
  return { shot: params.get('shot'), seed: Number.isInteger(seedParam) ? seedParam : 7 };
}

function placeTraffic(state, spots) {
  spots.forEach(([x, y, angle], i) => {
    const car = state.traffic[i % state.traffic.length];
    car.x = x; car.y = y; car.angle = angle; car.speed = 60; car.driver = 'traffic';
  });
}

function beginMission(state, index, step) {
  state.missions.index = index;
  state.missions.step = step;
  state.missions.active = true;
  state.missions.done = false;
  state.missions.started = true;
  state.missions.banner = '';
  state.missions.bannerTime = 0;
  const defs = [
    ['Mara: package is waiting in Palm Park.', 'Grab it, then drop it at the Old Port depot.'],
    ['Mara: hit every checkpoint, Ria.', 'The PD is already rolling - keep moving.'],
  ];
  state.missions.dialogue = defs[Math.min(index, 1)];
  state.missions.dialogueTime = 6.5;
  if (index === 1) state.missions.timer = 0;
}

export function stageShot(state, name) {
  if (name === 'title' || name === 'start') { state.mode = 'title'; return; }
  state.mode = 'playing';
  if (name === 'chase') {
    // COVER: Ria in a stolen coupe on the Harbor Heights avenue, three stars,
    // two cruisers on her tail, mission checkpoint ahead, minimap alive.
    const car = createCar(820, 759, 0, '#e74c3c', 'civilian');
    car.driver = 'player'; car.speed = 218; car.health = 72;
    state.traffic.push(car); state.inCar = car;
    state.player.x = car.x; state.player.y = car.y; state.player.health = 86;
    const cop1 = createCar(690, 742, 0.08, '#f5f6fa', 'police'); cop1.driver = 'police'; cop1.speed = 226;
    const cop2 = createCar(636, 792, -0.06, '#f5f6fa', 'police'); cop2.driver = 'police'; cop2.speed = 208;
    state.police.cars = [cop1, cop2];
    forceWanted(state.wanted, 3);
    beginMission(state, 1, 0);
    state.missions.step = 1; // checkpoint 2 at Harbor Heights, ahead of the car
    placeTraffic(state, [[1060, 801, 0], [1210, 759, Math.PI], [700, 801, 0]]);
    for (let i = 0; i < 8; i++) spawnTireSmoke(state.fx, car.x - 30 - i * 9, car.y + 12 + (i % 3) * 4);
    spawnSparks(state.fx, cop1.x + 24, cop1.y - 8, 7);
    state.cash = 570;
    state.cam.x = car.x - 640; state.cam.y = car.y - 360;
    state.focus = { x: car.x, y: car.y, angle: 0 };
    state.district = 'Harbor Heights';
  } else if (name === 'onfoot') {
    // On foot in Palm Park: peds strolling, the package marker glowing nearby.
    state.player.x = 585; state.player.y = 585; state.player.aimAngle = 0.5; state.player.angle = 0.5;
    state.peds.slice(0, 7).forEach((ped, i) => {
      ped.x = 600 + (i % 4) * 42; ped.y = 540 + Math.floor(i / 4) * 74; ped.down = 0; ped.fleeTime = 0;
    });
    placeTraffic(state, [[640, 461, 0], [900, 419, Math.PI]]);
    beginMission(state, 0, 0);
    state.cash = 120;
    state.cam.x = state.player.x - 640; state.cam.y = state.player.y - 360;
    state.focus = { x: state.player.x, y: state.player.y, angle: 0.5 };
    state.district = 'Palm District';
  } else if (name === 'mission') {
    // Driving the delivery: package aboard, depot marker ahead, traffic around.
    const car = createCar(905, 905, 0.5, '#3498db', 'civilian');
    car.driver = 'player'; car.speed = 150; car.health = 92;
    state.traffic.push(car); state.inCar = car;
    state.player.x = car.x; state.player.y = car.y; state.player.health = 100;
    beginMission(state, 0, 1);
    placeTraffic(state, [[1120, 919, Math.PI], [760, 961, 0], [1000, 1120, -Math.PI / 2]]);
    state.peds.slice(0, 4).forEach((ped, i) => { ped.x = 960 + i * 30; ped.y = 1005; });
    state.cash = 420;
    state.cam.x = car.x - 640; state.cam.y = car.y - 360;
    state.focus = { x: car.x, y: car.y, angle: 0.5 };
    state.district = 'Old Port';
  } else {
    state.player.x = 560; state.player.y = 560;
    beginMission(state, 0, 0);
    state.cam.x = 0; state.cam.y = 200;
    state.focus = { x: 560, y: 560, angle: 0 };
  }
  window.__shotReady = true;
}
