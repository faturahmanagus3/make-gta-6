// city.js - the procedural city of Sunfall: a road grid with named districts,
// collidable buildings, sidewalks, streetlights, parks and a beach waterfront.
// Also paints the whole ground layer and applies the day-cycle tint.

import { mulberry32, pickRandom, randInt, randRange } from './rng.js';

export const ROAD_HALF = 48;
export const VERTICAL_ROADS = [100, 460, 820, 1180, 1540, 1900];
export const HORIZONTAL_ROADS = [100, 440, 780, 1120, 1460];
export const CITY_WIDTH = 2040;
export const CITY_HEIGHT = 1620;
export const BEACH_X = 1860;

const BUILDING_COLORS = ['#e8b4a0', '#d9e2ec', '#f2d492', '#a8c3cf', '#e6ccb2', '#c9ada7', '#9db4c0', '#f4e1c1'];
const DISTRICTS = [
  { name: 'Marina Flats', x: 280, y: 270 }, { name: 'Palm District', x: 1000, y: 270 },
  { name: 'Neon Mile', x: 280, y: 950 }, { name: 'Old Port', x: 1000, y: 950 },
  { name: 'Harbor Heights', x: 640, y: 610 }, { name: 'Sunset Blocks', x: 1700, y: 610 },
];
const PARK_BLOCKS = new Set(['1,1', '3,2']);

export function createCity(seed = 7) {
  const rng = mulberry32(seed * 977 + 13);
  const buildings = [];
  const trees = [];
  const lights = [];
  for (let bx = 0; bx < VERTICAL_ROADS.length - 1; bx++) {
    for (let by = 0; by < HORIZONTAL_ROADS.length - 1; by++) {
      const x0 = VERTICAL_ROADS[bx] + ROAD_HALF + 14;
      const y0 = HORIZONTAL_ROADS[by] + ROAD_HALF + 14;
      const x1 = VERTICAL_ROADS[bx + 1] - ROAD_HALF - 14;
      const y1 = HORIZONTAL_ROADS[by + 1] - ROAD_HALF - 14;
      if (PARK_BLOCKS.has(bx + ',' + by)) {
        for (let t = 0; t < 9; t++) trees.push({ x: randRange(rng, x0 + 20, x1 - 20), y: randRange(rng, y0 + 20, y1 - 20), r: randRange(rng, 13, 22) });
        continue;
      }
      const cols = 2, rows = 2;
      for (let cx = 0; cx < cols; cx++) for (let cy = 0; cy < rows; cy++) {
        const w = (x1 - x0) / cols - 16, h = (y1 - y0) / rows - 16;
        buildings.push({
          x: x0 + cx * ((x1 - x0) / cols) + 8, y: y0 + cy * ((y1 - y0) / rows) + 8, w, h,
          color: pickRandom(rng, BUILDING_COLORS), roof: pickRandom(rng, ['#8d6e63', '#78909c', '#a1887f', '#607d8b']),
          floors: randInt(rng, 2, 9), neon: rng() < 0.22,
        });
      }
    }
  }
  for (const x of VERTICAL_ROADS) for (let y = 70; y < CITY_HEIGHT - 40; y += 130) lights.push({ x: x + ROAD_HALF + 6, y });
  for (const y of HORIZONTAL_ROADS) for (let x = 70; x < BEACH_X - 40; x += 150) lights.push({ x, y: y + ROAD_HALF + 6 });
  return { buildings, trees, lights, width: CITY_WIDTH, height: CITY_HEIGHT, dayTime: 0.32 };
}

export function isOnRoad(x, y) {
  if (VERTICAL_ROADS.some((rx) => Math.abs(x - rx) < ROAD_HALF)) return true;
  return HORIZONTAL_ROADS.some((ry) => Math.abs(y - ry) < ROAD_HALF);
}

export function buildingAt(city, x, y, pad = 0) {
  for (const b of city.buildings) {
    if (x > b.x - pad && x < b.x + b.w + pad && y > b.y - pad && y < b.y + b.h + pad) return b;
  }
  return null;
}

export function resolveBuildingCollision(city, pos, radius) {
  const b = buildingAt(city, pos.x, pos.y, radius * 0.6);
  if (!b) return false;
  const left = pos.x - (b.x - radius * 0.6), right = (b.x + b.w + radius * 0.6) - pos.x;
  const top = pos.y - (b.y - radius * 0.6), bottom = (b.y + b.h + radius * 0.6) - pos.y;
  const min = Math.min(left, right, top, bottom);
  if (min === left) pos.x = b.x - radius * 0.6; else if (min === right) pos.x = b.x + b.w + radius * 0.6;
  else if (min === top) pos.y = b.y - radius * 0.6; else pos.y = b.y + b.h + radius * 0.6;
  return true;
}

export function districtAt(x, y) {
  let best = DISTRICTS[0], bestD = Infinity;
  for (const d of DISTRICTS) { const dd = (d.x - x) ** 2 + (d.y - y) ** 2; if (dd < bestD) { bestD = dd; best = d; } }
  return x > BEACH_X - 40 ? 'Coral Beach' : best.name;
}

export function dayTint(city) {
  const t = city.dayTime % 1;
  const daylight = Math.max(0, Math.sin(t * Math.PI * 2 - 0.4));
  return { darkness: 0.38 * (1 - daylight), dusk: Math.abs(t - 0.52) < 0.09 || Math.abs(t - 0.02) < 0.07, daylight };
}

export function drawCity(ctx, city, cam, viewW, viewH) {
  const x0 = cam.x - 60, y0 = cam.y - 60, x1 = cam.x + viewW + 60, y1 = cam.y + viewH + 60;
  ctx.fillStyle = '#79a86b'; ctx.fillRect(cam.x - 60, cam.y - 60, viewW + 120, viewH + 120);
  // beach sand and water on the east edge
  ctx.fillStyle = '#eed9a4'; ctx.fillRect(BEACH_X, 0, city.width - BEACH_X, city.height);
  ctx.fillStyle = '#3d9dbd'; ctx.fillRect(city.width - 78, 0, 78, city.height);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  for (let y = 30; y < city.height; y += 90) ctx.fillRect(city.width - 82, y, 5, 34);
  // sidewalks then roads
  ctx.fillStyle = '#c9c2b4';
  for (const x of VERTICAL_ROADS) ctx.fillRect(x - ROAD_HALF - 10, 0, (ROAD_HALF + 10) * 2, city.height);
  for (const y of HORIZONTAL_ROADS) ctx.fillRect(0, y - ROAD_HALF - 10, BEACH_X + 60, (ROAD_HALF + 10) * 2);
  ctx.fillStyle = '#3c4148';
  for (const x of VERTICAL_ROADS) ctx.fillRect(x - ROAD_HALF, 0, ROAD_HALF * 2, city.height);
  for (const y of HORIZONTAL_ROADS) ctx.fillRect(0, y - ROAD_HALF, BEACH_X + 60, ROAD_HALF * 2);
  ctx.strokeStyle = '#f5d76e'; ctx.lineWidth = 3; ctx.setLineDash([22, 18]);
  for (const x of VERTICAL_ROADS) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, city.height); ctx.stroke(); }
  for (const y of HORIZONTAL_ROADS) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(BEACH_X + 60, y); ctx.stroke(); }
  ctx.setLineDash([]);
  // parks
  ctx.fillStyle = '#5f9e52';
  for (const key of PARK_BLOCKS) {
    const [bx, by] = key.split(',').map(Number);
    ctx.fillRect(VERTICAL_ROADS[bx] + ROAD_HALF + 8, HORIZONTAL_ROADS[by] + ROAD_HALF + 8,
      VERTICAL_ROADS[bx + 1] - VERTICAL_ROADS[bx] - ROAD_HALF * 2 - 16, HORIZONTAL_ROADS[by + 1] - HORIZONTAL_ROADS[by] - ROAD_HALF * 2 - 16);
  }
  for (const b of city.buildings) {
    if (b.x + b.w < x0 || b.x > x1 || b.y + b.h < y0 || b.y > y1) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.fillRect(b.x + 6, b.y + 8, b.w, b.h);
    ctx.fillStyle = b.roof; ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.color; ctx.fillRect(b.x + 5, b.y + 5, b.w - 10, b.h - 10);
    ctx.fillStyle = 'rgba(255,255,210,0.5)';
    const step = 16;
    for (let wx = b.x + 11; wx < b.x + b.w - 12; wx += step) for (let wy = b.y + 11; wy < b.y + b.h - 12; wy += step) ctx.fillRect(wx, wy, 6, 6);
    if (b.neon) { ctx.fillStyle = '#ff4fa3'; ctx.fillRect(b.x + 8, b.y + b.h / 2 - 3, b.w - 16, 6); }
  }
  for (const t of city.trees) {
    ctx.fillStyle = '#2e6b34'; ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, 7); ctx.fill();
    ctx.fillStyle = '#43a047'; ctx.beginPath(); ctx.arc(t.x - 3, t.y - 3, t.r * 0.62, 0, 7); ctx.fill();
  }
  const tint = dayTint(city);
  for (const l of city.lights) {
    if (l.x < x0 || l.x > x1 || l.y < y0 || l.y > y1) continue;
    ctx.fillStyle = '#546e7a'; ctx.fillRect(l.x - 2, l.y - 2, 4, 4);
    if (tint.darkness > 0.12) { ctx.fillStyle = 'rgba(255,214,120,0.20)'; ctx.beginPath(); ctx.arc(l.x, l.y, 26, 0, 7); ctx.fill(); }
  }
}

export function drawDayOverlay(ctx, city, viewW, viewH) {
  const tint = dayTint(city);
  if (tint.darkness <= 0.01) return;
  ctx.fillStyle = `rgba(16,20,54,${tint.darkness.toFixed(3)})`;
  ctx.fillRect(0, 0, viewW, viewH);
  if (tint.dusk) { ctx.fillStyle = 'rgba(255,120,60,0.08)'; ctx.fillRect(0, 0, viewW, viewH); }
}
