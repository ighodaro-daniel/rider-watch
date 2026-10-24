const express = require('express');
const { lookupAddress, sampleAddresses } = require('./geo');
const store = require('./store');
const { requireOwner } = require('./auth');
const { broadcast } = require('./ws');
const { checkArrivals } = require('./arrival');

const router = express.Router();

router.get('/api/state', requireOwner, (req, res) => {
  res.json(store.getState());
});

router.get('/api/sample-addresses', requireOwner, (req, res) => {
  res.json(sampleAddresses());
});

router.post('/api/recipients', requireOwner, (req, res) => {
  const name = String(req.body.name || '').trim();
  const address = String(req.body.address || '').trim();

  if (!name || !address) {
    return res.status(400).json({ error: 'Enter both a name and an address.' });
  }

  const place = lookupAddress(address);
  if (!place) {
    return res.status(400).json({
      error: `We couldn't find "${address}" in the sample addresses. Pick one of these:`,
      samples: sampleAddresses()
    });
  }

  const recipient = store.addRecipient({ name, address: place.address, lat: place.lat, lng: place.lng });
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

  const position = store.setPosition(rider.id, lat, lng);
  broadcast({ type: 'position', riderId: rider.id, name: rider.name, lat, lng, at: position.at });

  // Within 50 m of a recipient means that delivery has arrived; alert once each.
  // Only monitored riders count, per `prd.md > Live map and arrival alert` — a
  // rider the owner has not put on the job must not change the route.
  const arrivals = rider.monitored ? checkArrivals(position) : [];
  for (const recipient of arrivals) {
    broadcast({ type: 'arrival', riderId: rider.id, rider: rider.name, recipient });
  }

  return res.json({ ok: true, rider: rider.name, position, arrivals });
});

module.exports = router;
