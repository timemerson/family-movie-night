# Family Movie Night — Key Flows (v1)

> Flows are described as sequential steps. Decision points are marked with **[?]**. System actions are in *italics*.

---

## Flow 1: Onboarding + Group Creation

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
   - Screen B: "Invite your family" (group preview)
   - Screen C: "Vote together, watch together" (voting preview)
   - "Get Started" → step 4

4. Create your group
   - Prompt: "Name your family group" (text field, e.g., "The Emersons")
   - "Create Group" → step 5

5. Group home (empty state)
   - *User is the sole member*
   - CTA: "Set Your Preferences" → Preferences flow
   - CTA: "Invite Family" → Invite flow
```

**Assumption:** We always push toward group creation immediately. A user without a group has no value from the app.

---

## Flow 2: Inviting Family Members

**Entry:** Group creator taps "Invite Family" from group home or settings.

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

**Entry:** User taps "Set Your Preferences" from group home, or navigates to their profile.

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
   - *Movie is added to watched list, excluded from future suggestions*
   - Optional: "Rate it?" prompt → step 3
   - "Skip" → done

3. Rate the movie
   - 1–5 star rating (tap to select)
   - "Save" → *rating stored for this member*
   - *If other members haven't rated, no aggregate shown yet*
   - Done → return to group home or history
```

**Assumption:** Any group member can mark a movie as watched; it doesn't require consensus. This is a household app — trust is assumed.

---

## Flow 5: Getting Suggestions

**Entry:** Any group member taps "Suggest Movies" from the group home.

```
1. Pre-check
   [?] Does the group have ≥ 2 members with preferences set?
   ├── No → "Invite more family members or ask them to set preferences."
   │         CTA: "Invite" / "Nudge [Name]" (sends push notification)
   │         → end
   └── Yes → step 2

2. Generating suggestions
   - Loading state: "Finding movies your family will love..."
   - *System runs suggestion algorithm:*
     a. Filter catalog by group's effective content-rating ceiling
     b. Filter by liked genres (union of all members' likes)
     c. Exclude disliked genres (if ALL members dislike a genre, exclude it)
     d. Exclude watched movies
     e. Boost movies available on the group's streaming services
     f. Rank by popularity score (TMDB popularity)
     g. Return top 5–8

   [?] Enough results (≥ 3)?
   ├── No → Relax constraints (step 2a–2c) one at a time;
   │         show banner: "We loosened some filters to find more options."
   └── Yes → step 3

3. Suggestion shortlist
   - Card carousel or list of 5–8 movies
   - Each card: poster, title, year, genre tags, content rating,
     streaming badge(s)
   - Tap card → movie detail screen
   - CTA: "Start Voting" → Voting flow (Flow 6)
   - CTA: "Show Me More" → regenerate (back to step 2, excluding current batch)
```

---

## Flow 6: Collaborative Decision (Vote / Agree)

**Entry:** Group member (typically the creator) taps "Start Voting" from the suggestion shortlist.

```
1. Voting round created
   - *System creates a voting round with the current shortlist*
   - *All group members receive a push notification:*
     "[Creator] started a voting round! Cast your votes."
   - Creator is taken to the voting screen → step 2

2. Voting screen
   - Shows the shortlist as a vertical list
   - Each movie has two buttons: 👍 (thumbs-up) and 👎 (thumbs-down)
   - Member taps to vote; vote is recorded immediately
   - Member can change their vote before the round closes
   - Progress indicator: "3 of 4 family members have voted"
   - "Done Voting" → step 3 (for this member)

3. Waiting for others
   [?] All members voted OR creator closes the round?
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
   - *System records the pick*
   - *All members get push notification: "Tonight's movie: [Title]! 🎬"*
   - Screen shows pick confirmation with:
     - Movie poster and details
     - "Where to Watch" deep link
     - "We Watched It" button (→ Flow 4)

6. Round archived
   - *The round is saved to group history*
   - *The suggestion shortlist is cleared*
   - Group home returns to default state, ready for next movie night
```

**Assumption:** Only one voting round can be active at a time per group. Starting a new round closes/discards any unfinished round (with confirmation).

---

---

## Flow 7: Pick Tonight's Movie (End-to-End)

**Entry:** Group home screen. Someone says "let's pick a movie tonight." This flow ties together suggestions, watchlist integration, proposals, voting, and the final pick.

```
1. Group home
   - Member taps "Pick Tonight's Movie" (primary CTA)
   [?] Is there an active voting round?
   ├── Yes → Jump to step 5 (voting screen)
   └── No → step 2

2. Generate suggestions
   - *System runs the suggestion algorithm (see Flow 5, step 2)*
   - Returns 5–8 movies
   - Loading state: "Finding movies your family will love..."

3. Watchlist integration prompt
   [?] Does the group Watchlist have eligible movies?
   ├── No → skip to step 4
   └── Yes → Prompt: "Your Watchlist has [N] movies. Include some
       in tonight's vote?"
       ├── "Yes" → Up to 4 Watchlist movies are added to the round
       │   with "From Watchlist" tags. Count against 4-proposal cap.
       └── "No" → Proceed with algorithm suggestions only.

4. Round created
   - *System creates a voting round with the suggestions
     (+ any Watchlist additions)*
   - *All group members receive push notification:
     "[Name] started a voting round! Cast your votes."*
   - Creator is taken to the voting screen → step 5

5. Voting screen
   - Shows all movies (algorithm + proposals + Watchlist)
   - Each movie: poster, title, year, source tag (if proposed/Watchlist),
     👍 and 👎 buttons
   - Tap a movie → movie detail (Flow 9)
   - Progress: "3 of 4 members have voted"
   - Member votes on movies they have opinions on → step 6

   [?] Does the member want to propose a movie?
   ├── Yes → "Propose a Movie" button → search (Flow 10) → proposed
   │   movie appears in the list
   └── No → continue voting

6. Member finishes voting
   - "Done Voting" button → member sees waiting state
   [?] All members done OR creator closes early?
   ├── Not yet → Waiting screen with progress indicator
   │   Creator sees "Close Voting Early" button
   │   *1-hour nudge notification to non-voters*
   └── Yes → step 7

7. Results screen
   - Movies ranked by net score (up minus down)
   - Each movie shows vote breakdown + who voted what
   - Source tags preserved (Proposed by, From Watchlist)
   - Ties broken by TMDB popularity

   [?] Clear winner?
   ├── Yes → Winner highlighted with crown
   └── No (tie or all zero) → Tied movies shown equally;
       creator chooses

8. Lock in the pick
   - Creator taps "Pick This One" on chosen movie
   - *All members notified: "Tonight's movie: [Title]!"*
   - Screen shows pick confirmation:
     - Movie poster and details
     - "Where to Watch" deep link
     - "We Watched It" button → Flow 4

9. Post-pick
   - *Round archived to history*
   - *If the picked movie was from the Watchlist, it remains on the
     Watchlist until marked watched (then auto-removed)*
   - Group home returns to default state
```

**Key difference from Flow 5+6:** This flow integrates Watchlist promotion (step 3), mid-round proposals (step 5), and source attribution throughout. It represents the complete "movie night" experience.

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
   - 1–5 star tap selector
   - "Save" → *rating stored for this member*
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

## Flow Diagram Summary (Updated)

```
Onboarding → Group Creation → Set Preferences
                  ↓
            Invite Family
                  ↓
     ┌─── Search ──► Add to Watchlist ◄── Suggestion "Save for Later"
     │                    │
     │         (optional promotion at round start)
     │                    ▼
     └─► Suggest Movies + Watchlist ──► Vote ──► Pick ──► Watch ──► Rate
              ▲    (+ Proposals)          │
              │                           │
              │     Movie Detail ◄────────┘
              │       │
              │       ├── Add to Watchlist
              │       ├── Mark Watched
              │       └── Propose for Tonight
              │
              └──────────── (repeat weekly)
```
