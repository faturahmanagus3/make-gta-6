// hud.js - everything readable at a glance: health and cash, wanted stars,
// the current mission objective, dialogue and banner lines, speed and hints.

import { currentObjective, MISSION_DEFS } from './missions.js';
import { drawMinimap, MINIMAP_H } from './minimap.js';

export function drawStars(ctx, level, x, y) {
  ctx.font = '26px sans-serif'; ctx.textAlign = 'right';
  for (let i = 0; i < 5; i++) {
    const flash = level > 0 && i < level && Math.floor(performance.now() / 420) % 2 === 0;
    ctx.fillStyle = i < level ? (flash ? '#ffffff' : '#ffd54f') : 'rgba(255,255,255,0.25)';
    ctx.fillText('★', x - (4 - i) * 28, y);
  }
}

export function drawHUD(ctx, state, viewW, viewH) {
  const { player, cash, wanted } = state;
  // top-left: health bar + cash + armour of the prose: name plate
  ctx.fillStyle = 'rgba(8,12,18,0.66)';
  ctx.beginPath(); ctx.roundRect(14, 12, 252, 64, 9); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'left';
  ctx.fillText('RIA VALE', 24, 32);
  ctx.fillStyle = '#263238'; ctx.fillRect(24, 40, 180, 13);
  ctx.fillStyle = player.health > 30 ? '#66bb6a' : '#ef5350';
  ctx.fillRect(24, 40, 180 * Math.max(0, player.health) / 100, 13);
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.strokeRect(24, 40, 180, 13);
  ctx.fillStyle = '#a5d6a7'; ctx.font = 'bold 17px sans-serif';
  ctx.fillText('$' + Math.floor(cash).toLocaleString('en-US'), 24, 70);
  ctx.fillStyle = '#cfd8dc'; ctx.font = '11px sans-serif';
  ctx.fillText(state.inCar ? `SPEED ${Math.round(Math.abs(state.inCar.speed) * 0.62)} mph` : 'ON FOOT', 128, 70);
  drawStars(ctx, wanted.level, viewW - 18, 38);
  if (state.muted) { ctx.fillStyle = '#fff'; ctx.font = '12px sans-serif'; ctx.textAlign = 'right'; ctx.fillText('MUTED (M)', viewW - 18, 58); }
  // objective panel, top centre
  const objective = currentObjective(state.missions);
  ctx.font = 'bold 14px sans-serif';
  const w = Math.min(560, ctx.measureText(objective).width + 34);
  ctx.fillStyle = 'rgba(8,12,18,0.66)';
  ctx.beginPath(); ctx.roundRect(viewW / 2 - w / 2, 12, w, 40, 9); ctx.fill();
  ctx.fillStyle = '#ffd54f'; ctx.textAlign = 'center';
  const def = MISSION_DEFS[state.missions.index];
  ctx.fillText(state.missions.done ? 'FREE ROAM' : (def ? def.title.toUpperCase() : ''), viewW / 2, 30);
  ctx.fillStyle = '#ffffff'; ctx.font = '13px sans-serif';
  ctx.fillText(objective, viewW / 2, 46);
  // minimap bottom-left
  drawMinimap(ctx, state, 18, viewH - MINIMAP_H - 18);
  // context hint bottom-right
  ctx.textAlign = 'right'; ctx.fillStyle = 'rgba(255,255,255,0.88)'; ctx.font = '13px sans-serif';
  ctx.fillText(state.hint || '', viewW - 16, viewH - 16);
  // banner (mission complete / failed)
  if (state.missions.bannerTime > 0 && state.missions.banner) {
    ctx.textAlign = 'center'; ctx.font = 'bold 30px sans-serif';
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillText(state.missions.banner, viewW / 2 + 2, 122);
    ctx.fillStyle = '#ffd54f'; ctx.fillText(state.missions.banner, viewW / 2, 120);
  }
  // dialogue line
  if (state.missions.dialogueTime > 0 && state.missions.dialogue.length) {
    const line = state.missions.dialogue[Math.min(state.missions.dialogue.length - 1, Math.floor((6.5 - state.missions.dialogueTime) / 3.2))];
    ctx.fillStyle = 'rgba(8,12,18,0.72)';
    ctx.beginPath(); ctx.roundRect(viewW / 2 - 300, viewH - 86, 600, 42, 9); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = '14px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(line, viewW / 2, viewH - 60);
  }
  if (state.nearCarPrompt) {
    ctx.textAlign = 'center'; ctx.font = 'bold 15px sans-serif'; ctx.fillStyle = '#fff';
    ctx.fillText('Press E to steal this car', viewW / 2, viewH - 104);
  }
}
