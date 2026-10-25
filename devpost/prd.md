---
doc: prd
status: approved
---

# Rider Watch — Product Requirements

A live dispatch dashboard for a small-business owner: log in, add recipients to reach, send tracking links to riders, watch riders move on a map, get alerted on arrival, and tick off received parcels.
Source: `scope.md > The Core Loop`, `scope.md > The POC Boundary`.

## The Core Journey
1. The owner opens the app and sees a **login page**. After logging in, they land on the **dashboard**.
2. The owner **adds a recipient**: a name and a destination. For a nearby real-world test, the owner places the destination pin directly on the dashboard map; sample addresses remain available for simulation.
3. The owner **chooses the rider(s) to monitor**. A tracking link is shown on the dashboard for the owner to copy and share manually. When the app is started in phone-test mode, this link uses its temporary HTTPS address.
4. The rider opens the link on their phone (no login). The page explains location sharing and waits for the rider to tap **Start sharing** before requesting location access. The rider can stop sharing from that page.
5. On the dashboard, the owner sees the rider(s) **moving on the map** in real time.
6. When a rider reaches a recipient's destination, the app **marks arrival automatically** and **sounds an alert** on the dashboard.
7. The owner **calls the recipient on WhatsApp** (outside the app).
8. The owner **ticks the recipient's checkbox** in the side panel to mark the parcel as **received**.

Success: the demo shows steps 5 through 8 working.

## Screens and Layout
- **Login page** — the owner signs in, then goes to the dashboard. (`scope.md > Who It's For`)
- **Owner dashboard** — a large live map fills most of the screen, with a **side panel** listing recipients to reach. Rider names appear beside their moving map points, and recipient names appear beside their destination pins. The owner can center the map on their current location after granting permission, add a recipient, and choose which rider(s) to monitor.
- **Rider tracking page** — a simple phone page opened from the link. Clearly explains location sharing, asks the rider to start it, and lets them stop it. No login.

## Look and Feel
- Reference: **World Monitor** (https://www.worldmonitor.app/) — dark, map-first, real-time dashboard with side panels.
- The learner wants it to look more **"fascinating"**: World Monitor's style with extra aesthetic polish.
- Specific fonts, colors and effects are **not yet chosen**; `4-spec` translates this direction into styling and the learner can review it then.

## Features and Behavior

### Owner login
- As the business owner, I want to log in so that the dashboard is mine.
  - [ ] Opening the app shows a login page first.
  - [ ] Valid login goes to the dashboard.
  - [ ] Invalid login shows an error and does not open the dashboard.

### Recipients to reach (side panel)
- As the owner, I want a list of recipients to reach so that I can see what's left to deliver.
  - [ ] I can add a recipient with a **name** and a destination selected from the sample addresses or pinned directly on the map.
  - [ ] I can ask the dashboard to center the map on my current location; this one-time location is used only in my browser to move the map and is not sent to or saved by the server.
  - [ ] The side panel lists recipients **by name only** (compact, breadcrumb-style).
  - [ ] Clicking a name expands to show that recipient's **info** (name and address or pinned destination).
  - [ ] Each recipient has a **checkbox**; ticking it marks the parcel **received**.
  - [ ] Each recipient is **assigned to one rider**, shown as a small tag beside the name; the assignment is random when the recipient is added.
  - [ ] A **Shuffle** control re-deals every unfinished recipient between the riders.
  - [ ] A **received** delivery can be **removed** from the list, freeing space for a new recipient. Pending and arrived-but-unreceived deliveries cannot be removed.

### Rider monitoring
- As the owner, I want to choose which rider(s) to monitor so that I only see the ones on the job.
  - [ ] I can select one or both riders to monitor.
  - [ ] Selecting a rider makes a **tracking link** available to copy and share with that rider.

### Rider tracking page
- As a rider, I want to know when I'm being tracked so that it's transparent.
  - [ ] Opening the link explains location sharing before it starts.
  - [ ] The rider explicitly starts sharing; their phone asks for location permission.
  - [ ] The rider can stop sharing from the page.
  - [ ] Once shared, the rider's position updates on the owner's map.
  - [ ] If location permission is denied or unavailable, the page explains the problem without pretending to share.

### Live map and arrival alert
- As the owner, I want to see riders move and be alerted on arrival so that I know the moment to call the recipient.
  - [ ] Monitored riders appear on the map and **move as the rider moves**.
  - [ ] Each moving rider point is labeled with the rider's name, and each destination pin is labeled with the recipient's name.
  - [ ] When the **assigned** rider reaches a recipient's destination, it counts as an **arrival** and the recipient is marked **arrived** automatically. Another rider passing that destination does not complete it.
  - [ ] An **alert sound** plays on the dashboard when this happens.

## States and Boundaries
- **First use / empty** — dashboard with the map and an empty recipient list; prompt to add a recipient.
- **Rider hasn't opened the link** — rider shown as not connected / no position on the map.
- **Rider has not started sharing / permission denied** — the rider page explains the state and does not send positions.
- **Rider stops sharing** — the browser stops watching and the page confirms sharing has stopped.
- **Rider location unavailable** — if the rider's phone can't share location, the owner sees that the rider isn't reporting.
- **Arrived, not yet received** — recipient is flagged arrived (alert sounded), checkbox still unticked.
- **Received** — checkbox ticked; recipient shown as received, with a remove control to clear it off the route.
- **Access** — only the logged-in owner sees the dashboard. Riders only see their tracking page.

## Product Decisions
- Owner logs in; riders do not — "riders don't need to login, the app mainly for the business owner."
- Tracking link appears when the owner sets a rider to monitor; the owner shares it manually. Phone-test links use a temporary HTTPS tunnel.
- Real phone location sharing starts only after the rider taps **Start sharing** and grants browser permission; the rider can stop it.
- A destination can be selected by placing a pin on the map. Sample addresses remain available for simulated demos.
- Owner marks "received" after the WhatsApp call — the owner stays in control; no in-app calls.
- Side panel shows names only, expanding on click — keeps the list compact.
- Look: World Monitor style, with added aesthetic polish.

- A **▶ Demo** control on the dashboard (dev mode) starts and stops the simulated riders from the server, so a demo needs no second terminal; `npm run simulate` stays available. Simulated movement is deliberately slow — about 80 seconds per leg — so the dot glides between stops instead of jumping.
- Each recipient is carried by one rider: the assignment is random when the recipient is added, and Shuffle re-deals the unfinished ones. Only the assigned rider completes a delivery, so a rider passing another rider's destination leaves it alone.
- The deal is random among the riders with the fewest parcels still out, not a plain coin toss — a coin toss can leave one rider with everything and the other idle.
- The demo uses a single owner; multiple owners with separate dashboards is deferred.

## What We're Building
- Owner login page
- Dashboard with live map and side panel
- Add recipient (name and sample address or map pin); list by name; click to expand; checkbox for received
- Select rider(s) to monitor; copy and share the tracking link
- Rider tracking page that starts phone location sharing only after explicit consent and can stop sharing
- Optional temporary HTTPS tunnel for real-phone testing; keep simulated riders available
- Automatic arrival detection and alert sound
- Rider-name labels on moving points and recipient-name labels on destination pins

## Deferred From the POC
- **Multiple owners with separate dashboards** — the owner mentioned other businesses could use it; needs sign-up and data separation, too big for 2–4 hours.
- **More than 2 riders** — plan to scale when profitable.
- **Off-route detection** — the original worry; harder than arrival detection.
- **Delivery history and reports.**
- **Production hosting and SMS/WhatsApp link delivery** — the phone test uses a temporary HTTPS tunnel and manual link sharing, not a deployed production service or messaging provider.
- **Nearby registered-address suggestions through NIPOST** — the learner requested suggestions when an address is not registered. Integration is deferred until NIPOST provides official API documentation and access; do not scrape its public postcode-finder website.

## Possible Later Enhancements
- Shift-based tracking for riders.
- Route lines on the map between rider and destination.

## Non-Goals
- In-app phone calls — the owner calls on WhatsApp.
- Rider login — riders only use a link.
- Recipient-facing features — the owner confirms receipt.

## Open Questions
- **Can wait:** How close counts as "arrived"? (spec can propose a distance for the learner to agree to.)
- The POC supports both simulated movement and an optional real-phone test through a temporary HTTPS tunnel.
- The owner chooses the nearby test destination by placing a map pin. Sample addresses remain available for simulation.
- NIPOST nearby-address suggestions are deferred while the learner requests official API access and documentation.
