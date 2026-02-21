# Family Movie Night — Collaboration Rules (v1)

> This document defines how group members collaborate on movie selection: shared lists, proposing candidates, voting, and watched-state management. It is the source of truth for collaboration behavior and feeds directly into user stories and flows.

---

## 1. List Types in v1

v1 has three list concepts. Two are explicit (Watchlist, Watched) and one is implicit (Tonight's Round).

### Watchlist

A **single, shared, persistent list** of movies the group wants to consider for future movie nights. Think of it as a group-level bookmark list.

| Property | Rule |
|---|---|
| Scope | One per group |
| Who can add | Any group member |
| Who can remove | The member who added it, or the group creator |
| Ordering | Most-recently-added first (reverse chronological) |
| Max size | 50 movies (prevents unbounded growth; oldest can be removed to make room) |
| Persistence | Survives across rounds; movies remain until explicitly removed or marked watched |
| Duplicates | A movie cannot appear in both the Watchlist and the Watched list. Adding a watched movie to the Watchlist is blocked with an explanation. |

**How movies get onto the Watchlist:**
- From the suggestion screen: "Save for Later" action on a suggestion card
- From the movie detail screen: "Add to Watchlist" button
- From TMDB search results (see US-29)

**How movies leave the Watchlist:**
- Explicitly removed by the adder or group creator
- Automatically removed when the movie is marked as watched (moved to Watched list)
- Automatically removed when the movie is picked as tonight's winner (it transitions to the Pick/Watched flow)

### Tonight's Round (implicit)

Not a separate list entity — it **is** the active suggestion round. When someone starts a voting round, the algorithm-generated suggestions (5–8 movies) become the candidates for tonight. Members can also **propose** additional movies into the round (see Section 3).

| Property | Rule |
|---|---|
| Scope | One active round per group at a time (existing constraint) |
| Contents | Algorithm suggestions + member proposals |
| Max size | 12 movies total (8 algorithm + up to 4 proposals) |
| Lifecycle | Created when round starts → active during voting → archived when pick is made or round is discarded |

### Watched List

Movies the group has watched together. This combines two sources:

1. **Picked movies** marked as watched (existing flow — went through suggest → vote → pick → watch)
2. **Directly marked** movies (new — any member marks a movie as "already watched" from the detail screen, without going through a round)

| Property | Rule |
|---|---|
| Scope | One per group |
| Who can mark watched | Any group member |
| Effect on suggestions | Watched movies are excluded from future algorithm suggestions |
| Effect on Watchlist | Marking a Watchlist movie as watched removes it from the Watchlist automatically |
| Undo | A member can un-mark a directly-watched movie within 24 hours. Picked-and-watched movies (which went through a round) cannot be un-marked — they have vote history attached. |

---

## 2. Permissions

v1 uses a simple two-role model: **creator** and **member**. Trust is assumed within a family group.

| Action | Creator | Member |
|---|---|---|
| Add movie to Watchlist | Yes | Yes |
| Remove own Watchlist additions | Yes | Yes |
| Remove others' Watchlist additions | Yes | No |
| Start a voting round | Yes | Yes |
| Propose a movie into active round | Yes | Yes |
| Remove a proposal from active round | Yes | Only their own proposals |
| Vote (thumbs up/down) | Yes | Yes |
| Close voting early | Yes | No |
| Lock in the pick (choose winner) | Yes | No |
| Mark a movie as watched | Yes | Yes |
| Un-mark a directly-watched movie | Yes | Only if they marked it |
| Search TMDB for movies | Yes | Yes |

**Assumption:** We do not add a "moderator" or "admin" role in v1. The creator is the only elevated role, consistent with the existing group model.

---

## 3. Proposing a Movie

"Proposing" means a member manually adds a specific movie to the active voting round, alongside the algorithm-generated suggestions. This covers the real-world moment when someone says *"What about Inception?"* during the family discussion.

### Rules

| Rule | Detail |
|---|---|
| When | Only while a voting round is active (`status: voting`) |
| Who | Any group member |
| What | Any movie from TMDB that is not already in the round, not on the Watched list, and meets the group's content-rating ceiling |
| How | Member searches for a movie (by title) or taps "Propose for Tonight" from movie detail or Watchlist |
| Limit | Max 2 proposals per member per round. Max 4 proposals total per round. This prevents one member from flooding the round. |
| Display | Proposed movies appear in the round with a "Proposed by [Name]" tag. Algorithm suggestions have no such tag. |
| Voting | Proposed movies are voted on identically to algorithm suggestions. Same thumbs up/down, same scoring. |
| Source tracking | The `proposed_by` field is stored so the UI can show attribution. |

### If No Round Is Active

If a member wants to propose a movie but no round is active, they are prompted to add it to the Watchlist instead: *"No voting round right now. Save it to your Watchlist for next time?"*

### Watchlist Integration at Round Start

When a member starts a new round:
1. The algorithm generates 5–8 suggestions as usual.
2. If the Watchlist has movies that pass the group's current filters (content rating, not watched), the UI shows a prompt: **"Your Watchlist has [N] movies. Include them in tonight's vote?"**
3. If the member says yes, up to 4 Watchlist movies (most recently added first) are added to the round as pre-proposals, tagged "From Watchlist." They count against the 4-proposal cap.
4. If the member says no (or the Watchlist is empty), the round proceeds with algorithm suggestions only.

---

## 4. Voting Model

v1 uses **simple thumbs up / thumbs down** voting. This is deliberately unsophisticated — families discuss in person and the app just captures the signal.

### Mechanics

| Aspect | Rule |
|---|---|
| Vote options | Thumbs up (+1) or thumbs down (−1) per movie |
| Votes per member | One vote per movie. A member does not have to vote on every movie. |
| Changing votes | Allowed while the round is open (`status: voting`). New vote overwrites the old one. |
| Vote visibility | Transparent — all members can see who voted what, in real time. Families are not anonymous. |
| Abstaining | A member can simply not vote on a movie. No explicit "abstain" button. |
| Scoring | Net score = thumbs up count − thumbs down count |
| Ranking | Movies ranked by net score descending. Ties broken by TMDB popularity score descending. |
| Who closes voting | The group creator, or auto-close when all members have voted on at least one movie. |
| Who picks the winner | The group creator taps "Pick This One" on any movie in the results (not necessarily the highest-ranked). This allows the creator to factor in real-world context ("Dad really wants this one"). |

### Tie-Breaking

If two or more movies have the same net score:
1. Sub-sort by TMDB popularity (higher = better).
2. If still tied, the creator chooses manually from the tied movies.
3. The UI highlights tied movies equally — no fake winner is manufactured.

### Edge Cases

| Scenario | Behavior |
|---|---|
| No one votes | Results show all movies at 0-0 with a message: "No votes yet! [Creator] can pick, or ask the family to vote." The creator can still pick any movie. |
| Only one member votes | That member's votes determine the ranking. Other members are shown as "didn't vote." |
| Round stalls (no activity for 24 hours) | A push notification is sent to all non-voters: "Your family is waiting! Cast your votes for movie night." (One-time, after 24h.) |
| New member joins during active round | They can vote on any movie in the round. Their arrival does not reset the round or change existing votes. |

---

## 5. "Already Watched" Behavior

"Already watched" is a group-level signal that prevents a movie from cluttering future suggestions. There are two paths to marking a movie as watched:

### Path A: Through the voting flow (existing)
Pick is made → family watches → member taps "We Watched It" → movie is marked watched → optional rating prompt.

### Path B: Direct mark from detail screen (new)
Member opens any movie's detail screen → taps "Already Watched" → movie is added to the group's Watched list → excluded from future suggestions.

**Use cases for Path B:**
- "We watched that last month but never logged it."
- "I know my family has seen this — skip it."
- While browsing Watchlist: "Oh, we ended up watching this on our own."

### Interaction with other features

| Feature | Interaction |
|---|---|
| Suggestions | Watched movies are excluded from algorithm results (existing behavior, now includes directly-marked movies). |
| Watchlist | Marking a Watchlist movie as watched removes it from the Watchlist automatically. |
| Active round | If a movie in the current round is marked as watched, it remains in the round (voting is underway, don't disrupt it), but a "Watched" badge appears and members are informed. |
| Undo | Directly-marked movies can be un-marked within 24 hours ("Oops, wrong movie"). Picked-and-watched movies cannot be un-marked (they have round/vote history). |

---

## 6. Movie Detail View (Collaboration Context)

The movie detail screen (US-12) is extended with group context and collaboration actions.

### Fields Shown

**Movie metadata** (from TMDB — already defined in US-12):
- Poster, title, year, runtime, synopsis, cast (top 5), genre tags, content rating, streaming availability, trailer link

**Group context** (new):
- **Watchlist status:** "On your Watchlist" badge (with "Added by [Name] on [Date]"), or "Add to Watchlist" button
- **Watched status:** "Watched on [Date]" badge, or "Already Watched" button
- **Vote history:** If this movie was in a previous round, show the vote breakdown (e.g., "3 up / 1 down in Round on Feb 14")
- **Rating:** If watched and rated, show the group's average rating and individual ratings

### Actions Available

| Action | When available |
|---|---|
| "Add to Watchlist" | Movie is not on Watchlist and not watched |
| "Remove from Watchlist" | Movie is on Watchlist (only for adder or creator) |
| "Propose for Tonight" | A voting round is active and movie is not already in it |
| "Already Watched" | Movie is not yet marked as watched |
| "Undo Watched" | Movie was directly marked watched within last 24 hours |
| "Where to Watch" | Always (links to streaming app) |
| "Watch Trailer" | Always (links to YouTube) |
| "Rate" | Movie is marked as watched |

---

## 7. Audit & History (v1 Minimal)

v1 takes a **minimal audit approach**: store enough to support the UI and basic accountability, but don't build a full activity feed.

### What we store

| Data point | Stored? | Purpose |
|---|---|---|
| Who voted what, when | Yes | Display on results screen (already in data model) |
| Who proposed which movie | Yes | "Proposed by [Name]" tag in round |
| Who added a movie to Watchlist | Yes | Attribution on Watchlist and detail screen |
| Who marked a movie as watched | Yes | Attribution and undo eligibility |
| Who started a round | Yes | Already in data model (`started_by`) |
| Who locked in the pick | Yes | Already in data model (`picked_by`) |
| Detailed change log / activity feed | No | v2 consideration |
| Edit history (e.g., changed vote from up to down) | No | We overwrite; only the final vote is stored |

### What the UI shows

- **Round results:** Who voted what (existing).
- **Watchlist:** Who added each movie and when.
- **Watched list:** Date watched, who marked it, average rating.
- **No activity feed or timeline in v1.** Members see the current state, not a changelog.

---

## 8. Non-Goals for v1

These features are explicitly **out of scope** for v1 collaboration. They may be considered for v2+.

| Non-Goal | Rationale |
|---|---|
| **Comments / chat on movies** | Families discuss in person. An in-app discussion thread adds complexity without clear value for the target user (families in the same household). |
| **Multiple groups per user** | v1 is one group per user (existing constraint from brief.md). Multi-group would require rethinking Watchlist scope, watched state, and the whole data model. |
| **Custom / user-created lists** | v1 has Watchlist + Watched. Named lists ("Classics", "Scary Movies", "Date Night") are a v2 feature. |
| **Ranked-choice or weighted voting** | Thumbs up/down is sufficient for groups of 2–8. Ranked choice adds cognitive overhead for casual family use. |
| **Anonymous voting** | Families are transparent (Assumption A4). Anonymous voting adds complexity and reduces accountability. |
| **Rich metadata ingestion** | No importing from Letterboxd, IMDb, Trakt, or CSV. Movies are added one at a time via search or suggestions. |
| **Movie search/browse as a primary flow** | v1 search exists only to support propose/watchlist. There is no "browse by genre" or "discover" tab. Full browse is v2. |
| **List reordering** | Watchlist is sorted by recency. No drag-to-reorder in v1. |
| **Sharing lists outside the group** | No public URLs, no cross-group sharing, no social features. |
| **Reminders / scheduling** | No "movie night is at 7pm" or calendar integration. Out of scope per brief.md. |
| **Reactions beyond thumbs up/down** | No emoji reactions, star ratings on suggestions (ratings are post-watch only), or "interested" states. |

---

## 9. Open Questions (Collaboration-Specific)

### CQ-01: Watchlist cap
**Question:** Is 50 movies the right cap for the Watchlist?
**Default:** 50. Revisit if user feedback suggests families want more. The cap prevents the list from becoming an unmanageable dumping ground.

### CQ-02: Proposal limit per round
**Question:** Is 2 per member / 4 per round the right proposal cap?
**Default:** Yes. This keeps the round focused (max 12 movies to vote on). Can be raised if families feel restricted.

### CQ-03: Auto-close behavior
**Question:** Should voting auto-close when all members have voted on all movies, or just when all members have voted on at least one movie?
**Default:** Auto-close when all members have submitted at least one vote AND tapped "Done Voting." This prevents a member from being rushed before they've reviewed everything.

### CQ-04: Watched-movie undo window
**Question:** Is 24 hours the right undo window for directly-marked watched movies?
**Default:** 24 hours. Short enough to prevent gaming, long enough for "oops, wrong movie."

### CQ-05: Search scope
**Question:** Should TMDB search be limited to the same filters as suggestions (year range, popularity threshold), or allow searching the full TMDB catalog?
**Default:** Full catalog search. The filters exist to improve algorithm suggestions; manual search is intentional and should not be artificially constrained. Content-rating ceiling still applies (cannot propose an R movie when the group ceiling is PG).

---

## 10. Assumptions

These assumptions are specific to collaboration features. See also the [Assumptions Log in open-questions.md](open-questions.md#assumptions-log).

| # | Assumption | Affects |
|---|---|---|
| CA-1 | Families discuss movies in person; the app captures decisions, not conversation. | No chat/comments in v1. |
| CA-2 | The group creator is the de facto decision-maker (parent). Other members influence via votes. | Creator-only pick lock-in, creator-only vote close. |
| CA-3 | Proposal spam is unlikely in small family groups (2–8 people) but caps are a safety net. | 2/member, 4/round proposal limits. |
| CA-4 | Members generally agree on what they've watched (trust model). | Any member can mark watched; no consensus required. |
| CA-5 | The Watchlist is a lightweight "save for later" tool, not a curated catalog. | No reordering, no categories, 50-movie cap. |
| CA-6 | Search is a secondary action, not a browsing experience. | Minimal search UI (text input + results list). |
