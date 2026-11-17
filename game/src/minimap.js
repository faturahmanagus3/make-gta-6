// minimap.js - the live corner map: roads, beach, player arrow, police dots,
// traffic dots, pedestrian specks and the pulsing mission marker.

import { VERTICAL_ROADS, HORIZONTAL_ROADS, CITY_WIDTH, CITY_HEIGHT, BEACH_X } from './city.js';
import { currentStep } from './missions.js';

export const MINIMAP_W = 196;
export const MINIMAP_H = 156;

export function drawMinimap(ctx, state, x, y) {
  const sx = MINIMAP_W / CITY_WIDTH, sy = MINIMAP_H / CITY_HEIGHT;
  ctx.save();
  ctx.fillStyle = 'rgba(10,16,22,0.78)';
  ctx.beginPath(); ctx.roundRect(x - 6, y - 6, MINIMAP_W + 12, MINIMAP_H + 12, 10); ctx.fill();
  ctx.fillStyle = '#4c7a45'; ctx.fillRect(x, y, MINIMAP_W, MINIMAP_H);
  ctx.fillStyle = '#eed9a4'; ctx.fillRect(x + BEACH_X * sx, y, (CITY_WIDTH - BEACH_X) * sx, MINIMAP_H);
  ctx.fillStyle = '#3d9dbd'; ctx.fillRect(x + (CITY_WIDTH - 78) * sx, y, 78 * sx, MINIMAP_H);
  ctx.strokeStyle = '#596068'; ctx.lineWidth = 3;
  for (const rx of VERTICAL_ROADS) { ctx.beginPath(); ctx.moveTo(x + rx * sx, y); ctx.lineTo(x + rx * sx, y + MINIMAP_H); ctx.stroke(); }
  for (const ry of HORIZONTAL_ROADS) { ctx.beginPath(); ctx.moveTo(x, y + ry * sy); ctx.lineTo(x + MINIMAP_W, y + ry * sy); ctx.stroke(); }
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  for (const ped of state.peds) ctx.fillRect(x + ped.x * sx - 1, y + ped.y * sy - 1, 2, 2);
  ctx.fillStyle = '#ffd54f';
  for (const car of state.traffic) ctx.fillRect(x + car.x * sx - 2, y + car.y * sy - 2, 4, 4);
  const blink = Math.floor(state.time * 2.4) % 2 === 0;
  ctx.fillStyle = blink ? '#ff3838' : '#3867ff';
  for (const car of state.police.cars) { ctx.beginPath(); ctx.arc(x + car.x * sx, y + car.y * sy, 3.4, 0, 7); ctx.fill(); }
  const step = currentStep(state.missions);
  if (step && state.missions.started) {
    ctx.strokeStyle = '#ffd54f'; ctx.lineWidth = 2;
    const r = 5 + Math.sin(state.time * 4) * 1.6;
    ctx.beginPath(); ctx.arc(x + step.x * sx, y + step.y * sy, r, 0, 7); ctx.stroke();
    ctx.fillStyle = '#ffd54f'; ctx.beginPath(); ctx.arc(x + step.x * sx, y + step.y * sy, 2.4, 0, 7); ctx.fill();
  }
  const px = x + state.focus.x * sx, py = y + state.focus.y * sy;
  ctx.save(); ctx.translate(px, py); ctx.rotate(state.focus.angle || 0);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(-5, -4.6); ctx.lineTo(-5, 4.6); ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'left';
  ctx.fillText(state.district.toUpperCase(), x + 2, y + MINIMAP_H + -3 + 6);
  ctx.restore();
}
