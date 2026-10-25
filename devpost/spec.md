---
doc: spec
status: approved
---

# Rider Watch — Technical Spec

## How This Works, In Plain Language
Rider Watch is one small web app that runs on your computer. You start it with one command and open it in your browser.

- **The server** is a small program (Node.js with Express) that stays running. It serves the pages, checks your login, remembers recipients, and receives rider positions.
- **The pages** are plain web pages: a login page, your dashboard, and a rider tracking page. No big framework.
- **The map** is Leaflet, a free map library, with a dark map style so it looks like World Monitor.
- **Live updates** use WebSockets, a connection that stays open so the dashboard updates the instant a rider moves, with no refresh.
- **Saved data** (recipients, which riders are monitored, which parcels are received) lives in one file, `data/db.json`. Think of it as a small spreadsheet the app reads and writes.
- Rider movement can be simulated with `scripts/simulate-rider.js` or shared from a real phone. Phone GPS requires HTTPS, so optional phone-test mode opens a temporary tunnel to the local Node server. The rider explicitly starts and stops sharing on the phone page. The dashboard keeps its visible "Simulated riders" label for simulator sessions.

Why this shape: it needs no accounts with outside services, no database to install, and no deployment, so it fits a few hours and is easy to record.

## The Core Journey Through the System
PRD ref: `prd.md > The Core Journey`.

1. **Login** — you enter your username and password on `login.html`. The server checks them against the single owner account in `config.json`, then gives your browser a session cookie (a small token that says "this is the owner"). → you land on `dashboard.html`.
2. **Add recipient** — you type a name and either choose a built-in sample address or place a destination pin on the map. The server saves the selected map location in `db.json`. → the name appears in the side panel and a marker appears on the map.
3. **Monitor riders** — you tick Rider 1 and/or Rider 2. The server marks them monitored and produces a **tracking link** for each (`/track/<token>`). The dashboard shows a copyable link. In phone-test mode it uses the HTTPS tunnel address; the owner shares it manually.
4. **Rider shares location** — for simulation, `simulate-rider.js` sends positions to `POST /api/location/<token>`. For a real phone, the rider opens `rider.html` through the HTTPS link and taps **Start sharing**; the browser asks for location permission. The rider can stop sharing on that page.
5. **Watch** — the server forwards each position over the WebSocket to your dashboard. → the rider's dot moves on the map.
6. **Arrival** — each time a position arrives, the server measures its distance to every recipient who has not yet arrived. If any is within **50 metres**, that recipient is marked **arrived**, the server broadcasts it, and the dashboard plays an **alert sound** and highlights the recipient.
7. **Call** — you call the recipient on WhatsApp, outside the app.
8. **Received** — you tick the recipient's checkbox. The server saves `received: true` in `db.json`. → the recipient shows as received.

## Stack
| Piece | Choice | Why / tradeoff | Docs |
|---|---|---|---|
| Runtime | Node.js (v24 already installed here) | Already on your machine; one language for server and pages | https://nodejs.org/docs |
| Server | Express | Small, widely used way to serve pages and an API | https://expressjs.com |
| Live updates | `ws` (WebSockets) | Instant updates without refreshing | https://github.com/websockets/ws |
| Map | Leaflet + Esri dark grey canvas tiles | Free, no account or key; tradeoff: tiles need internet | https://leafletjs.com |
| Pages | Plain HTML, CSS, JavaScript | No framework to learn or debug | https://developer.mozilla.org |
| Sessions | `express-session` | Simple login cookie for one owner | https://github.com/expressjs/session |
| Storage | One JSON file | No database setup; tradeoff: fine for one owner, not for scale | — |
| Phone-test tunnel | Cloudflare Quick Tunnel (`cloudflared`) | Optional temporary HTTPS URL to reach the local server from a phone; no account required; not production hosting | https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/ |

**Verified in the build:** CARTO's legacy `basemaps.cartocdn.com` endpoints no longer serve map imagery without an API key — every request returns the same 2.5 KB "API KEY REQUIRED" placeholder tile. Replaced with Esri's World Dark Gray Canvas (`server.arcgisonline.com/.../Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}`), which needs no key, supports zoom up to 16, and returns distinct tiles per coordinate. Package versions are chosen at install time.

## Where It Runs and How Someone Tries It
- **Runs on:** your computer, as a local Node.js process. Needs Node.js (v24 present) and an internet connection for map tiles and optional phone testing.
- **Start:**
  1. `npm install` (once)
  2. `npm start` → server on `http://localhost:3000`
  3. In a second terminal: `npm run simulate` to start the simulated riders (after you've set them to monitored on the dashboard).
- **Phone test:** install `cloudflared` from Cloudflare's official downloads, then run `npm run share`. It starts the server and a temporary Cloudflare Quick Tunnel and displays the public URL used for copyable rider links. Open that link on your phone and choose **Start sharing**. Stop the command to close the tunnel. Anyone with the URL can reach the app; anyone with a rider tracking link can submit positions while the server is running. Live location requests pass through Cloudflare. This is a test setup, not production hosting.
- **Demo recording:** open `http://localhost:3000`, log in, add recipients, tick the riders, run the simulation, show the dots moving, the arrival alert, and the received tick.
- **Submission:** a short demo video and a public GitHub repository are both required. Deployment is optional and not planned. The README documents these steps; `6-ship` covers the video and repo.
- **Credentials:** the owner login lives in `config.json` (not committed); `config.example.json` shows the shape. Never commit real passwords.

## Look and Feel
Carried from `prd.md > Look and Feel` and `scope.md > Inspiration & Identity`.
- **Reference:** World Monitor (https://www.worldmonitor.app/): dark, map-first, real-time dashboard with side panels.
- **Palette:** near-black navy backgrounds with a glowing accent (emerald/teal for riders and live state, amber for arrivals and alerts). Fonts and exact colors can be adjusted at review.
- **Polish ("fascinating"):** soft glows on rider dots, a pulsing ring when a rider arrives, trailing path lines behind riders, smooth easing between position updates, frosted-glass side panel, subtle map vignette.
- **Typography:** a clean modern sans-serif for the interface, with a monospace font for small data labels (coordinates, times).
- **Density:** map fills most of the screen; a narrow side panel on the right. The side panel lists names and expands on click; compact labels identify map markers.
- **Map labels:** show each rider's name beside its moving point and each recipient's name beside its destination pin. Use the names already in the app; do not look up street names for live GPS coordinates.
- **Copy tone:** short, calm, plain. The dashboard labels recent simulated positions as "Simulated riders" and real phone positions as "Phone GPS"; if both are active it says "Mixed rider sources".
- **Limits:** plain CSS can honor all of this; heavy effects stay light so the dashboard runs smoothly while recording.

## Components

### Login page and session
Owner signs in; wrong credentials show an error and no dashboard.
Files: `public/login.html`, `src/auth.js`.
PRD ref: `prd.md > Owner login`.

### Dashboard shell and side panel
Map plus the "Recipients to reach" panel: names only, click to expand recipient details, checkbox to mark received, an "Add recipient" form supporting sample addresses or map pins, and rider monitoring controls.
Files: `public/dashboard.html`, `public/js/dashboard.js`, `public/css/style.css`.
PRD ref: `prd.md > Recipients to reach (side panel)`, `prd.md > Rider monitoring`.

### Address lookup (built-in sample addresses)
Looks up an entered address in a fixed list and returns a map location. If the address isn't in the list, the form says so and offers the sample addresses to pick from.
Files: `data/sample-addresses.json`, `src/geo.js`.
PRD ref: `prd.md > Recipients to reach (side panel)`.

### Map-pin destination
The owner can center the map on their current location after granting browser permission; this one-time position is used only to pan the map and is not sent to or saved by the server. They can then place a destination pin directly on the map. The selected destination latitude and longitude are validated and saved. Sample-address selection remains available.
Files: `public/js/dashboard.js`, `src/routes.js`, `src/store.js`.
PRD ref: `prd.md > Recipients to reach (side panel)`.

### Dispatch (which rider carries which parcel)
Every recipient is dealt to a rider as it is added, and a **Shuffle** control re-deals the unfinished ones. The choice is random among the riders carrying the fewest parcels still out, so one rider never ends up with the whole route. The tag on each row and the rider's dot colour show the plan. See `spec.md > Decisions and Open Issues` for why it is random-but-level rather than a plain coin toss.
Files: `src/assign.js`, `src/routes.js`.
PRD ref: `prd.md > Recipients to reach (side panel)`, `prd.md > Live map and arrival alert`.

### Rider monitoring and tracking links
Marks riders monitored and creates a tracking link per rider.
Files: `src/routes.js`, `src/store.js`.
PRD ref: `prd.md > Rider monitoring`.

### Rider tracking page
Page a real phone opens from the tracking link. It explains sharing, starts browser geolocation only after the rider taps **Start sharing**, posts positions, and can stop its location watch.
Files: `public/rider.html`, `public/js/rider.js`.
PRD ref: `prd.md > Rider tracking page`.

### Temporary HTTPS tunnel
Optional `npm run share` mode starts the local server and `cloudflared tunnel --url http://127.0.0.1:<port>`. Its temporary `trycloudflare.com` HTTPS URL is made available to the owner dashboard so copied tracking links work on a phone. The tunnel requires installing `cloudflared`, is publicly reachable to anyone with its URL, and is only for a hands-on test, not production hosting.
Files: `server.js`, `package.json`.
PRD ref: `prd.md > Rider monitoring`.

### Rider simulator
Plays two riders, each walking the parcels dealt to it and then back again, posting positions every second and re-reading the plan every three seconds so a parcel added or shuffled mid-demo is picked up without a restart. Clearly labeled simulated in the app.
Files: `scripts/simulate-rider.js`.
PRD ref: `prd.md > Live map and arrival alert`.

### Live map and rider positions
Shows monitored riders as moving glowing dots with trails and their names beside the dots; recipient destination pins show recipient names. Riders who haven't connected show as "not connected".
Files: `public/js/dashboard.js`, `src/ws.js`.
PRD ref: `prd.md > Live map and arrival alert`.

### Arrival detection and alert
On each position update, computes distance from the rider to every un-arrived recipient it is carrying. Within 50 m means arrived; another rider passing that destination changes nothing. The dashboard plays an alert sound (generated in the browser, so no audio file) and highlights the recipient. Sound is enabled by the login click, since browsers block sound before interaction.
Files: `src/arrival.js`, `public/js/alert.js`.
PRD ref: `prd.md > Live map and arrival alert`.

## Data Model
All in `data/db.json`, read at startup and saved on every change. It survives restarting the server.

- **recipient**: `id`, `name`, `address` (sample address or null for a map pin), `lat`, `lng`, `riderId` (the rider carrying it), `arrived` (true/false), `received` (true/false). Updated when you add, when the plan is shuffled, when a rider arrives, when you tick the box, and when you clear it away.
- **rider**: `id` (rider-1, rider-2), `name`, `monitored` (true/false), `token` (for the link). Updated when you tick monitor.
- **latest position** (not saved to file): kept in server memory and pushed over the WebSocket; trails live in the browser. After a restart riders show as "not connected" until positions arrive again.

## File Structure
```
rider-watch/
├── server.js                 # starts Express + WebSocket
├── package.json
├── config.example.json       # shape of owner login (real config.json is git-ignored)
├── README.md                 # how to run and demo
├── src/
│   ├── auth.js               # login + session
│   ├── routes.js             # API: recipients, riders, location
│   ├── store.js              # read/write data/db.json
│   ├── geo.js                # address lookup + distance
│   ├── arrival.js            # arrival detection
│   ├── assign.js              # which rider carries which parcel
│   └── ws.js                 # live updates to dashboard
├── public/
│   ├── login.html
│   ├── dashboard.html
│   ├── rider.html
│   ├── css/style.css
│   └── js/ (dashboard.js, alert.js, rider.js)
├── data/
│   ├── sample-addresses.json # built-in addresses with locations (SAMPLE DATA)
│   └── db.json               # saved recipients/riders (created at first run)
├── scripts/
│   └── simulate-rider.js     # simulated riders (SIMULATION)
└── devpost/                  # Devpost learning workspace
```

## External Services and Dependencies
- **Map tiles (Esri dark grey canvas):** loaded by the browser as images, `https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}`. No key. Needs internet. Attribution "Esri, HERE, Garmin, © OpenStreetMap contributors" is shown on the map, per https://leafletjs.com/reference.html#tilelayer. Max zoom 16. Cost: free for light, non-commercial use. (CARTO dark tiles were dropped: they now require an API key and return a watermark.)
- **Phone-test tunnel (Cloudflare Quick Tunnel):** optional temporary public HTTPS access to the local server. Anyone with the URL can reach the app, the dashboard remains behind owner login, and anyone with a rider token link can submit that rider's locations while the tunnel is active. Location requests pass through Cloudflare. This is not a production deployment.
- **npm packages:** `express`, `express-session`, `ws`, Leaflet (vendored locally). Phone-test mode additionally requires the `cloudflared` executable. Docs linked in Stack.
- **Internal API (own server):**
  - `POST /login` `{username, password}` → session cookie
  - `GET /api/state` → recipients and riders; includes the temporary HTTPS base URL when phone-test mode is active
  - `POST /api/recipients` `{name, address}` or `{name, lat, lng}` → recipient with location, or a validation error for an unknown address/invalid coordinates
  - `POST /api/recipients/:id/received` `{received}` → updated recipient
  - `DELETE /api/recipients/:id` → removes a received delivery (`409` if it has not been ticked received)
  - `POST /api/assign` → re-deals every unfinished parcel between the riders, returns all recipients
  - `POST /api/riders/:id/monitor` `{monitored}` → rider with tracking link
  - `POST /api/location/:token` `{lat, lng, source}` → position accepted (no login; the token identifies the rider; source is `phone` or `simulation`)
  - Authenticated owner WebSocket messages to dashboard: `position`, `rider`, `arrival`, `recipient-removed`, `assignments`. Connections without a valid owner session are rejected.

## Important Failure Modes
- **Map tiles don't load (no internet)** → the dashboard still works with a plain dark background, and a small notice says the map imagery couldn't load.
- **Address not in the built-in list** → the form says the address wasn't found and shows the sample addresses to choose from.
- **Rider stops sending positions** → rider shown as "not reporting" after a few seconds of silence.
- **Phone location permission denied or unavailable** → the rider page explains the state; no position is sent.
- **HTTPS tunnel cannot be opened** → the command reports the error; local dashboard and simulation remain available with `npm start` and `npm run simulate`.
- **Alert sound blocked by the browser** → the arrival is still highlighted on screen; the login click normally enables sound.

## What Was Simplified and Why
- **Temporary Cloudflare tunnel instead of production hosting** — the phone test can use real GPS without deploying the app, but the temporary public URL is only suitable for a controlled test.
- **Built-in sample addresses** for the reproducible simulation, plus map pins for a real nearby test. NIPOST address suggestions are deferred until official API documentation and authorized access are available.
- **One owner account in a config file** instead of sign-up and many owners — multiple owners is deferred in the PRD.
- **Tracking link shown on screen** instead of sent by SMS/WhatsApp — sending needs a messaging service and cost.
- **JSON file** instead of a database — one owner, tiny data.

## Decisions and Open Issues
**Learner choices:**
- Keep simulated movement as a reproducible demo path and add an optional real-phone test.
- Keep simulated movement and add a real-phone test through a temporary HTTPS tunnel.
- Use a map pin for the nearby real test destination while official NIPOST address-lookup API access is pending.

**Added after the build, at the learner's request:**
- Every recipient is dealt to a rider as it is added, and a Shuffle control re-deals the unfinished ones. The choice is random *among the riders carrying the fewest unfinished parcels* rather than a plain coin toss, because a coin toss can hand one rider the whole route and leave the other idle — which reads as a bug in a demo. Only the rider carrying a parcel completes it, so the plan on the panel means something; a rider passing another rider's destination leaves it alone. The simulator walks each rider's own parcels and re-reads the plan every three seconds, so an order added mid-journey is picked up without a restart.

**Recommended by the agent and accepted by the learner at review ("yes"):**
- Node.js + Express, WebSockets, Leaflet with dark tiles, JSON file storage, single config-file owner login.
- 50-metre arrival distance (from the PRD's open question, "how close counts as arrived").

**Learner uncertainty:** none identified at review (the learner did not name one). Noted and proceeding; if it comes up, the simulator will show directly how a position becomes a moving dot.

**Open issues:**
- Where the sample addresses should be located (city/area). Placeholder coordinates are used and labeled as sample data; the map pin supports a nearby real test without changing those samples.
- NIPOST nearby-address suggestions need official API documentation and authorized access before implementation.
- ~~Confirm the dark tile source works and its terms~~ — resolved in the build: CARTO needs a key now, Esri dark grey canvas is in use and verified. Remaining question: whether to stay on Esri or move to a keyed provider later for a stronger dark style.
