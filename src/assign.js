// Dispatch: which rider carries which parcel.
//
// The choice is random, but only among the riders carrying the fewest parcels
// still out. A pure coin toss would happily give one rider five destinations and
// leave the other idle, which is neither a fair day's work nor a good demo.

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// How many parcels each rider still has to deliver.
function loadByRider(riders, recipients) {
  const loads = new Map(riders.map((rider) => [rider.id, 0]));
  for (const recipient of recipients) {
    if (recipient.received || !recipient.riderId) continue;
    if (loads.has(recipient.riderId)) loads.set(recipient.riderId, loads.get(recipient.riderId) + 1);
  }
  return loads;
}

function leastLoaded(riders, loads) {
  const fewest = Math.min(...loads.values());
  return riders.filter((rider) => loads.get(rider.id) === fewest);
}

// The rider a new parcel goes to: random among the least busy.
function pickRider(riders, recipients) {
  if (!riders.length) return null;
  const pool = leastLoaded(riders, loadByRider(riders, recipients));
  return pool[Math.floor(Math.random() * pool.length)];
}

// Re-deal every unfinished parcel, in random order, one at a time, so the
// counts stay level as it goes. Returns [{ id, riderId }].
function deal(riders, recipients) {
  if (!riders.length) return [];

  const loads = new Map(riders.map((rider) => [rider.id, 0]));
  return shuffle(recipients.filter((recipient) => !recipient.received)).map((recipient) => {
    const pool = leastLoaded(riders, loads);
    const rider = pool[Math.floor(Math.random() * pool.length)];
    loads.set(rider.id, loads.get(rider.id) + 1);
    return { id: recipient.id, riderId: rider.id };
  });
}

module.exports = { pickRider, deal };
