const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');

const dataDir = path.join(__dirname, '..', 'data');
const dbPath = path.join(dataDir, 'db.json');

const defaultRiders = [
  { id: 'rider-1', name: 'Rider 1' },
  { id: 'rider-2', name: 'Rider 2' }
];

// Latest position per rider. Kept in memory only, per the spec: after a restart
// riders show as "not connected" until positions arrive again.
const positions = new Map();

function freshRiders() {
  return defaultRiders.map((rider) => ({
    ...rider,
    monitored: false,
    token: crypto.randomBytes(8).toString('hex')
  }));
}

function freshDb() {
  return { recipients: [], riders: freshRiders() };
}

let db = null;

// Read data/db.json once at startup; create it on first run.
function load() {
  if (db) return db;
  try {
    db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  } catch {
    db = freshDb();
  }
  db.recipients = db.recipients || [];
  db.riders = db.riders && db.riders.length ? db.riders : freshRiders();
  save();
  return db;
}

function save() {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(dbPath, `${JSON.stringify(db, null, 2)}\n`);
}

function withPosition(rider) {
  return { ...rider, position: positions.get(rider.id) || null };
}

function getState() {
  const current = load();
  return {
    recipients: current.recipients,
    riders: current.riders.map(withPosition)
  };
}

function addRecipient({ name, address, lat, lng, riderId = null }) {
  const current = load();
  const recipient = {
    id: crypto.randomUUID(),
    name,
    address,
    lat,
    lng,
    riderId,
    arrived: false,
    received: false
  };
  current.recipients.push(recipient);
  save();
  return recipient;
}

function setReceived(id, received) {
  const current = load();
  const recipient = current.recipients.find((item) => item.id === id);
  if (!recipient) return null;

  recipient.received = Boolean(received);
  save();
  return recipient;
}

function markArrived(id) {
  const current = load();
  const recipient = current.recipients.find((item) => item.id === id);
  if (!recipient || recipient.arrived) return null;

  recipient.arrived = true;
  save();
  return recipient;
}

// Apply a fresh deal from src/assign.js: [{ id, riderId }]. Saves once, however
// many parcels were re-dealt.
function setAssignments(assignments) {
  const current = load();
  let changed = false;

  for (const { id, riderId } of assignments) {
    const recipient = current.recipients.find((item) => item.id === id);
    if (!recipient || recipient.riderId === riderId) continue;
    recipient.riderId = riderId;
    changed = true;
  }

  if (changed) save();
  return current.recipients;
}

function removeRecipient(id) {
  const current = load();
  const index = current.recipients.findIndex((item) => item.id === id);
  if (index === -1) return null;

  const [removed] = current.recipients.splice(index, 1);
  save();
  return removed;
}

function setMonitored(id, monitored) {
  const current = load();
  const rider = current.riders.find((item) => item.id === id);
  if (!rider) return null;

  rider.monitored = Boolean(monitored);
  save();
  return withPosition(rider);
}

function findRiderByToken(token) {
  const current = load();
  return current.riders.find((item) => item.token === token) || null;
}

function setPosition(riderId, lat, lng) {
  const position = { lat, lng, at: Date.now() };
  positions.set(riderId, position);
  return position;
}

module.exports = {
  getState,
  addRecipient,
  setReceived,
  markArrived,
  setAssignments,
  removeRecipient,
  setMonitored,
  findRiderByToken,
  setPosition
};
