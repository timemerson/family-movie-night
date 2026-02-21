# Family Movie Night — Product Brief (v1)

## Overview

Family Movie Night helps households pick a movie everyone will enjoy — together, without the 30-minute scroll-and-debate cycle.

Each authenticated user creates a single **household**. A household contains multiple **members**, who collaborate to choose a movie during a structured **movie night session**.

The app suggests movies that match the attending members’ combined tastes. The household then votes to lock in a pick, watches it, and optionally rates it to improve future sessions.

---

## Target User

- **Primary:** Parents (25–50) in households of 3–6 people who watch movies together at least twice a month.
- **Secondary:** The rest of the household (partners, kids 8+, grandparents) who participate in choosing and voting.
- **Platform:** iOS only (iPhone; iPad support is a nice-to-have, not v1).

---

## Identity Model (v1)

### Household
- One household per authenticated account.
- A household contains 2–8 members.

### Members
Members belong to a household and can be:

- **Independent Members** — Have their own login and device.
- **Managed Members** — Do not log in directly; accessible from any household device (e.g., younger children).

Profiles are **household-bound**, not device-bound.

Any device logged into the household can switch between:
- The authenticated user’s profile
- Any managed member profile

Independent members cannot be impersonated on other devices.

---

## Core Loop

1. **Select attendees** — Start a movie night session and choose which household members are participating (default: all).
2. **Get suggestions** — The app generates a shortlist (5–8 movies) that threads the needle across attendees’ preferences.
3. **Vote** — Members asynchronously vote (thumbs-up / thumbs-down). Votes are saved immediately.
4. **Select winner** — The app surfaces the top pick based on majority.
5. **Watch & Rate** — The household marks the movie as watched and members rate it (Loved / Liked / Did Not Like).

---

## Movie Night Session Lifecycle

A movie night is a stateful session:

- `draft` — Session created; attendees selected.
- `voting` — Suggestions visible; votes being cast.
- `selected` — Winning movie chosen.
- `watched` — Movie marked as watched.
- `rated` — Post-watch ratings completed.
- `expired` — No selection made within expiration window.

Sessions are stored in history.

---

## v1 Scope

| In scope | Details |
|---|---|
| Account & household creation | Sign up with Apple ID or email; create one household |
| Member management | Add managed or independent members to household |
| Invite flow | Share link / SMS / iMessage invite for independent members |
| Profile switching | Switch between household profiles on-device |
| Preference profiles | Per-member genre likes/dislikes, content-rating ceiling (G/PG/PG-13/R) |
| Suggestion engine | Rule-based filtering over movie metadata (genre, rating, release year, popularity). ML ranking is post-v1. |
| Voting round | Async thumbs-up / thumbs-down per suggestion; majority determines winner |
| Watched log | Mark selected movie as watched |
| Post-watch rating | Loved / Liked / Did Not Like per member |
| Movie detail view | Poster, synopsis, cast, streaming availability (via TMDB or similar) |
| Session history | View past movie nights and ratings |

---

## Non-Goals (v1)

- **TV shows / series** — movies only.
- **In-app streaming** — we link out to the streaming service.
- **Multi-household support** — one household per account.
- **ML-based recommendation** — v1 uses deterministic filtering + popularity scoring.
- **Android / Web** — iOS only.
- **Social features beyond the household** — no public profiles, no friend lists.
- **Calendar / scheduling** — we don’t schedule the movie night itself.
- **Parental control enforcement** — we rely on content-rating filters.
- **Real-time voting indicators** — voting is asynchronous; no live presence system in v1.

---

## Key Assumptions

1. TMDB (The Movie Database) is the primary movie catalog and metadata source.
2. Streaming availability data comes from TMDB watch-providers or another third-party API.
3. Group sizes are small (2–8 members).
4. Kids 8+ can operate the app independently; younger children are represented as managed profiles.
5. Voting is asynchronous; no real-time websocket infrastructure required.
6. Profiles are household-scoped; data isolation is at the household level.

---

## Success Metrics

| Metric | Target (90 days post-launch) |
|---|---|
| Household activation rate | ≥ 60% of created households have ≥ 2 members |
| Member engagement rate | ≥ 70% of sessions receive votes from ≥ 2 members |
| Consensus rate | ≥ 50% of voting rounds produce a clear majority winner |
| Weekly retention (household-level) | ≥ 40% return at least once per week for 4 consecutive weeks |
| NPS | ≥ 40 among household creators |
| Watched-log rate | ≥ 30% of selected movies are marked as watched |
| Post-watch rating rate | ≥ 50% of watched movies receive ≥ 2 member ratings |