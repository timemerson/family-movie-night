# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

# Project Overview

Family Movie Night is an iOS app that helps households collaboratively pick a movie.

Members:
- Belong to a single household (one household per user in v1)
- Set preferences (genre, MPAA rating)
- Receive 5–8 suggested movies via deterministic filtering against TMDB data
- Vote (thumbs up/down or stronger positive)
- Select a winner
- Mark the movie as watched
- Rate it (Loved / Liked / Did Not Like)

Platform:
- iOS only (SwiftUI)
- iPhone-first (iPad nice-to-have, not v1)

---

# Repository Structure

- `docs/product/` — Product specs (brief, user stories, flows, data model, open questions)
- `ios/` — iOS app
- `backend/` — Backend service
- `adr/` — Architecture Decision Records

---

# Key Product Documents

- `docs/product/brief.md` — v1 scope, non-goals, success metrics
- `docs/product/stories.md` — User stories with acceptance criteria (P0/P1/P2)
- `docs/product/flows.md` — Step-by-step user journey flows
- `docs/product/data.md` — Data model (entities, privacy principles, retention policy)
- `docs/product/open-questions.md` — Open decisions with suggested defaults

---

# Technical Decisions Still Pending

- Backend stack (Firebase, Supabase, custom API, or CloudKit)
- Streaming availability API (TMDB watch-providers initially)
- COPPA compliance review before launch

---

# Key Constraints

- TMDB is the movie metadata source (free tier)
- Group size: 2–8 members
- Content ratings: MPAA (G/PG/PG-13/R)
- Suggestion algorithm: deterministic filtering + popularity scoring (no ML in v1)
- Online-only
- Free app, no ads, no monetization in v1
- One household per authenticated user in v1
- Profiles are household-bound, not device-bound

---

# UI & Design Principles

Family Movie Night must feel:

- Apple-native (Human Interface Guidelines compliant)
- Clean, modern, warm
- Playful but not childish
- Fast and frictionless
- Calm during voting
- Optimized for families physically gathered together

## Core UI Philosophy

- Use native SwiftUI components first.
- Avoid heavy custom styling unless it improves clarity.
- Prefer system materials (e.g., `.ultraThinMaterial`) over flat colors.
- Embrace large touch targets.
- Prioritize legibility over density.
- Use motion subtly (spring animations, light haptics).
- Avoid cluttered grids; prefer card-based layouts.
- Minimize cognitive load during group decision-making.

---

# Design System (v1)

## Color

Use semantic tokens only:

- `AppBackground`
- `CardBackground`
- `PrimaryAccent`
- `SuccessAccent`
- `WarningAccent`

Guidelines:
- Default to system background colors.
- Use accent color sparingly for voting highlights.
- Avoid heavy gradients.
- Maintain WCAG AA contrast compliance.
- Dark mode must be supported.

---

## Typography

Use SF Pro system font exclusively.

Hierarchy:

- `.largeTitle` → Screen headers
- `.title2` → Section headers
- `.body` → Descriptions
- `.caption` → Metadata (year, rating, runtime)

Never hardcode font sizes.

Use Dynamic Type compatibility.

---

## Spacing

- 16pt outer padding on screens
- 12pt vertical spacing between stacked components
- Cards must have minimum 16pt internal padding
- Tap targets must be minimum 44pt height

---

# Component Standards

All UI must be composed of reusable SwiftUI components.

Required foundational components:

- `ProfileAvatarView`
- `MemberChip`
- `MovieCardView`
- `VoteIndicatorRow`
- `PrimaryButton`
- `SecondaryButton`
- `RatingSelectorView`

Each component must:
- Support light + dark mode
- Have a Preview
- Be visually consistent with design system tokens

Avoid one-off inline UI duplication.

---

# UI Architecture

- Platform: SwiftUI only
- Pattern: MVVM
- Each screen must include:
  - View
  - ViewModel
  - SwiftUI Preview
- No business logic inside Views
- API calls must go through a service layer
- Use async/await
- Use ObservableObject + @StateObject properly
- Avoid tightly coupling networking and UI

---

# Screen State Requirements

Every screen must explicitly handle:

- Loading state
- Empty state
- Error state
- Success state

Do not leave states unimplemented.

Loading states must feel intentional (skeletons or progress indicators).

---

# Interaction Design Rules

Voting must:

- Animate when selected
- Provide light haptic feedback
- Visually indicate which members have voted
- Display aggregate vote results clearly but subtly
- Allow vote changes before final selection

Profile switching must:

- Be accessible from top-right avatar
- Animate smoothly
- Not require full app reload

Movie cards must:

- Have rounded corners (minimum radius: 16)
- Elevate slightly on tap
- Use poster art as primary visual anchor
- Avoid cluttered metadata

Buttons must:

- Be clearly primary or secondary
- Not exceed two primary actions per screen

---

# Aesthetic Direction

The app should feel:

- Like Apple TV + Notion had a baby
- Spacious
- Calm
- Family-friendly but not cartoonish
- Minimal but warm

Avoid:

- Neon colors
- Heavy shadows
- Cluttered density
- Too many simultaneous interactive elements
- Excessively dark or saturated palettes

---

# Movie Night Lifecycle Model (UI Implications)

A Movie Night is a state machine:

- draft
- voting
- selected
- watched
- rated
- expired

UI must visually reflect state clearly.

Past sessions must be viewable in a History screen.

---

# UI Generation Workflow

When generating new UI:

1. First propose screen layout structure in prose.
2. Define required reusable components.
3. Implement SwiftUI code using MVVM.
4. Include Preview variants for:
   - Light mode
   - Dark mode
   - Large Dynamic Type

Do not skip the design explanation phase.

---

# Accessibility Requirements

- Support Dynamic Type
- Ensure VoiceOver labels are meaningful
- Maintain proper contrast ratios
- Avoid relying solely on color to convey meaning
- Provide adequate tap targets
- Avoid excessive motion

---

# Code Quality Expectations

- Clean, readable SwiftUI
- No massive single-file Views
- Reusable components extracted
- Clear separation of concerns
- No commented-out experimental UI
- No placeholder UI shipped in main branch

---

# What "Beautiful" Means in This App

Beautiful means:

- Calm
- Clear
- Intentional
- Balanced whitespace
- Effortless to use in a living room setting

It does not mean flashy.

It does not mean over-designed.

It does not mean clever at the expense of clarity.