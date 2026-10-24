const map = L.map('map', { zoomControl: false }).setView([6.5244, 3.3792], 12);

L.control.zoom({ position: 'bottomleft' }).addTo(map);

const tiles = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap &copy; CARTO',
  maxZoom: 19
});

tiles.on('tileerror', () => {
  document.getElementById('map-notice').hidden = false;
});
tiles.addTo(map);

const markers = new Map();
const expanded = new Set();
const listEl = document.getElementById('recipient-list');
const emptyEl = document.getElementById('empty-state');
const countEl = document.getElementById('recipient-count');
const formEl = document.getElementById('add-recipient');
const errorEl = document.getElementById('form-error');
const datalistEl = document.getElementById('sample-addresses');

async function api(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  const body = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, body };
}

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
  marker.bindTooltip(recipient.name, { direction: 'top', offset: [0, -8] });
  marker.setStyle({ color: recipient.received ? '#5ee8c3' : '#efb84b', fillColor: recipient.received ? '#5ee8c3' : '#efb84b' });
  return marker;
}

function rowFor(recipient) {
  const item = document.createElement('li');
  item.className = 'recipient';
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

  row.append(nameButton, tick);

  const info = document.createElement('div');
  info.className = 'recipient-info';
  info.hidden = !expanded.has(recipient.id);
  info.textContent = recipient.address;

  item.append(row, info);
  return item;
}

let currentRecipients = [];

function renderList(recipients) {
  currentRecipients = recipients;
  countEl.textContent = String(recipients.length).padStart(2, '0');
  emptyEl.hidden = recipients.length > 0;
  listEl.hidden = recipients.length === 0;
  listEl.replaceChildren(...recipients.map(rowFor));
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

async function refresh() {
  const { ok, body } = await api('/api/state');
  if (!ok) return;
  renderList(body.recipients);
  body.recipients.forEach(markerFor);
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
  const { ok, body } = await api('/api/recipients', {
    method: 'POST',
    body: JSON.stringify({ name: data.get('name'), address: data.get('address') })
  });

  if (!ok) {
    showError(body.error || 'That recipient could not be added.', body.samples);
    return;
  }

  errorEl.hidden = true;
  formEl.reset();
  currentRecipients = [...currentRecipients, body];
  renderList(currentRecipients);
  markerFor(body);
  map.panTo([body.lat, body.lng]);
});

refresh();
loadSampleAddresses();
