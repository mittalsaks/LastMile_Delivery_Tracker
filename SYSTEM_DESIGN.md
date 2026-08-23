# System Design Write-Up

> The four things this project actually had to get right: **pricing that's never hardcoded**, **zone detection that doesn't break on messy addresses**, **agent assignment that stays fair as load grows**, and **a failure path that's tracked exactly as rigorously as the happy path**.

This is the "why it's built this way" companion to [`README.md`](./README.md) (which has the full API/schema reference). Four sub-systems, each with a diagram first and reasoning after.

## Table of Contents
- [1. Rate Calculation Engine](#1-rate-calculation-engine)
- [2. Zone Detection](#2-zone-detection)
- [3. Auto-Assignment Logic](#3-auto-assignment-logic)
- [4. Failed Delivery & Reschedule](#4-failed-delivery--reschedule)
- [Trade-offs, called out on purpose](#trade-offs-called-out-on-purpose)

---

## 1. Rate Calculation Engine

**The one rule that shapes everything else:** the price a customer previews and the price they're charged must come from the *same function call* — not two implementations that can quietly drift apart.

```mermaid
flowchart TD
    A["Order request:<br/>addresses + L×B×H + weight + orderType + paymentType"] --> B["Zone Detection<br/>(pickup & drop)"]
    B --> C{"Zone resolved<br/>for both addresses?"}
    C -- "No" --> C1["❌ Reject —<br/>'no zone configured for &lt;pincode/area&gt;'"]
    C -- "Yes" --> D["Volumetric weight<br/>(L × B × H) / 5000"]
    D --> E["Chargeable weight =<br/>max(actual, volumetric)"]
    E --> F{"pickupZone === dropZone?"}
    F -- "Yes" --> G1["rateType = intra"]
    F -- "No" --> G2["rateType = inter"]
    G1 --> H["RateCard lookup:<br/>orderType × rateType × zone pair"]
    G2 --> H
    H --> I{"Rate card<br/>found?"}
    I -- "No" --> I1["❌ Reject —<br/>'no rate card for this route'"]
    I -- "Yes" --> J["weightCharge =<br/>baseRate + (chargeableWeight × ratePerKg)"]
    J --> K{"paymentType<br/>== COD?"}
    K -- "No" --> M["Total = weightCharge"]
    K -- "Yes" --> L["CODConfig lookup by orderType<br/>flat ₹ or %"]
    L --> M2["Total = weightCharge + codSurcharge"]
    M --> N(["Charge breakdown returned"])
    M2 --> N

    style A fill:#1e293b,color:#fff
    style N fill:#065f46,color:#fff
    style C1 fill:#7f1d1d,color:#fff
    style I1 fill:#7f1d1d,color:#fff
```

**Why this shape, specifically:**

- **One function, two callers.** `POST /calculate-charge` (the pre-confirm preview) and `POST /orders` (actual creation) both call `utils/rateCalculator.js`. If pricing logic lived in two places, they *would* eventually disagree — not a hypothetical, that's how most "quoted vs. billed" bugs happen in real checkout systems.
- **Volumetric-vs-actual, not just actual.** A large, light box (think a lampshade) still eats truck space proportional to its volume. Billing on actual weight alone systematically underprices bulky-but-light shipments — so the higher of the two always wins.
- **B2B and B2C are fully separate rate cards, not a discount multiplier on one card.** B2B shipments run bulkier volumes on thinner margins in practice; forcing them onto the same pricing curve as B2C would mean one segment always cross-subsidizes the other.
- **Fail loud, not silent.** A missing rate card or COD config throws a specific, named error instead of defaulting to ₹0 — an admin misconfiguration should surface immediately, not show up as a support ticket three weeks later.

---

## 2. Zone Detection

Real-world addresses are messy — pincodes get mistyped, some areas are configured by locality name instead. Zone detection needs a deterministic fallback chain, not a single brittle lookup.

```mermaid
flowchart LR
    A(["Address"]) --> B{"Exact pincode<br/>match in any Zone?"}
    B -- "Yes" --> Z(["✅ Zone resolved"])
    B -- "No" --> C{"Case-insensitive<br/>area name match?"}
    C -- "Yes" --> Z
    C -- "No" --> D(["❌ Rejected —<br/>names exactly which<br/>address/field failed"])

    style Z fill:#065f46,color:#fff
    style D fill:#7f1d1d,color:#fff
```

**Why pincode-first, area-name-second:** pincodes are unambiguous — no spelling ambiguity, no locality naming disputes. Area names are the pragmatic fallback for addresses where the pincode is missing, wrong, or the admin simply prefers to configure a zone by neighborhood (`"Bandra, Khar, Santacruz"` reads a lot more intuitively in an ops dashboard than a pincode list). Supporting both means an admin can configure zones the way that matches *their* operations, instead of the system forcing one convention. A failed lookup names exactly what didn't resolve and for which address — so the fix is obvious, not a guessing game.

---

## 3. Auto-Assignment Logic

The question the assigner answers: *"who is the best available agent for this zone, right now?"* — done in three layered passes rather than one query, so an order is never stuck just because one zone is short-staffed.

```mermaid
flowchart TD
    A(["Order needs an agent<br/>(pickup zone, or drop zone on reassignment)"]) --> B["Pass 1 — Zone match:<br/>agents where currentZone == target zone<br/>AND isAvailable == true"]
    B --> C{"Any candidates?"}
    C -- "Yes" --> E["Rank candidates"]
    C -- "No" --> D["Pass 2 — Zone fallback:<br/>ANY available agent, system-wide"]
    D --> C2{"Any candidates?"}
    C2 -- "No" --> F(["❌ Unassigned —<br/>surfaced to admin queue"])
    C2 -- "Yes" --> E
    E --> G["Sort by:<br/>1) active order count ↑ (least busy wins)<br/>2) lastAssignedAt ↑ (longest idle wins ties)"]
    G --> H(["✅ Best agent assigned<br/>lastAssignedAt updated"])

    style A fill:#1e293b,color:#fff
    style H fill:#065f46,color:#fff
    style F fill:#7f1d1d,color:#fff
```

**Design reasoning:**

- **Zone match is the "nearest agent" proxy — deliberately, not accidentally.** The schema already stores `agentDetails.currentLocation` (lat/lng) for a future haversine-distance ranking, but addresses in this project don't carry coordinates yet. Rather than fake precision with a half-built distance calculation, same-zone-first is used as an honest, documented stand-in. That's a scope boundary, not an oversight.
- **Two-pass search over a single query.** A strict "must be in-zone" filter would leave orders unassigned the moment one zone runs out of available agents — an operational failure mode a real ops team hits constantly during demand spikes. Falling back to system-wide availability trades a small "nearest" penalty for guaranteeing every order gets picked up.
- **Load-balance, then fairness.** Ranking by active order count first stops any one agent from getting buried; the `lastAssignedAt` tiebreaker stops the *same* least-busy agent from winning every tie in a slow period. Manual assignment (admin picks directly) and auto-assignment both read from the same live order-count, so the two paths can never disagree about who's "busy."

---

## 4. Failed Delivery & Reschedule

A rescheduled order isn't a special case bolted onto the side — it re-enters the exact same state machine, with the exact same tracking rigor, as a first attempt.

```mermaid
stateDiagram-v2
    [*] --> Created
    Created --> PickedUp
    PickedUp --> InTransit
    InTransit --> OutForDelivery
    OutForDelivery --> Delivered
    OutForDelivery --> Failed
    Failed --> Rescheduled : customer requests reschedule
    Rescheduled --> PickedUp : agent (re)assigned,<br/>original agent excluded
    Delivered --> [*]

    note right of Failed
        Customer notified by email + SMS.
        Every arrow above writes an
        immutable TrackingHistory entry
        (status + actor + timestamp).
    end note
```

**Why it's built this way:**

- **`Failed` is reachable only from `OutForDelivery`.** The central transition map in `utils/statusTransitions.js` checks every update against this graph — an order can't be marked `Failed` from, say, `Created`, which would make no operational sense and would corrupt the timeline's meaning.
- **The failed agent is recorded and excluded, not just dropped.** On reschedule, the same three-pass assignment logic from section 3 runs again — minus the agent who already failed once on this order. Re-running the *same* algorithm (instead of a bespoke "reschedule assignment" path) means there's only one assignment policy in the codebase to reason about, ever.
- **Rescheduled orders re-enter at `PickedUp`, not a shortcut state.** This is the crux of "no special-cased shortcut": a rescheduled delivery gets pushed through `InTransit` → `OutForDelivery` → `Delivered` again with full tracking, because a second attempt succeeding is exactly as important to have on record as a first attempt succeeding — for the customer's trust and for the ops team's failure-rate metrics.
- **Immutability isn't a convention here, it's enforced.** `TrackingHistory` blocks update/delete at the Mongoose-hook level. So the full story — including the failure and the recovery — can't be quietly edited after the fact, by anyone.

---

## Trade-offs, called out on purpose

No system design is free of compromises — the ones worth naming explicitly:

| Decision | What was chosen | What was traded off |
|---|---|---|
| Nearest-agent proxy | Zone match instead of live geo-distance | Simplicity now; schema already supports adding real lat/lng ranking later without migration |
| Zone detection | Pincode → area-name fallback chain | No fuzzy/typo-tolerant matching — an admin must configure the exact pincode or area name |
| Rate cards | One row per exact zone pair | Doesn't auto-generalize (e.g. a "default inter-zone rate") — every route needs an explicit card, which is more setup but zero ambiguity |
| COD & rate config | Fully admin-editable, zero hardcoding | Slightly more setup screens for the admin, in exchange for zero-deployment pricing changes |
