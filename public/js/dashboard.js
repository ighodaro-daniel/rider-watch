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
