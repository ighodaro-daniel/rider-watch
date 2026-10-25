const express = require('express');
const { lookupAddress, sampleAddresses } = require('./geo');
const store = require('./store');
const { requireOwner } = require('./auth');
const { broadcast } = require('./ws');
const { checkArrivals } = require('./arrival');
const assign = require('./assign');
const demo = require('./demo');

const router = express.Router();

router.get('/api/state', requireOwner, (req, res) => {
  res.json({
    ...store.getState(),
    publicBaseUrl: req.app.locals.publicBaseUrl || null,
    simulation: demo.status()
  });
});

router.get('/api/sample-addresses', requireOwner, (req, res) => {
  res.json(sampleAddresses());
});

router.post('/api/recipients', requireOwner, (req, res) => {
  const name = String(req.body.name || '').trim();
  const address = String(req.body.address || '').trim();

  if (!name) {
    return res.status(400).json({ error: 'Enter a recipient name.' });
  }

  const hasLat = req.body.lat !== undefined && req.body.lat !== null && req.body.lat !== '';
  const hasLng = req.body.lng !== undefined && req.body.lng !== null && req.body.lng !== '';
  let place;

  if (hasLat || hasLng) {
    if (!hasLat || !hasLng) {
      return res.status(400).json({ error: 'Choose a destination pin on the map.' });
    }

    const lat = typeof req.body.lat === 'number' || (typeof req.body.lat === 'string' && req.body.lat.trim())
      ? Number(req.body.lat)
      : NaN;
    const lng = typeof req.body.lng === 'number' || (typeof req.body.lng === 'string' && req.body.lng.trim())
      ? Number(req.body.lng)
      : NaN;
    if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) {
      return res.status(400).json({ error: 'That destination pin has invalid coordinates.' });
    }
    place = { address: address || 'Pinned destination', lat, lng };
  } else {
    if (!address) {
      return res.status(400).json({ error: 'Enter a sample address or choose a destination pin on the map.' });
    }
    place = lookupAddress(address);
    if (!place) {
      return res.status(400).json({
        error: `We couldn't find "${address}" in the sample addresses. Choose a sample address or pin the destination on the map:`,
        samples: sampleAddresses()
      });
    }
  }

  // Every new parcel is dealt to a rider as it arrives, so the owner never has
  // to think about who carries what until they want to re-deal it.
  const state = store.getState();
  const rider = assign.pickRider(state.riders, state.recipients);

  const recipient = store.addRecipient({
    name,
    address: place.address,
    lat: place.lat,
    lng: place.lng,
    riderId: rider ? rider.id : null
  });
  return res.status(201).json(recipient);
});

router.post('/api/recipients/:id/received', requireOwner, (req, res) => {
  const recipient = store.setReceived(req.params.id, req.body.received);
  if (!recipient) return res.status(404).json({ error: 'That recipient no longer exists.' });
  return res.json(recipient);
});

// Clearing a finished delivery frees the panel for new names. Only a delivery
// already ticked received can go, so a stray click can never delete a parcel
// that is still on the route.
router.delete('/api/recipients/:id', requireOwner, (req, res) => {
  const recipient = store.getState().recipients.find((item) => item.id === req.params.id);
  if (!recipient) return res.status(404).json({ error: 'That recipient no longer exists.' });
  if (!recipient.received) {
    return res.status(409).json({ error: 'Tick the delivery as received before removing it.' });
  }

  store.removeRecipient(recipient.id);
  // Tell every open dashboard, so the name disappears everywhere at once.
  broadcast({ type: 'recipient-removed', id: recipient.id });
  return res.json({ removed: recipient.id });
});

// Re-deal every unfinished parcel between the riders, in random order. Every
// open dashboard takes the new plan straight away.
router.post('/api/assign', requireOwner, (req, res) => {
  const state = store.getState();
  const assignments = assign.deal(state.riders, state.recipients);
  const recipients = store.setAssignments(assignments);

  broadcast({ type: 'assignments', recipients });
  return res.json({ recipients });
});

// Dev/demo mode: play the riders from inside the server, so a demo needs no
// second terminal. Owner-only, and it can be stopped at any time.
router.post('/api/dev/simulation', requireOwner, (req, res) => {
  const on = req.body.on === true || req.body.on === 'true';
  return res.json(on ? demo.start() : demo.stop());
});

router.post('/api/riders/:id/monitor', requireOwner, (req, res) => {
  const rider = store.setMonitored(req.params.id, req.body.monitored);
  if (!rider) return res.status(404).json({ error: 'That rider no longer exists.' });

  // Tell every open dashboard so the tracking link appears immediately.
  broadcast({ type: 'rider', rider });
  return res.json(rider);
});

// A rider's phone posts here, identified by its tracking token. No login: the
// token is the credential, and it only allows sending a position.
router.post('/api/location/:token', (req, res) => {
  const rider = store.findRiderByToken(req.params.token);
  if (!rider) return res.status(404).json({ error: 'This tracking link is not valid.' });

  const lat = Number(req.body.lat);
  const lng = Number(req.body.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({ error: 'A position needs numeric lat and lng.' });
  }

  const source = req.body.source === 'simulation' ? 'simulation' : 'phone';
  const position = store.setPosition(rider.id, lat, lng, source);
  broadcast({ type: 'position', riderId: rider.id, name: rider.name, lat, lng, source, at: position.at });

  // Within 50 m of a recipient means that delivery has arrived; alert once each.
  // Only monitored riders count, per `prd.md > Live map and arrival alert` — a
  // rider the owner has not put on the job must not change the route.
  const arrivals = rider.monitored ? checkArrivals(position, rider.id) : [];
  for (const recipient of arrivals) {
    broadcast({ type: 'arrival', riderId: rider.id, rider: rider.name, recipient });
  }

  return res.json({ ok: true, rider: rider.name, position, arrivals });
});

module.exports = router;
