// traffic.js - AI traffic: civilian cars that follow the road lanes, stop for
// obstacles ahead, and pick a new direction at intersections.

import { createCar, updateCarPhysics, CAR_COLORS } from './vehicles.js';
import { VERTICAL_ROADS, HORIZONTAL_ROADS, ROAD_HALF, CITY_WIDTH, CITY_HEIGHT } from './city.js';
import { pickRandom, randRange, turnToward, wrapAngle, clamp } from './rng.js';

const LANE = 21;

export function laneTargetFor(car) {
  // Right-hand traffic: offset the road centre by LANE to the car's right.
  const fx = Math.cos(car.angle), fy = Math.sin(car.angle);
  return { x: car.x + fx * 90 - fy * 0 + (-fy) * 0, y: car.y + fy * 90 + fx * 0, fx, fy };
}

function nearestRoadAxis(car) {
  let bestV = Infinity, bestH = Infinity;
  for (const x of VERTICAL_ROADS) bestV = Math.min(bestV, Math.abs(car.x - x));
  for (const y of HORIZONTAL_ROADS) bestH = Math.min(bestH, Math.abs(car.y - y));
  return bestV < bestH ? 'v' : 'h';
}

export function createTraffic(city, rng, count = 14) {
  const cars = [];
  for (let i = 0; i < count; i++) {
    const vertical = rng() < 0.5;
    const dir = rng() < 0.5 ? 1 : -1;
    let x, y, angle;
    if (vertical) {
      const road = pickRandom(rng, VERTICAL_ROADS.slice(0, -1));
      x = road + dir * LANE; y = randRange(rng, 80, CITY_HEIGHT - 80); angle = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      // driving down (+y) keeps right: lane is road - LANE... use dir sign on x offset
      x = road + (dir > 0 ? -LANE : LANE);
    } else {
      const road = pickRandom(rng, HORIZONTAL_ROADS);
      y = road + (dir > 0 ? LANE : -LANE); x = randRange(rng, 80, CITY_WIDTH - 260); angle = dir > 0 ? 0 : Math.PI;
    }
    const car = createCar(x, y, angle, pickRandom(rng, CAR_COLORS), 'civilian');
    car.driver = 'traffic';
    car.cruiseSpeed = randRange(rng, 95, 150);
    car.turnCooldown = randRange(rng, 1, 5);
    cars.push(car);
  }
  return cars;
}

function obstacleAhead(car, others, playerCar, player) {
  const fx = Math.cos(car.angle), fy = Math.sin(car.angle);
  const check = (ox, oy, r) => {
    const dx = ox - car.x, dy = oy - car.y;
    const ahead = dx * fx + dy * fy, side = Math.abs(-dx * fy + dy * fx);
    return ahead > 6 && ahead < r && side < 17;
  };
  for (const o of others) { if (o !== car && !o.wrecked && check(o.x, o.y, 58)) return true; }
  if (playerCar && check(playerCar.x, playerCar.y, 58)) return true;
  if (!playerCar && player && check(player.x, player.y, 40)) return true;
  return false;
}

export function updateTraffic(cars, dt, city, fx, allCars, playerCar, player, rng, hooks = {}) {
  for (const car of cars) {
    if (car.driver !== 'traffic' || car.wrecked) continue;
    car.turnCooldown -= dt;
    // At an intersection, sometimes turn onto the crossing road.
    const nearV = VERTICAL_ROADS.some((x) => Math.abs(car.x - x) < 12);
    const nearH = HORIZONTAL_ROADS.some((y) => Math.abs(car.y - y) < 12);
    if (nearV && nearH && car.turnCooldown <= 0 && rng() < 0.012) {
      const options = [0, Math.PI, Math.PI / 2, -Math.PI / 2].filter((a) => Math.abs(wrapAngle(a - car.angle)) > 0.4);
      car.angle = pickRandom(rng, options);
      car.turnCooldown = randRange(rng, 3, 7);
      // snap toward the lane of the new direction
      if (Math.abs(Math.cos(car.angle)) > 0.7) {
        let best = HORIZONTAL_ROADS[0]; for (const y of HORIZONTAL_ROADS) if (Math.abs(car.y - y) < Math.abs(car.y - best)) best = y;
        car.y = best + (Math.cos(car.angle) > 0 ? LANE : -LANE);
      } else {
        let best = VERTICAL_ROADS[0]; for (const x of VERTICAL_ROADS) if (Math.abs(car.x - x) < Math.abs(car.x - best)) best = x;
        car.x = best + (Math.sin(car.angle) > 0 ? -LANE : LANE);
      }
    }
    // Keep to the lane centre of the road being followed.
    let steer = 0;
    if (Math.abs(Math.cos(car.angle)) > 0.7) {
      let best = HORIZONTAL_ROADS[0]; for (const y of HORIZONTAL_ROADS) if (Math.abs(car.y - y) < Math.abs(car.y - best)) best = y;
      const laneY = best + (Math.cos(car.angle) > 0 ? LANE : -LANE);
      steer = clamp((laneY - car.y) * 0.02, -0.5, 0.5);
    } else {
      let best = VERTICAL_ROADS[0]; for (const x of VERTICAL_ROADS) if (Math.abs(car.x - x) < Math.abs(car.x - best)) best = x;
      const laneX = best + (Math.sin(car.angle) > 0 ? -LANE : LANE);
      steer = clamp((car.x - laneX) * 0.02, -0.5, 0.5) * (Math.sin(car.angle) > 0 ? 1 : -1);
      steer = clamp((laneX - car.x) * 0.012, -0.4, 0.4);
    }
    const blocked = obstacleAhead(car, allCars, playerCar, player);
    const edge = car.x < 70 || car.x > CITY_WIDTH - 210 || car.y < 70 || car.y > CITY_HEIGHT - 70;
    let throttle = 0;
    if (blocked) throttle = car.speed > 8 ? -1 : 0;
    else if (edge && car.turnCooldown <= 0) { car.angle += Math.PI; car.turnCooldown = 4; }
    else throttle = car.speed < car.cruiseSpeed ? 0.75 : 0;
    updateCarPhysics(car, { throttle, steer, handbrake: false }, dt, city, fx, hooks);
    void nearestRoadAxis; void ROAD_HALF;
  }
}

export function drawTrafficHint() { return 'traffic follows lanes and stops for obstacles'; }
