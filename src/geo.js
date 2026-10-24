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

module.exports = { lookupAddress, sampleAddresses };
