// pedestrians.js - citizens who stroll the sidewalks and park paths, chat in
// pairs, and flee screaming (well, running) from gunfire, crashes and speeding cars.

import { VERTICAL_ROADS, HORIZONTAL_ROADS, ROAD_HALF, CITY_WIDTH, CITY_HEIGHT, buildingAt } from './city.js';
import { pickRandom, randRange, clamp } from './rng.js';

const SHIRTS = ['#ff7675', '#74b9ff', '#55efc4', '#ffeaa7', '#a29bfe', '#fd79a8', '#81ecec', '#fab1a0'];

function sidewalkPoint(rng) {
  const vertical = rng() < 0.5;
  if (vertical) {
    const road = pickRandom(rng, VERTICAL_ROADS);
    return { x: road + (rng() < 0.5 ? -1 : 1) * (ROAD_HALF + 7), y: randRange(rng, 50, CITY_HEIGHT - 50) };
  }
  const road = pickRandom(rng, HORIZONTAL_ROADS);
  return { x: randRange(rng, 50, CITY_WIDTH - 220), y: road + (rng() < 0.5 ? -1 : 1) * (ROAD_HALF + 7) };
}

export function createPedestrians(rng, count = 26) {
  const peds = [];
  for (let i = 0; i < count; i++) {
    const p = sidewalkPoint(rng);
    peds.push({
      x: p.x, y: p.y, angle: rng() * Math.PI * 2, speed: 0, walkSpeed: randRange(rng, 26, 44),
      target: sidewalkPoint(rng), shirt: pickRandom(rng, SHIRTS), skin: pickRandom(rng, ['#f1c27d', '#e0ac69', '#8d5524', '#ffdbac']),
      fleeTime: 0, down: 0, phase: rng() * 7,
    });
  }
  return peds;
}

export function scarePeds(peds, x, y, radius) {
  for (const ped of peds) {
    if (Math.hypot(ped.x - x, ped.y - y) < radius) ped.fleeTime = Math.max(ped.fleeTime, 2.6);
  }
}

export function updatePedestrians(peds, dt, city, danger, rng) {
  for (const ped of peds) {
    if (ped.down > 0) { ped.down -= dt; continue; }
    let speed = ped.walkSpeed;
    let tx = ped.target.x, ty = ped.target.y;
    const dangerDist = danger ? Math.hypot(ped.x - danger.x, ped.y - danger.y) : Infinity;
    if (danger && dangerDist < 130) ped.fleeTime = Math.max(ped.fleeTime, 0.7);
    if (ped.fleeTime > 0) {
      ped.fleeTime -= dt; speed = 118;
      if (danger) { tx = ped.x + (ped.x - danger.x); ty = ped.y + (ped.y - danger.y); }
    } else if (Math.hypot(tx - ped.x, ty - ped.y) < 14) {
      ped.target = sidewalkPoint(rng); tx = ped.target.x; ty = ped.target.y;
    }
    const want = Math.atan2(ty - ped.y, tx - ped.x);
    let diff = want - ped.angle;
    while (diff > Math.PI) diff -= Math.PI * 2; while (diff < -Math.PI) diff += Math.PI * 2;
    ped.angle += clamp(diff, -4.4 * dt, 4.4 * dt);
    const nx = ped.x + Math.cos(ped.angle) * speed * dt;
    const ny = ped.y + Math.sin(ped.angle) * speed * dt;
    if (!buildingAt(city, nx, ny, 4)) { ped.x = clamp(nx, 16, CITY_WIDTH - 14); ped.y = clamp(ny, 16, CITY_HEIGHT - 16); }
    else ped.target = sidewalkPoint(rng);
    ped.phase += dt * (ped.fleeTime > 0 ? 13 : 7);
  }
}

export function knockDownPed(ped) { ped.down = 5; ped.fleeTime = 0; }

export function drawPedestrian(ctx, ped, time) {
  const bob = ped.down > 0 ? 0 : Math.sin(ped.phase) * 1.6;
  ctx.save(); ctx.translate(ped.x, ped.y);
  ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.beginPath(); ctx.arc(1.5, 2.5, 7, 0, 7); ctx.fill();
  if (ped.down > 0) ctx.rotate(1.35);
  ctx.fillStyle = '#2d3436';
  ctx.fillRect(-5 + bob * 0.4, 2, 4, 6); ctx.fillRect(1 - bob * 0.4, 2, 4, 6);
  ctx.fillStyle = ped.shirt; ctx.beginPath(); ctx.arc(0, 0, 6.4, 0, 7); ctx.fill();
  ctx.fillStyle = ped.skin; ctx.beginPath(); ctx.arc(0, -1.5, 3.6, 0, 7); ctx.fill();
  ctx.restore();
  if (ped.fleeTime > 0.4 && ped.down <= 0) {
    ctx.fillStyle = '#fff'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('!', ped.x, ped.y - 14);
  }
  void time;
}
