# 🐝 TripHive

**Plan the trip together. Let Hive keep it realistic.**

Live: https://triphive.app.space · Built on [DeepSpace](https://docs.deep.space)

TripHive lets a group of friends plan one trip together. Everyone edits the same day-by-day itinerary in real time. **Plan Doctor** checks the plan and flags problems. **Hive**, the AI planner, researches real places and suggests changes, and the group votes before any change is applied.

## The core flow

1. Create a trip. TripHive geocodes the city and pulls a 5-day forecast.
2. Share the 6-character invite code. Friends join and appear as live avatars, with an "Ana is editing…" badge on the stop they have open.
3. Each traveler sets their own style: pace, daily budget, interests, dietary needs and wake-up time.
4. Add stops. They sync live to everyone, with walking or transit time and distance between consecutive stops and a route map for each day.
5. **Plan Doctor** checks the plan deterministically for:
   - overlapping stops
   - travel gaps too short to make
   - stops outside the trip dates
   - days that are too packed for the slowest traveler's pace
   - missing lunch or dinner
   - outdoor stops on days with rain in the forecast
   - spend above the tightest daily budget
   - duplicate places
   - starts earlier than the latest riser's wake-up time
6. Ask **Hive** something like "plan day 1" or "fix the conflicts". It reads the trip, searches the web (Exa), geocodes places (OpenStreetMap), checks the weather and routes, and then *proposes* changes with reasons and sources.
7. The group votes 👍/👎. A majority applies the change, and the organizer can approve it immediately.
8. Email the itinerary to the group. Each morning a cron job refreshes the forecast and emails the group if a new rain conflict appears.

## DeepSpace primitives and integrations

| Need | What I used | Why |
|---|---|---|
| Shared, live data | `RecordRoom` collections + `useQuery`/`useMutations` | Realtime sync without building a sync layer |
| Trip privacy | `'team'` RBAC: `teamField` + a server-written `team_members` collection | Built-in row-level access per trip; non-members receive nothing over the socket (covered by the E2E test) |
| Presence | `usePresenceRoom('trip:<id>')` | Shows who is online and who is editing which stop, without persisting it |
| Privileged writes | Server actions (`src/actions`) | Create/join trip, voting, applying proposals, email. Each one checks membership first because actions bypass RBAC |
| AI agent | `ai-chat` feature + `streamDeepSpaceAgent` with custom trip-scoped tools (`src/ai/trip-tools.ts`) | The agent runs server-side and is bound to one trip only after a membership check |
| Web research | `exa/search` integration | Finds real places with source URLs, which appear on each proposal |
| Weather + city geocoding | `openweathermap/forecast`, `openweathermap/geocoding` | Forecast per day drives the rain checks and the day chips |
| Ratings (optional) | Google Places (New) Text Search, key via `npx deepspace secrets set GOOGLE_MAPS_API_KEY=…` | Real Google ratings + Maps links; server-side only, 100 lookups/user/day, falls back to OSM without a key |
| Directions | Google Maps deep links (no key) | Per-leg "directions" and "Open day in Google Maps" — no directions API exists in the catalog |
| Email | `email/send` | Itinerary email and rain alerts, one email per recipient |
| Scheduled work | `CronRoom` (`src/cron.ts`, daily 07:00 UTC) | Weather watch; only the app owner can trigger or pause it |

Not from DeepSpace: **OpenStreetMap** (Nominatim for place geocoding, map tiles through Leaflet). The DeepSpace Google Maps endpoint (`serpapi/places-search`) returned `"Your account has run out of searches."` during development, and OWM geocoding only resolves cities.

**What I left out on purpose:**
- **Payments:** there is no business model in this app.
- **LiveKit:** text collaboration is enough here.
- **Image generation for cover images:** I cut it for time. The trip cards use real map tiles of the destination instead, which are more useful.
- **Google Calendar export:** a natural next step, but it needs per-user OAuth.

## The main tradeoff: Hive proposes, humans decide

The scaffold's agent can write records directly as the user. I removed that. In TripHive, Hive's only write is a **proposal** row. Proposals are `create: false` for clients, written server-side, and applied only by the vote action.

- **Why:** in a *shared* plan, an AI that silently rewrites a friend's edit damages trust. Voting also makes the AI's work visible to the whole group, not just the person who asked.
- **Cost:** every change takes an extra click, and a proposal can go stale. When that happens, the apply step re-checks that the target stop still exists and marks the proposal `stale` instead of applying it.

Related decisions:

- **Plan Doctor is deterministic code, not an LLM.** Conflicts have to be reliable and testable (18 unit tests). The LLM's job is to fix them.
- **Hive is billed to the app owner.** Travelers sign in with fresh DeepSpace accounts that have no credits. A user-billed planner returned `402` for every one of them, which I verified. Owner billing is limited to verified trip members, with a server-only `ai_usage` counter (40 messages per user per day).
- **Hive runs on Claude Sonnet 5.5, with Haiku as an option.** Opus returned `Payment Required` through the owner-billed path, while Sonnet and Haiku succeeded (tested on prod). Sonnet is also the better fit for cost and latency on a tool-heavy loop.
- **RBAC `create` is a boolean in DeepSpace**, so it can't be scoped to a row. Every trip collection is therefore `create: false`, and creation goes through membership-checked actions (`addStop`, `savePrefs`). Edits stay as direct realtime writes, because `update`/`delete` *are* row-scoped (`'team'`/`'own'`).

## How it was built: what the agent did vs. what I verified

I directed a coding agent (Claude Code) through the whole build.

**The agent:**
- read the DeepSpace docs and the skill, and studied the StoryNest and ThreadHunt examples
- probed the live integrations before writing any code, which is how the dead SerpAPI quota and the exact Exa, OpenWeatherMap and email schemas came to light
- wrote the code and tests and iterated on failures

**Problems caught by running things rather than by reading code:**
- An E2E test passed for the wrong reason (it matched the trip card's heading instead of waiting for navigation). It was fixed to assert the URL.
- Hive returned `402` locally. The agent narrowed this down to caller billing, then to Opus specifically, by calling each model on prod.
- Map tiles from CARTO started requiring an API key. This was caught from screenshots and the app was switched to OSM tiles.

**Fixed after an automated security review:**
- XSS in the Leaflet tooltips (they now use a text node)
- cross-trip row inserts (closed by `create: false` plus actions)
- email addresses disclosed between members (fixed by sending one email per recipient)
- owner-billed AI being reachable by non-members
- a spend cap that users could delete. It is now a server-only counter that fails closed.

**Known residual:** the per-user caps (Hive messages, Google lookups) are read-then-write on a server-only counter, so exactly simultaneous requests from one user can overshoot by the number in flight. A per-user Durable Object counter with an atomic increment would close this.

**Automated verification:**
- `npx vitest run src/lib`: 18 Plan Doctor and geo unit tests.
- `npx deepspace test run tests/triphive.spec.ts`: two real accounts. A creates a trip, B **cannot** see it by URL, B joins by code, A's stops appear live for B, and an overlap produces a Plan Doctor issue that B sees.
- A manual prod run of Hive: overview → Exa search → geocode → two proposals with sources → vote → the stop lands live.

**What I verified myself:** _<!-- TODO(applicant): fill in what you personally clicked through and checked, e.g. two browsers on the live URL, invite flow, Hive proposals + voting, email received -->_

## Unfinished / next

- Drag-to-reorder stops. Today stops are ordered by time, and Hive's `optimize_day` suggests a better order.
- Real transit routing. Travel times today are labelled "approx" (straight line × 1.3, by mode).
- An atomic per-user AI counter (see the known residual above).
- Google Calendar export, per-stop comments, and a shared budget split.

## Run it

```sh
npm install
npx deepspace auth login
npx deepspace dev start          # http://localhost:5173
npx vitest run src/lib           # unit tests
npx deepspace test run tests/triphive.spec.ts   # needs 2 test accounts
npx deepspace deploy
```

Key files:
- `src/schemas/trip-schemas.ts`: data and access model
- `src/lib/planCheck.ts`: Plan Doctor
- `src/server/trips.ts`: trip service
- `src/ai/trip-tools.ts`: Hive's tools and prompt
- `src/actions/index.ts`: server actions
- `src/cron.ts`: weather watch
- `src/pages/(app)/(protected)/trips/`: UI
