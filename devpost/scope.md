---
doc: scope
status: approved
---

# Rider Watch (working name)

A live dispatch dashboard where a small-business owner watches his riders move on a map and gets alerted when one reaches a delivery destination.

## The Unique Kernel
The owner sees where his riders actually are, without relying on WhatsApp updates, and the app tells him the moment a rider arrives so he can confirm the handover himself. The owner stays in control of "received."

## Who It's For
The owner of a small dispatch business with 2 riders (planning to scale when profitable). Riders use smartphones and report over WhatsApp today. He can't tell whether they detour off the route or "bypass the business model."

## The Core Loop
1. Each rider's phone shares its location.
2. The owner watches both riders move on a Bolt-style dashboard map.
3. When a rider reaches the destination, the app marks the arrival automatically and sounds an alert.
4. The owner calls the recipient on WhatsApp (outside the app).
5. The owner marks the parcel as received.

Why he comes back: it replaces guessing and message-checking with a live view.

## Inspiration & Identity
Bolt-style dashboard: a map-centered live view of moving riders.
Reference: Bolt (ride-hailing app). No other direction volunteered.

## Why This Matters to the Learner
"I find it difficult to monitor the movement of the dispatch rider." It is his own business problem and a real tool he would use.

## What "Working" Looks Like
*Drawn from the learner's described flow. To be confirmed at review.*
In a one-minute demo: the dashboard shows both riders as moving points on a map. One rider reaches a delivery destination, the dashboard marks the arrival and sounds an alert, and the owner marks the parcel "received" on the dashboard.
The moving rider points show rider names, and destination pins show recipient names, so the owner can identify both at a glance.

## The POC Boundary
- Rider location sharing from a phone, with the rider's knowledge that tracking is on.
- Live map dashboard showing both riders.
- Rider names beside moving map points and recipient names beside destination pins.
- Automatic arrival detection at a destination, plus an audible alert.
- A "received" mark set by the owner.

## Later
- More than 2 riders.
- Off-route detection (the original worry).
- Delivery history and reports.
- Rider accounts and shift-based tracking.

## Explicitly Cut
- In-app phone calls: the owner calls on WhatsApp instead, which keeps the app simple and avoids call-service setup and cost.
- Recipient-facing features: the owner confirms receipt himself.
- Luminara: parked as a long-term vision, too large for a 2–4 hour proof of concept.

## Open Items
- Ground truth for the demo: whether it is tested with real phones or simulated rider movement.
- How riders are told and agree that tracking is on (consent).
