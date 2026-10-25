// Dev/demo simulation: plays the two riders from inside the server, so the
// dashboard's Demo control needs no second terminal. It feeds the same store,
// live updates and arrival check a real phone position goes through.
const store = require('./store');
const { broadcast } = require('./ws');
const { checkArrivals } = require('./arrival');
const plan = require('./route-plan');

const TICK_MS = 1000;
// Re-read the plan every few updates, so a parcel added or shuffled mid-demo is
// picked up along the way instead of being ignored until the demo restarts.
const REREAD_TICKS = 3;

let timer = null;
let ticks = 0;
let routes = new Map();
let cursors = new Map();

function running() {
  return timer !== null;
}

function buildRoutes() {
  const state = store.getState();
  routes = new Map();
  for (const rider of state.riders) {
    if (!plan.startingPoints[rider.id]) continue;
    const route = plan.buildRoute(rider, state.recipients);
    routes.set(rider.id, route);
    if (!cursors.has(rider.id)) cursors.set(rider.id, { from: 0, to: 1, t: 0, dir: 1 });
    else plan.clampCursor(route, cursors.get(rider.id));
  }
}

function tick() {
  ticks += 1;
  if (ticks % REREAD_TICKS === 1) buildRoutes();

  for (const rider of store.getState().riders) {
    const route = routes.get(rider.id);
    if (!route) continue;

    const point = plan.advance(route, cursors.get(rider.id));
    const position = store.setPosition(rider.id, point.lat, point.lng, 'simulation');
    broadcast({
      type: 'position',
      riderId: rider.id,
      name: rider.name,
      lat: point.lat,
      lng: point.lng,
      source: 'simulation',
      at: position.at
    });

    // Same rule as a real phone: only a monitored rider can complete a parcel.
    if (!rider.monitored) continue;
    for (const recipient of checkArrivals(position, rider.id)) {
      broadcast({ type: 'arrival', riderId: rider.id, rider: rider.name, recipient });
    }
  }
}

function start() {
  if (timer) return { running: true };

  ticks = 0;
  cursors = new Map();
  buildRoutes();
  tick();
  timer = setInterval(tick, TICK_MS);
  broadcast({ type: 'simulation', running: true });
  return { running: true };
}

function stop() {
  if (!timer) return { running: false };

  clearInterval(timer);
  timer = null;
  routes = new Map();
  cursors = new Map();
  broadcast({ type: 'simulation', running: false });
  return { running: false };
}

function status() {
  return { running: running() };
}

module.exports = { start, stop, status };
