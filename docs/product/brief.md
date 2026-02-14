# Family Movie Night — Product Brief (v1)

## Overview

Family Movie Night helps households pick a movie everyone will enjoy — together, without the 30-minute scroll-and-debate cycle. One family member creates a group, invites others, and the app suggests movies that match the group's combined tastes. The family then votes to lock in a pick.

## Target User

- **Primary:** Parents (25–50) in households of 3–6 people who watch movies together at least twice a month.
- **Secondary:** The rest of the household (partners, kids 8+, grandparents) who participate in choosing and voting.
- **Platform:** iOS only (iPhone; iPad support is a nice-to-have, not v1).

## Core Loop

1. **Set preferences** — Each member indicates genres/themes they like and dislike, plus age-appropriateness constraints.
2. **Get suggestions** — The app generates a shortlist (5–8 movies) that threads the needle across everyone's preferences.
3. **Vote / Agree** — Members swipe or tap to approve/reject. The app surfaces the top pick (or a ranked list if no consensus).
4. **Watch & Log** — The family marks the movie as watched and optionally rates it, which refines future suggestions.

## v1 Scope

| In scope | Details |
|---|---|
| Account & group creation | Sign up with Apple ID or email; create one "family" group |
| Invite flow | Share link / SMS / iMessage invite to join the group |
| Preference profiles | Per-member genre likes/dislikes, content-rating ceiling (G/PG/PG-13/R) |
| Suggestion engine | Rule-based filtering over a movie metadata catalog (genre, rating, release year, popularity). ML ranking is post-v1. |
| Voting round | Simple thumbs-up / thumbs-down per suggestion; surface winner |
| Watched list | Mark movies as watched; hide them from future suggestions |
| Push notifications | Nudge members to vote; announce the winning pick |
| Movie detail view | Poster, synopsis, cast, streaming availability (via a third-party API like JustWatch or TMDB) |

## Non-Goals (v1)

- **TV shows / series** — movies only.
- **In-app streaming** — we link out to the streaming service.
- **Multi-group support** — one group per account. Multi-group is v2.
- **ML-based recommendation** — v1 uses deterministic filtering + popularity scoring.
- **Android / Web** — iOS only.
- **Social features beyond the family group** — no public profiles, no friend lists.
- **Calendar / scheduling** — we don't schedule the movie night itself.
- **Parental controls / screen-time** — out of scope; we rely on content-rating filters.

## Key Assumptions

1. We will use TMDB (The Movie Database) as the primary movie catalog and metadata source. It is free for non-commercial use and has good genre/rating data.
2. Streaming availability data will come from a third-party API (e.g., JustWatch, Watchmode, or TMDB's own watch-providers endpoint). Exact provider TBD (see open-questions.md).
3. Group sizes are small (2–8 members). We do not need to optimize for large groups.
4. Kids 8+ can operate the app independently; younger kids will be represented by a parent setting preferences on their behalf.

## Success Metrics

| Metric | Target (90 days post-launch) |
|---|---|
| Group activation rate | ≥ 60% of created groups have ≥ 2 members who set preferences |
| Suggestion-to-vote rate | ≥ 70% of suggestion rounds receive votes from ≥ 2 members |
| Consensus rate | ≥ 50% of voting rounds produce a clear winner (one movie with majority thumbs-up) |
| Weekly retention (group-level) | ≥ 40% of activated groups return at least once per week for 4 consecutive weeks |
| NPS | ≥ 40 among group creators |
| Watched-log rate | ≥ 30% of winning picks are later marked as "watched" |
