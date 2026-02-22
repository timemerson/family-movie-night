# Family Movie Night — Open Questions & Risks (v1)

> Items are ranked by impact. Each question includes a **suggested default** so we can move forward while awaiting a final decision.

---

## High Impact

### OQ-01: Streaming availability data source
**Question:** Which API do we use for "where to watch" data? Options include TMDB's watch-providers endpoint (free, limited), JustWatch (no official public API), or Watchmode (paid, reliable).

**Risk:** Choosing an unreliable or expensive source could break a core feature or blow the budget.

**Suggested default:** Start with **TMDB's watch-providers endpoint** (free, included with the movie metadata API). Evaluate accuracy during development and upgrade to Watchmode if TMDB's data is too stale or incomplete.

---

### OQ-02: COPPA compliance for child profiles
**Question:** Do managed child profiles (parent creates them, no direct data collection from the child) trigger COPPA obligations? What disclosures are needed?

**Risk:** Non-compliance could lead to App Store rejection or legal exposure.

**Suggested default:** Treat child profiles as **parent-controlled data** (the parent provides all info). Add a clear disclosure in the profile creation flow: "This profile is managed by you on behalf of your child. No data is collected directly from your child." **Consult legal counsel before launch.**

---

### OQ-03: Suggestion algorithm quality
**Question:** Will a simple genre-filter + popularity-rank algorithm produce good enough suggestions, or will users feel the picks are generic?

**Risk:** Poor suggestions undermine the core value prop. Users stop using the app after 2–3 bland rounds.

**Suggested default:** Ship with the deterministic algorithm (filter → rank by TMDB popularity). Add a **feedback mechanism** — if users tap "Show Me More" more than twice in a session, log it as a signal for algorithm improvement. Plan ML-based recommendations for v2.

---

### OQ-04: Monetization model
**Question:** How will this app make money? Options: freemium (free with paid tier), one-time purchase, ads, or free (growth-first).

**Risk:** Choosing too early constrains design; choosing too late means no revenue path.

**Suggested default:** **Free for v1** with no ads. Focus on retention and product-market fit. Revisit monetization after hitting 10K activated groups. Likely model: freemium (free for 1 group, pay for multi-group + advanced filters).

---

## Medium Impact

### OQ-05: Group size cap
**Question:** What's the maximum number of members per group? The brief says 8, but is that the right number?

**Risk:** Too small excludes extended families; too large dilutes consensus (voting becomes hard).

**Suggested default:** **Cap at 8 members.** This covers nuclear families + grandparents. If user feedback demands more, raise to 12 in a point release.

---

### OQ-06: Handling disagreements / no consensus
**Question:** What happens when a voting round produces no clear winner (e.g., all movies get mixed reviews)?

**Risk:** Frustrated families abandon the app when it can't help them decide.

**Suggested default:** If no movie has a net-positive score, show the results with a message: "Tough crowd! Try a new batch of suggestions or let [Creator] make the call." The creator can always override and pick any movie from the list.

---

### OQ-07: Movie catalog scope
**Question:** Should we include all movies in TMDB, or limit to movies released in the last N years, or only movies available on streaming?

**Risk:** Including everything means obscure/unavailable movies clutter suggestions. Limiting too much means missing classics.

**Suggested default:** Include movies from **1980 to present** with a **popularity score above a threshold** (e.g., TMDB popularity > 10). Streaming-available movies get a ranking boost. Allow users to discover older films but don't suggest deep cuts.

---

### OQ-08: Multi-device / multi-account per household — RESOLVED
**Question:** Should family members each have their own Apple ID / device, or should we support multiple profiles on a single device?

**Risk:** Younger kids may not have their own iPhone. Parents may want to set up the whole family from one device.

**Resolution:** Two member types:
- **Independent members** have their own Cognito account and sign in on their own device. They cannot be impersonated from other devices.
- **Managed members** have no login. Created by a parent/household admin. Accessible from any household device via profile switching.
- Any device logged into the household can switch between the authenticated user and any managed members they control.
- See US-25 (managed members), US-42 (profile switching), US-43 (attendee selection).

---

### OQ-09: Notification timing and frequency
**Question:** How aggressive should notifications be? Too many and users mute them; too few and voting rounds stall.

**Risk:** Getting this wrong either annoys users or causes engagement to drop.

**Suggested default:** Conservative approach:
- **Round started:** Immediate push to all members.
- **Vote nudge:** 1 push, 1 hour after round opens, only to non-voters.
- **Pick announced:** Immediate push to all members.
- No other automated notifications. Revisit based on engagement data.

---

### OQ-10: Offline behavior
**Question:** How should the app behave without internet? Movie metadata requires API calls.

**Risk:** Poor offline UX creates a bad impression, but heavy caching adds complexity.

**Suggested default:** **Online-only for v1.** Show a clear "No internet connection" state. Previously loaded movie details can be viewed from cache, but no new suggestions or voting without connectivity.

---

## Lower Impact

### OQ-11: Accessibility and localization
**Question:** What's the v1 accessibility bar? Do we localize beyond English?

**Suggested default:** Meet **WCAG 2.1 AA** standards (VoiceOver support, Dynamic Type, sufficient contrast). **English only** for v1. Localization is v2.

---

### OQ-12: Trailer integration
**Question:** Should we embed YouTube trailers in-app or link out?

**Suggested default:** **Link out to YouTube** via deep link. Embedding requires YouTube API quota management and adds complexity.

---

### OQ-13: App Store age rating
**Question:** What age rating should we target for the app itself? The app helps families choose movies (some of which are rated R).

**Suggested default:** **12+** — the app itself contains no objectionable content, but it references movies of all ratings. This matches similar apps (e.g., IMDB is 12+).

---

### OQ-14: Re-suggesting previously rejected movies
**Question:** If a movie was in a voting round and got mostly thumbs-down, should it ever appear again?

**Suggested default:** **Yes, but deprioritized.** Exclude it from the next 3 suggestion rounds, then allow it back at a lower rank. Family composition or moods change — don't permanently blacklist unless explicitly hidden by a user.

---

### OQ-15: Backend technology
**Question:** What backend stack / infrastructure should we use?

**Risk:** Premature commitment. This is explicitly out of scope for this document.

**Suggested default:** **Defer.** Evaluate after the product spec is reviewed. Candidates to consider: managed BaaS (Firebase/Supabase), custom API (Node/Go/Swift on server), or CloudKit for tight Apple integration. Decision should factor in team expertise, cost, and timeline.

---

## Assumptions Log

These assumptions are baked into the spec. If any prove wrong, revisit the affected documents.

| # | Assumption | Affects |
|---|---|---|
| A1 | TMDB is the movie metadata source (free tier sufficient for v1 scale) | brief, data, flows |
| A2 | Household sizes are 2–8 members | brief, flows, data |
| A3 | One household per authenticated account in v1 | brief, stories, data |
| A4 | Families trust each other (votes are visible, any member can mark watched) | flows, stories |
| A5 | Kids under 8 are represented as managed members (no login, parent-controlled) | stories (US-25) |
| A6 | No revenue in v1; free app with no ads | brief |
| A7 | Push notifications via APNs (standard iOS) | stories, flows |
| A8 | The app is online-only; no offline-first architecture | flows |
| A9 | Content ratings use the MPAA system (US-centric) | stories, data |
