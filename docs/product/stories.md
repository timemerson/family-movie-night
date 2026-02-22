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

### US-03: Create a household (P0)
**As a** signed-in user, **I want to** create a household and give it a name **so that** my family has a shared space.

**Acceptance Criteria:**
- Household name is required (max 40 chars).
- Creator is automatically added as the first member (independent).
- The user is taken to the household home screen after creation.

### US-04: Complete onboarding tutorial (P1)
**As a** first-time user, **I want to** see a brief walkthrough of how the app works **so that** I understand the core flow before inviting my family.

**Acceptance Criteria:**
- 3–4 screen carousel explaining: set preferences → get suggestions → vote → watch.
- Skippable at any point.
- Only shown once (or accessible from Settings).

---

## Inviting Family Members

### US-05: Invite via share link (P0)
**As a** household creator, **I want to** generate an invite link I can share via iMessage, WhatsApp, or any channel **so that** family members can join easily.

**Acceptance Criteria:**
- Link opens the app (or App Store if not installed) via Universal Link.
- Accepting the link adds the user to the household after sign-up/sign-in.
- Link expires after 7 days or after 8 members join (household cap).

### US-06: Invite via SMS (P1)
**As a** household creator, **I want to** invite someone by entering their phone number **so that** they get a direct text with the invite.

**Acceptance Criteria:**
- App opens the native SMS composer pre-filled with the invite message + link.
- No server-side SMS sending in v1 (uses the device's SMS).

### US-07: See pending invites (P1)
**As a** household creator, **I want to** see who has been invited but hasn't joined yet **so that** I can re-send or revoke invites.

**Acceptance Criteria:**
- List shows pending invites with "Resend" and "Revoke" actions.
- Revoking an invite invalidates the link immediately.

---

## Preferences

### US-08: Set genre likes and dislikes (P0)
**As a** household member, **I want to** indicate which genres I like and which I dislike **so that** suggestions reflect my taste.

**Acceptance Criteria:**
- Full genre list presented (Action, Comedy, Drama, Horror, Sci-Fi, Animation, etc. — sourced from TMDB genres).
- Each genre can be set to Like, Dislike, or Neutral (default).
- Changes save automatically.

### US-09: Set content-rating ceiling (P0)
**As a** parent, **I want to** set the maximum content rating for my family member's profile **so that** inappropriate movies are excluded.

**Acceptance Criteria:**
- Options: G, PG, PG-13, R. Default is PG-13.
- The household's effective ceiling is the *minimum* across all members (e.g., if one member is set to PG, the household only sees G and PG movies).
- Household creator can override on a per-session basis with confirmation ("Allow PG-13 for tonight?").

### US-10: Set streaming services (P1)
**As a** household member, **I want to** indicate which streaming services my household subscribes to **so that** suggestions prioritize movies we can actually watch.

**Acceptance Criteria:**
- Checklist of major services (Netflix, Disney+, Hulu, Amazon Prime Video, HBO Max, Apple TV+, Paramount+, Peacock).
- This is set at the household level (one household = one set of subscriptions).
- Movies available on selected services are ranked higher; others are still shown but flagged.

---

## Suggestions

### US-11: Get a suggestion shortlist (P0)
**As a** household member, **I want to** tap "Suggest Movies" and see a curated shortlist **so that** we have good options to choose from.

**Acceptance Criteria:**
- Returns 5–8 movies matching the household's combined preferences.
- Previously watched movies are excluded.
- Each suggestion shows: poster, title, year, genre tags, content rating, and where to stream.
- If no movies match all filters, the app relaxes constraints and explains which ones were loosened.

### US-12: View movie details (P0)
**As a** household member, **I want to** tap a movie to see its full details **so that** I can make an informed vote.

**Acceptance Criteria:**
- Detail screen shows: poster, title, year, runtime, synopsis, cast (top 5), genre tags, content rating, streaming availability, and a link to the trailer (YouTube deep link).
- "Where to Watch" section links out to the streaming app.

### US-13: Refresh suggestions (P1)
**As a** household member, **I want to** request a new batch of suggestions **so that** I can see different options if the first set doesn't appeal.

**Acceptance Criteria:**
- "Show me more" replaces the current shortlist with a new one.
- Previously shown (and un-voted) movies may reappear in future batches but not in the immediately next one.

---

## Voting / Collaborative Decision

### US-14: Vote on suggestions (P0)
**As a** household member, **I want to** thumbs-up or thumbs-down each suggested movie **so that** the household can find consensus.

**Acceptance Criteria:**
- Each member can vote once per movie per round (thumbs-up or thumbs-down).
- Votes are submitted individually; a member does not need to vote on all movies.
- Voting is open until the household creator closes the round or all members have voted.

### US-15: See voting results (P0)
**As a** household member, **I want to** see how many people liked each movie **so that** we can pick the winner.

**Acceptance Criteria:**
- Results screen shows each movie ranked by net votes (thumbs-up minus thumbs-down).
- Individual votes are visible (who liked what) — families are not anonymous.
- If there's a tie, movies are sub-sorted by popularity score.

### US-16: Lock in the pick (P0)
**As the** household creator, **I want to** confirm the final movie choice **so that** everyone knows what we're watching.

**Acceptance Criteria:**
- Household creator taps "Pick this one" on a movie from the results.
- All members receive a push notification: "Tonight's movie: [Title]!"
- The pick is saved to the household's history.

### US-17: Receive vote nudge (P1)
**As a** household member who hasn't voted yet, **I want to** receive a push notification reminding me to vote **so that** the round can complete.

**Acceptance Criteria:**
- Notification sent 1 hour after the round opens if the member hasn't voted.
- Only one nudge per round.
- Tapping the notification opens the voting screen.

---

## Watched List & History

### US-18: Mark a movie as watched (P0)
**As a** household member, **I want to** mark the picked movie as "watched" **so that** it won't be suggested again.

**Acceptance Criteria:**
- One-tap action from the pick confirmation screen or from household history.
- Any member can mark it; it applies to the whole household.

### US-19: Rate a watched movie (P0)
**As a** household member, **I want to** rate a movie after watching it **so that** future suggestions improve and we remember what we thought.

**Acceptance Criteria:**
- Rating prompt appears after marking a movie as watched.
- Three options: Loved / Liked / Did Not Like (not a numeric scale).
- Rating is optional and dismissable.
- One rating per attending member per session; can be changed before ratings are closed.
- Individual ratings are stored; the household sees a summary (e.g., "2 Loved, 1 Liked").
- When all attending members have rated, the session auto-transitions to `rated` status.
- The creator can close ratings early via "Close Ratings" if some attendees never rate.
- Rating is attributed to the active member (supports managed member profiles).

### US-20: View watch history (P1)
**As a** household member, **I want to** see a list of all movies we've watched together **so that** I can look back at our movie nights.

**Acceptance Criteria:**
- Chronological list with poster thumbnail, title, date watched, and household average rating.
- Tapping a movie opens the detail view.

---

## Settings & Profile

### US-21: Edit my display name and avatar (P2)
**As a** user, **I want to** customize my display name and pick an avatar **so that** my family recognizes me in the app.

**Acceptance Criteria:**
- Display name editable (max 30 chars).
- Avatar selection from a predefined set of illustrated icons (no photo upload in v1).

### US-22: Leave a household (P1)
**As a** household member, **I want to** leave the household **so that** my preferences no longer affect suggestions.

**Acceptance Criteria:**
- Confirmation dialog before leaving.
- The member's preferences are removed from household calculations.
- If the creator leaves, the longest-tenured remaining member becomes the new creator.

### US-23: Delete my account (P0)
**As a** user, **I want to** delete my account and all associated data **so that** I can exercise my privacy rights.

**Acceptance Criteria:**
- Accessible from Settings → Account → Delete Account.
- Requires confirmation ("Type DELETE to confirm").
- All personal data is deleted within 30 days per retention policy.
- The user is removed from any household they belong to.

### US-24: Manage notification preferences (P1)
**As a** user, **I want to** control which push notifications I receive **so that** I'm not overwhelmed.

**Acceptance Criteria:**
- Toggles for: vote nudges, pick announcements, new round started.
- Default: all on.

### US-25: Add a managed member profile (P0)
**As a** household member, **I want to** create a managed profile for a family member (e.g., a young child) within my account **so that** their preferences count without them needing their own device or login.

**Acceptance Criteria:**
- Managed member profile is linked to the creating user's account (`parent_user_id`).
- Managed members have no Cognito account, no email, no login credentials.
- The creating user sets the managed member's display name and avatar.
- Managed members have a mandatory content-rating ceiling of PG (not editable).
- Managed members appear in the household member list and the profile switcher.
- COPPA disclosure is shown during creation: "This profile is managed by you on behalf of a household member. No data is collected directly from them."
- The creating user can set preferences on behalf of the managed member by switching to their profile.
- Managed members can be removed by the household creator.

---

## Watchlist

### US-26: Add a movie to the household watchlist (P0)
**As a** household member, **I want to** save a movie to the household's shared Watchlist **so that** we can consider it for a future movie night.

**Acceptance Criteria:**
- "Add to Watchlist" action is available from suggestion cards, movie detail screen, and search results.
- The movie is added to the household's Watchlist with attribution (who added it, when).
- If the movie is already on the Watchlist, the button is disabled with "Already on Watchlist."
- If the movie is on the Watched list, the action is blocked with "You've already watched this."
- Watchlist has a maximum of 50 movies. If full, the user sees "Watchlist is full. Remove a movie to make room."
- All household members can see the updated Watchlist immediately.

### US-27: View the household watchlist (P0)
**As a** household member, **I want to** browse our household's Watchlist **so that** I can see what movies we're considering.

**Acceptance Criteria:**
- Watchlist is accessible from the household home screen.
- Movies are displayed in reverse chronological order (most recently added first).
- Each entry shows: poster thumbnail, title, year, genre tags, content rating, who added it, and streaming availability badges.
- Tapping a movie opens the full movie detail screen.
- Empty state: "No movies saved yet. Add movies from suggestions or search."

### US-28: Remove a movie from the watchlist (P1)
**As a** household member, **I want to** remove a movie from the Watchlist **so that** the list stays relevant and manageable.

**Acceptance Criteria:**
- Swipe-to-delete on any Watchlist entry (or "Remove" button on movie detail).
- A member can remove movies they added. The household creator can remove any movie.
- Non-creator members cannot remove movies added by others.
- Removal is immediate with a brief undo toast (3 seconds).

---

## Movie Discovery

### US-29: Search for a movie by title (P1)
**As a** household member, **I want to** search for a specific movie **so that** I can add it to the Watchlist or propose it for tonight.

**Acceptance Criteria:**
- Search is accessible from the Watchlist screen and from the active round screen.
- Text input searches TMDB by title. Results appear as the user types (debounced, minimum 3 characters).
- Results show: poster thumbnail, title, year, and content rating.
- Movies that exceed the household's content-rating ceiling are shown but grayed out with "Exceeds household rating."
- Movies already on the Watched list are shown with a "Watched" badge.
- Tapping a result opens the movie detail screen with available actions (Add to Watchlist, Propose for Tonight, etc.).
- Search queries are not stored or shared with household members.

---

## Proposing Movies

### US-30: Propose a movie for the active voting round (P1)
**As a** household member, **I want to** add a specific movie to tonight's voting round **so that** the family can vote on my suggestion alongside the algorithm picks.

**Acceptance Criteria:**
- "Propose for Tonight" action is available on movie detail and Watchlist when a voting round is active.
- The movie is added to the round's suggestion list with a "Proposed by [Name]" tag.
- The movie must not already be in the round, must not be on the Watched list, and must meet the household's content-rating ceiling.
- Each member can propose up to 2 movies per round. A 4-movie total proposal cap per round applies.
- If the member has hit their limit: "You've already proposed 2 movies this round."
- If the round cap is hit: "This round has enough proposals. Try adding to the Watchlist instead."
- All household members see the new proposal immediately. Members who haven't voted on it yet see it in their voting queue.
- If no round is active, the action is replaced with "Add to Watchlist" and a helper: "No round active. Save it for next time?"

### US-31: Include watchlist movies when starting a round (P1)
**As a** household member starting a voting round, **I want to** optionally include Watchlist movies **so that** saved favorites get a chance to be voted on.

**Acceptance Criteria:**
- After the algorithm generates suggestions, if the Watchlist has eligible movies (not watched, within content-rating ceiling), a prompt appears: "Your Watchlist has [N] movies. Include some in tonight's vote?"
- If yes, up to 4 Watchlist movies (most recently added) are added to the round with a "From Watchlist" tag.
- These count against the round's 4-proposal cap.
- If no, the round proceeds with algorithm suggestions only.
- If the Watchlist is empty or has no eligible movies, the prompt is skipped.
- Watchlist movies included in the round are NOT removed from the Watchlist (they stay until picked or manually removed).

---

## Movie Detail & Actions

### US-32: View movie detail with household context (P0)
**As a** household member, **I want to** see a movie's full details along with my household's history with it **so that** I can make informed decisions.

**Acceptance Criteria:**
- All fields from US-12 are shown (poster, title, year, runtime, synopsis, cast top 5, genres, content rating, streaming, trailer link).
- **Watchlist status:** If on the Watchlist, show "On your Watchlist — added by [Name] on [Date]." If not, show "Add to Watchlist" button.
- **Watched status:** If watched, show "Watched on [Date]" with the household's average rating (if rated). If not, show "Already Watched" button.
- **Vote history:** If this movie appeared in a previous round, show the vote summary (e.g., "Suggested on Feb 14 — 3 up, 1 down").
- **Current round:** If this movie is in the active round, show current vote tally and the user's own vote (if cast).
- Available actions depend on context (see collaboration-rules.md Section 6).

### US-33: Mark any movie as "already watched" (P0)
**As a** household member, **I want to** mark a movie as watched from its detail screen **so that** it doesn't appear in future suggestions, even if we didn't pick it through the app.

**Acceptance Criteria:**
- "Already Watched" button on the movie detail screen (when the movie is not yet marked watched).
- Tapping it adds the movie to the household's Watched list with attribution (who marked it, when).
- The movie is excluded from future suggestion algorithm results.
- If the movie is on the Watchlist, it is automatically removed from the Watchlist.
- If the movie is in the active round, it remains in the round but gains a "Watched" badge. A brief inline note: "[Name] marked this as already watched."
- Optional rating prompt appears after marking: "Rate it?" (Loved / Liked / Did Not Like), skippable.
- Confirmation before marking: "Mark as watched for the whole household? It won't appear in future suggestions."

### US-34: Add to watchlist from movie detail or suggestion card (P0)
**As a** household member, **I want to** add a movie to the Watchlist directly from its detail screen or suggestion card **so that** I can quickly save interesting movies.

**Acceptance Criteria:**
- "Add to Watchlist" button on the movie detail screen (when not already on Watchlist or Watched).
- "Save for Later" quick-action on suggestion cards in the suggestion shortlist (icon button, no navigation required).
- After adding, the button changes to "On Watchlist" (disabled state) with a brief success toast.
- If the Watchlist is full (50 movies), the action is blocked with "Watchlist is full."
- Adding a movie does NOT remove it from the current suggestion shortlist or round.

---

## Watched List

### US-35: View the household's complete watched list (P1)
**As a** household member, **I want to** see all the movies our household has watched **so that** we can reminisce and track our movie night history.

**Acceptance Criteria:**
- Accessible from the household home screen (tab or section).
- Combines both sources: movies picked through voting rounds AND movies directly marked as watched.
- Each entry shows: poster thumbnail, title, year, date watched, who marked/picked it, and average household rating (if rated).
- Movies that went through a round show "Picked" badge; directly marked movies show "Marked by [Name]."
- Sorted reverse chronologically (most recently watched first).
- Tapping a movie opens the detail view with vote history (for picked movies) and rating details.
- This extends US-20 (which only covered picked movies).

### US-36: Un-mark a directly-watched movie (P2)
**As a** household member, **I want to** undo an accidental "already watched" mark **so that** the movie can appear in suggestions again.

**Acceptance Criteria:**
- "Undo Watched" action available on the movie detail screen for directly-marked movies only (not for movies picked through rounds).
- Only available within 24 hours of the original mark.
- Only the member who marked it (or the household creator) can undo.
- After 24 hours, the action disappears; the movie is permanently on the Watched list.
- Undoing restores the movie to its previous state (back on Watchlist if it was there before, otherwise just unmarked).

---

## Round Management

### US-37: See proposal source for each movie in a round (P2)
**As a** household member, **I want to** see whether a movie in the voting round came from the algorithm, a member's proposal, or the Watchlist **so that** I understand where the options came from.

**Acceptance Criteria:**
- Each movie in the voting screen shows a subtle source tag:
  - No tag for algorithm-generated suggestions (default)
  - "Proposed by [Name]" for member proposals
  - "From Watchlist" for Watchlist promotions
- Tags are informational only and do not affect voting mechanics.

### US-38: Remove a proposed movie from the active round (P2)
**As the** member who proposed a movie (or the household creator), **I want to** remove my proposal from the round **so that** I can fix a mistake or make room for a different proposal.

**Acceptance Criteria:**
- "Remove Proposal" action on proposed movies in the round (not available for algorithm suggestions).
- Available to the proposer or the household creator.
- If votes have already been cast on the proposal, a confirmation is required: "This movie has [N] votes. Remove it anyway?"
- Removing a proposal frees up one proposal slot (for the member and/or the round).
- Votes on the removed proposal are discarded.

---

## Permissions & Edge Cases

### US-39: New member sees existing household data (P0)
**As a** new member who just joined a household, **I want to** immediately see the household's Watchlist, Watched list, and any active round **so that** I can participate right away.

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
**As the** household creator, **I want to** still be able to pick a movie even if no one voted **so that** we don't get stuck.

**Acceptance Criteria:**
- If the creator closes a round with zero votes, the results screen shows all movies at 0-0 scores.
- Message: "No votes yet! Pick a movie or ask the family to weigh in."
- The creator can pick any movie from the list.
- If the creator doesn't pick and 24 hours pass, a nudge notification is sent: "Your movie night is waiting! Pick a movie or start a new round."

---

## Profile Switching & Identity

### US-42: Switch to a managed member profile (P0)
**As an** authenticated user, **I want to** switch to a managed member's profile on my device **so that** I can set their preferences, vote on their behalf, and rate movies for them.

**Acceptance Criteria:**
- Profile switcher is accessible from the top-right avatar on the household home screen.
- Shows the authenticated user's own profile plus all managed members they control.
- Does NOT show independent members from other accounts (they cannot be impersonated).
- Switching animates smoothly (spring animation) without a full app reload.
- VoiceOver announces "Now viewing as [Name]" on profile switch.
- After switching, preferences, votes, and ratings are attributed to the managed member.
- A "Voting as [Name]" caption is shown on the voting screen when acting as a managed member.

### US-43: Select attendees for a session (P0)
**As a** household member, **I want to** choose which members are participating in tonight's movie night **so that** suggestions and voting are scoped to who's actually watching.

**Acceptance Criteria:**
- Attendee selection is the first step when starting a new session (before suggestions).
- All household members are checked by default.
- Minimum 2 attendees must be selected.
- The suggestion algorithm uses only the selected attendees' preferences.
- Vote progress shows "N of M attending members voted" (not all household members).
- Attendees list is stored on the session and visible in session history.

### US-44: Any member can start a session (P0)
**As a** household member (not just the creator), **I want to** start a movie night session **so that** anyone in the family can kick off movie night.

**Acceptance Criteria:**
- The "Pick Tonight's Movie" / "Start Voting Round" button is visible to all household members.
- Round creation does not require the `creator` role.
- Pick confirmation (locking in the final choice) remains creator-only.

### US-45: View session history (P1)
**As a** household member, **I want to** see a history of past movie night sessions **so that** I can look back at what we watched and how we rated it.

**Acceptance Criteria:**
- Session history is accessible from the household home screen ("Watch History" or "Session History").
- Shows a paginated list of all sessions, sorted newest first.
- Each entry shows: status badge, picked movie poster + title, date, and ratings summary.
- Status badges: draft, voting, selected, watched, rated, expired.
- `discarded` sessions display as "Expired."
- Tapping a session shows full detail: attendees, vote breakdown, pick, and individual ratings.

### US-46: Close ratings manually (P1)
**As the** household creator, **I want to** close the rating period for a session **so that** the session can be finalized even if some attendees don't rate.

**Acceptance Criteria:**
- "Close Ratings" action is available to the creator when the session is in `watched` status.
- Closing transitions the session to `rated` status.
- Ratings already submitted are preserved; missing ratings are recorded as "not rated."
- This is not needed when all attendees have already rated (auto-transition handles that case).
