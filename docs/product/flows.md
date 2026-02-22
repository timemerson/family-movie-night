# Family Movie Night — Key Flows (v1)

> Flows are described as sequential steps. Decision points are marked with **[?]**. System actions are in *italics*.

---

## Flow 1: Onboarding + Household Creation

**Entry:** User opens the app for the first time.

```
1. Welcome screen
   ├── "Continue with Apple" → Apple ID auth → step 3
   └── "Sign up with Email" → step 2

2. Email sign-up form
   - Fields: email, password, display name
   - *System sends verification email*
   - User confirms email → step 3

3. Onboarding carousel (skippable)
   - Screen A: "Tell us what you like" (preferences preview)
   - Screen B: "Invite your family" (household preview)
   - Screen C: "Vote together, watch together" (voting preview)
   - "Get Started" → step 4

4. Create your household
   - Prompt: "Name your household" (text field, e.g., "The Emersons")
   - "Create Household" → step 5

5. Household home (empty state)
   - *User is the sole member (creator, independent)*
   - CTA: "Set Your Preferences" → Preferences flow
   - CTA: "Invite Family" → Invite flow
   - CTA: "Add Family Member" → Managed member creation flow (Flow 11)
```

**Assumption:** We always push toward household creation immediately. A user without a household has no value from the app.

---

## Flow 2: Inviting Independent Members

**Entry:** Household creator taps "Invite Family" from household home or settings. This flow is for **independent members** who will sign in with their own account. For managed members (no login), see Flow 11.

```
1. Invite screen
   - Option A: "Share Invite Link" → step 2
   - Option B: "Invite via Text" → step 3
   - Shows list of pending invites (if any)

2. Share invite link
   - *System generates a unique invite URL*
   - iOS share sheet opens (iMessage, WhatsApp, AirDrop, Copy, etc.)
   - *Link is valid for 7 days, up to group cap (8 members)*
   - Done → return to invite screen

3. Invite via text
   - User enters phone number
   - *Opens native SMS composer with pre-filled message:*
     "Join our Family Movie Night group! [link]"
   - After sending → return to invite screen

--- Invitee side ---

4. Invitee taps link
   [?] App installed?
   ├── Yes → App opens with invite context → step 5
   └── No → App Store → install → first launch with invite context → step 5

5. Invitee sign-up/sign-in
   - Same as Onboarding steps 1–2
   - *After auth, system auto-joins the invitee to the group*
   - Skip group creation (they're joining an existing one)

6. Invitee lands on group home
   - CTA: "Set Your Preferences" → Preferences flow
   - *Group creator gets a push notification: "[Name] joined your group!"*
```

---

## Flow 3: Setting Likes/Dislikes (Preferences)

**Entry:** User taps "Set Your Preferences" from household home, or navigates to their profile. For managed members, the parent sets preferences on their behalf after switching to the managed member's profile (see Flow 12).

```
1. Genre selection screen
   - Grid of genre chips (Action, Comedy, Drama, Horror, Sci-Fi,
     Animation, Thriller, Romance, Documentary, Fantasy, Family, Mystery)
   - Each chip has 3 states: Neutral (default) → tap once → Like (green) → tap again → Dislike (red) → tap again → Neutral
   - Minimum: at least 2 genres liked
   - "Next" → step 2

2. Content rating ceiling
   - Selector: G / PG / PG-13 / R
   - Default: PG-13
   - Helper text: "The group's suggestions will be limited to the most
     restrictive rating across all members."
   - "Next" → step 3

3. Streaming services (group-level, shown only to creator or if not yet set)
   [?] Already configured for this group?
   ├── Yes → skip to step 4
   └── No → Checklist of services (Netflix, Disney+, Hulu, Prime Video,
       HBO Max, Apple TV+, Paramount+, Peacock)
       - "Save" → step 4

4. Preferences saved confirmation
   - *Preferences save automatically on each screen*
   - "Done" → return to group home
   - Group home now shows member's preference badges
```

**Assumption:** Preferences can be edited at any time from the profile/settings screen. The initial flow is guided; subsequent edits are direct.

---

## Flow 4: Marking a Movie as Watched

**Entry A:** After a movie is picked (from pick confirmation screen).
**Entry B:** From group watch history or movie detail.

```
1. Pick confirmation screen (primary path)
   - Shows the picked movie with "Tonight's movie: [Title]!"
   - Button: "We Watched It" → step 2
   - Button: "Not Yet" → dismiss

   OR

   Group history screen (secondary path)
   - User taps a previously picked but un-watched movie
   - Button: "Mark as Watched" → step 2

2. Mark as watched
   - *System records the watch date*
   - *Session transitions to `watched` status*
   - *Movie is added to watched list, excluded from future suggestions*
   - Prompt: "Rate it?" → step 3
   - "Skip" → done

3. Rate the movie
   - Three options: Loved / Liked / Did Not Like (tap to select)
   - "Save" → *rating stored for this attending member*
   - *If other attendees haven't rated, show "Waiting for others to rate"*
   - *When all attendees have rated, session auto-transitions to `rated` status*
   - *Creator can close ratings early if some attendees never rate*
   - Done → return to household home or session history
```

**Assumption:** Any household member can mark a movie as watched; it doesn't require consensus. This is a household app — trust is assumed.

---

## Flow 5: Getting Suggestions

**Entry:** Any household member taps "Suggest Movies" or "Pick Tonight's Movie" from the household home.

```
1. Select attendees
   - Show all household members with checkmarks (default: all checked)
   - Minimum 2 attendees must be selected
   - "Next" → step 2

2. Pre-check
   [?] Do ≥ 2 selected attendees have preferences set?
   ├── No → "Some attendees need to set preferences first."
   │         CTA: "Nudge [Name]" (sends push notification)
   │         → end
   └── Yes → step 3

3. Generating suggestions
   - Loading state: "Finding movies your family will love..."
   - *System runs suggestion algorithm using ATTENDEES' preferences only:*
     a. Filter catalog by attendees' effective content-rating ceiling
     b. Filter by liked genres (union of attendees' likes)
     c. Exclude disliked genres (if ALL attendees dislike a genre, exclude it)
     d. Exclude watched movies
     e. Boost movies available on the household's streaming services
     f. Rank by popularity score (TMDB popularity)
     g. Return top 5–8

   [?] Enough results (≥ 3)?
   ├── No → Relax constraints (step 3a–3c) one at a time;
   │         show banner: "We loosened some filters to find more options."
   └── Yes → step 4

4. Suggestion shortlist
   - Card carousel or list of 5–8 movies
   - Each card: poster, title, year, genre tags, content rating,
     streaming badge(s)
   - Tap card → movie detail screen
   - CTA: "Start Voting" → Voting flow (Flow 6)
   - CTA: "Show Me More" → regenerate (back to step 3, excluding current batch)
```

---

## Flow 6: Collaborative Decision (Vote / Agree)

**Entry:** Any household member taps "Start Voting" from the suggestion shortlist.

```
1. Voting round created
   - *System creates a voting round with the current shortlist and
     selected attendees*
   - *All attending members receive a push notification:*
     "[Name] started a voting round! Cast your votes."
   - The member who started is taken to the voting screen → step 2

2. Voting screen
   - Shows the shortlist as a vertical list
   - Each movie has two buttons: 👍 (thumbs-up) and 👎 (thumbs-down)
   - Member taps to vote; vote is recorded immediately (async, no websocket)
   - Member can change their vote before the round closes
   - If acting as a managed member: "Voting as [Name]" caption shown
   - Progress indicator: "3 of 4 attending members have voted"
   - "Done Voting" → step 3 (for this member)

3. Waiting for others
   [?] All attendees voted OR creator closes the round?
   ├── Not yet → Waiting screen with progress
   │   - Creator sees "Close Voting Early" button
   │   - *1-hour nudge notification sent to non-voters*
   └── Yes → step 4

4. Results screen
   - Movies ranked by net score (thumbs-up minus thumbs-down)
   - Each movie shows vote breakdown and who voted what
   - Ties broken by TMDB popularity

   [?] Is there a clear winner (one movie with strictly highest score)?
   ├── Yes → Winner is highlighted with a crown icon
   └── No (tie) → Top tied movies shown equally; creator chooses

5. Lock in the pick
   - Creator taps "Pick This One" on the winning (or chosen) movie
   - *System records the pick; session transitions to `selected` status*
   - *All attending members get push notification: "Tonight's movie: [Title]!"*
   - Screen shows pick confirmation with:
     - Movie poster and details
     - "Where to Watch" deep link
     - "We Watched It" button (→ Flow 4)

6. Post-watch rating
   - After marking watched, session transitions to `watched` status
   - Each attending member is prompted: "How was it?"
   - Options: Loved / Liked / Did Not Like
   - *When all attendees have rated, session auto-transitions to `rated`*
   - *Creator can close ratings early via "Close Ratings" if some
     attendees never rate*

7. Session archived
   - *The session is saved to session history*
   - *The suggestion shortlist is cleared*
   - Household home returns to default state, ready for next movie night
```

**Assumption:** Only one voting round can be active at a time per household. Starting a new round closes/discards any unfinished round (with confirmation). Any member can start a round, but only the creator can lock in the pick.

---

---

## Flow 7: Pick Tonight's Movie (End-to-End)

**Entry:** Household home screen. Someone says "let's pick a movie tonight." This flow ties together attendee selection, suggestions, watchlist integration, proposals, voting, and the final pick. Any household member can start this flow.

```
1. Household home
   - Member taps "Pick Tonight's Movie" (primary CTA)
   [?] Is there an active voting round?
   ├── Yes → Jump to step 6 (voting screen)
   └── No → step 2

2. Select attendees
   - Show all household members with checkmarks (default: all checked)
   - Minimum 2 attendees must be selected
   - "Next" → step 3

3. Generate suggestions
   - *System runs the suggestion algorithm using attendees' preferences
     (see Flow 5, step 3)*
   - Returns 5–8 movies
   - Loading state: "Finding movies your family will love..."

4. Watchlist integration prompt
   [?] Does the household Watchlist have eligible movies?
   ├── No → skip to step 5
   └── Yes → Prompt: "Your Watchlist has [N] movies. Include some
       in tonight's vote?"
       ├── "Yes" → Up to 4 Watchlist movies are added to the round
       │   with "From Watchlist" tags. Count against 4-proposal cap.
       └── "No" → Proceed with algorithm suggestions only.

5. Round created
   - *System creates a voting round with the suggestions
     (+ any Watchlist additions) and the selected attendees*
   - *All attending members receive push notification:
     "[Name] started a voting round! Cast your votes."*
   - Member is taken to the voting screen → step 6

6. Voting screen
   - Shows all movies (algorithm + proposals + Watchlist)
   - Each movie: poster, title, year, source tag (if proposed/Watchlist),
     thumbs-up and thumbs-down buttons
   - If acting as a managed member: "Voting as [Name]" caption
   - Tap a movie → movie detail (Flow 9)
   - Progress: "3 of 4 attending members have voted"
   - Member votes on movies they have opinions on → step 7

   [?] Does the member want to propose a movie?
   ├── Yes → "Propose a Movie" button → search (Flow 10) → proposed
   │   movie appears in the list
   └── No → continue voting

7. Member finishes voting
   - "Done Voting" button → member sees waiting state
   [?] All attendees done OR creator closes early?
   ├── Not yet → Waiting screen with progress indicator
   │   Creator sees "Close Voting Early" button
   │   *1-hour nudge notification to non-voters*
   └── Yes → step 8

8. Results screen
   - Movies ranked by net score (up minus down)
   - Each movie shows vote breakdown + who voted what
   - Source tags preserved (Proposed by, From Watchlist)
   - Ties broken by TMDB popularity

   [?] Clear winner?
   ├── Yes → Winner highlighted with crown
   └── No (tie or all zero) → Tied movies shown equally;
       creator chooses

9. Lock in the pick
   - Creator taps "Pick This One" on chosen movie
   - *Session transitions to `selected` status*
   - *All attending members notified: "Tonight's movie: [Title]!"*
   - Screen shows pick confirmation:
     - Movie poster and details
     - "Where to Watch" deep link
     - "We Watched It" button → Flow 4

10. Post-watch & Rate
   - After "We Watched It": session transitions to `watched`
   - Each attending member is prompted: Loved / Liked / Did Not Like
   - *When all attendees rate, session transitions to `rated`*
   - *Creator can "Close Ratings" if some attendees never rate*
   - *Session saved to session history*
   - *If the picked movie was from the Watchlist, it remains on the
     Watchlist until marked watched (then auto-removed)*
   - Household home returns to default state
```

**Key difference from Flow 5+6:** This flow integrates attendee selection (step 2), Watchlist promotion (step 4), mid-round proposals (step 6), source attribution, and the full post-watch rating flow. It represents the complete "movie night" experience.

---

## Flow 8: Add to Watchlist from Suggestion or Detail

**Entry A:** User is viewing the suggestion shortlist (before or during a round).
**Entry B:** User is on a movie detail screen (from any context).
**Entry C:** User is viewing TMDB search results.

```
1. User sees a movie they want to save

   --- From suggestion card (Entry A) ---
   - "Save for Later" icon button on the card
   - Tap → step 2 (no navigation)

   --- From movie detail screen (Entry B) ---
   - "Add to Watchlist" button in the actions section
   - Tap → step 2

   --- From search results (Entry C) ---
   - "Add to Watchlist" action on each result
   - Tap → step 2

2. Pre-check
   [?] Is the movie already on the Watchlist?
   ├── Yes → Show "Already on Watchlist" (disabled state). Done.
   └── No → step 3

   [?] Is the movie on the Watched list?
   ├── Yes → Show "Already watched." Done.
   └── No → step 3

   [?] Is the Watchlist full (50 movies)?
   ├── Yes → Show "Watchlist is full. Remove a movie to make room."
   │   CTA: "Go to Watchlist" → Watchlist screen. Done.
   └── No → step 3

3. Add to Watchlist
   - *Movie added with attribution: added_by = current user,
     added_at = now*
   - Button changes to "On Watchlist" (disabled/check state)
   - Brief success toast: "Added to Watchlist"
   - *No push notification to other members (too noisy for a save action)*

4. Done
   - User stays on their current screen
   - The movie remains in the suggestion list or search results
     (adding to Watchlist does NOT remove it from view)
```

**Assumption:** Adding to the Watchlist is a lightweight, low-friction action. No confirmation dialog, no navigation, no disruption to the current flow.

---

## Flow 9: Movie Detail + Mark as Watched

**Entry:** User taps a movie from any context — suggestion card, Watchlist, Watched history, search result, or voting round.

```
1. Movie detail screen loads
   - *System fetches movie metadata from TMDB (cached)*
   - Shows: poster, title, year, runtime, synopsis, cast (top 5),
     genres, content rating, streaming availability, trailer link

2. Group context section
   - *System checks group state for this movie:*

   [?] On the Watchlist?
   ├── Yes → Badge: "On your Watchlist — added by [Name] on [Date]"
   │   Actions: "Remove from Watchlist" (if adder or creator)
   └── No → Action: "Add to Watchlist"

   [?] On the Watched list?
   ├── Yes → Badge: "Watched on [Date]"
   │   - Shows group avg rating and individual ratings (if any)
   │   - [?] Was it directly marked within the last 24 hours
   │     by this user?
   │     ├── Yes → "Undo Watched" action available
   │     └── No → No undo
   └── No → Action: "Already Watched" button

   [?] Was this movie in a previous round?
   ├── Yes → "Vote history: [N] up / [N] down on [Date]"
   └── No → (nothing shown)

   [?] Is this movie in the active round?
   ├── Yes → "In tonight's vote: [N] up / [N] down so far"
   │   - Shows the user's own vote (if cast)
   │   - User can vote directly from detail screen
   └── No → (nothing shown)

3. User taps "Already Watched"
   - Confirmation dialog: "Mark as watched for the whole group?
     It won't appear in future suggestions."
   - "Mark Watched" / "Cancel"

4. Mark as watched
   - *Movie added to group Watched list:
     marked_by = current user, watched_at = now*
   - *If movie was on Watchlist → automatically removed*
   - *If movie is in active round → "Watched" badge added
     to the movie in the round; no disruption to voting*
   - Button changes to "Watched on [Date]"

5. Rating prompt (optional)
   - "How was it? Rate this movie."
   - Three options: Loved / Liked / Did Not Like
   - "Save" → *rating stored for this attending member*
   - "Skip" → dismiss

6. Done
   - User remains on the detail screen
   - Updated state reflected (Watched badge, removed from Watchlist
     if applicable)
```

---

## Flow 10: Propose a Movie for Tonight

**Entry:** A voting round is active. A member wants to add a specific movie that isn't in the current suggestion list.

```
1. Member taps "Propose a Movie" from the voting screen
   [?] Has this member already proposed 2 movies this round?
   ├── Yes → "You've proposed the max (2) for this round."
   │   CTA: "Add to Watchlist instead" → Watchlist flow. Done.
   └── No → step 2

   [?] Has the round hit 4 total proposals?
   ├── Yes → "This round has enough proposals."
   │   CTA: "Add to Watchlist instead." Done.
   └── No → step 2

2. Search for a movie
   - Text input: "Search by movie title..."
   - *Searches TMDB API (debounced, min 3 characters)*
   - Results: poster thumbnail, title, year, content rating
   - Grayed out / excluded results:
     - Movies already in the round: "Already in tonight's vote"
     - Movies on the Watched list: "Already watched"
     - Movies exceeding content-rating ceiling: "Exceeds group rating"

3. Member selects a movie
   - Taps a valid result → brief movie summary shown
   - "Propose This Movie" button

4. Confirm proposal
   - *Movie added to the round's suggestion list:*
     - proposed_by = current user
     - Tagged "Proposed by [Name]"
   - *All group members see the new movie in the voting screen*
   - *No push notification for a proposal (members are already
     in the voting flow)*
   - Member returns to the voting screen with the new movie visible

5. Voting
   - The proposed movie is votable immediately
   - Members who already tapped "Done Voting" are NOT re-prompted
     (they can reopen the voting screen to see/vote on proposals)
   - The proposed movie is included in final results ranking
```

**Assumption:** Proposals are expected to be infrequent (1–2 per round). The caps (2 per member, 4 per round) are a safety net, not a feature the typical family will hit.

---

## Flow 11: Add a Managed Member

**Entry:** Household creator or independent member taps "Add Family Member" from the household home or member management screen.

```
1. Add managed member form
   - Display name (required, max 30 chars)
   - Avatar selection (predefined set)
   - *Content rating ceiling is automatically set to PG
     (not editable for managed members)*
   - COPPA disclosure: "This profile is managed by you on behalf
     of a household member. No data is collected directly from them."

2. Confirm
   - "Add Member" → step 3

3. Member created
   - *System creates a managed member record:*
     - user_id = managed_<uuid>
     - is_managed = true
     - parent_user_id = authenticated user's ID
     - content_rating_ceiling = PG
   - *Member added to the household*
   - *New member appears in the member list and profile switcher*
   - CTA: "Set Their Preferences" → Switch to new member profile,
     then Preferences flow (Flow 3)
   - "Done" → return to household home
```

**Assumption:** Only authenticated (independent) members can create managed members. The creating user becomes the managed member's parent. Managed members have no login credentials and no notification preferences.

---

## Flow 12: Profile Switching

**Entry:** User taps their profile avatar in the top-right corner of the household home screen.

```
1. Profile switcher
   - Sheet/popover shows:
     - Authenticated user's own profile (highlighted as "You")
     - All managed members with parent_user_id = current user
   - Each entry: avatar + display name
   - Independent members from other devices are NOT shown
     (they cannot be impersonated)

2. Switch profile
   - User taps a managed member → spring animation transition
   - *ProfileSessionManager updates activeProfile*
   - *No app reload; NavigationStack remains in place*
   - *VoiceOver announces: "Now viewing as [Name]"*
   - Household home refreshes to show the active profile context:
     - "Viewing as [Name]" banner or avatar change
     - Preferences screen shows managed member's preferences
     - Voting screen attributes votes to managed member

3. Switch back
   - User taps profile avatar again → switcher shows with
     the authenticated user's entry
   - Tapping "You" switches back to the authenticated user
   - *All subsequent API calls drop the X-Acting-As-Member header*
```

**Assumption:** Profile switching is entirely client-side — no server round-trip required. The API uses the `X-Acting-As-Member` header to know which member is acting. Independent members from other accounts cannot be switched to.

---

## Flow 13: Session History

**Entry:** User taps "Watch History" or "Session History" from the household home or household detail screen.

```
1. Session history list
   - Paginated list of all past sessions, sorted newest first
   - Each entry shows:
     - Session status badge (draft, voting, selected, watched, rated, expired)
     - Picked movie poster + title (if applicable)
     - Date created
     - Ratings summary (e.g., "2 Loved, 1 Liked") if rated
   - Tapping a session → step 2

2. Session detail
   - Full session summary:
     - Attendees list
     - Suggestions shown in the round
     - Vote breakdown per movie
     - Pick result
     - Individual ratings (if rated)
   - "discarded" sessions display as "Expired"
```

---

## Flow Diagram Summary (Updated)

```
Onboarding → Household Creation → Set Preferences
                  ↓
       ┌── Invite Family (independent members)
       ├── Add Family Member (managed members) ──► Profile Switching
       │
       ↓
     ┌─── Search ──► Add to Watchlist ◄── Suggestion "Save for Later"
     │                    │
     │         (optional promotion at round start)
     │                    ▼
     └─► Select Attendees → Suggest Movies + Watchlist ──► Vote ──► Pick ──► Watch ──► Rate
              ▲    (+ Proposals)                             │
              │                                              │
              │     Movie Detail ◄───────────────────────────┘
              │       │
              │       ├── Add to Watchlist
              │       ├── Mark Watched
              │       └── Propose for Tonight
              │
              └──────────── Session History ◄── (repeat weekly)
```
