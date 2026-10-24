const express = require('express');
const { lookupAddress, sampleAddresses } = require('./geo');
const store = require('./store');
const { requireOwner } = require('./auth');

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

module.exports = router;
