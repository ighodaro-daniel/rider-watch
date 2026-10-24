// SIMULATION: plays the riders so the dashboard can be demonstrated on one computer.
// It posts to the same location endpoint a real phone uses.
// Each rider walks the parcels dealt to it by the dashboard, so arrival alerts
// come from the rider actually carrying that parcel.
const path = require('node:path');
const fs = require('node:fs');

const port = process.env.PORT || 3000;
const base = `http://localhost:${port}`;
const dbPath = path.join(__dirname, '..', 'data', 'db.json');

// Where each rider starts from, and where it heads if nothing is assigned yet.
const startingPoints = {
  'rider-1': { lat: 6.4281, lng: 3.4219 }, // Victoria Island
  'rider-2': { lat: 6.6018, lng: 3.3515 }  // Ikeja
};
const fallbackDestinations = {
  'rider-1': { lat: 6.4478, lng: 3.4723 }, // Lekki Phase 1
  'rider-2': { lat: 6.5095, lng: 3.3711 }  // Yaba
};

const STEPS = 40;
const TICK_MS = Number(process.env.SIM_TICK_MS || 1000);
// How often the plan is re-read, so a parcel added or shuffled mid-demo is
// picked up along the way instead of being ignored until the script restarts.
const REREAD_MS = 3000;

function readDb() {
  try {
    return JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  } catch {
    console.error('No data/db.json yet. Start the app once and add a recipient first.');
    process.exit(1);
  }
}

function readPlan() {
  const db = readDb();
  const riders = (db.riders || []).filter((rider) => startingPoints[rider.id]);
  const recipients = db.recipients || [];
  return { riders, recipients };
}

// A rider's route: its start, then the parcels dealt to it that are still out.
function buildRoute(rider, recipients) {
  const start = startingPoints[rider.id];
  const stops = recipients
    .filter((recipient) => !recipient.received && recipient.riderId === rider.id)
    .map((recipient) => ({ lat: recipient.lat, lng: recipient.lng, name: recipient.name }));

  const points = stops.length
    ? [start, ...stops]
    : [start, { ...fallbackDestinations[rider.id], name: 'a sample address' }];

  return { points, stops };
}

function pointAlong([from, to], t) {
  return {
    lat: from.lat + (to.lat - from.lat) * t,
    lng: from.lng + (to.lng - from.lng) * t
  };
}

// Walk from stop to stop, then turn round and come back, so the dot keeps moving
// and a new stop appended mid-demo is reached on the next pass.
function advance(route, cursor) {
  const last = route.points.length - 1;
  let { from, to, t, dir } = cursor;

  if (last < 1) return route.points[0];

  t += 1 / STEPS;
  if (t >= 1) {
    t = 0;
    from = to;
    if (to === last && dir === 1) dir = -1;
    else if (to === 0 && dir === -1) dir = 1;
    to = from + dir;
  }

  Object.assign(cursor, { from, to, t, dir });
  return pointAlong([route.points[from], route.points[to]], t);
}

// Shrinking route (a parcel removed) must not leave the cursor pointing past the end.
function clampCursor(route, cursor) {
  const last = route.points.length - 1;
  cursor.from = Math.min(cursor.from, last);
  cursor.to = Math.min(cursor.to, last);
  if (cursor.from === cursor.to) {
    cursor.to = cursor.from === last ? Math.max(0, last - 1) : cursor.from + 1;
  }
  cursor.dir = cursor.to === cursor.from + 1 ? 1 : -1;
}

async function post(token, name, position) {
  try {
    const response = await fetch(`${base}/api/location/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(position)
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      console.error(`${name}: ${response.status} ${body.error || ''}`);
    }
  } catch {
    console.error(`${name}: could not reach ${base}. Is the app running (npm start)?`);
  }
}

const { riders, recipients } = readPlan();
if (!riders.length) {
  console.error('No riders found in data/db.json.');
  process.exit(1);
}

const routes = new Map();
const cursors = new Map();
const described = new Map();

function refreshRoutes() {
  const plan = readPlan();
  for (const rider of plan.riders) {
    const route = buildRoute(rider, plan.recipients);
    routes.set(rider.id, route);

    const description = route.stops.map((stop) => stop.name).join(', ') || 'a sample address';
    if (described.get(rider.id) !== description) {
      described.set(rider.id, description);
      console.log(`  ${rider.name} → ${description}`);
    }

    if (!cursors.has(rider.id)) cursors.set(rider.id, { from: 0, to: 1, t: 0, dir: 1 });
    else clampCursor(route, cursors.get(rider.id));
  }
}

console.log(`Simulating ${riders.map((rider) => rider.name).join(' and ')} every ${TICK_MS}ms.`);
refreshRoutes();

const unmonitored = riders.filter((rider) => !rider.monitored).map((rider) => rider.name);
if (unmonitored.length) {
  console.log(`Note: ${unmonitored.join(' and ')} not monitored yet — tick them on the dashboard to see them.`);
}
console.log('Press Ctrl+C to stop.\n');

let ticks = 0;
setInterval(async () => {
  ticks += 1;
  if (ticks % Math.max(1, Math.round(REREAD_MS / TICK_MS)) === 1) refreshRoutes();

  for (const rider of riders) {
    const route = routes.get(rider.id);
    if (!route) continue;
    const position = advance(route, cursors.get(rider.id));
    await post(rider.token, rider.name, position);
  }
}, TICK_MS);
