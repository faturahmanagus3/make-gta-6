// main.js - Neon Harbor: Sunfall City. A top-down open-world crime game.
// Ria Vale, a wheelwoman down on her luck, takes four jobs from fixer Mara Venn
// across a sun-soaked coastal city: steal cars, outrun the Sunfall PD, deliver
// packages and grab the final score. This file owns the loop, the player, the
// camera and the screens; every system lives in its own module beside it.

import { mulberry32, clamp, distance } from './rng.js';
import { createCity, drawCity, drawDayOverlay, districtAt, resolveBuildingCollision, dayTint, buildingAt, CITY_WIDTH, CITY_HEIGHT } from './city.js';
import { updateCarPhysics, drawCar, separateCars, damageCar, pointInCar } from './vehicles.js';
import { createTraffic, updateTraffic } from './traffic.js';
import { createPedestrians, updatePedestrians, drawPedestrian, scarePeds, knockDownPed } from './pedestrians.js';
import { createWanted, addCrime, forceWanted, updateWanted, createPoliceFleet, updatePolice, playerSpottedBy } from './police.js';
import { createCombat, tryShoot, drawBullets, drawPlayerOnFoot } from './combat.js';
import { createMissionRunner, updateMissions, drawMissionMarker } from './missions.js';
import { createParticles, spawnTireSmoke, spawnDamageSmoke, spawnSparks, spawnPickupBurst, addShake, updateParticles, drawParticles, shakeOffset, drawHeadlightCones } from './particles.js';
import { createAudio, ensureAudio, playGunshot, playPickup, playCash, playCrash, playUiClick, playWasted, playMissionDone, updateAudio, toggleMute } from './audio.js';
import { loadSave, writeSave } from './savegame.js';
import { drawHUD } from './hud.js';
import { stageShot, readShotRequest } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
let viewW = 1280, viewH = 720;

function resizeCanvas() {
  viewW = window.innerWidth; viewH = window.innerHeight;
  canvas.width = viewW; canvas.height = viewH;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

const shotRequest = readShotRequest(window.location.search);
const seed = shotRequest.seed;
const rng = mulberry32(seed);

const state = {
  mode: 'title', time: 0, seed,
  city: createCity(seed), rng,
  fx: createParticles(mulberry32(seed + 99)),
  audio: createAudio(), muted: false,
  player: { x: 560, y: 560, angle: 0.6, aimAngle: 0.6, health: 100, walkPhase: 0 },
  inCar: null, cash: 120, district: 'Palm District',
  traffic: [], peds: [], police: createPoliceFleet(), wanted: createWanted(),
  combat: createCombat(), missions: createMissionRunner(0),
  cam: { x: 0, y: 0 }, hint: '', nearCarPrompt: false, focus: { x: 560, y: 560, angle: 0 },
  buttons: [], wastedTimer: 0, saveLoaded: false, ramCooldown: 0,
};
state.traffic = createTraffic(state.city, mulberry32(seed + 7), 14);
state.peds = createPedestrians(mulberry32(seed + 21), 26);

const keys = new Set();
const mouse = { x: 640, y: 360, down: false };
let mouseWorld = { x: 0, y: 0 };

function saveNow() {
  writeSave({ cash: state.cash, missionIndex: state.missions.index, missionsDone: state.missions.index });
}

const missionHooks = {
  addCash(amount) { state.cash += amount; playCash(state.audio); saveNow(); },
  setWanted(level) { forceWanted(state.wanted, level); },
  onPickup(step) { playPickup(state.audio); spawnPickupBurst(state.fx, step.x, step.y); },
  onComplete() { playMissionDone(state.audio); },
  onFail() { playWasted(state.audio); },
};

function allCars() { return [...state.traffic, ...state.police.cars]; }

function nearestCar(x, y, maxDist) {
  let best = null, bestD = maxDist;
  for (const car of allCars()) {
    if (car.wrecked) continue;
    const d = distance(x, y, car.x, car.y);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

function enterCar(car) {
  const wasTraffic = car.driver === 'traffic';
  const wasPolice = car.kind === 'police';
  car.driver = 'player';
  state.inCar = car;
  state.player.x = car.x; state.player.y = car.y;
  if (wasTraffic || wasPolice) {
    addCrime(state.wanted, 'theft');
    state.peds.push({ x: car.x + 20, y: car.y + 14, angle: 2.4, speed: 0, walkSpeed: 40, target: { x: car.x + 160, y: car.y + 120 }, shirt: '#ffeaa7', skin: '#f1c27d', fleeTime: 3, down: 0, phase: 0 });
    scarePeds(state.peds, car.x, car.y, 90);
  }
  playUiClick(state.audio);
}

function exitCar() {
  const car = state.inCar;
  if (!car) return;
  car.driver = null; car.speed = 0;
  state.inCar = null;
  state.player.x = car.x - Math.sin(car.angle) * 26;
  state.player.y = car.y + Math.cos(car.angle) * 26;
  resolveBuildingCollision(state.city, state.player, 9);
}

function tryEnterExit() {
  if (state.inCar) { exitCar(); return; }
  const car = nearestCar(state.player.x, state.player.y, 52);
  if (car) enterCar(car);
}

function respawn() {
  state.player.health = 100;
  state.player.x = 300; state.player.y = 300;
  state.inCar = null;
  state.wanted.level = 0; state.wanted.heat = 0;
  state.police.cars = [];
  state.cash = Math.max(0, Math.floor(state.cash * 0.9));
  state.mode = 'playing';
  saveNow();
}

function startGame(useSave) {
  ensureAudio(state.audio);
  playUiClick(state.audio);
  if (useSave) {
    const save = loadSave();
    if (save) {
      state.cash = save.cash;
      state.missions = createMissionRunner(Math.min(4, save.missionIndex));
      state.saveLoaded = true;
    }
  }
  state.mode = 'playing';
  statusEl.textContent = 'Neon Harbor started. Follow the gold marker.';
}

window.addEventListener('keydown', (e) => {
  ensureAudio(state.audio);
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  keys.add(e.code);
  if (e.code === 'KeyM') { state.muted = toggleMute(state.audio); return; }
  if (state.mode === 'title' && e.code === 'KeyC' && loadSave() !== null) { startGame(true); return; }
  if (state.mode === 'title' && (e.code === 'Enter' || e.code === 'Space')) { startGame(false); return; }
  if (state.mode === 'wasted' && e.code === 'Enter') { respawn(); return; }
  if ((e.code === 'KeyP' || e.code === 'Escape') && (state.mode === 'playing' || state.mode === 'paused')) {
    state.mode = state.mode === 'playing' ? 'paused' : 'playing'; return;
  }
  if (state.mode !== 'playing') return;
  if (e.code === 'KeyE') tryEnterExit();
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
canvas.addEventListener('mousemove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; });
canvas.addEventListener('mousedown', (e) => {
  ensureAudio(state.audio);
  mouse.down = true;
  if (state.mode === 'title') {
    for (const b of state.buttons) {
      if (e.clientX >= b.x && e.clientX <= b.x + b.w && e.clientY >= b.y && e.clientY <= b.y + b.h) { startGame(b.continueRun); return; }
    }
  } else if (state.mode === 'wasted' && state.wastedTimer > 0.4) respawn();
});
window.addEventListener('mouseup', () => { mouse.down = false; });

function playerCrashHook(car, impact) {
  addShake(state.fx, Math.min(10, impact * 0.05));
  playCrash(state.audio);
  spawnSparks(state.fx, car.x, car.y, 9);
  if (car === state.inCar && impact > 90) addCrime(state.wanted, 'collision');
}

function updatePlayer(dt) {
  const p = state.player;
  if (state.inCar) {
    const car = state.inCar;
    const input = {
      throttle: (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) + (keys.has('KeyS') || keys.has('ArrowDown') ? -1 : 0),
      steer: (keys.has('KeyA') || keys.has('ArrowLeft') ? -1 : 0) + (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0),
      handbrake: keys.has('Space'),
    };
    updateCarPhysics(car, input, dt, state.city, state.fx, { onCrash: playerCrashHook });
    p.x = car.x; p.y = car.y; p.angle = car.angle;
    if (Math.abs(car.speed) > 120 && input.steer !== 0) spawnTireSmoke(state.fx, car.x - Math.cos(car.angle) * 20, car.y - Math.sin(car.angle) * 20);
    if (car.health < 38 && !car.wrecked) spawnDamageSmoke(state.fx, car.x + Math.cos(car.angle) * 16, car.y + Math.sin(car.angle) * 16);
    if (car.wrecked) { exitCar(); p.health -= 8; }
    state.hint = 'E exit car - SPACE handbrake - P pause - M mute';
    state.nearCarPrompt = false;
    return;
  }
  const mx = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
  const my = (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0);
  const len = Math.hypot(mx, my) || 1;
  const speed = keys.has('ShiftLeft') || keys.has('ShiftRight') ? 238 : 158;
  if (mx || my) {
    p.x += (mx / len) * speed * dt; p.y += (my / len) * speed * dt;
    p.x = clamp(p.x, 14, CITY_WIDTH - 12); p.y = clamp(p.y, 14, CITY_HEIGHT - 14);
    resolveBuildingCollision(state.city, p, 9);
    p.walkPhase += dt * 10;
    p.angle = Math.atan2(my, mx);
  }
  p.aimAngle = Math.atan2(mouseWorld.y - p.y, mouseWorld.x - p.x);
  const near = nearestCar(p.x, p.y, 52);
  state.nearCarPrompt = !!near;
  state.hint = near ? '' : 'WASD move - SHIFT run - CLICK shoot - E steal car - P pause';
  if (mouse.down) {
    tryShoot(state.combat, p, p.aimAngle, state.fx, null, {
      onShoot() { playGunshot(state.audio); scarePeds(state.peds, p.x, p.y, 190); addCrime(state.wanted, 'shooting'); },
    });
  }
}

// Bullets fly, and every hit lands its crime in exactly one place: here.
function updateBullets(dt) {
  state.combat.fireCooldown = Math.max(0, state.combat.fireCooldown - dt);
  for (const b of state.combat.bullets) {
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    if (b.life <= 0) continue;
    if (buildingAt(state.city, b.x, b.y, 0)) { b.life = 0; spawnSparks(state.fx, b.x, b.y, 3); continue; }
    let consumed = false;
    for (const ped of state.peds) {
      if (ped.down <= 0 && Math.hypot(ped.x - b.x, ped.y - b.y) < 10) {
        knockDownPed(ped); scarePeds(state.peds, ped.x, ped.y, 130); addCrime(state.wanted, 'assault');
        consumed = true; break;
      }
    }
    if (consumed) { b.life = 0; continue; }
    for (const car of allCars()) {
      if (car !== state.inCar && pointInCar(car, b.x, b.y, 2)) {
        damageCar(car, 13); spawnSparks(state.fx, b.x, b.y, 6);
        addCrime(state.wanted, car.kind === 'police' ? 'shotCop' : 'shotCar');
        b.life = 0; break;
      }
    }
  }
  state.combat.bullets = state.combat.bullets.filter((b) => b.life > 0);
}

function updateWorld(dt) {
  state.city.dayTime = (state.city.dayTime + dt / 260) % 1;
  updatePlayer(dt);
  const focusEntity = state.inCar || state.player;
  const danger = state.wanted.level > 0
    ? { x: state.player.x, y: state.player.y }
    : (state.inCar && Math.abs(state.inCar.speed) > 195 ? { x: state.inCar.x, y: state.inCar.y } : null);
  updateTraffic(state.traffic, dt, state.city, state.fx, allCars(), state.inCar, state.inCar ? null : state.player, state.rng, {
    onCrash(car, impact) { if (impact > 80) spawnSparks(state.fx, car.x, car.y, 6); },
  });
  const ramHook = {
    onRam() {
      if (state.ramCooldown > 0) return;
      state.ramCooldown = 0.8;
      if (state.inCar) { damageCar(state.inCar, 5); addShake(state.fx, 5); playCrash(state.audio); }
      else { state.player.health -= 7; addShake(state.fx, 6); }
    },
  };
  const sees = updatePolice(state.police, dt, state.city, state.fx, state.wanted, focusEntity, ramHook);
  updateWanted(state.wanted, dt, sees || playerSpottedBy(state.police, focusEntity));
  state.ramCooldown = Math.max(0, state.ramCooldown - dt);
  updatePedestrians(state.peds, dt, state.city, danger, state.rng);
  const cars = allCars();
  for (let i = 0; i < cars.length; i++) for (let j = i + 1; j < cars.length; j++) {
    separateCars(cars[i], cars[j], {
      onCrash(a, closing) {
        spawnSparks(state.fx, a.x, a.y, 7);
        if (a === state.inCar || cars[j] === state.inCar) {
          playCrash(state.audio); addShake(state.fx, 6);
          if (closing > 90) addCrime(state.wanted, 'collision');
        }
      },
    });
  }
  for (const car of cars) {
    if (Math.abs(car.speed) < 55) continue;
    for (const ped of state.peds) {
      if (ped.down <= 0 && Math.hypot(ped.x - car.x, ped.y - car.y) < 24) {
        knockDownPed(ped); spawnSparks(state.fx, ped.x, ped.y, 5);
        if (car === state.inCar) addCrime(state.wanted, 'hitPed');
      }
    }
    if (!state.inCar && car.driver && Math.hypot(state.player.x - car.x, state.player.y - car.y) < 23) {
      state.player.health -= 55 * dt; addShake(state.fx, 3);
    }
  }
  updateBullets(dt);
  updateMissions(state.missions, { x: focusEntity.x, y: focusEntity.y, inCar: !!state.inCar, wantedLevel: state.wanted.level, dt }, missionHooks);
  if (state.player.health < 100 && state.wanted.level === 0) state.player.health = Math.min(100, state.player.health + dt * 2.4);
  if (state.player.health <= 0 && state.mode === 'playing') {
    state.mode = 'wasted'; state.wastedTimer = 0; playWasted(state.audio); saveNow();
  }
  updateParticles(state.fx, dt);
  updateAudio(state.audio, { driving: !!state.inCar, speedRatio: state.inCar ? Math.abs(state.inCar.speed) / 300 : 0, wanted: state.wanted.level, dt });
  state.district = districtAt(focusEntity.x, focusEntity.y);
  state.focus = { x: focusEntity.x, y: focusEntity.y, angle: focusEntity.angle || 0 };
}

function updateCamera(dt) {
  const f = state.focus;
  const look = state.inCar ? { x: Math.cos(f.angle) * Math.abs(state.inCar.speed) * 0.34, y: Math.sin(f.angle) * Math.abs(state.inCar.speed) * 0.34 } : { x: 0, y: 0 };
  const tx = clamp(f.x + look.x - viewW / 2, 0, Math.max(0, CITY_WIDTH - viewW));
  const ty = clamp(f.y + look.y - viewH / 2, 0, Math.max(0, CITY_HEIGHT - viewH));
  const k = Math.min(1, dt * 5.5);
  state.cam.x += (tx - state.cam.x) * k; state.cam.y += (ty - state.cam.y) * k;
  mouseWorld = { x: mouse.x + state.cam.x, y: mouse.y + state.cam.y };
}

function drawWorld() {
  const shake = shakeOffset(state.fx);
  ctx.save();
  ctx.translate(-state.cam.x + shake.x, -state.cam.y + shake.y);
  drawCity(ctx, state.city, state.cam, viewW, viewH);
  drawMissionMarker(ctx, state.missions, state.time);
  for (const ped of state.peds) {
    if (ped.x < state.cam.x - 40 || ped.x > state.cam.x + viewW + 40 || ped.y < state.cam.y - 40 || ped.y > state.cam.y + viewH + 40) continue;
    drawPedestrian(ctx, ped, state.time);
  }
  const tint = dayTint(state.city);
  drawHeadlightCones(ctx, allCars(), tint.darkness);
  for (const car of allCars()) drawCar(ctx, car, car === state.inCar);
  if (!state.inCar) drawPlayerOnFoot(ctx, state.player);
  drawBullets(ctx, state.combat);
  drawParticles(ctx, state.fx);
  ctx.restore();
  drawDayOverlay(ctx, state.city, viewW, viewH);
}

function drawTitle() {
  state.cam.x = clamp(500 + Math.sin(state.time * 0.07) * 260, 0, Math.max(0, CITY_WIDTH - viewW));
  state.cam.y = clamp(420 + Math.cos(state.time * 0.05) * 160, 0, Math.max(0, CITY_HEIGHT - viewH));
  ctx.save(); ctx.translate(-state.cam.x, -state.cam.y);
  drawCity(ctx, state.city, state.cam, viewW, viewH);
  for (const car of state.traffic.slice(0, 8)) drawCar(ctx, car, false);
  ctx.restore();
  ctx.fillStyle = 'rgba(10,10,26,0.55)'; ctx.fillRect(0, 0, viewW, viewH);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff4fa3'; ctx.font = 'bold 74px sans-serif';
  ctx.fillText('NEON HARBOR', viewW / 2, 168);
  ctx.fillStyle = '#ffd54f'; ctx.font = 'bold 25px sans-serif';
  ctx.fillText('S U N F A L L   C I T Y', viewW / 2, 208);
  ctx.fillStyle = '#ffffff'; ctx.font = '16px sans-serif';
  ctx.fillText('Ria Vale owes the wrong people. Four jobs for fixer Mara Venn stand between', viewW / 2, 258);
  ctx.fillText('her and a clean slate: run packages, shame a rival crew, lose the heat,', viewW / 2, 280);
  ctx.fillText('and grab the final score - in a city that never stops moving.', viewW / 2, 302);
  ctx.font = '14px sans-serif'; ctx.fillStyle = '#cfd8dc';
  ctx.fillText('WASD / arrows drive and walk - E steal or exit a car - mouse aim, click to shoot', viewW / 2, 348);
  ctx.fillText('SHIFT run - SPACE handbrake - P pause - M mute - follow the gold marker', viewW / 2, 370);
  const save = loadSave();
  state.buttons = [];
  const bw = 300, bh = 52, bx = viewW / 2 - bw / 2;
  let by = 412;
  ctx.fillStyle = '#ff4fa3'; ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 10); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 20px sans-serif';
  ctx.fillText(save ? 'NEW RUN' : 'START RUN', viewW / 2, by + 33);
  state.buttons.push({ x: bx, y: by, w: bw, h: bh, continueRun: false });
  if (save) {
    by += 66;
    ctx.fillStyle = '#26a69a'; ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 10); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 16px sans-serif';
    ctx.fillText(`CONTINUE - $${Math.floor(save.cash)} - JOB ${Math.min(4, save.missionIndex + 1)} OF 4`, viewW / 2, by + 33);
    state.buttons.push({ x: bx, y: by, w: bw, h: bh, continueRun: true });
  }
  ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.font = '13px sans-serif';
  ctx.fillText('An original top-down open-world crime game. Every car can be stolen. Every star must be earned.', viewW / 2, viewH - 34);
}

function drawPaused() {
  drawWorld(); drawHUD(ctx, state, viewW, viewH);
  ctx.fillStyle = 'rgba(8,8,20,0.62)'; ctx.fillRect(0, 0, viewW, viewH);
  ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.font = 'bold 44px sans-serif';
  ctx.fillText('PAUSED', viewW / 2, viewH / 2 - 12);
  ctx.font = '16px sans-serif'; ctx.fillText('Press P to keep driving', viewW / 2, viewH / 2 + 26);
}

function drawWasted() {
  drawWorld();
  ctx.fillStyle = 'rgba(120,0,0,0.42)'; ctx.fillRect(0, 0, viewW, viewH);
  ctx.textAlign = 'center'; ctx.fillStyle = '#ff5252'; ctx.font = 'bold 76px sans-serif';
  ctx.fillText('WASTED', viewW / 2, viewH / 2 - 10);
  ctx.fillStyle = '#fff'; ctx.font = '17px sans-serif';
  ctx.fillText('Sunfall General patched Ria up - for 10 percent of her cash.', viewW / 2, viewH / 2 + 30);
  ctx.fillText('Click or press Enter to respawn', viewW / 2, viewH / 2 + 58);
}

let lastNow = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - lastNow) / 1000 || 0.016);
  lastNow = now;
  state.time += dt;
  if (state.mode === 'playing') { updateWorld(dt); updateCamera(dt); }
  else if (state.mode === 'title') updateParticles(state.fx, dt);
  else updateCamera(dt);
  if (state.mode === 'title') drawTitle();
  else if (state.mode === 'paused') drawPaused();
  else if (state.mode === 'wasted') { state.wastedTimer += dt; drawWasted(); }
  else { drawWorld(); drawHUD(ctx, state, viewW, viewH); }
  requestAnimationFrame(frame);
}

if (shotRequest.shot) stageShot(state, shotRequest.shot);
window.__neonHarbor = state;
window.__shotReady = true;
requestAnimationFrame(frame);
