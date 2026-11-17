// missions.js - Ria Vale's story: four linked jobs across Sunfall City.
// 1) First Run: pick up a package in Palm Park, deliver it to the Old Port.
// 2) The Chase: hit three checkpoints across town while the PD is already up.
// 3) Lay Low: reach the beach hideout hot, then shake a three-star wanted.
// 4) The Final Score: grab three cash bags against the clock. Finale pays big.

export const MISSION_DEFS = [
  {
    title: 'Mission 1 - First Run', reward: 300,
    intro: ['Mara: Ria, package is waiting in Palm Park.', 'Grab it, then drop it at the Old Port depot. Easy money.'],
    steps: [
      { kind: 'reach', x: 640, y: 610, label: 'Pick up the package in Palm Park', radius: 34 },
      { kind: 'reach', x: 1000, y: 950, label: 'Deliver the package to the Old Port depot', radius: 38 },
    ],
  },
  {
    title: 'Mission 2 - The Chase', reward: 450, wanted: 2,
    intro: ['Mara: A rival crew just torched our drop car.', 'Hit every checkpoint so they know Sunfall is ours. The PD will notice.'],
    steps: [
      { kind: 'reach', x: 460, y: 440, label: 'Reach checkpoint 1 - Neon Mile crossing', radius: 40, needsCar: true },
      { kind: 'reach', x: 1180, y: 780, label: 'Reach checkpoint 2 - Harbor Heights', radius: 40, needsCar: true },
      { kind: 'reach', x: 820, y: 1120, label: 'Reach checkpoint 3 - south market', radius: 40, needsCar: true },
    ],
  },
  {
    title: 'Mission 3 - Lay Low', reward: 400, wanted: 3,
    intro: ['Mara: That run made you famous. Too famous.', 'Get to the Coral Beach hideout and lose the heat.'],
    steps: [
      { kind: 'reach', x: 1780, y: 300, label: 'Reach the Coral Beach hideout', radius: 46 },
      { kind: 'loseWanted', label: 'Stay hidden until the wanted level clears', radius: 90, x: 1780, y: 300 },
    ],
  },
  {
    title: 'Mission 4 - The Final Score', reward: 900, timeLimit: 105,
    intro: ['Mara: One last score, Ria. Three cash bags, one clock.', 'Bring them home and Sunfall is yours.'],
    steps: [
      { kind: 'reach', x: 280, y: 270, label: 'Grab cash bag 1 - Marina Flats', radius: 36 },
      { kind: 'reach', x: 1540, y: 1120, label: 'Grab cash bag 2 - Sunset Blocks', radius: 36 },
      { kind: 'reach', x: 640, y: 1460, label: 'Grab cash bag 3 - south pier road', radius: 36 },
    ],
  },
];

export function createMissionRunner(startIndex = 0) {
  return {
    index: startIndex, step: 0, active: startIndex < MISSION_DEFS.length,
    banner: '', bannerTime: 0, dialogue: [], dialogueTime: 0,
    timer: 0, done: startIndex >= MISSION_DEFS.length, failed: '',
    started: false,
  };
}

export function currentStep(runner) {
  if (!runner.active) return null;
  return MISSION_DEFS[runner.index].steps[runner.step] || null;
}

export function currentObjective(runner) {
  if (runner.done) return 'Story complete - free roam Sunfall City. Steal, race, explore.';
  if (!runner.active) return 'Free roam';
  const step = currentStep(runner);
  const def = MISSION_DEFS[runner.index];
  const time = def.timeLimit && runner.started ? `  (${Math.max(0, Math.ceil(runner.timer))}s)` : '';
  return step ? step.label + time : def.title;
}

export function startMission(runner, hooks = {}) {
  if (!runner.active) return;
  const def = MISSION_DEFS[runner.index];
  runner.step = 0; runner.started = true; runner.failed = '';
  runner.timer = def.timeLimit || 0;
  runner.dialogue = [...def.intro]; runner.dialogueTime = 6.5;
  runner.banner = def.title; runner.bannerTime = 3.2;
  if (def.wanted && hooks.setWanted) hooks.setWanted(def.wanted);
  if (hooks.onStart) hooks.onStart(def);
}

function completeMission(runner, hooks) {
  const def = MISSION_DEFS[runner.index];
  if (hooks.addCash) hooks.addCash(def.reward);
  if (hooks.onComplete) hooks.onComplete(def);
  runner.banner = `${def.title} complete  +$${def.reward}`;
  runner.bannerTime = 3.6;
  runner.index++; runner.step = 0; runner.started = false;
  if (runner.index >= MISSION_DEFS.length) { runner.done = true; runner.active = false; runner.banner = 'SUNFALL IS YOURS - story complete!'; }
  else startMission(runner, hooks);
}

// ctx: {x, y, inCar, wantedLevel, dt}. hooks: {addCash, setWanted, onPickup, onComplete, onFail, onStart}
export function updateMissions(runner, ctx, hooks = {}) {
  if (runner.bannerTime > 0) runner.bannerTime -= ctx.dt;
  if (runner.dialogueTime > 0) runner.dialogueTime -= ctx.dt;
  if (!runner.active || runner.done) return;
  if (!runner.started) { startMission(runner, hooks); return; }
  const def = MISSION_DEFS[runner.index];
  if (def.timeLimit) {
    runner.timer -= ctx.dt;
    if (runner.timer <= 0) {
      runner.failed = 'Out of time - the score slipped away.';
      runner.banner = 'MISSION FAILED - try again'; runner.bannerTime = 3;
      runner.started = false; runner.step = 0; runner.timer = def.timeLimit;
      if (hooks.onFail) hooks.onFail(def);
      return;
    }
  }
  const step = currentStep(runner);
  if (!step) { completeMission(runner, hooks); return; }
  if (step.kind === 'reach') {
    if (step.needsCar && !ctx.inCar) return;
    if (Math.hypot(ctx.x - step.x, ctx.y - step.y) < step.radius) {
      if (hooks.onPickup) hooks.onPickup(step);
      runner.step++;
      runner.banner = runner.step >= def.steps.length ? '' : 'Objective updated';
      if (runner.banner) runner.bannerTime = 1.6;
      if (runner.step >= def.steps.length) completeMission(runner, hooks);
    }
  } else if (step.kind === 'loseWanted') {
    const nearHideout = Math.hypot(ctx.x - step.x, ctx.y - step.y) < step.radius + 60;
    if (ctx.wantedLevel === 0 && nearHideout) completeMission(runner, hooks);
  }
}

export function drawMissionMarker(ctx, runner, time) {
  const step = currentStep(runner);
  if (!step || !runner.started) return;
  const bob = Math.sin(time * 3.2) * 7;
  ctx.save(); ctx.translate(step.x, step.y + bob);
  ctx.fillStyle = 'rgba(255,213,79,0.22)';
  ctx.beginPath(); ctx.arc(0, -bob, step.radius, 0, 7); ctx.fill();
  ctx.strokeStyle = '#ffd54f'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(0, -bob, step.radius, 0, 7); ctx.stroke();
  ctx.fillStyle = '#ffd54f';
  ctx.beginPath(); ctx.moveTo(0, 6); ctx.lineTo(-11, -14); ctx.lineTo(11, -14); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#263238'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('!', 0, -3);
  ctx.restore();
}
