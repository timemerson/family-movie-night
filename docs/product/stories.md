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
