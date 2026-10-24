// SIMULATION: plays the riders so the dashboard can be demonstrated on one computer.
// It posts to the same location endpoint a real phone uses.
const path = require('node:path');
const fs = require('node:fs');

const port = process.env.PORT || 3000;
const base = `http://localhost:${port}`;
const dbPath = path.join(__dirname, '..', 'data', 'db.json');

// Each rider loops back and forth between two sample addresses in Lagos.
const routes = {
  'rider-1': [
    { lat: 6.4281, lng: 3.4219 }, // Victoria Island
    { lat: 6.4478, lng: 3.4723 }  // Lekki Phase 1
  ],
  'rider-2': [
    { lat: 6.6018, lng: 3.3515 }, // Ikeja
    { lat: 6.5095, lng: 3.3711 }  // Yaba
  ]
};

const STEPS = 40;
const TICK_MS = Number(process.env.SIM_TICK_MS || 1000);

function readRiders() {
  try {
    return JSON.parse(fs.readFileSync(dbPath, 'utf8')).riders || [];
  } catch {
    console.error('No data/db.json yet. Start the app once and tick a rider first.');
    process.exit(1);
  }
}

function pointAlong([from, to], t) {
  return {
    lat: from.lat + (to.lat - from.lat) * t,
    lng: from.lng + (to.lng - from.lng) * t
  };
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

const riders = readRiders().filter((rider) => routes[rider.id]);
if (!riders.length) {
  console.error('No riders with routes found in data/db.json.');
  process.exit(1);
}

const unmonitored = riders.filter((rider) => !rider.monitored).map((rider) => rider.name);
if (unmonitored.length) {
  console.log(`Note: ${unmonitored.join(' and ')} not monitored yet — tick them on the dashboard to see them.`);
}

console.log(`Simulating ${riders.map((rider) => rider.name).join(' and ')} every ${TICK_MS}ms.`);
console.log('Press Ctrl+C to stop.\n');

let step = 0;
setInterval(async () => {
  step += 1;
  // Ping-pong: forward for STEPS, then back, so the dots keep moving.
  const phase = step % (STEPS * 2);
  const t = phase <= STEPS ? phase / STEPS : (STEPS * 2 - phase) / STEPS;

  for (const rider of riders) {
    const position = pointAlong(routes[rider.id], t);
    await post(rider.token, rider.name, position);
  }
}, TICK_MS);
