// Shared geometry for the simulated riders. Used by the dashboard's Demo
// control (src/demo.js) and by the standalone simulator
// (scripts/simulate-rider.js), so both walk the same routes at the same pace.

// Where each rider starts from, and where it heads if nothing is assigned yet.
const startingPoints = {
  'rider-1': { lat: 6.4281, lng: 3.4219 }, // Victoria Island
  'rider-2': { lat: 6.6018, lng: 3.3515 }  // Ikeja
};

const fallbackDestinations = {
  'rider-1': { lat: 6.4478, lng: 3.4723 }, // Lekki Phase 1
  'rider-2': { lat: 6.5095, lng: 3.3711 }  // Yaba
};

// How many position updates it takes to walk one leg. More updates means a
// slower dot; at one update a second, 80 is a gentle glide between stops
// instead of a dart across the map.
const STEPS = 80;

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

module.exports = { startingPoints, fallbackDestinations, STEPS, buildRoute, advance, clampCursor };
