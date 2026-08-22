# System Design Write-Up

## Rate calculation engine

The rate engine (`utils/rateCalculator.js`) is a pure orchestration
function with no hardcoded pricing — every number it uses comes from the
database, so admins can change pricing without a code change. It runs in
five steps: resolve pickup/drop zones, compute volumetric weight, take the
chargeable weight as the higher of actual vs. volumetric, look up the
matching rate card, and apply COD surcharge if relevant.

Volumetric weight uses the standard courier-industry divisor:
`(L × B × H) / 5000`, with dimensions in centimeters. Billing on the higher
of actual vs. volumetric weight is the same rule real logistics providers
use — it prevents large, light packages (which take up truck space
disproportionate to their weight) from being underpriced. Chargeable weight
is exposed to the frontend so customers see the number their charge is
based on, not just a final total.

The rate card lookup is keyed on three inputs: `orderType` (B2B/B2C),
whether pickup zone equals drop zone (`intra`) or not (`inter`), and the
zone pair itself for inter-zone. This keeps B2B and B2C pricing fully
independent — a common real-world requirement, since B2B shipments are
often bulkier and lower-margin than B2C. COD surcharge is a separate
lookup by `orderType`, supporting either a flat fee or a percentage, so
admins aren't locked into one surcharge model.

Exposing `calculate-charge` as its own endpoint (separate from order
creation) was deliberate: it lets the frontend show a price preview before
commitment, and the same function backs both the preview and the
actually-billed amount, so they can never drift apart.

## Zone detection approach

Zones are modeled as a flat list of pincodes and named areas rather than
geo-boundaries (polygons/coordinates), which keeps the admin-facing CRUD
simple — an admin adds a zone by typing in pincodes, no GIS tooling
required. Zone detection is a lookup: given an address's pincode (falling
back to area name if the pincode isn't mapped), find the `Zone` document
whose `pincodes[]`/`areas[]` contains it. This trades geographic precision
for operational simplicity, appropriate for this assignment's scope. A
production system handling un-mapped pincodes would likely add a
nearest-zone-by-geocoding fallback, which could be added later without
changing the rate engine's interface — it only needs a zone ID in, not the
detection method.

## Auto-assignment logic

`utils/agentAssigner.js` implements a two-tier ranking: first, prefer
agents whose `agentDetails.currentZone` matches the order's zone (keeps
agents working local routes, minimizing travel); if none are available in
that zone, fall back to any available agent system-wide rather than
leaving the order unassigned. Among candidates, agents are ranked by
active-order count (load balancing — don't pile orders onto one agent)
and then by `lastAssignedAt` (round-robin tie-break, so among equally
loaded agents the one who's gone longest without a new order gets it
next). This is a heuristic rather than true route-optimization (no
travel-time or real-time GPS routing), which is an appropriate scope
trade-off for this assignment; the interface (`findBestAgent()`) is
designed so a smarter ranking function could be swapped in later without
touching the callers (manual/auto-assign routes, reschedule reassignment).

## Order status lifecycle + immutable tracking history

Status transitions are enforced by an explicit state machine
(`utils/statusTransitions.js`) rather than allowing arbitrary status
writes — `Created → Picked Up → In Transit → Out for Delivery →
{Delivered | Failed}`, with `Failed → Rescheduled → Picked Up` as the
recovery path. Centralizing the valid-transition map in one file (instead
of scattering `if` checks across controllers) means the rules are
auditable at a glance and can't drift between the order-status endpoint
and the reschedule endpoint.

Every transition writes an append-only `TrackingHistory` document
(order, status, changedBy, timestamp) rather than only updating
`Order.status` in place. This is what makes the tracking timeline
possible and, more importantly, makes the audit trail tamper-resistant:
nothing ever deletes or edits a past entry, so "who changed what, when"
is always reconstructable — important for a logistics platform where
disputes over delivery timing are common.

## Failed delivery + reschedule handling

A `Failed` status is not terminal — it's the entry point to a
customer-initiated recovery flow. The customer submits a new date (and
optional reason), which the system validates against the state machine
before touching anything, then atomically updates `Order.reschedule`
(capturing `previousAgent` before clearing the assignment), transitions
status to `Rescheduled`, and logs both a `TrackingHistory` entry and a
`Notification`. Reassignment is a deliberately separate step (manual or
auto, admin-triggered) rather than automatic, since a failed delivery
often means the original agent/route was the problem — an admin may want
to route it differently rather than automatically retrying the same
assignment logic. Once reassigned, `Rescheduled → Picked Up` re-enters
the normal lifecycle, so no special-case tracking logic is needed
downstream.
