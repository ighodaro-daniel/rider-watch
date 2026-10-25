// SIMULATION: plays the riders so the dashboard can be demonstrated on one computer.
// It posts to the same location endpoint a real phone uses.
// Each rider walks the parcels dealt to it by the dashboard, so arrival alerts
// come from the rider actually carrying that parcel. The route geometry is
// shared with the dashboard's Demo control (src/route-plan.js).
const path = require('node:path');
const fs = require('node:fs');
const plan = require('../src/route-plan');

const port = process.env.PORT || 3000;
const base = `http://localhost:${port}`;
const dbPath = path.join(__dirname, '..', 'data', 'db.json');

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
  const riders = (db.riders || []).filter((rider) => plan.startingPoints[rider.id]);
  const recipients = db.recipients || [];
  return { riders, recipients };
}

async function post(token, name, position) {
  try {
    const response = await fetch(`${base}/api/location/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...position, source: 'simulation' })
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
  const nextPlan = readPlan();
  for (const rider of nextPlan.riders) {
    const route = plan.buildRoute(rider, nextPlan.recipients);
    routes.set(rider.id, route);

    const description = route.stops.map((stop) => stop.name).join(', ') || 'a sample address';
    if (described.get(rider.id) !== description) {
      described.set(rider.id, description);
      console.log(`  ${rider.name} → ${description}`);
    }

    if (!cursors.has(rider.id)) cursors.set(rider.id, { from: 0, to: 1, t: 0, dir: 1 });
    else plan.clampCursor(route, cursors.get(rider.id));
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
    const position = plan.advance(route, cursors.get(rider.id));
    await post(rider.token, rider.name, position);
  }
}, TICK_MS);
