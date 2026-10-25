---
doc: checklist
status: approved
---

# Build Checklist

Build mode: learn

## Slices

- [ ] **1. See a real rider move on the map**
  Becomes usable: The owner can sign in, place a nearby destination pin, share a temporary HTTPS tracking link, and see a rider's phone position update on the live map after the rider explicitly starts sharing; rider and recipient names identify the map markers.
  Why now: This makes the requested real-phone test the first usable behavior and surfaces the phone-permission and HTTPS-tunnel risks early; project setup is part of this working path, not a separate step.
  PRD ref: `prd.md > The Core Journey` (steps 1–5); `prd.md > Rider tracking page`; `prd.md > What We're Building`
  Spec ref: `spec.md > Where It Runs and How Someone Tries It`, `spec.md > Components` (Dashboard shell and side panel, Map-pin destination, Rider monitoring and tracking links, Rider tracking page, Temporary HTTPS tunnel), `spec.md > External Services and Dependencies`
  Build: Make the app runnable as described in the spec; complete owner login, map-pin destination selection, rider monitoring and link sharing, and the consented phone-location path through `npm run share`. Label rider dots with rider names and destination pins with recipient names, using existing app data only. Keep the simulator available as a second way to send positions.
  Verify (mechanical): Run `npm run share` with `cloudflared` available. Open the printed HTTPS owner URL, place a destination pin, monitor a rider, and open its HTTPS link on a phone. After tapping Start sharing and granting permission, confirm phone positions update the dashboard and show the rider name; confirm the destination pin shows the recipient name. Tap Stop sharing and confirm updates stop. Then confirm `npm run simulate` still runs locally.
  Learner check: On the owner device, open the phone-test URL and share the rider link with the test phone. Start sharing, move a short distance, and check that the rider's name stays beside the moving dot and the recipient's name is beside the destination pin; stop sharing and check that updates stop.
  Commit: `Add consented phone tracking`

- [ ] **2. Detect arrival and confirm a delivery**
  Becomes usable: When the assigned rider reaches a recipient, the app marks arrival and alerts the owner; the owner can then mark the parcel received, with that state preserved after restart.
  Why now: With real phone positions already reaching the map, this completes the unique kernel and owner journey; simulation stays available for repeatable checks of arrival edge cases.
  PRD ref: `prd.md > The Core Journey` (steps 5–8); `prd.md > Live map and arrival alert`; `prd.md > States and Boundaries`
  Spec ref: `spec.md > Components` (Dispatch, Live map and rider positions, Arrival detection and alert); `spec.md > Data Model`; `spec.md > Important Failure Modes`
  Build: Detect arrival only when the assigned rider is within the specified distance, broadcast and display the arrival with an audible alert, and let the owner mark the parcel received. Preserve state in the JSON store and retain simulated movement for reproducible testing.
  Verify (mechanical): Run the app and simulator, then confirm an assigned rider reaching its destination triggers one arrival and alert, while another rider passing that destination does not. Mark the parcel received, restart the server, and confirm its received state remains saved; also test the arrival with a real phone.
  Learner check: Use the phone to approach a pinned destination and watch for the arrival alert; mark the parcel received on the dashboard. If GPS accuracy makes the approach hard to repeat, use the simulator to confirm the same arrival behavior.
  Commit: `Add arrival alerts and received state`

- [ ] **3. Finish the owner delivery controls**
  Becomes usable: The owner can inspect recipient details, rebalance unfinished deliveries between riders, and remove a delivery only after it is marked received.
  Why now: These controls refine the already-working dispatch loop without delaying evidence for the live-tracking kernel or the phone-test risk.
  PRD ref: `prd.md > Recipients to reach (side panel)`; `prd.md > Product Decisions`; `prd.md > States and Boundaries`
  Spec ref: `spec.md > Components` (Dashboard shell and side panel, Dispatch); `spec.md > Data Model`; `spec.md > Important Failure Modes`
  Build: Complete the compact name-first recipient list and expandable details, fair Shuffle behavior for unfinished parcels, and removal confirmation for received parcels only; ensure the visible assignment and saved state stay in sync.
  Verify (mechanical): Run the app and simulator, add several recipients, and confirm assignments go to riders with the fewest unfinished parcels; shuffle and verify pending assignments update. Confirm pending and arrived deliveries cannot be removed, a received delivery can be removed, and the saved list remains correct after restarting.
  Learner check: Add a few deliveries, expand a recipient, shuffle the unfinished assignments, then mark one received and remove it; confirm the other active deliveries remain.
  Commit: `Complete recipient management controls`

## Hands-on Checkpoints

- [ ] Early usable behavior explored — after slice 1: try the real-phone tracking flow and give feedback while it can still shape the arrival and owner-control slices.
- [ ] Final kick-the-tires exploration and feedback completed — after all slices, freely try the core journey and awkward inputs.

## Final Review

- [ ] Final review complete — feedback resolved and learner confirms ready to ship

## Code Tour and App Map

- [ ] Learning activity complete — guided route, focused alternative, prior practice connected, or brief recap
- [ ] Optional edit and transfer reflection addressed — offered/declined/already covered/not applicable as appropriate
- [ ] `devpost/app-map.html` generated from finished code, checked, and shown, including a project-grounded practice to reuse

Activity and evidence: [what actually happened; real document/test/code references; unfinished work if interrupted]
Route and stops: [actual paths and symbols; guided stops completed, or reference-only route]
Edit outcome: [tried/kept/reverted/declined/not applicable; verification if changed]
Reflection: [offered/answered/declined/already covered — personal answer belongs only in the ignored profile]
Activity mode: [live app and editor, explicit static fallback, focused alternative, prior practice, or recap]

## Revisions
- Added compact names beside moving rider dots and recipient destination pins at the learner's request; labels use existing names and do not add a geocoding service.
