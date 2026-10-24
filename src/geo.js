const path = require('node:path');
const fs = require('node:fs');

const samplePath = path.join(__dirname, '..', 'data', 'sample-addresses.json');

function sampleAddresses() {
  return JSON.parse(fs.readFileSync(samplePath, 'utf8'));
}

function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[.,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Returns { address, lat, lng } for an address or label in the built-in list, otherwise null.
function lookupAddress(input) {
  const wanted = normalize(input);
  if (!wanted) return null;

  const found = sampleAddresses().find(
    (entry) => normalize(entry.address) === wanted || normalize(entry.label) === wanted
  );
  if (!found) return null;

  return { address: found.address, lat: found.lat, lng: found.lng };
}

// Straight-line distance in metres between two { lat, lng } points.
function distanceMeters(a, b) {
  const earthRadius = 6371000;
  const toRad = (degrees) => (degrees * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadius * Math.asin(Math.sqrt(h));
}

module.exports = { lookupAddress, sampleAddresses, distanceMeters };
