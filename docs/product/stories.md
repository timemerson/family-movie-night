# Family Movie Night — User Stories (v1)

> Priority: **P0** = must-have for launch, **P1** = should-have, **P2** = nice-to-have.

---

## Account & Onboarding

### US-01: Sign up with Apple ID (P0)
**As a** new user, **I want to** sign up using my Apple ID **so that** I can get started without creating a new password.

**Acceptance Criteria:**
- Tapping "Continue with Apple" completes sign-up in ≤ 2 taps.
- Display name is pre-filled from Apple ID (editable).
- If the user already has an account, they are signed in instead.

### US-02: Sign up with email (P0)
**As a** new user without an Apple device ecosystem preference, **I want to** sign up with email + password **so that** I have an alternative sign-up path.

**Acceptance Criteria:**
- Email verification is sent and must be confirmed before the account is fully active.
- Password must meet minimum strength requirements (≥ 8 chars, 1 number).

### US-03: Create a family group (P0)
**As a** signed-in user, **I want to** create a family group and give it a name **so that** my household has a shared space.

**Acceptance Criteria:**
- Group name is required (max 40 chars).
- Creator is automatically added as the first member.
- The user is taken to the group home screen after creation.

### US-04: Complete onboarding tutorial (P1)
**As a** first-time user, **I want to** see a brief walkthrough of how the app works **so that** I understand the core flow before inviting my family.

**Acceptance Criteria:**
- 3–4 screen carousel explaining: set preferences → get suggestions → vote → watch.
- Skippable at any point.
- Only shown once (or accessible from Settings).

---

## Inviting Family Members

### US-05: Invite via share link (P0)
**As a** group creator, **I want to** generate an invite link I can share via iMessage, WhatsApp, or any channel **so that** family members can join easily.

**Acceptance Criteria:**
- Link opens the app (or App Store if not installed) via Universal Link.
- Accepting the link adds the user to the group after sign-up/sign-in.
- Link expires after 7 days or after 8 members join (group cap).

### US-06: Invite via SMS (P1)
**As a** group creator, **I want to** invite someone by entering their phone number **so that** they get a direct text with the invite.

**Acceptance Criteria:**
- App opens the native SMS composer pre-filled with the invite message + link.
- No server-side SMS sending in v1 (uses the device's SMS).

### US-07: See pending invites (P1)
**As a** group creator, **I want to** see who has been invited but hasn't joined yet **so that** I can re-send or revoke invites.

**Acceptance Criteria:**
- List shows pending invites with "Resend" and "Revoke" actions.
- Revoking an invite invalidates the link immediately.

---

## Preferences

### US-08: Set genre likes and dislikes (P0)
**As a** group member, **I want to** indicate which genres I like and which I dislike **so that** suggestions reflect my taste.

**Acceptance Criteria:**
- Full genre list presented (Action, Comedy, Drama, Horror, Sci-Fi, Animation, etc. — sourced from TMDB genres).
- Each genre can be set to Like, Dislike, or Neutral (default).
- Changes save automatically.

### US-09: Set content-rating ceiling (P0)
**As a** parent, **I want to** set the maximum content rating for my family member's profile **so that** inappropriate movies are excluded.

**Acceptance Criteria:**
- Options: G, PG, PG-13, R. Default is PG-13.
- The group's effective ceiling is the *minimum* across all members (e.g., if one member is set to PG, the group only sees G and PG movies).
- Group creator can override on a per-session basis with confirmation ("Allow PG-13 for tonight?").

### US-10: Set streaming services (P1)
**As a** group member, **I want to** indicate which streaming services my household subscribes to **so that** suggestions prioritize movies we can actually watch.

**Acceptance Criteria:**
- Checklist of major services (Netflix, Disney+, Hulu, Amazon Prime Video, HBO Max, Apple TV+, Paramount+, Peacock).
- This is set at the group level (one household = one set of subscriptions).
- Movies available on selected services are ranked higher; others are still shown but flagged.

---

## Suggestions

### US-11: Get a suggestion shortlist (P0)
**As a** group member, **I want to** tap "Suggest Movies" and see a curated shortlist **so that** we have good options to choose from.

**Acceptance Criteria:**
- Returns 5–8 movies matching the group's combined preferences.
- Previously watched movies are excluded.
- Each suggestion shows: poster, title, year, genre tags, content rating, and where to stream.
- If no movies match all filters, the app relaxes constraints and explains which ones were loosened.

### US-12: View movie details (P0)
**As a** group member, **I want to** tap a movie to see its full details **so that** I can make an informed vote.

**Acceptance Criteria:**
- Detail screen shows: poster, title, year, runtime, synopsis, cast (top 5), genre tags, content rating, streaming availability, and a link to the trailer (YouTube deep link).
- "Where to Watch" section links out to the streaming app.

### US-13: Refresh suggestions (P1)
**As a** group member, **I want to** request a new batch of suggestions **so that** I can see different options if the first set doesn't appeal.

**Acceptance Criteria:**
- "Show me more" replaces the current shortlist with a new one.
- Previously shown (and un-voted) movies may reappear in future batches but not in the immediately next one.

---

## Voting / Collaborative Decision

### US-14: Vote on suggestions (P0)
**As a** group member, **I want to** thumbs-up or thumbs-down each suggested movie **so that** the group can find consensus.

**Acceptance Criteria:**
- Each member can vote once per movie per round (thumbs-up or thumbs-down).
- Votes are submitted individually; a member does not need to vote on all movies.
- Voting is open until the group creator closes the round or all members have voted.

### US-15: See voting results (P0)
**As a** group member, **I want to** see how many people liked each movie **so that** we can pick the winner.

**Acceptance Criteria:**
- Results screen shows each movie ranked by net votes (thumbs-up minus thumbs-down).
- Individual votes are visible (who liked what) — families are not anonymous.
- If there's a tie, movies are sub-sorted by popularity score.

### US-16: Lock in the pick (P0)
**As the** group creator, **I want to** confirm the final movie choice **so that** everyone knows what we're watching.

**Acceptance Criteria:**
- Group creator taps "Pick this one" on a movie from the results.
- All members receive a push notification: "Tonight's movie: [Title]!"
- The pick is saved to the group's history.

### US-17: Receive vote nudge (P1)
**As a** group member who hasn't voted yet, **I want to** receive a push notification reminding me to vote **so that** the round can complete.

**Acceptance Criteria:**
- Notification sent 1 hour after the round opens if the member hasn't voted.
- Only one nudge per round.
- Tapping the notification opens the voting screen.

---

## Watched List & History

### US-18: Mark a movie as watched (P0)
**As a** group member, **I want to** mark the picked movie as "watched" **so that** it won't be suggested again.

**Acceptance Criteria:**
- One-tap action from the pick confirmation screen or from group history.
- Any member can mark it; it applies to the whole group.

### US-19: Rate a watched movie (P1)
**As a** group member, **I want to** rate a movie after watching it (1–5 stars) **so that** future suggestions improve.

**Acceptance Criteria:**
- Rating prompt appears when a member opens the app within 24 hours after the movie was marked watched.
- Rating is optional and dismissable.
- Individual ratings are stored; the group sees an average.

### US-20: View watch history (P1)
**As a** group member, **I want to** see a list of all movies we've watched together **so that** I can look back at our movie nights.

**Acceptance Criteria:**
- Chronological list with poster thumbnail, title, date watched, and group average rating.
- Tapping a movie opens the detail view.

---

## Settings & Profile

### US-21: Edit my display name and avatar (P2)
**As a** user, **I want to** customize my display name and pick an avatar **so that** my family recognizes me in the app.

**Acceptance Criteria:**
- Display name editable (max 30 chars).
- Avatar selection from a predefined set of illustrated icons (no photo upload in v1).

### US-22: Leave a group (P1)
**As a** group member, **I want to** leave the group **so that** my preferences no longer affect suggestions.

**Acceptance Criteria:**
- Confirmation dialog before leaving.
- The member's preferences are removed from group calculations.
- If the creator leaves, the longest-tenured remaining member becomes the new creator.

### US-23: Delete my account (P0)
**As a** user, **I want to** delete my account and all associated data **so that** I can exercise my privacy rights.

**Acceptance Criteria:**
- Accessible from Settings → Account → Delete Account.
- Requires confirmation ("Type DELETE to confirm").
- All personal data is deleted within 30 days per retention policy.
- The user is removed from any group they belong to.

### US-24: Manage notification preferences (P1)
**As a** user, **I want to** control which push notifications I receive **so that** I'm not overwhelmed.

**Acceptance Criteria:**
- Toggles for: vote nudges, pick announcements, new round started.
- Default: all on.

### US-25: Add a child's profile (P1)
**As a** parent, **I want to** create a profile for my young child (under 8) within my account **so that** their preferences count without them needing their own device.

**Acceptance Criteria:**
- Child profile is linked to the parent's account (not a separate sign-up).
- Parent sets the child's preferences on their behalf.
- Child profile has a mandatory content-rating ceiling of PG.

---

## Watchlist

### US-26: Add a movie to the group watchlist (P0)
**As a** group member, **I want to** save a movie to the group's shared Watchlist **so that** we can consider it for a future movie night.

**Acceptance Criteria:**
- "Add to Watchlist" action is available from suggestion cards, movie detail screen, and search results.
- The movie is added to the group's Watchlist with attribution (who added it, when).
- If the movie is already on the Watchlist, the button is disabled with "Already on Watchlist."
- If the movie is on the Watched list, the action is blocked with "You've already watched this."
- Watchlist has a maximum of 50 movies. If full, the user sees "Watchlist is full. Remove a movie to make room."
- All group members can see the updated Watchlist immediately.

### US-27: View the group watchlist (P0)
**As a** group member, **I want to** browse our group's Watchlist **so that** I can see what movies we're considering.

**Acceptance Criteria:**
- Watchlist is accessible from the group home screen.
- Movies are displayed in reverse chronological order (most recently added first).
- Each entry shows: poster thumbnail, title, year, genre tags, content rating, who added it, and streaming availability badges.
- Tapping a movie opens the full movie detail screen.
- Empty state: "No movies saved yet. Add movies from suggestions or search."

### US-28: Remove a movie from the watchlist (P1)
**As a** group member, **I want to** remove a movie from the Watchlist **so that** the list stays relevant and manageable.

**Acceptance Criteria:**
- Swipe-to-delete on any Watchlist entry (or "Remove" button on movie detail).
- A member can remove movies they added. The group creator can remove any movie.
- Non-creator members cannot remove movies added by others.
- Removal is immediate with a brief undo toast (3 seconds).

---

## Movie Discovery

### US-29: Search for a movie by title (P1)
**As a** group member, **I want to** search for a specific movie **so that** I can add it to the Watchlist or propose it for tonight.

**Acceptance Criteria:**
- Search is accessible from the Watchlist screen and from the active round screen.
- Text input searches TMDB by title. Results appear as the user types (debounced, minimum 3 characters).
- Results show: poster thumbnail, title, year, and content rating.
- Movies that exceed the group's content-rating ceiling are shown but grayed out with "Exceeds group rating."
- Movies already on the Watched list are shown with a "Watched" badge.
- Tapping a result opens the movie detail screen with available actions (Add to Watchlist, Propose for Tonight, etc.).
- Search queries are not stored or shared with group members.

---

## Proposing Movies

### US-30: Propose a movie for the active voting round (P1)
**As a** group member, **I want to** add a specific movie to tonight's voting round **so that** the family can vote on my suggestion alongside the algorithm picks.

**Acceptance Criteria:**
- "Propose for Tonight" action is available on movie detail and Watchlist when a voting round is active.
- The movie is added to the round's suggestion list with a "Proposed by [Name]" tag.
- The movie must not already be in the round, must not be on the Watched list, and must meet the group's content-rating ceiling.
- Each member can propose up to 2 movies per round. A 4-movie total proposal cap per round applies.
- If the member has hit their limit: "You've already proposed 2 movies this round."
- If the round cap is hit: "This round has enough proposals. Try adding to the Watchlist instead."
- All group members see the new proposal immediately. Members who haven't voted on it yet see it in their voting queue.
- If no round is active, the action is replaced with "Add to Watchlist" and a helper: "No round active. Save it for next time?"

### US-31: Include watchlist movies when starting a round (P1)
**As a** group member starting a voting round, **I want to** optionally include Watchlist movies **so that** saved favorites get a chance to be voted on.

**Acceptance Criteria:**
- After the algorithm generates suggestions, if the Watchlist has eligible movies (not watched, within content-rating ceiling), a prompt appears: "Your Watchlist has [N] movies. Include some in tonight's vote?"
- If yes, up to 4 Watchlist movies (most recently added) are added to the round with a "From Watchlist" tag.
- These count against the round's 4-proposal cap.
- If no, the round proceeds with algorithm suggestions only.
- If the Watchlist is empty or has no eligible movies, the prompt is skipped.
- Watchlist movies included in the round are NOT removed from the Watchlist (they stay until picked or manually removed).

---

## Movie Detail & Actions

### US-32: View movie detail with group context (P0)
**As a** group member, **I want to** see a movie's full details along with my group's history with it **so that** I can make informed decisions.

**Acceptance Criteria:**
- All fields from US-12 are shown (poster, title, year, runtime, synopsis, cast top 5, genres, content rating, streaming, trailer link).
- **Watchlist status:** If on the Watchlist, show "On your Watchlist — added by [Name] on [Date]." If not, show "Add to Watchlist" button.
- **Watched status:** If watched, show "Watched on [Date]" with the group's average rating (if rated). If not, show "Already Watched" button.
- **Vote history:** If this movie appeared in a previous round, show the vote summary (e.g., "Suggested on Feb 14 — 3 up, 1 down").
- **Current round:** If this movie is in the active round, show current vote tally and the user's own vote (if cast).
- Available actions depend on context (see collaboration-rules.md Section 6).

### US-33: Mark any movie as "already watched" (P0)
**As a** group member, **I want to** mark a movie as watched from its detail screen **so that** it doesn't appear in future suggestions, even if we didn't pick it through the app.

**Acceptance Criteria:**
- "Already Watched" button on the movie detail screen (when the movie is not yet marked watched).
- Tapping it adds the movie to the group's Watched list with attribution (who marked it, when).
- The movie is excluded from future suggestion algorithm results.
- If the movie is on the Watchlist, it is automatically removed from the Watchlist.
- If the movie is in the active round, it remains in the round but gains a "Watched" badge. A brief inline note: "[Name] marked this as already watched."
- Optional rating prompt appears after marking: "Rate it?" (1–5 stars), skippable.
- Confirmation before marking: "Mark as watched for the whole group? It won't appear in future suggestions."

### US-34: Add to watchlist from movie detail or suggestion card (P0)
**As a** group member, **I want to** add a movie to the Watchlist directly from its detail screen or suggestion card **so that** I can quickly save interesting movies.

**Acceptance Criteria:**
- "Add to Watchlist" button on the movie detail screen (when not already on Watchlist or Watched).
- "Save for Later" quick-action on suggestion cards in the suggestion shortlist (icon button, no navigation required).
- After adding, the button changes to "On Watchlist" (disabled state) with a brief success toast.
- If the Watchlist is full (50 movies), the action is blocked with "Watchlist is full."
- Adding a movie does NOT remove it from the current suggestion shortlist or round.

---

## Watched List

### US-35: View the group's complete watched list (P1)
**As a** group member, **I want to** see all the movies our group has watched **so that** we can reminisce and track our movie night history.

**Acceptance Criteria:**
- Accessible from the group home screen (tab or section).
- Combines both sources: movies picked through voting rounds AND movies directly marked as watched.
- Each entry shows: poster thumbnail, title, year, date watched, who marked/picked it, and average group rating (if rated).
- Movies that went through a round show "Picked" badge; directly marked movies show "Marked by [Name]."
- Sorted reverse chronologically (most recently watched first).
- Tapping a movie opens the detail view with vote history (for picked movies) and rating details.
- This extends US-20 (which only covered picked movies).

### US-36: Un-mark a directly-watched movie (P2)
**As a** group member, **I want to** undo an accidental "already watched" mark **so that** the movie can appear in suggestions again.

**Acceptance Criteria:**
- "Undo Watched" action available on the movie detail screen for directly-marked movies only (not for movies picked through rounds).
- Only available within 24 hours of the original mark.
- Only the member who marked it (or the group creator) can undo.
- After 24 hours, the action disappears; the movie is permanently on the Watched list.
- Undoing restores the movie to its previous state (back on Watchlist if it was there before, otherwise just unmarked).

---

## Round Management

### US-37: See proposal source for each movie in a round (P2)
**As a** group member, **I want to** see whether a movie in the voting round came from the algorithm, a member's proposal, or the Watchlist **so that** I understand where the options came from.

**Acceptance Criteria:**
- Each movie in the voting screen shows a subtle source tag:
  - No tag for algorithm-generated suggestions (default)
  - "Proposed by [Name]" for member proposals
  - "From Watchlist" for Watchlist promotions
- Tags are informational only and do not affect voting mechanics.

### US-38: Remove a proposed movie from the active round (P2)
**As the** member who proposed a movie (or the group creator), **I want to** remove my proposal from the round **so that** I can fix a mistake or make room for a different proposal.

**Acceptance Criteria:**
- "Remove Proposal" action on proposed movies in the round (not available for algorithm suggestions).
- Available to the proposer or the group creator.
- If votes have already been cast on the proposal, a confirmation is required: "This movie has [N] votes. Remove it anyway?"
- Removing a proposal frees up one proposal slot (for the member and/or the round).
- Votes on the removed proposal are discarded.

---

## Permissions & Edge Cases

### US-39: New member sees existing group data (P0)
**As a** new member who just joined a group, **I want to** immediately see the group's Watchlist, Watched list, and any active round **so that** I can participate right away.

**Acceptance Criteria:**
- Upon joining, the new member sees the full Watchlist and Watched history (no phased access).
- If a voting round is active, the new member can vote on all movies in the round.
- The new member's vote does not retroactively change already-displayed results for others (results update live).
- The new member appears in the vote progress indicator (e.g., "3 of 5 members have voted").

### US-40: Duplicate prevention across lists and suggestions (P0)
**As the** system, **I need to** prevent the same movie from appearing in conflicting states **so that** the user experience is consistent.

**Acceptance Criteria:**
- A movie cannot be on the Watchlist and the Watched list simultaneously (marking watched removes from Watchlist).
- A movie cannot be added to the Watchlist if it's already there (idempotent; show "Already on Watchlist").
- The suggestion algorithm excludes all Watched movies (both picked and directly marked).
- A movie already in the active round cannot be proposed again.
- When "Show Me More" regenerates suggestions, previously shown movies AND Watchlist movies already in the round are excluded.

### US-41: Handle round with zero votes (P1)
**As the** group creator, **I want to** still be able to pick a movie even if no one voted **so that** we don't get stuck.

**Acceptance Criteria:**
- If the creator closes a round with zero votes, the results screen shows all movies at 0-0 scores.
- Message: "No votes yet! Pick a movie or ask the family to weigh in."
- The creator can pick any movie from the list.
- If the creator doesn't pick and 24 hours pass, a nudge notification is sent: "Your movie night is waiting! Pick a movie or start a new round."
