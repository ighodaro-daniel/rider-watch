const token = location.pathname.split('/').filter(Boolean).pop();
const statusEl = document.getElementById('rider-status');
const detailEl = document.getElementById('rider-detail');
const dotEl = document.getElementById('rider-dot');

let lastSent = 0;

function setStatus(text, detail, live) {
  statusEl.textContent = text;
  if (detail !== undefined) detailEl.textContent = detail;
  dotEl.classList.toggle('is-live', Boolean(live));
}

async function send(position) {
  const now = Date.now();
  if (now - lastSent < 1000) return; // at most one update a second
  lastSent = now;

  try {
    const response = await fetch(`/api/location/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat: position.coords.latitude, lng: position.coords.longitude })
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setStatus(body.error || 'This tracking link is not valid.', '', false);
      return;
    }

    const time = new Date().toLocaleTimeString();
    setStatus('Location is being shared', `${position.coords.latitude.toFixed(5)}, ${position.coords.longitude.toFixed(5)} · ${time}`, true);
  } catch {
    setStatus('Lost connection to the dispatcher', 'Trying again…', false);
  }
}

if (!navigator.geolocation) {
  setStatus('This browser cannot share location', 'Open the link on a phone with location enabled.', false);
} else if (!window.isSecureContext) {
  // Browsers only allow location on https or localhost.
  setStatus('Location needs a secure connection', 'Open this link over https, or use the simulator on the dashboard.', false);
} else {
  navigator.geolocation.watchPosition(
    send,
    (error) => {
      if (error.code === error.PERMISSION_DENIED) {
        setStatus('Location permission was blocked', 'Allow location for this page, then reload.', false);
      } else {
        setStatus('Waiting for a location fix…', error.message || '', false);
      }
    },
    { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 }
  );
}
