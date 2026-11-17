// vehicles.js - car bodies, arcade driving physics and car rendering.
// One car shape serves the player, traffic and police; the driver field
// decides who is steering it. E steals any car: see main.js.

import { clamp } from './rng.js';
import { resolveBuildingCollision, CITY_WIDTH, CITY_HEIGHT } from './city.js';

export const CAR_COLORS = ['#e74c3c', '#f39c12', '#2ecc71', '#3498db', '#ecf0f1', '#9b59b6', '#fd79a8', '#00cec9', '#fdcb6e', '#636e72'];
let nextCarId = 1;

export function createCar(x, y, angle, color, kind = 'civilian') {
  return {
    id: nextCarId++, x, y, angle, speed: 0, steer: 0, color, kind,
    w: 46, h: 22, health: 100, wrecked: false, driver: null,
    accelInput: 0, brakeInput: 0, handbrake: false, honk: 0,
  };
}

export function carCorners(car) {
  const fx = Math.cos(car.angle), fy = Math.sin(car.angle);
  const px = -fy, py = fx, hw = car.w / 2, hh = car.h / 2;
  return [
    { x: car.x + fx * hw + px * hh, y: car.y + fy * hw + py * hh },
    { x: car.x + fx * hw - px * hh, y: car.y + fy * hw - py * hh },
    { x: car.x - fx * hw + px * hh, y: car.y - fy * hw + py * hh },
    { x: car.x - fx * hw - px * hh, y: car.y - fy * hw - py * hh },
  ];
}

export function pointInCar(car, x, y, pad = 0) {
  const dx = x - car.x, dy = y - car.y;
  const fx = Math.cos(car.angle), fy = Math.sin(car.angle);
  const localX = dx * fx + dy * fy, localY = -dx * fy + dy * fx;
  return Math.abs(localX) < car.w / 2 + pad && Math.abs(localY) < car.h / 2 + pad;
}

// input: {throttle -1..1, steer -1..1, handbrake}. Returns impact speed if the
// car slammed a building this step, else 0, so callers can add damage/shake.
export function updateCarPhysics(car, input, dt, city, fx, hooks = {}) {
  if (car.wrecked) { car.speed *= Math.max(0, 1 - dt * 3); return 0; }
  const maxSpeed = car.kind === 'police' ? 335 : 295;
  const accel = 235, brakeForce = 330;
  if (input.throttle > 0) car.speed += accel * input.throttle * dt * (1 - Math.max(0, car.speed) / (maxSpeed * 1.25));
  else if (input.throttle < 0) {
    if (car.speed > 12) car.speed -= brakeForce * dt;
    else car.speed = Math.max(-105, car.speed - accel * 0.62 * dt);
  } else {
    car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 42 * dt);
  }
  if (input.handbrake) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 300 * dt);
  car.speed = clamp(car.speed, -110, maxSpeed);
  const steerTarget = input.steer * 0.62;
  car.steer += (steerTarget - car.steer) * Math.min(1, dt * 9);
  if (Math.abs(car.speed) > 4) {
    car.angle += car.steer * (car.speed / 118) * dt * (car.speed < 0 ? -1 : 1);
    if (input.handbrake && fx && Math.abs(car.speed) > 130 && fx.rng() < 0.6) {
      fx.list && null;
    }
  }
  const drift = input.handbrake ? 0.86 : 1;
  const nx = car.x + Math.cos(car.angle) * car.speed * dt * drift;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt * drift;
  const before = { x: car.x, y: car.y };
  car.x = clamp(nx, 30, CITY_WIDTH - 26);
  car.y = clamp(ny, 26, CITY_HEIGHT - 26);
  const probe = { x: car.x, y: car.y };
  const hit = resolveBuildingCollision(city, probe, 17);
  let impact = 0;
  if (hit) {
    impact = Math.abs(car.speed);
    if (impact > 55) {
      car.health -= (impact - 45) * 0.16;
      if (hooks.onCrash) hooks.onCrash(car, impact);
    }
    car.x = probe.x; car.y = probe.y;
    car.speed *= -0.22;
    if (Math.abs(before.x - car.x) < 0.01 && Math.abs(before.y - car.y) < 0.01) car.speed = 0;
  }
  if (car.health <= 0) { car.health = 0; car.wrecked = true; car.speed = 0; }
  return impact;
}

export function damageCar(car, amount) {
  car.health -= amount;
  if (car.health <= 0) { car.health = 0; car.wrecked = true; car.speed = 0; }
}

export function separateCars(a, b, hooks = {}) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const d = Math.hypot(dx, dy);
  const minD = 40;
  if (d === 0 || d >= minD) return 0;
  const push = (minD - d) / 2, ux = dx / d, uy = dy / d;
  a.x -= ux * push; a.y -= uy * push;
  b.x += ux * push; b.y += uy * push;
  const closing = Math.abs(a.speed - b.speed) + Math.min(Math.abs(a.speed), Math.abs(b.speed)) * 0.4;
  if (closing > 42) {
    damageCar(a, closing * 0.05); damageCar(b, closing * 0.05);
    a.speed *= 0.55; b.speed *= 0.55;
    if (hooks.onCrash) hooks.onCrash(a, closing, b);
    return closing;
  }
  const avg = (a.speed + b.speed) / 2; a.speed = avg * 0.9; b.speed = avg * 0.9;
  return 0;
}

export function drawCar(ctx, car, isPlayerCar) {
  ctx.save(); ctx.translate(car.x, car.y); ctx.rotate(car.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.fillRect(-car.w / 2 + 3, -car.h / 2 + 5, car.w, car.h);
  ctx.fillStyle = car.wrecked ? '#3a3a3a' : car.color;
  ctx.beginPath(); ctx.roundRect(-car.w / 2, -car.h / 2, car.w, car.h, 6); ctx.fill();
  ctx.fillStyle = car.kind === 'police' ? '#111318' : 'rgba(20,30,40,0.85)';
  ctx.beginPath(); ctx.roundRect(-6, -car.h / 2 + 3, 17, car.h - 6, 4); ctx.fill();
  ctx.fillStyle = 'rgba(180,225,255,0.9)'; ctx.fillRect(9, -car.h / 2 + 4, 5, car.h - 8);
  ctx.fillStyle = '#22242a';
  for (const [wx, wy] of [[-15, -car.h / 2 - 2], [13, -car.h / 2 - 2], [-15, car.h / 2 - 2], [13, car.h / 2 - 2]]) ctx.fillRect(wx, wy, 10, 4);
  ctx.fillStyle = '#fff6bf'; ctx.fillRect(car.w / 2 - 3, -7, 3, 5); ctx.fillRect(car.w / 2 - 3, 2, 3, 5);
  ctx.fillStyle = '#ff5252'; ctx.fillRect(-car.w / 2, -7, 3, 5); ctx.fillRect(-car.w / 2, 2, 3, 5);
  if (car.kind === 'police') {
    ctx.fillStyle = '#f5f6fa'; ctx.fillRect(-14, -car.h / 2, 26, car.h);
    ctx.fillStyle = (Math.floor(performance.now() / 280) % 2 === 0) ? '#ff3838' : '#3867ff';
    ctx.fillRect(-3, -4, 8, 8);
    ctx.fillStyle = '#111'; ctx.font = 'bold 7px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('POLICE', 1, 2.5);
  }
  if (isPlayerCar) {
    ctx.fillStyle = '#ffe94a'; ctx.beginPath();
    ctx.moveTo(0, -car.h / 2 - 17); ctx.lineTo(-6, -car.h / 2 - 26); ctx.lineTo(6, -car.h / 2 - 26); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  if (car.health < 45 && !car.wrecked) {
    ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.fillRect(car.x - 16, car.y - 26, 32, 4);
    ctx.fillStyle = '#ff7043'; ctx.fillRect(car.x - 16, car.y - 26, 32 * (car.health / 100), 4);
  }
}
