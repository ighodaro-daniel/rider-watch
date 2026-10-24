# Rider Watch

A live dispatch dashboard for a small rider team. The owner logs in, adds the recipients to reach, watches riders move on a dark map, and is alerted the moment a rider reaches a destination — then ticks the parcel off as received.

This is a proof of concept built for the Devpost Build With AI: Basics hackathon. Rider movement is **simulated**; everything else (login, recipients, live map, arrival detection, alert, received tick) is real.

## What you need

- Node.js 18 or newer (built and tested on v24)
- An internet connection for the map tiles

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

## Try the demo

In a second terminal, after ticking a rider on the dashboard:

```bash
npm run simulate
```

1. Log in — the dashboard opens with a dark map and an empty side panel.
2. Add a recipient: type a name and one of the sample addresses (start typing and the list suggests them).
3. Tick **Rider 1** and **Rider 2**. A tracking link appears for each.
4. Run `npm run simulate`. Teal dots appear and move along their routes, leaving fading trails.
5. When a rider comes within 50 metres of a recipient, that recipient is marked **arrived**, the panel highlights it, and the dashboard plays a short chime. Click anywhere on the page first so the browser allows sound.
6. Tick the recipient's checkbox to mark it **received**.
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
| `src/ws.js` | Pushes positions, rider changes and arrivals to the dashboard |
| `public/js/dashboard.js` | Map, markers, trails, side panel, live updates |
| `public/js/alert.js` | Arrival chime, generated in the browser (no audio file) |
| `public/js/rider.js` | The page a rider's phone opens from a tracking link |
| `scripts/simulate-rider.js` | Plays the two riders (SIMULATION) |

Saved data lives in `data/db.json` (git-ignored, created on first run). Sample addresses live in `data/sample-addresses.json` and are placeholders for Lagos.

## Using a real phone as a rider

The tracking link works from a real phone, but browsers only allow location sharing over **HTTPS** — an `http://` address other than `localhost` is blocked by the browser, and the rider page says so instead of failing silently. For a real ride you would expose the app through an HTTPS tunnel (for example ngrok) and open that link. The demo recording uses the simulator, so nothing is needed for submission.

## Deliberately not built

Multiple owners, more than two riders, off-route detection, delivery history, in-app calls, and rider logins are all outside this proof of concept. The plan and reasoning live in `devpost/`.
