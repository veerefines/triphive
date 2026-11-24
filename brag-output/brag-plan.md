# TripHive brag plan

## Rubric

1. **What is it?** A shared trip planner for groups. Everyone edits one day-by-day plan live, and an assistant called Hive checks it and suggests changes that the group votes on.
2. **Who is it for?** Friends planning a trip together, plus solo travelers looking for a group going the same way.
3. **The problem it solves.** Group trips get planned in a chat thread, so nobody owns the plan and the hard questions (rain, timing, budget, lunch) get noticed on the day.
4. **The best line from the product.** "Plan the trip together. Let Hive keep it realistic." (README tagline)
5. **The most showable moment.** The Issues tab: Hive flags a 116-minute transit leg with 30 minutes free, a missing lunch stop and a trek that starts before a traveler is up.
6. **What is weird or specific about it.** Hive sits inside the group chat and posts real place cards. Nothing changes the plan until the group votes.
7. **Real UI available.** Captured live from https://triphive.app.space by `tests/zz-brag-capture.spec.ts`. Every screen is asserted before it is saved.
8. **Tone.** `app-store` crossed with `cinematic`: a confident product launch film in a warm honey-and-paper palette.
9. **Format.** Landscape 1920x1080, 30fps, 60s. The user asked for 60s, which overrides brag's 15–25s window.

## Angle

Group trips die in the group chat. TripHive turns that chat into one shared plan, and Hive keeps it honest.

- **Hook:** "47 messages. 3 spreadsheets. 0 plans." This is framing, not a product claim.
- **One-liner:** "Plan together. Hive keeps it real." It is a shortened README tagline.

## Storyboard (60.0s)

| # | Time | Scene | On screen | Transition out | SFX |
|---|---|---|---|---|---|
| 1 | 0.0–4.1 | Chat chaos | Chat bubbles pile up fast. The hook lands at 1.37s and holds. | Bubbles collapse into one dot | keypresses, card-slide pops |
| 2 | 4.1–8.2 | The real problem | "Who's booking?" / "Does it rain?" / "Is anyone even awake at 7?" Then "Group trips die in the group chat." | Dot expands, colour flood to paper | impactSoft_medium |
| 3 | 8.2–12.0 | Reveal | TripHive logo mark scales in, then the wordmark, then "Plan the trip together." | Zoom through the logo | impactSoft_heavy |
| 4 | 12.0–20.2 | One shared plan | Trip page with live avatars, invite code card, "My style" sheet. Captions: "One plan. Live for everyone." / "Share a 6-character code." / "Everyone sets their own pace and budget." | Iris close on the "plan issues" badge | click, card-slide |
| 5 | 20.2–28.0 | Hive checks the plan | Beat-locked at 20.19s: "Let Hive keep it realistic." Issue cards then fan in on the beat grid. | Whip left to chat | bell on lock, card-place per issue |
| 6 | 28.0–36.0 | @Hive in the chat | Typed "@Hive add a cafe near Ward's Lake", then "Hive is reading the chat…", then the place card, then Votes with Yes, then approve. Caption: "Nothing changes until the group votes." | Blur swap | keypresses, bong, click |
| 7 | 36.0–42.0 | Logistics | Three cards fan in: the Cost card ("Carry about…"), the header buttons for Weather / Email plan / Download PDF, and the itinerary. | Cards slide off | chips-stack |
| 8 | 42.0–50.0 | Find your people | Discover, then Ask to join with a pitch, then Inbox request with Accept, then People. Caption: "Find travelers going the same way." | Zoom out to montage | card-slide, click |
| 9 | 50.0–56.0 | Montage | Public trip cards from Discover sliding past on the beat grid. | Colour flood to honey | card-fan |
| 10 | 56.0–60.0 | End card | "Plan together. Hive keeps it real." / triphive.app.space / credit line. | Music tail | impactBell_heavy_000 |

## Audio

- **Music:** `happy-beats-business-moves-vol-10-by-ende-dot-app.mp3`. It runs exactly 60.00s at about 110 BPM, which matches the cut. Volume is 0.35, with a short fade-in and the track's own ending.
- **SFX:** Kenney packs, chosen from the low and medium HF-risk picks. Volume is 0.55–0.8.
- **Voice:** none. Kinetic captions carry the story.
- **Credit on the end card:** "Music: Sascha Ende, ende.app (CC BY 4.0)".

## Music cue guidance

- **Preset:** `cues/happy-beats-business-moves-vol-10-by-ende-dot-app.music-cues.md`. The beat grid starts at 0.27s with a step of about 0.545s.
- **Strong cues:** 15.82, 18.01, 18.55, 20.19, 20.74, 21.83, 22.37, 22.92, 23.46, 24.01.
- **Main lock:** the "Let Hive keep it realistic." line at 20.19s. Issue cards follow on 20.74, 21.83 and 22.92.
- **Secondary lock:** the logo reveal on 8.22s.
- **Beyond 25s:** `hyperframes beats` on the track extends the grid to 60s, and the montage cards snap to it.
- Readability wins over the grid every time.

## Voiceover script

Kokoro `af_heart`, one clip per scene, mixed into `composition/assets/voiceover.wav` (loudnorm -16 LUFS). Music is sidechain-ducked about 10 dB under the voice (`assets/music/music-ducked.mp3`). SFX are trimmed to 70%.

| Scene | Start | Line |
|---|---|---|
| s01 Hook | 0.25s | Every group trip starts here. And most of them end here too. |
| s02 Chaos | 4.35s | Who's booking? What's open? Is anyone even awake at seven? |
| s03 Reveal | 8.45s | So meet TripHive. One plan your whole group builds together. |
| s04 Shared plan | 12.25s | Start a trip, share a six letter code, and everyone's on the same live plan. Each person sets their own pace and budget. |
| s05 Hive check | 20.35s | Then Hive checks the whole thing. Long transit legs, a skipped lunch, a sunrise trek nobody's awake for. |
| s06 Chat + vote | 28.25s | Need ideas? Just ask Hive in the group chat. It finds real places, and nothing changes until the group votes. |
| s07 Logistics | 36.25s | Costs split themselves. Weather, the PDF, it's all there. |
| s08 Find people | 42.25s | Travelling solo? Find people headed your way, send a quick pitch, and join their trip. |
| s09 Montage | 50.25s | From Bhutan to San Diego, trips are already taking shape. |
| s10 End card | 56.3s | TripHive. Plan together. Hive keeps it real. |
