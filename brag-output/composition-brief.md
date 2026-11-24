# Composition brief: TripHive, 60s launch film

The plan and storyboard are in `brag-plan.md`. This brief is the Hyperframes handoff.

## Objective
Build a 60-second landscape film that sells TripHive to group travelers and trip planners.

- **Story:** problem, then reveal, then features, then the one-liner.
- **Footage:** every product shot is a real capture from https://triphive.app.space.

## Output
- **Path:** `brag-output/composition/` (Hyperframes project).
- **Format:** 1920x1080 at 30fps, 60.0s.
- **Render:** `brag-output/brag.mp4`.

## Source material (verbatim copy only)
- **Tagline (README):** "Plan the trip together. Let Hive keep it realistic."
- **Features (README):**
  - Share the 6-character invite code.
  - Each traveler sets their own style: pace, daily budget, interests, dietary needs and wake-up time.
  - Hive checks the plan.
  - The group votes.
  - Download PDF or Email plan.
  - Find your people.
  - Ask to join.
  - Accept or Decline.
- **UI strings in the captures:** "plan issues", "Put to vote", "Hive is reading the chat…", "Carry about", "Weather", "Email plan", "Download PDF".
- **Issue texts from the live plan check:**
  - Travel time: "24.9 km … needs ~116 min by transit, but only 30 min is free."
  - Meal gap: "No lunch stop between 11:30 and 14:30."
  - Early start: "starts 07:00, before Sam is usually up (08:00)."
- **Free framing (not product claims):**
  - "47 messages. 3 spreadsheets. 0 plans."
  - "Group trips die in the group chat."
  - "Plan together. Hive keeps it real."

## Creative direction
- **Tone:** app-store crossed with cinematic. Confident and warm, never cute.
- **Pacing:** fast cuts, and readable holds of 0.5s plus 0.3s per word.
- **Product shots:** real UI on soft paper cards with deep shadows, framed, zoomed and panned. Never shown as flat full screens for long.
- **Transitions** (5 kinds, each with an on-screen cause):
  - collapse to a dot
  - colour flood
  - zoom through the logo
  - whip
  - blur swap

## Visual identity (from `src/styles.css`, quoted exactly)

| Token | Value |
|---|---|
| ground (bg) | `#ebe8e1` |
| ink (fg) | `#1c1814` |
| card | `#f8f7f3` |
| muted | `#e3dfd6` |
| muted-fg | `#6f685d` |
| border | `#d9d4c9` |
| honey (accent) | `#d4622a` |
| honey-soft | `#f3ddd0` |
| on-accent | `#fbf8f2` |

- **Display face:** Fraunces 600/700, shipped as `assets/fonts/fraunces-latin.woff2`.
- **Body face:** Inter 400/700.
- **Labels:** IBM Plex Mono.
- **Radius:** 0.9rem in the app, scaled to about 28px for video cards.
- **Logo:** `assets/brand/logo-mark.png` (512²) and `assets/brand/triphive-logo.png` (720×240).
- **Banned:**
  - dark grounds
  - full-screen linear gradients
  - neon
  - generic SaaS phrases

## Storyboard summary
See the 10-scene table in `brag-plan.md`. Each scene is one sub-composition, `compositions/sNN-*.html`.

## Audio
- **Role:** music drives energy, and the SFX mark every on-screen cause.
- **Music:** `assets/music/happy-beats-business-moves-vol-10-by-ende-dot-app.mp3`.
  - Track 10, 0–60s, volume 0.35.
  - Fade in over 0.3s and out over 1.2s.
- **Cue guidance:**
  - Main lock: 20.19s, "Let Hive keep it realistic." (`// beat-locked: 20.19s`).
  - Secondary lock: logo on 8.22s.
  - The issue cards sit on the beat grid at 20.74, 21.83 and 22.92.
  - The montage cards follow the beat grid from `hyperframes beats`.
- **Audio-reactive:** `assets/audio-data.json` comes from `extract-audio-data.py`. Bass energy drives the soft honey glow behind the product cards, a 3–6% change in presence. No waveform visuals.
- **SFX:** track 11, volume 0.55–0.8, Kenney picks with low to medium HF risk.
  - `keypress-*` for typing
  - `card-slide-1` for card entrances
  - `impactSoft_medium_*` for cuts
  - `impactSoft_heavy_001` for the logo
  - `bong_001` when the Hive card lands
  - `click_003` for button presses
  - `impactBell_heavy_000` for the end card
- **Voice:** none.

## Hyperframes instructions
- **Root:** `index.html`, with `data-composition-id="main"`, `data-duration="60"` and 1920x1080.
- **Mounting:** scene hosts sit back to back on track 1, and each mounts its file through `data-composition-src`.
- **Ids:** the host id, the scene root `data-composition-id` and the timeline key must be identical.
- **Tweens:**
  - Use `fromTo` only.
  - Animate children of `.clip` elements, never the clip itself.
  - Set no CSS transform on tweened elements.
- **Determinism:** no `Date.now`, no unseeded random, no infinite repeats.
- **Assets:** paths are relative, `assets/...`.
- **Gate:** `npx hyperframes check` must report 0 errors, including contrast.
