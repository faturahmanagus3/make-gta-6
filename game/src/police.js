// police.js - the wanted system and the Sunfall PD response. Crimes raise
// heat; heat becomes stars; stars send patrol cars that pursue and ram.
// Staying out of sight lets the heat cool and the stars fall away.

import { createCar, updateCarPhysics, pointInCar } from './vehicles.js';
import { clamp, turnToward, wrapAngle } from './rng.js';
import { VERTICAL_ROADS, HORIZONTAL_ROADS } from './city.js';

export const CRIME_HEAT = { theft: 34, collision: 10, hitPed: 30, assault: 26, shooting: 16, shotCar: 22, shotCop: 46, speeding: 4 };

export function createWanted() {
  return { level: 0, heat: 0, unseenTime: 0, crimes: 0 };
}

export function addCrime(wanted, kind) {
  wanted.heat = clamp(wanted.heat + (CRIME_HEAT[kind] || 10), 0, 500);
  wanted.crimes++;
  wanted.unseenTime = 0;
  wanted.level = clamp(Math.floor(wanted.heat / 62), 0, 5);
}

export function forceWanted(wanted, level) {
  wanted.level = clamp(level, 0, 5);
  wanted.heat = Math.max(wanted.heat, wanted.level * 62 + 4);
}

export function updateWanted(wanted, dt, observed) {
  if (observed) wanted.unseenTime = 0; else wanted.unseenTime += dt;
  if (wanted.unseenTime > 4 && wanted.level > 0) {
    wanted.heat -= dt * 13;
    if (wanted.heat < wanted.level * 62 - 62 + 1 && wanted.level > 0) wanted.heat = Math.max(0, wanted.heat);
    wanted.level = clamp(Math.floor(Math.max(0, wanted.heat) / 62), 0, 5);
    if (wanted.heat <= 0) { wanted.heat = 0; wanted.level = 0; }
  }
}

export function createPoliceFleet() { return { cars: [], spawnTimer: 0 }; }

function spawnPointNear(player) {
  const spots = [];
  for (const x of VERTICAL_ROADS) spots.push({ x, y: player.y + (player.y > 800 ? -430 : 430) });
  for (const y of HORIZONTAL_ROADS) spots.push({ x: player.x + (player.x > 1000 ? -430 : 430), y });
  const s = spots[Math.floor(Math.random() * spots.length)];
  return { x: clamp(s.x, 60, 1980), y: clamp(s.y, 60, 1560) };
}

export function updatePolice(fleet, dt, city, fx, wanted, target, hooks = {}) {
  const desired = wanted.level === 0 ? 0 : Math.min(6, 1 + wanted.level);
  fleet.spawnTimer -= dt;
  if (fleet.cars.length < desired && fleet.spawnTimer <= 0) {
    const p = spawnPointNear(target);
    const car = createCar(p.x, p.y, Math.atan2(target.y - p.y, target.x - p.x), '#f5f6fa', 'police');
    car.driver = 'police'; car.cruiseSpeed = 330;
    fleet.cars.push(car);
    fleet.spawnTimer = 2.4;
  }
  if (wanted.level === 0 && fleet.cars.length) {
    // stand down: cruisers peel away and are removed once far off
    fleet.cars = fleet.cars.filter((c) => Math.hypot(c.x - target.x, c.y - target.y) < 900);
    for (const car of fleet.cars) car.driver = 'leaving';
  }
  let anySeesTarget = false;
  for (const car of fleet.cars) {
    const dist = Math.hypot(car.x - target.x, car.y - target.y);
    if (dist < 430) anySeesTarget = true;
    if (car.wrecked) continue;
    if (car.driver === 'leaving') {
      updateCarPhysics(car, { throttle: car.speed < 120 ? 0.8 : 0, steer: 0, handbrake: false }, dt, city, fx, hooks);
      continue;
    }
    const wantAngle = Math.atan2(target.y - car.y, target.x - car.x);
    const diff = wrapAngle(wantAngle - car.angle);
    const steer = clamp(diff * 1.7, -0.62, 0.62);
    car.angle = turnToward(car.angle, car.angle, 0); // steering handled by physics below
    let throttle = 1;
    if (dist < 42) throttle = -0.4;
    else if (Math.abs(diff) > 2.2) throttle = -0.7;
    updateCarPhysics(car, { throttle, steer, handbrake: false }, dt, city, fx, hooks);
    if (dist < 34 && hooks.onRam) hooks.onRam(car);
  }
  return anySeesTarget;
}

export function playerSpottedBy(fleet, target) {
  return fleet.cars.some((c) => !c.wrecked && Math.hypot(c.x - target.x, c.y - target.y) < 430);
}

export { pointInCar };
