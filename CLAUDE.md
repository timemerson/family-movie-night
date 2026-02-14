# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Family Movie Night is an iOS app that helps households collaboratively pick a movie. Members set genre/rating preferences, the app suggests 5–8 movies via rule-based filtering against TMDB data, the family votes (thumbs up/down), and a winner is picked. iOS only, one group per user in v1.

## Repository Structure

- `docs/product/` — Product specs (brief, user stories, flows, data model, open questions)
- `ios/` — iOS app (not yet implemented)
- `backend/` — Backend service (not yet implemented)
- `adr/` — Architecture Decision Records

## Key Product Documents

- `docs/product/brief.md` — v1 scope, non-goals, success metrics
- `docs/product/stories.md` — User stories with acceptance criteria (P0/P1/P2)
- `docs/product/flows.md` — Step-by-step user journey flows
- `docs/product/data.md` — Data model (10 entities), privacy principles, retention policy
- `docs/product/open-questions.md` — Open decisions with suggested defaults (backend stack, streaming API, COPPA, monetization)

## Technical Decisions Still Pending

- **Backend stack** (OQ-15): Firebase, Supabase, custom API, or CloudKit — not yet chosen
- **Streaming availability API** (OQ-01): Starting with TMDB watch-providers, may upgrade to Watchmode
- **Platform**: iOS only (iPhone); iPad is nice-to-have, not v1

## Key Constraints

- TMDB is the movie metadata source (free tier)
- Group size: 2–8 members
- Content ratings: MPAA system (G/PG/PG-13/R)
- Suggestion algorithm: deterministic filtering + popularity scoring (no ML in v1)
- Online-only; no offline-first architecture
- Free app, no ads, no monetization in v1
- COPPA considerations for child profiles — requires legal review before launch
