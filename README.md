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

## Social layer: find your people

TripHive is also a place to meet travelers going the same way.

- **Private or Public trips.** The organizer can list a trip on **Discover** with a pitch, vibe tags and a number of open spots.
- **Ask to join.** Another traveler sends a short pitch. It reaches the organizer as a **chat request** in the **Inbox**, together with the requester's profile (bio, home city, travel style, interests).
  - The organizer can **Accept** or **Decline**.
  - The requester's composer stays locked until the organizer accepts. Accepting adds them to the trip, unlocks the chat for both sides and opens the full plan.
- **Members can suggest.** New members can suggest places, and each suggestion becomes a proposal the group votes on. Every trip also has a **group chat** tab.
- **Travel-buddy matching.** Discover and each trip's Explore tab show public trips in the same area (within 60 km, or the same city name) whose dates fall within **±5 days** of yours.
  - This is useful for solo travelers looking for a group.
  - The matcher is `src/lib/match.ts`; it is pure and unit-tested.
- **TripHive Featured.** A curated list of verified places with member perks (`src/data/featured.ts`).
  - Shown on Discover, on public trip pages and in the trip's Explore tab ("Suggest to group").
  - Hive also checks it first through a `get_featured_places` tool.
  - **The perks are demo offers.** No real partnerships exist, and the UI labels each one "Demo offer".

**How privacy works:**
- Strangers never get read access to `trips` or `stops`. A public trip is advertised through a separate `public_trips` *listing snapshot* that the server writes. The snapshot holds the title, dates, pitch, vibe tags and the first few stop titles per day. It never holds the invite code, times, prefs or member ids. The snapshot is rebuilt on publish, on accept or leave, and after every Plan Doctor run.
- `join_requests` and `dm_messages` use a `collaboratorsField` (`participants = [requester, organizer]`), so only those two people can read a request thread.
- Group chat is `'team'`.
- All social writes go through server actions that check the caller's role.
- Limits:
  - at most 20 join requests per user per day
  - one active request per trip
  - message length caps

## Planning together: routes, Hive in the chat, reviews, cost

- **Best route between stops.** The day map draws street routes between stops (OSRM, `src/lib/routing.ts`). A strip of leg cards gives the best way to go (walk, transit or taxi), the time, the cost in the destination currency, the alternatives and a Directions link. Mode choice is in `src/lib/legs.ts`, based on distance, the group's pace and the tightest budget in the group. If OSRM is down, legs fall back to straight-line estimates marked "est.".
- **Hive in the group chat.** After each group message, Hive reads the last 20 messages (`src/ai/hive-group.ts`, Haiku, low effort). It stays silent unless one of these happens:
  - the group agreed on a place: Hive adds it to the plan (at most 3 per run), and the activity log says why
  - a specific place came up: Hive posts a place card with rating, must-try dishes, food and things to do nearby, tips, a TripHive Verified perk if there is one, and TripHiver reviews
  - someone asked for ideas: Hive posts up to 2 cards
- **TripHiver reviews.** Members rate a place (1–5), write a line and log what they spent. Reviews are keyed by place and city, so they carry across trips. They show on Hive cards and feed the cost estimate. All writes go through a membership-checked server action.
- **Cost tab.** Shows a per-person estimate split into getting there, stays, food, getting around (from the route legs), things to do, shopping and a buffer. Planned prices come first, then what TripHivers reported spending, then local price levels (adapted from the Wayfare formulas). Totals show in the destination currency and the viewer's home currency, using live FX from Frankfurter with offline fallback rates. The tab also suggests how much cash to carry, based on how cash-heavy the destination is.

**Tradeoff: in group chat, Hive writes directly.** This departs from the proposal-only rule below. When the group has clearly agreed on a place in chat, a vote would ask them the same question twice. To limit the risk:
- Hive can only *add* stops in chat, never edit or delete them.
- It adds at most 3 per run.
- Every add is tagged `source: 'ai'` and logged with the reason.
- Group chat shares the 40-turns/day owner-billed budget with private Hive chat (`reserveHiveTurn`).

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
| Social privacy | `collaboratorsField` RBAC on `join_requests` / `dm_messages`, `'team'` on `trip_messages`, server-written `public_trips` | Request threads are readable only by the two participants; public listings expose no private plan data |

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
- `npx vitest run src/lib`: 27 unit tests covering Plan Doctor, geo, safe URLs and travel-buddy matching.
- `npx deepspace test run tests/social.spec.ts`: two real accounts.
  - A publishes a trip.
  - B still **cannot** open it by URL.
  - B finds it on Discover as a ±5-day match and sends a pitch. B's chat is locked.
  - A accepts from the Inbox (with the badge showing).
  - Chat unlocks both ways, and B opens the trip.
  - B suggests a Featured place, which lands in A's Votes, and the group chat works.
- `npx deepspace test run tests/triphive.spec.ts`: two real accounts. A creates a trip, B **cannot** see it by URL, B joins by code, A's stops appear live for B, and an overlap produces a Plan Doctor issue that B sees.
- A manual prod run of Hive: overview → Exa search → geocode → two proposals with sources → vote → the stop lands live.

**What I verified myself:** _<!-- TODO(applicant): fill in what you personally clicked through and checked, e.g. two browsers on the live URL, invite flow, Hive proposals + voting, email received -->_

## Unfinished / next

- Drag-to-reorder stops. Today stops are ordered by time, and Hive's `optimize_day` suggests a better order.
- Real transit timetables. Street routes come from OSRM. Transit and taxi times and prices are modelled, not live.
- Hive's group-chat reply runs in the background with no streaming, so the UI shows "Hive is thinking" for up to 45 s.
- An atomic per-user AI counter (see the known residual above).
- Google Calendar export, per-stop comments, and settling up who-paid-what (the Cost tab estimates, it does not track spend).
- Social:
  - real partner deals and an admin UI for Featured places (today it is a code-reviewed list)
  - blocking and reporting users
  - read receipts and unread counts per thread
  - photo avatars
  - map-based search on Discover

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
- `src/schemas/social-schemas.ts`, `src/server/social.ts`: the social layer
- `src/pages/(app)/(protected)/{discover,inbox,profile,people}`: Discover, Inbox and profiles
