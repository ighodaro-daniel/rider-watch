const { distanceMeters } = require('./geo');
const store = require('./store');

// How close counts as "arrived". Agreed in `spec.md > Decisions and Open Issues`.
const ARRIVAL_METERS = 50;

// Given a rider's latest position, mark every not-yet-arrived recipient within
// 50 metres as arrived. Returns only the recipients that just became arrived, so
// the caller can alert once per recipient and never twice.
function checkArrivals(position) {
  if (!position) return [];

  const arrivedNow = [];
  for (const recipient of store.getState().recipients) {
    if (recipient.arrived) continue;
    const metres = distanceMeters(position, { lat: recipient.lat, lng: recipient.lng });
    if (metres > ARRIVAL_METERS) continue;

    const updated = store.markArrived(recipient.id);
    if (updated) arrivedNow.push(updated);
  }
  return arrivedNow;
}

module.exports = { checkArrivals, ARRIVAL_METERS };
