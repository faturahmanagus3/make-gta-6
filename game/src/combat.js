// combat.js - mouse-aim shooting on foot: bullets, hits on pedestrians,
// cars and police, plus the damage the world does back to the player.

import { pointInCar } from './vehicles.js';

export function createCombat() {
  return { bullets: [], fireCooldown: 0, shotsFired: 0 };
}

export function tryShoot(combat, shooter, aimAngle, fx, audio, hooks = {}) {
  if (combat.fireCooldown > 0) return false;
  combat.fireCooldown = 0.17;
  combat.shotsFired++;
  const mx = shooter.x + Math.cos(aimAngle) * 15, my = shooter.y + Math.sin(aimAngle) * 15;
  combat.bullets.push({ x: mx, y: my, vx: Math.cos(aimAngle) * 880, vy: Math.sin(aimAngle) * 880, life: 0.55 });
  if (fx) { fx.flashes.push({ x: mx, y: my, angle: aimAngle, age: 0, life: 0.06 }); fx.shake = Math.min(16, fx.shake + 0.7); }
  if (audio) audio.gunshot && audio.gunshot();
  if (hooks.onShoot) hooks.onShoot(mx, my);
  return true;
}

export function updateCombat(combat, dt, world, hooks = {}) {
  combat.fireCooldown = Math.max(0, combat.fireCooldown - dt);
  const { peds, cars, city } = world;
  for (const b of combat.bullets) {
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    if (b.life <= 0) continue;
    if (city && world.buildingHit && world.buildingHit(b.x, b.y)) { b.life = 0; if (hooks.onSpark) hooks.onSpark(b.x, b.y); continue; }
    for (const ped of peds) {
      if (ped.down <= 0 && Math.hypot(ped.x - b.x, ped.y - b.y) < 10) {
        b.life = 0; if (hooks.onHitPed) hooks.onHitPed(ped, b); break;
      }
    }
    if (b.life <= 0) continue;
    for (const car of cars) {
      if (pointInCar(car, b.x, b.y, 2)) {
        b.life = 0; if (hooks.onHitCar) hooks.onHitCar(car, b); break;
      }
    }
  }
  combat.bullets = combat.bullets.filter((b) => b.life > 0);
}

export function drawBullets(ctx, combat) {
  ctx.strokeStyle = '#ffe082'; ctx.lineWidth = 2.4;
  for (const b of combat.bullets) {
    ctx.beginPath(); ctx.moveTo(b.x - b.vx * 0.012, b.y - b.vy * 0.012); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
}

export function drawPlayerOnFoot(ctx, player) {
  const aim = player.aimAngle || 0;
  ctx.save(); ctx.translate(player.x, player.y);
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.arc(2, 3, 8, 0, 7); ctx.fill();
  ctx.fillStyle = '#37474f'; ctx.fillRect(-5, 3, 4, 6); ctx.fillRect(1, 3, 4, 6);
  ctx.fillStyle = '#ff7043'; ctx.beginPath(); ctx.arc(0, 0, 7.4, 0, 7); ctx.fill();
  ctx.fillStyle = '#263238'; ctx.beginPath(); ctx.arc(0, -2, 4, 0, 7); ctx.fill();
  ctx.rotate(aim);
  ctx.fillStyle = '#212121'; ctx.fillRect(6, -1.6, 13, 3.2);
  ctx.restore();
  // aim reticle
  const rx = player.x + Math.cos(aim) * 44, ry = player.y + Math.sin(aim) * 44;
  ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.arc(rx, ry, 5, 0, 7); ctx.stroke();
}
