# Rider Watch

A live dispatch dashboard for a small rider team. The owner logs in, adds the recipients to reach, watches riders move on a dark map, and is alerted the moment a rider reaches a destination — then ticks the parcel off as received.

This is a proof of concept built for the Devpost Build With AI: Basics hackathon. Rider movement can be **simulated** or shared from a real phone over a temporary HTTPS tunnel; login, recipients, live map, arrival detection, alert, and received tick are real.

## What you need

- Node.js 18 or newer (built and tested on v24)
- An internet connection for the map tiles
- For real-phone testing, `cloudflared` installed from [Cloudflare's official downloads](https://developers.cloudflare.com/tunnel/downloads/)

## Run it

```bash
npm install
```

Create `config.json` from the example and set your own owner login (this file is git-ignored, so your password never gets committed):

```bash
cp config.example.json config.json
```

Then start the app:

```bash
npm start
```

Open http://localhost:3000 and sign in with the username and password from `config.json`.

## Test from a real phone

Install Cloudflare's `cloudflared` program first, then run:

```bash
npm run share
```

When the command prints `Phone-test HTTPS link base`, open that HTTPS URL on the owner device and sign in. On the dashboard, choose **Center map on my location** (the one-time position is used only in your browser to move the map), then choose **Choose destination on map** and tap the intended delivery spot. Monitor a rider and copy the rider's HTTPS tracking link to your phone. The rider page asks the rider to tap **Start sharing** and grant location permission; **Stop sharing** ends updates. Keep the terminal running during the test; press Ctrl+C to close the temporary tunnel.

Cloudflare Quick Tunnels need no account and are for testing, not production. While running, the temporary URL makes the local app reachable through Cloudflare; anyone with the URL can reach the app, though the dashboard and its live WebSocket still require owner login. Live location requests pass through Cloudflare. Treat rider links as private, share them only with the intended rider, and stop the command when finished.

## Try the demo

After ticking a rider on the dashboard, either press **▶ Demo** in the RIDERS section (the server plays the riders, no second terminal needed) or run the standalone simulator in a second terminal:

```bash
npm run simulate
```

1. Log in — the dashboard opens with a dark map and an empty side panel.
2. Add a recipient: type a name and one of the sample addresses (start typing and the list suggests them). The name arrives already dealt to a rider — a small **R1** or **R2** tag beside it.
3. Tick **Rider 1** and **Rider 2**. A tracking link appears for each.
4. Press **▶ Demo** (or run `npm run simulate`). A teal dot (Rider 1) and a violet dot (Rider 2) appear and glide along their own routes, leaving fading trails; each leg takes about 80 seconds. Each rider only walks the deliveries tagged with its number; **⇄ Shuffle** above the riders re-deals them and the dots take the new plan.
5. When a rider comes within 50 metres of a recipient, that recipient is marked **arrived**, the panel highlights it, and the dashboard plays a short chime. Click anywhere on the page first so the browser allows sound.
6. Tick the recipient's checkbox to mark it **received**. A **×** appears beside it: click once and it asks **Remove?**, click again to clear the finished delivery and free the list for a new name.
7. Stop the simulator and the riders change to **NOT REPORTING** after a few seconds of silence.

## How it is put together

| Piece | What it does |
| --- | --- |
| `server.js` | Express server, session login, HTTP + WebSocket startup |
| `src/auth.js` | Owner login and the session guard |
| `src/routes.js` | API: state, recipients, riders, incoming rider positions |
| `src/store.js` | Reads and writes `data/db.json` |
| `src/geo.js` | Sample-address lookup and distance between two points |
| `src/arrival.js` | Turns a position within 50 m of a recipient into one arrival |
| `src/assign.js` | Deals each delivery to a rider, at random but evenly |
| `src/ws.js` | Pushes positions, rider changes and arrivals to the dashboard |
| `public/js/dashboard.js` | Map, markers, trails, side panel, live updates |
| `public/js/alert.js` | Arrival chime, generated in the browser (no audio file) |
| `public/js/rider.js` | The page a rider's phone opens from a tracking link |
| `scripts/simulate-rider.js` | Plays the two riders (SIMULATION) |

Saved data lives in `data/db.json` (git-ignored, created on first run). Sample addresses live in `data/sample-addresses.json` and are placeholders for Lagos.

## Deliberately not built

Multiple owners, more than two riders, off-route detection, delivery history, in-app calls, rider logins, production hosting, and NIPOST address suggestions (pending official API access) are outside this proof of concept. The plan and reasoning live in `devpost/`.
