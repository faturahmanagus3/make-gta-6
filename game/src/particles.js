// particles.js - short-lived visual effects: tire smoke, impact sparks,
// muzzle flashes, damage smoke, pickup sparkles and camera screen shake.

import { randRange } from './rng.js';

export function createParticles(rng) {
  return { list: [], rng, shake: 0, flashes: [] };
}

function push(fx, p) { if (fx.list.length < 420) fx.list.push(p); }

export function spawnTireSmoke(fx, x, y) {
  push(fx, { x, y, vx: randRange(fx.rng, -14, 14), vy: randRange(fx.rng, -14, 4), life: 0.7, age: 0, size: randRange(fx.rng, 5, 10), color: '200,200,200', grow: 16 });
}

export function spawnDamageSmoke(fx, x, y) {
  push(fx, { x, y, vx: randRange(fx.rng, -8, 8), vy: randRange(fx.rng, -26, -12), life: 1.1, age: 0, size: randRange(fx.rng, 6, 11), color: '70,70,70', grow: 12 });
}

export function spawnSparks(fx, x, y, count = 8) {
  for (let i = 0; i < count; i++) {
    const a = fx.rng() * Math.PI * 2, s = randRange(fx.rng, 60, 210);
    push(fx, { x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.32, age: 0, size: 2.4, color: '255,190,60', grow: -3, spark: true });
  }
}

export function spawnPickupBurst(fx, x, y) {
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    push(fx, { x, y, vx: Math.cos(a) * 70, vy: Math.sin(a) * 70, life: 0.5, age: 0, size: 3.4, color: '120,255,150', grow: -2, spark: true });
  }
}

export function spawnMuzzleFlash(fx, x, y, angle) {
  fx.flashes.push({ x, y, angle, age: 0, life: 0.06 });
}

export function addShake(fx, amount) { fx.shake = Math.min(16, fx.shake + amount); }

export function updateParticles(fx, dt) {
  for (const p of fx.list) { p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt; }
  fx.list = fx.list.filter((p) => p.age < p.life);
  for (const f of fx.flashes) f.age += dt;
  fx.flashes = fx.flashes.filter((f) => f.age < f.life);
  fx.shake = Math.max(0, fx.shake - dt * 26);
}

export function shakeOffset(fx) {
  if (fx.shake <= 0.2) return { x: 0, y: 0 };
  return { x: randRange(fx.rng, -fx.shake, fx.shake) * 0.5, y: randRange(fx.rng, -fx.shake, fx.shake) * 0.5 };
}

export function drawParticles(ctx, fx) {
  for (const p of fx.list) {
    const t = 1 - p.age / p.life;
    ctx.fillStyle = `rgba(${p.color},${(t * (p.spark ? 0.95 : 0.5)).toFixed(3)})`;
    const s = Math.max(0.6, p.size + p.grow * p.age);
    if (p.spark) ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
    else { ctx.beginPath(); ctx.arc(p.x, p.y, s, 0, 7); ctx.fill(); }
  }
  for (const f of fx.flashes) {
    ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.angle);
    ctx.fillStyle = 'rgba(255,220,120,0.95)';
    ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(26, 0); ctx.lineTo(0, 6); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
}

export function drawHeadlightCones(ctx, cars, darkness) {
  if (darkness <= 0.1) return;
  for (const car of cars) {
    if (car.wrecked) continue;
    const fx = Math.cos(car.angle), fy = Math.sin(car.angle);
    const px = -fy, py = fx;
    for (const side of [-9, 9]) {
      const ox = car.x + fx * 24 + px * side, oy = car.y + fy * 24 + py * side;
      const grad = ctx.createRadialGradient(ox, oy, 4, ox + fx * 70, oy + fy * 70, 95);
      grad.addColorStop(0, 'rgba(255,240,180,0.28)'); grad.addColorStop(1, 'rgba(255,240,180,0)');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.moveTo(ox, oy);
      ctx.lineTo(ox + fx * 110 + px * 30, oy + fy * 110 + py * 30);
      ctx.lineTo(ox + fx * 110 - px * 30, oy + fy * 110 - py * 30);
      ctx.closePath(); ctx.fill();
    }
  }
}
