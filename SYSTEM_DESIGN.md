# System Design Write-Up

This document covers the four areas called out for review: the rate calculation engine, the zone detection approach, the agent auto-assignment logic, and failed-delivery handling. It complements [`README.md`](./README.md), which has the full API/schema reference — this is the "why it's built this way" companion.

## Rate Calculation Engine

The rate engine lives in a single module (`utils/rateCalculator.js`) and is shared by two endpoints: `calculate-charge` (the pre-confirmation preview) and `create order`. Sharing one function guarantees the price a customer previews is exactly the price they're charged — there's no second implementation to drift out of sync.

The pipeline runs in five deterministic steps:

1. **Zone detection** for both pickup and drop addresses.
2. **Volumetric weight** — `(length × breadth × height) / 5000`, the standard courier-industry formula, with dimensions in centimeters.
3. **Chargeable weight** — the higher of actual weight vs. volumetric weight. This mirrors real logistics pricing: a large, light package still consumes truck space proportional to its volume, so billing on actual weight alone would underprice it.
4. **Rate card lookup** — keyed on `orderType` (B2B/B2C), whether the pickup and drop zones are the same (`intra`) or different (`inter`), and the specific zone pair. Keeping B2B and B2C fully separate reflects a real requirement: B2B shipments tend to be bulkier and run on thinner margins than B2C, so they need independent pricing.
5. **COD surcharge** — a separate lookup by `orderType`, supporting either a flat fee or a percentage of the weight charge, applied only when `paymentType` is COD.

Every number here — base rate, per-kg rate, COD value — comes from the database (`RateCard`/`CODConfig`). Nothing is hardcoded, so admins can change pricing without a deployment. A missing rate card or COD config fails loudly with a specific error instead of silently defaulting to zero.

## Zone Detection Approach

Zones are stored as a name plus two matching lists: `pincodes` and `areas`. Detection tries an **exact pincode match** first, since pincodes are unambiguous and don't rely on spelling. If that fails, it falls back to a **case-insensitive match on area name**, which covers addresses where the pincode is missing or the zone was configured by neighborhood rather than pincode. If neither matches, the request is rejected with a message naming exactly what couldn't be resolved (the pincode/area and which address it was), so the customer or admin knows precisely what to fix or ask the admin to configure — rather than failing generically.

This two-tier approach lets admins configure zones the way that's easiest for their operations — by service pincodes, by named localities, or both — without forcing every zone to be defined the same way.

## Auto-Assignment Logic

Agent assignment answers "who is the best available agent for this zone right now?" using a layered strategy in `utils/agentAssigner.js`:

1. **Zone match first** — agents whose `agentDetails.currentZone` matches the target zone (the order's pickup zone for a fresh assignment, or the drop zone when reassigning after a failed delivery) are preferred, since same-zone agents are the closest practical proxy for "nearest" available today.
2. **Zone fallback** — if no agent is available in that zone, the search widens to *any* available agent system-wide, so an order is never stuck unassigned just because one zone is short-staffed.
3. **Load-based ranking** — among candidates, agents are ranked first by their current count of non-Delivered orders (ascending — least busy wins), then by `lastAssignedAt` (ascending — longest since their last assignment wins ties). This keeps workload spread evenly instead of piling every new order onto whichever agent happens to sort first.

The schema also captures `agentDetails.currentLocation` (lat/lng) so true distance-based ranking can be added later without a schema migration — but since addresses in this project don't carry coordinates yet, zone match is used as the nearest-agent proxy for now. This is a deliberate, documented scope boundary rather than an oversight.

Manual assignment (admin picking an agent directly) and auto-assignment both funnel through the same underlying workload counter, so the two paths never disagree about how busy an agent currently is.

## Failed Delivery Handling

A `Failed` status is reachable only from `Out for Delivery`, enforced by a central status-transition map (`utils/statusTransitions.js`) that every status update is checked against — so an order can't be marked Failed from an invalid prior state. On failure, the customer is emailed automatically and can submit a reschedule request with a new delivery date. This moves the order to `Rescheduled`, and the previous agent is recorded so they can be explicitly excluded from reassignment (the same "best available agent" logic runs again for the new attempt, minus that exclusion). Once an agent is reassigned, the order transitions back to `Picked Up` and re-enters the normal lifecycle — so a rescheduled order gets exactly the same tracking rigor as a first attempt, not a special-cased shortcut. Every step of this — the failure, the reschedule request, and the reassignment — writes its own immutable entry to the tracking history, so the full story of what went wrong and how it was recovered stays visible on the order's timeline permanently.