const map = L.map('map', { zoomControl: false, maxZoom: 16 }).setView([6.5244, 3.3792], 12);

L.control.zoom({ position: 'bottomleft' }).addTo(map);

// Esri's dark grey canvas: dark basemap with no API key required.
// CARTO's basemaps.cartocdn.com endpoints now answer with an "API KEY REQUIRED"
// placeholder tile, so they were replaced here.
const tiles = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
  attribution: 'Tiles &copy; Esri &mdash; Esri, HERE, Garmin, &copy; OpenStreetMap contributors',
  maxZoom: 16
});

tiles.on('tileerror', () => {
  document.getElementById('map-notice').hidden = false;
});
tiles.addTo(map);

const SILENT_AFTER_MS = 8000;
const TRAIL_POINTS = 60;

const markers = new Map();
const expanded = new Set();
const listEl = document.getElementById('recipient-list');
const emptyEl = document.getElementById('empty-state');
const countEl = document.getElementById('recipient-count');
const formEl = document.getElementById('add-recipient');
const errorEl = document.getElementById('form-error');
const datalistEl = document.getElementById('sample-addresses');
const riderListEl = document.getElementById('rider-list');
const toggleAddEl = document.getElementById('toggle-add');
const shuffleEl = document.getElementById('shuffle-riders');
const demoEl = document.getElementById('demo-riders');
const centerOnLocationEl = document.getElementById('center-on-location');
const choosePinEl = document.getElementById('choose-pin');
const pinStatusEl = document.getElementById('pin-status');
const trackingModeEl = document.getElementById('tracking-mode');

const riderMarkers = new Map();
const riderTrails = new Map();
let selectedPin = null;
let pinMarker = null;
let choosingPin = false;
let publicBaseUrl = location.origin;
let simulationRunning = false;

// Rider 1 in teal, rider 2 in violet, so a dot on the map matches the tag on
// the delivery it is carrying.
const RIDER_COLORS = ['#5ee8c3', '#a99bff'];

function riderIndex(riderId) {
  return currentRiders.findIndex((rider) => rider.id === riderId);
}

function riderColor(riderId) {
  const index = riderIndex(riderId);
  return RIDER_COLORS[(index < 0 ? 0 : index) % RIDER_COLORS.length];
}

function riderTag(riderId) {
  const index = riderIndex(riderId);
  return index < 0 ? '' : `R${index + 1}`;
}

let currentRecipients = [];
let currentRiders = [];

function updateTrackingMode() {
  const sources = new Set(currentRiders
    .filter((rider) => rider.monitored && rider.position && Date.now() - rider.position.at <= SILENT_AFTER_MS)
    .map((rider) => rider.position.source || 'phone'));

  if (sources.size > 1) trackingModeEl.textContent = 'MIXED RIDER SOURCES';
  else if (sources.has('simulation')) trackingModeEl.textContent = 'SIMULATED RIDERS';
  else if (sources.has('phone')) trackingModeEl.textContent = 'PHONE GPS';
  else trackingModeEl.textContent = 'RIDER TRACKING';
}

function clearPin() {
  selectedPin = null;
  choosingPin = false;
  choosePinEl.textContent = 'Choose destination on map';
  if (pinMarker) {
    map.removeLayer(pinMarker);
    pinMarker = null;
  }
  pinStatusEl.textContent = '';
}

function placePin(latlng) {
  selectedPin = { lat: latlng.lat, lng: latlng.lng };
  choosingPin = false;
  choosePinEl.textContent = 'Choose destination on map';
  if (pinMarker) map.removeLayer(pinMarker);
  pinMarker = L.circleMarker(latlng, {
    radius: 9,
    color: '#5ee8c3',
    weight: 2,
    fillColor: '#5ee8c3',
    fillOpacity: 0.65
  }).addTo(map);
  pinStatusEl.textContent = `Destination pinned at ${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}.`;
}

map.on('click', (event) => {
  if (choosingPin) placePin(event.latlng);
});

centerOnLocationEl.addEventListener('click', () => {
  if (!navigator.geolocation) {
    pinStatusEl.textContent = 'This browser cannot find your location. Move the map manually instead.';
    return;
  }
  if (!window.isSecureContext) {
    pinStatusEl.textContent = 'Location needs a secure connection. Use localhost or the HTTPS phone-test link.';
    return;
  }

  pinStatusEl.textContent = 'Waiting for location permission…';
  navigator.geolocation.getCurrentPosition(
    ({ coords }) => {
      map.setView([coords.latitude, coords.longitude], Math.max(map.getZoom(), 15));
      pinStatusEl.textContent = 'Map centered on your location. Choose the delivery destination on the map.';
    },
    (error) => {
      pinStatusEl.textContent = error.code === error.PERMISSION_DENIED
        ? 'Location permission was denied. Move the map manually instead.'
        : 'Your location is unavailable. Move the map manually instead.';
    },
    { enableHighAccuracy: true, maximumAge: 30000, timeout: 15000 }
  );
});

choosePinEl.addEventListener('click', () => {
  choosingPin = !choosingPin;
  choosePinEl.textContent = choosingPin ? 'Click the map to place the pin…' : 'Choose destination on map';
  pinStatusEl.textContent = choosingPin ? 'Click the delivery destination on the map.' : '';
});



async function api(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  const body = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, body };
}

/* ---------- recipients ---------- */

function markerFor(recipient) {
  let marker = markers.get(recipient.id);
  if (!marker) {
    marker = L.circleMarker([recipient.lat, recipient.lng], {
      radius: 6,
      color: '#efb84b',
      weight: 2,
      fillColor: '#efb84b',
      fillOpacity: 0.9
    }).addTo(map);
    markers.set(recipient.id, marker);
  }
  const label = document.createElement('span');
  label.textContent = `${recipient.name}${riderTag(recipient.riderId) ? ` · ${riderTag(recipient.riderId)}` : ''}`;
  marker.bindTooltip(label, {
    permanent: true,
    direction: 'top',
    offset: [0, -8],
    className: 'map-name-label recipient-map-label'
  });
  marker.setStyle({ color: recipient.received ? '#5ee8c3' : '#efb84b', fillColor: recipient.received ? '#5ee8c3' : '#efb84b' });
  return marker;
}

// A received delivery can be cleared away to make room on the list. Two clicks:
// the first arms the button, the second removes, so a mis-tap costs nothing.
function removeButtonFor(recipient) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'remove-button';
  button.textContent = '×';
  button.title = `Remove ${recipient.name} from the route`;
  button.setAttribute('aria-label', `Remove ${recipient.name} from the route`);

  let armed = false;
  let disarm;

  const reset = () => {
    armed = false;
    clearTimeout(disarm);
    button.classList.remove('is-armed');
    button.textContent = '×';
  };

  button.addEventListener('click', async () => {
    if (!armed) {
      armed = true;
      button.classList.add('is-armed');
      button.textContent = 'Remove?';
      disarm = setTimeout(reset, 3000);
      return;
    }

    clearTimeout(disarm);
    const { ok } = await api(`/api/recipients/${recipient.id}`, { method: 'DELETE' });
    if (!ok) reset();
    else dropRecipient(recipient.id);
  });

  return button;
}

function rowFor(recipient) {
  const item = document.createElement('li');
  item.className = 'recipient';
  item.dataset.recipientId = recipient.id;
  if (recipient.received) item.classList.add('is-received');
  if (recipient.arrived) item.classList.add('is-arrived');

  const row = document.createElement('div');
  row.className = 'recipient-row';

  const nameButton = document.createElement('button');
  nameButton.type = 'button';
  nameButton.className = 'recipient-name';
  nameButton.textContent = recipient.name;
  nameButton.addEventListener('click', () => {
    if (expanded.has(recipient.id)) expanded.delete(recipient.id);
    else expanded.add(recipient.id);
    renderList(currentRecipients);
    const marker = markers.get(recipient.id);
    if (marker) map.panTo(marker.getLatLng());
  });

  const tick = document.createElement('input');
  tick.type = 'checkbox';
  tick.className = 'received-box';
  tick.checked = recipient.received;
  tick.setAttribute('aria-label', `Mark ${recipient.name} received`);
  tick.addEventListener('change', async () => {
    const { ok, body } = await api(`/api/recipients/${recipient.id}/received`, {
      method: 'POST',
      body: JSON.stringify({ received: tick.checked })
    });
    if (ok) applyRecipient(body);
    else tick.checked = !tick.checked;
  });

  row.append(nameButton);

  // Which rider has this one. Colour matches that rider's dot on the map.
  if (recipient.riderId) {
    const owner = currentRiders.find((rider) => rider.id === recipient.riderId);
    const chip = document.createElement('span');
    chip.className = 'rider-chip';
    chip.textContent = riderTag(recipient.riderId);
    chip.style.color = riderColor(recipient.riderId);
    chip.title = owner ? `${recipient.name} is with ${owner.name}` : '';
    row.append(chip);
  }

  row.append(tick);
  if (recipient.received) row.append(removeButtonFor(recipient));

  const info = document.createElement('div');
  info.className = 'recipient-info';
  info.hidden = !expanded.has(recipient.id);
  info.textContent = recipient.address;

  item.append(row, info);
  return item;
}

function updateSummary(recipients) {
  const summary = document.getElementById('summary');
  if (!summary) return;

  const arrived = recipients.filter((recipient) => recipient.arrived).length;
  const received = recipients.filter((recipient) => recipient.received).length;
  if (!recipients.length) {
    summary.textContent = 'No recipients yet';
    return;
  }
  summary.textContent = `${recipients.length} to reach · ${arrived} arrived · ${received} received`;
}

// The add form folds away once the route has entries, so the names being ticked
// off get the panel's height instead.
function setFormOpen(open) {
  formEl.hidden = !open;
  toggleAddEl.textContent = open ? 'Close' : '+ Add';
}

toggleAddEl.addEventListener('click', () => setFormOpen(formEl.hidden));

function renderList(recipients) {
  currentRecipients = recipients;
  countEl.textContent = String(recipients.length).padStart(2, '0');
  emptyEl.hidden = recipients.length > 0;
  listEl.hidden = recipients.length === 0;
  listEl.replaceChildren(...recipients.map(rowFor));
  updateSummary(recipients);
}

// Take a removed delivery off the list, the map and the alert rings at once.
function dropRecipient(id) {
  currentRecipients = currentRecipients.filter((item) => item.id !== id);
  expanded.delete(id);

  const marker = markers.get(id);
  if (marker) {
    map.removeLayer(marker);
    markers.delete(id);
  }

  const ring = arrivalRings.get(id);
  if (ring) {
    map.removeLayer(ring);
    arrivalRings.delete(id);
  }

  renderList(currentRecipients);
  // An empty route means there is room for a new name, so offer the form.
  if (currentRecipients.length === 0) setFormOpen(true);
}

function applyRecipient(updated) {
  currentRecipients = currentRecipients.map((item) => (item.id === updated.id ? updated : item));
  renderList(currentRecipients);
  markerFor(updated);
}

function showError(message, samples) {
  errorEl.replaceChildren();
  errorEl.hidden = false;
  const text = document.createElement('span');
  text.textContent = message;
  errorEl.append(text);

  if (samples && samples.length) {
    const chips = document.createElement('span');
    chips.className = 'sample-chips';
    for (const sample of samples) {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'sample-chip';
      chip.textContent = sample.label;
      chip.title = sample.address;
      chip.addEventListener('click', () => {
        formEl.elements.address.value = sample.address;
        errorEl.hidden = true;
      });
      chips.append(chip);
    }
    errorEl.append(chips);
  }
}

/* ---------- riders ---------- */

function riderStatus(rider) {
  if (!rider.monitored) return { text: 'OFF', live: false };
  if (!rider.position) return { text: 'NOT CONNECTED', live: false };
  const age = Date.now() - rider.position.at;
  if (age > SILENT_AFTER_MS) return { text: 'NOT REPORTING', live: false };
  return { text: 'LIVE', live: true };
}

function riderRow(rider) {
  const wrap = document.createElement('div');
  wrap.className = 'rider-row';
  wrap.dataset.riderId = rider.id;

  const name = document.createElement('span');
  name.className = 'rider-name';
  name.textContent = rider.name;

  const toggle = document.createElement('input');
  toggle.type = 'checkbox';
  toggle.className = 'monitor-box';
  toggle.checked = Boolean(rider.monitored);
  toggle.setAttribute('aria-label', `Monitor ${rider.name}`);
  toggle.addEventListener('change', async () => {
    const { ok, body } = await api(`/api/riders/${rider.id}/monitor`, {
      method: 'POST',
      body: JSON.stringify({ monitored: toggle.checked })
    });
    if (!ok) {
      toggle.checked = !toggle.checked;
      return;
    }
    applyRider(body);
  });

  const status = document.createElement('span');
  status.className = 'rider-status';
  status.dataset.status = rider.id;
  const state = riderStatus(rider);
  status.textContent = state.text;
  status.classList.toggle('is-live', state.live);

  wrap.append(name, toggle, status);

  if (rider.monitored) {
    const linkRow = document.createElement('div');
    linkRow.className = 'rider-link';

    const link = document.createElement('span');
    link.className = 'rider-url';
    link.textContent = `${publicBaseUrl}/track/${rider.token}`;
    link.title = link.textContent;

    const copy = document.createElement('button');
    copy.type = 'button';
    copy.className = 'copy-button';
    copy.textContent = 'Copy';
    copy.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(link.textContent);
        copy.textContent = 'Copied';
        setTimeout(() => { copy.textContent = 'Copy'; }, 1500);
      } catch {
        // Clipboard can be blocked; the full link is still in the tooltip.
      }
    });

    linkRow.append(link, copy);
    wrap.append(linkRow);
  }

  return wrap;
}

function renderRiders(riders) {
  currentRiders = riders;
  riderListEl.replaceChildren(...riders.map(riderRow));
  updateTrackingMode();
}

function applyRider(updated) {
  const withoutPosition = currentRiders.find((rider) => rider.id === updated.id);
  const merged = { ...withoutPosition, ...updated };
  currentRiders = currentRiders.map((rider) => (rider.id === updated.id ? merged : rider));
  renderRiders(currentRiders);

  if (!merged.monitored) {
    const marker = riderMarkers.get(merged.id);
    if (marker) {
      map.removeLayer(marker);
      riderMarkers.delete(merged.id);
    }
    const trail = riderTrails.get(merged.id);
    if (trail) {
      map.removeLayer(trail);
      riderTrails.delete(merged.id);
    }
    return;
  }

  if (merged.position) moveRider(merged.id, merged.position.lat, merged.position.lng, merged.position.source);
}

function riderLayer(riderId) {
  let marker = riderMarkers.get(riderId);
  if (!marker) {
    const color = riderColor(riderId);
    const icon = L.divIcon({
      className: 'rider-icon',
      html: `<span class="rider-dot" style="background:${color};box-shadow:0 0 12px ${color},0 0 34px ${color}80"></span>`,
      iconSize: [16, 16],
      iconAnchor: [8, 8]
    });
    marker = L.marker([0, 0], { icon, zIndexOffset: 1000 });
    const rider = currentRiders.find((item) => item.id === riderId);
    const label = document.createElement('span');
    label.textContent = rider ? rider.name : riderId;
    marker.bindTooltip(label, {
      permanent: true,
      direction: 'right',
      offset: [10, 0],
      className: 'map-name-label rider-map-label'
    });
    riderMarkers.set(riderId, marker);

    const trail = L.polyline([], { color, weight: 2, opacity: 0.45 });
    trail.addTo(map);
    riderTrails.set(riderId, trail);
  }
  return marker;
}

// Positions arrive about once a second. Easing the dot across that whole second
// keeps the movement a calm glide rather than a series of jumps.
const riderTargets = new Map();

function easeRiders() {
  for (const [riderId, target] of riderTargets) {
    const marker = riderMarkers.get(riderId);
    if (!marker || !marker._map) continue;

    const current = marker.getLatLng();
    const lat = current.lat + (target.lat - current.lat) * 0.07;
    const lng = current.lng + (target.lng - current.lng) * 0.07;

    if (Math.abs(target.lat - lat) < 1e-6 && Math.abs(target.lng - lng) < 1e-6) {
      marker.setLatLng(target);
      riderTargets.delete(riderId);
    } else {
      marker.setLatLng([lat, lng]);
    }
  }
  requestAnimationFrame(easeRiders);
}
requestAnimationFrame(easeRiders);

function moveRider(riderId, lat, lng, source = 'phone') {
  const marker = riderLayer(riderId);
  const latlng = L.latLng(lat, lng);

  if (marker._map) {
    riderTargets.set(riderId, latlng);
  } else {
    // First sighting: place it straight away rather than easing in from nowhere.
    marker.setLatLng(latlng).addTo(map);
  }

  const trail = riderTrails.get(riderId);
  trail.addLatLng(latlng);
  const points = trail.getLatLngs();
  if (points.length > TRAIL_POINTS) trail.setLatLngs(points.slice(-TRAIL_POINTS));

  const rider = currentRiders.find((item) => item.id === riderId);
  if (rider) {
    rider.position = { lat, lng, source, at: Date.now() };
    const status = document.querySelector(`[data-status="${riderId}"]`);
    if (status) {
      status.textContent = 'LIVE';
      status.classList.add('is-live');
    }
    updateTrackingMode();
  }
}

// Riders go quiet when the simulator stops; refresh the labels so the dashboard tells the truth.
setInterval(() => {
  for (const rider of currentRiders) {
    const status = document.querySelector(`[data-status="${rider.id}"]`);
    if (!status) continue;
    const state = riderStatus(rider);
    status.textContent = state.text;
    status.classList.toggle('is-live', state.live);
  }
  updateTrackingMode();
}, 2000);

/* ---------- live updates ---------- */

function connectLive() {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const socket = new WebSocket(`${protocol}//${location.host}`);

  socket.addEventListener('message', (event) => {
    let message;
    try {
      message = JSON.parse(event.data);
    } catch {
      return;
    }

    if (message.type === 'position') {
      const rider = currentRiders.find((item) => item.id === message.riderId);
      if (!rider || !rider.monitored) return;
      moveRider(message.riderId, message.lat, message.lng, message.source);
    }

    if (message.type === 'rider') {
      applyRider(message.rider);
    }

    if (message.type === 'arrival') {
      handleArrival(message.recipient);
    }

    if (message.type === 'recipient-removed') {
      dropRecipient(message.id);
    }

    if (message.type === 'assignments') {
      applyAssignments(message.recipients);
    }

    if (message.type === 'simulation') {
      simulationRunning = Boolean(message.running);
      renderDemo();
    }
  });

  socket.addEventListener('close', () => {
    setTimeout(connectLive, 2000);
  });
}

/* ---------- arrival ---------- */

const arrivalRings = new Map();

function pulseAt(recipient) {
  const ring = L.circleMarker([recipient.lat, recipient.lng], {
    radius: 8,
    color: '#efb84b',
    weight: 2,
    fill: false,
    className: 'arrival-ring'
  }).addTo(map);

  arrivalRings.set(recipient.id, ring);
  setTimeout(() => {
    map.removeLayer(ring);
    arrivalRings.delete(recipient.id);
  }, 5000);
}

function handleArrival(recipient) {
  applyRecipient(recipient);
  pulseAt(recipient);
  if (typeof playArrivalAlert === 'function') playArrivalAlert();

  // Bring the arrived name into view, so the box is right there to tick.
  const row = listEl.querySelector(`[data-recipient-id="${recipient.id}"]`);
  if (row) row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

/* ---------- dispatch ---------- */

// A new deal from the server: same destinations, different riders.
function applyAssignments(recipients) {
  currentRecipients = recipients;
  renderList(recipients);
  recipients.forEach(markerFor);
}

shuffleEl.addEventListener('click', async () => {
  const { ok, body } = await api('/api/assign', { method: 'POST' });
  if (!ok) return;
  applyAssignments(body.recipients);
  shuffleEl.textContent = 'Shuffled';
  setTimeout(() => { shuffleEl.textContent = '⇄ Shuffle'; }, 1200);
});

/* ---------- demo riders (dev mode) ---------- */

// The server plays the riders, so a demo needs no second terminal.
function renderDemo() {
  demoEl.textContent = simulationRunning ? '■ Stop demo' : '▶ Demo';
  demoEl.classList.toggle('is-live', simulationRunning);
  demoEl.title = simulationRunning
    ? 'Stop the simulated riders'
    : 'Dev mode: play the simulated riders from the server, no second terminal needed';
}

demoEl.addEventListener('click', async () => {
  const { ok, body } = await api('/api/dev/simulation', {
    method: 'POST',
    body: JSON.stringify({ on: !simulationRunning })
  });
  if (!ok) return;
  simulationRunning = Boolean(body.running);
  renderDemo();
});

/* ---------- startup ---------- */

async function refresh() {
  const { ok, body } = await api('/api/state');
  if (!ok) return;
  publicBaseUrl = body.publicBaseUrl || location.origin;
  simulationRunning = Boolean(body.simulation && body.simulation.running);
  renderDemo();
  // Riders first: the names carry the rider tag, so it needs to know who is who.
  renderRiders(body.riders);
  renderList(body.recipients);
  body.recipients.forEach(markerFor);
  body.riders.forEach((rider) => {
    if (rider.monitored && rider.position) moveRider(rider.id, rider.position.lat, rider.position.lng, rider.position.source);
  });
  // Keep the form folded away when there is already a route to work through.
  setFormOpen(body.recipients.length === 0);
}

async function loadSampleAddresses() {
  const { ok, body } = await api('/api/sample-addresses');
  if (!ok) return;
  datalistEl.replaceChildren(
    ...body.map((sample) => {
      const option = document.createElement('option');
      option.value = sample.address;
      return option;
    })
  );
}

formEl.addEventListener('submit', async (event) => {
  event.preventDefault();
  const data = new FormData(formEl);
  const payload = { name: data.get('name'), address: data.get('address') };
  if (selectedPin) {
    payload.lat = selectedPin.lat;
    payload.lng = selectedPin.lng;
  }
  const { ok, body } = await api('/api/recipients', {
    method: 'POST',
    body: JSON.stringify(payload)
  });

  if (!ok) {
    showError(body.error || 'That recipient could not be added.', body.samples);
    return;
  }

  errorEl.hidden = true;
  formEl.reset();
  clearPin();
  currentRecipients = [...currentRecipients, body];
  renderList(currentRecipients);
  setFormOpen(false);
  markerFor(body);
  map.panTo([body.lat, body.lng]);
});

function startClock() {
  const clock = document.getElementById('clock');
  if (!clock) return;
  const tick = () => {
    clock.textContent = `LOCAL / ${new Date().toLocaleTimeString('en-GB')}`;
  };
  tick();
  setInterval(tick, 1000);
}

refresh();
loadSampleAddresses();
connectLive();
startClock();
