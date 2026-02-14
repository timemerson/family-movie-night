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

## Flow Diagram Summary

```
Onboarding → Group Creation → Set Preferences
                  ↓
            Invite Family
                  ↓
          Suggest Movies → Vote → Pick → Watch → Rate
                  ↑___________________________|
                       (repeat weekly)
```
