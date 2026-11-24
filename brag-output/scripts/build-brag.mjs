// Generates the TripHive brag composition: index.html (scene hosts, music, SFX,
// audio-reactive glow) and compositions/s01..s10.html.
// Usage: node build-brag.mjs <composition-dir> <bass10.json>
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'

const [, , DIR, BASS] = process.argv
if (!DIR || !BASS) throw new Error('usage: node build-brag.mjs <composition-dir> <bass10.json>')
mkdirSync(join(DIR, 'compositions'), { recursive: true })

const W = 1920
const H = 1080
const SHOT_W = 1440
const SHOT_H = 900

// ---------- shared scene pieces ----------

const BASE_CSS = `
@font-face { font-family: 'Fraunces'; src: url('assets/fonts/fraunces-latin.woff2') format('woff2'); font-weight: 400 900; font-display: block; }
#root { position: absolute; inset: 0; font-family: Inter, sans-serif; color: #1c1814; overflow: hidden; }
.cap { position: absolute; font-family: 'Fraunces', serif; font-weight: 700; color: #1c1814; letter-spacing: -0.02em; line-height: 1.04; }
.cap .w { display: inline-block; margin-right: 0.22em; }
.cap em { font-style: normal; color: #b4501f; }
.label { font-family: 'IBM Plex Mono', monospace; font-size: 28px; letter-spacing: 0.14em; text-transform: uppercase; color: #6f685d; }
.win { position: absolute; overflow: hidden; border-radius: 28px; background: #f8f7f3; border: 1px solid #d9d4c9;
  box-shadow: 0 50px 100px -30px rgba(28,24,20,0.35), 0 18px 36px -18px rgba(28,24,20,0.25); }
.shot { position: absolute; inset: 0; }
.shot img { position: absolute; max-width: none; display: block; }
`

/** Wraps each word of a caption in a span; words starting with * are accented. */
function words(text) {
  return text.split(' ').map((w) => (w.startsWith('*') ? `<span class="w"><em>${w.slice(1)}</em></span>` : `<span class="w">${w}</span>`)).join('')
}

/** Positions an image so `region` [x,y,w,h] of a nw x nh image fills a win.w x win.h window, clamped to the image edges. */
function fit(region, win, nw = SHOT_W, nh = SHOT_H) {
  const [rx, ry, rw, rh] = region
  const s = Math.min(win.w / rw, win.h / rh)
  const clamp = (v, size, span) => Math.min(0, Math.max(span - size * s, v))
  const l = clamp(win.w / 2 - s * (rx + rw / 2), nw, win.w)
  const t = clamp(win.h / 2 - s * (ry + rh / 2), nh, win.h)
  return `left:${l.toFixed(1)}px;top:${t.toFixed(1)}px;width:${(nw * s).toFixed(1)}px`
}

function shot(id, src, region, win, nw, nh) {
  return `<div class="shot" id="${id}"><img src="assets/ui/${src}" alt="" style="${fit(region, win, nw, nh)}" /></div>`
}

const box = (b) => `left:${b.x}px;top:${b.y}px;width:${b.w}px;height:${b.h}px`

// Timeline helpers available inside every scene script.
const TL_HELPERS = `
  const inW = (sel, t) => tl.fromTo(sel + ' .w', { opacity: 0, y: 46 }, { opacity: 1, y: 0, duration: 0.6, ease: 'expo.out', stagger: 0.07 }, t);
  const outW = (sel, t) => tl.fromTo(sel + ' .w', { opacity: 1, y: 0 }, { opacity: 0, y: -24, duration: 0.28, ease: 'power3.in', stagger: 0.02, immediateRender: false }, t);
  const fadeIn = (sel, t, d = 0.45) => tl.fromTo(sel, { opacity: 0, scale: 1.04 }, { opacity: 1, scale: 1, duration: d, ease: 'power4.out' }, t);
  const fadeOut = (sel, t, d = 0.25) => tl.fromTo(sel, { opacity: 1 }, { opacity: 0, duration: d, ease: 'power3.in', immediateRender: false }, t);
`

function scene(id, body, script, extraCss = '') {
  return `<template>
  <style>${BASE_CSS}${extraCss}</style>
  <div id="root" data-composition-id="${id}" data-width="${W}" data-height="${H}">
${body}
  </div>
  <script>
    const tl = gsap.timeline({ paused: true });
${TL_HELPERS}
${script}
    window.__timelines["${id}"] = tl;
  </script>
</template>
`
}

// ---------- scenes ----------

const S = {}

// s01 0.00-4.10 chat chaos + hook
{
  const msgs = [
    ['booking anything yet??', 120, 110, -4, 0], ['wait which dates', 1340, 140, 3, 1], ['I made a sheet', 260, 330, 2, 0],
    ['no use MY sheet', 1250, 360, -3, 1], ['is it monsoon there', 140, 560, -2, 0], ['who is driving', 1420, 600, 4, 0],
    ['can we vote', 380, 800, 3, 1], ['lunch??', 1180, 830, -5, 0], ['not waking at 5am', 760, 70, 2, 0],
    ['budget per person?', 700, 920, -2, 1], ['new sheet v3', 1500, 940, 3, 0], ['ok but where', 60, 960, 4, 0],
  ]
  const bubbles = msgs.map(([t, x, y, r, hot], i) =>
    `    <div class="s01-b${hot ? ' hot' : ''}" id="s01-b${i}" style="left:${x}px;top:${y}px">${t}</div>`).join('\n')
  const times = [0.05, 0.27, 0.42, 0.55, 0.68, 0.82, 0.93, 1.02, 1.1, 1.18, 1.24, 1.3]
  S.s01 = scene('s01', `${bubbles}
    <div id="s01-hook" class="cap" style="left:0;top:330px;width:1920px;text-align:center;font-size:124px">
      <div id="s01-l1">${words('47 messages.')}</div>
      <div id="s01-l2">${words('3 spreadsheets.')}</div>
      <div id="s01-l3">${words('0 *plans.')}</div>
    </div>
    <div id="s01-dot"></div>`, `
    const T = ${JSON.stringify(times)};
    const R = ${JSON.stringify(msgs.map((m) => m[3]))};
    T.forEach((t, i) => tl.fromTo('#s01-b' + i, { opacity: 0, scale: 0.6, rotation: 0 }, { opacity: 1, scale: 1, rotation: R[i], duration: 0.35, ease: 'back.out(2)' }, t));
    tl.fromTo('.s01-b', { opacity: 1 }, { opacity: 0.16, duration: 0.4, ease: 'power2.out', immediateRender: false }, 1.3);
    // beat-locked: 1.37s
    inW('#s01-l1', 1.37);
    // beat-grid
    inW('#s01-l2', 1.90);
    // beat-grid
    inW('#s01-l3', 2.46);
    outW('#s01-hook', 3.45);
    tl.fromTo('.s01-b', { x: 0, y: 0, scale: 1 }, { x: (i) => 960 - ${JSON.stringify(msgs.map((m) => m[1] + 150))}[i], y: (i) => 540 - ${JSON.stringify(msgs.map((m) => m[2] + 30))}[i], scale: 0.05, opacity: 0, duration: 0.42, ease: 'power3.in', immediateRender: false }, 3.4);
    tl.fromTo('#s01-dot', { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.25, ease: 'expo.out' }, 3.78);`, `
    .s01-b { position: absolute; padding: 18px 28px; border-radius: 26px 26px 26px 8px; background: #f8f7f3; border: 1px solid #d9d4c9;
      font-size: 32px; color: #1c1814; white-space: nowrap; box-shadow: 0 14px 30px -14px rgba(28,24,20,0.3); }
    .s01-b.hot { background: #f3ddd0; border-color: #e7c2ab; }
    #s01-l3 em { background: #f3ddd0; color: #1c1814; padding: 0 0.12em; border-radius: 12px; }
    #s01-dot { position: absolute; left: 930px; top: 510px; width: 60px; height: 60px; border-radius: 50%; background: #d4622a; }`)
}

// s02 4.10-8.20 the real problem
{
  const qs = [['Who is booking?', 230, 250, -5], ['Does it rain?', 760, 470, 3], ['Anyone up at 7?', 1120, 210, -2]]
  S.s02 = scene('s02', `    <div id="s02-flood"></div>
${qs.map(([t, x, y], i) => `    <div class="s02-q" id="s02-q${i}" style="left:${x}px;top:${y}px">${t}</div>`).join('\n')}
    <div id="s02-line" class="cap" style="left:0;top:420px;width:1920px;text-align:center;font-size:118px">${words('Group trips die')}<br/>${words('in the group chat.')}</div>
    <div id="s02-paper"></div>`, `
    tl.fromTo('#s02-flood', { scale: 1 }, { scale: 72, duration: 0.5, ease: 'expo.in' }, 0);
    const QT = [0.05, 0.25, 0.45]; const QR = ${JSON.stringify(qs.map((q) => q[3]))};
    QT.forEach((t, i) => tl.fromTo('#s02-q' + i, { opacity: 0, y: 60, rotation: 0 }, { opacity: 1, y: 0, rotation: QR[i], duration: 0.45, ease: 'expo.out' }, t));
    tl.fromTo('.s02-q', { opacity: 1, scale: 1 }, { opacity: 0, scale: 0.9, duration: 0.22, ease: 'power3.in', stagger: 0.04, immediateRender: false }, 1.48);
    // beat-locked: 5.74s
    inW('#s02-line', 1.64);
    tl.fromTo('#s02-paper', { y: 1100 }, { y: 0, duration: 0.45, ease: 'power3.in' }, 3.62);`, `
    #s02-flood { position: absolute; left: 930px; top: 510px; width: 60px; height: 60px; border-radius: 50%; background: #d4622a; }
    .s02-q { position: absolute; padding: 26px 38px; background: #fbf8f2; border-radius: 28px; font-family: 'Fraunces', serif; font-weight: 700;
      font-size: 64px; color: #1c1814; white-space: nowrap; box-shadow: 0 30px 60px -24px rgba(28,24,20,0.45); }
    #s02-paper { position: absolute; left: 0; top: 0; width: 1920px; height: 1080px; background: #ebe8e1; }`)
}

// s03 8.20-12.00 reveal
S.s03 = scene('s03', `    <img id="s03-mark" src="assets/brand/logo-mark.png" alt="" />
    <div id="s03-word" class="cap" style="left:0;top:560px;width:1920px;text-align:center;font-size:150px">TripHive</div>
    <div id="s03-tag" class="cap" style="left:0;top:770px;width:1920px;text-align:center;font-size:64px;font-weight:600">${words('Plan the trip *together.')}</div>`, `
    // beat-locked: 8.22s
    tl.fromTo('#s03-mark', { scale: 0.2, opacity: 0, rotation: -25 }, { scale: 1, opacity: 1, rotation: 0, duration: 0.7, ease: 'expo.out' }, 0.02);
    tl.fromTo('#s03-word', { opacity: 0, y: 40, scale: 1.08 }, { opacity: 1, y: 0, scale: 1, duration: 0.8, ease: 'expo.out' }, 0.5);
    // beat-grid
    inW('#s03-tag', 1.09);
    fadeOut('#s03-word', 3.1, 0.22);
    fadeOut('#s03-tag', 3.1, 0.22);
    tl.fromTo('#s03-mark', { scale: 1 }, { scale: 26, duration: 0.6, ease: 'power3.in', immediateRender: false }, 3.15);
    tl.fromTo('#s03-mark', { opacity: 1 }, { opacity: 0, duration: 0.18, ease: 'power3.in', immediateRender: false }, 3.58);`, `
    #s03-mark { position: absolute; left: 830px; top: 210px; width: 260px; height: 260px; }`)

// s04 12.00-20.19 one shared plan
{
  const win = { x: 680, y: 178, w: 1140, h: 712 }
  S.s04 = scene('s04', `    <div class="win" id="s04-win" style="${box(win)}">
      ${shot('s04-a', '04-trip-plan.png', [0, 0, 1440, 900], win)}
      ${shot('s04-b', '04-trip-plan.png', [560, 60, 600, 150], win)}
      ${shot('s04-c', '04-my-style.png', [520, 190, 400, 520], win)}
    </div>
    <div id="s04-code" class="win" style="left:1040px;top:800px;width:398px;height:128px;border-radius:24px">
      <img src="assets/ui/04-invite-code.png" alt="" style="position:absolute;left:13px;top:10px;width:372px;height:108px" />
    </div>
    <div id="s04-k1" class="cap" style="left:110px;top:400px;width:520px;font-size:80px">${words('One plan. Live for *everyone.')}</div>
    <div id="s04-k2" class="cap" style="left:110px;top:400px;width:520px;font-size:80px">${words('Share a *6-character code.')}</div>
    <div id="s04-k3" class="cap" style="left:110px;top:340px;width:540px;font-size:76px">${words('Everyone sets their own *pace and *budget.')}</div>`, `
    tl.fromTo('#s04-win', { opacity: 0, y: 120 }, { opacity: 1, y: 0, duration: 0.7, ease: 'expo.out' }, 0);
    tl.fromTo('#s04-a img', { scale: 1 }, { scale: 1.05, duration: 2.6, ease: 'none', transformOrigin: '50% 30%' }, 0.1);
    inW('#s04-k1', 0.3);
    outW('#s04-k1', 2.55);
    fadeIn('#s04-b', 2.75);
    inW('#s04-k2', 2.85);
    tl.fromTo('#s04-code', { opacity: 0, y: 60, scale: 0.8 }, { opacity: 1, y: 0, scale: 1, duration: 0.55, ease: 'back.out(1.8)' }, 3.2);
    outW('#s04-k2', 5.0);
    fadeOut('#s04-code', 5.0);
    fadeIn('#s04-c', 5.2);
    inW('#s04-k3', 5.3);
    // beat-locked: 18.55s
    tl.fromTo('#s04-c img', { scale: 1 }, { scale: 1.06, duration: 2.3, ease: 'none', transformOrigin: '50% 50%' }, 5.3);
    outW('#s04-k3', 7.55);
    tl.fromTo('#s04-win', { clipPath: 'circle(120% at 50% 50%)' }, { clipPath: 'circle(0% at 50% 50%)', duration: 0.5, ease: 'power3.in', immediateRender: false }, 7.62);`, `
    #s04-a, #s04-b, #s04-c { opacity: 1; }
    #s04-b, #s04-c { opacity: 0; }
    #s04-code { opacity: 0; }`)
}

// s05 20.19-28.00 Hive checks the plan
{
  const win = { x: 120, y: 270, w: 700, h: 740 }
  const issues = [
    ['Travel time', 'Needs ~116 min by transit, but only 30 min is free.'],
    ['Meal gap', 'No lunch stop between 11:30 and 14:30.'],
    ['Early start', 'Root bridge trek starts 07:00, before Sam is usually up (08:00).'],
  ]
  const cards = issues.map(([k, v], i) => `    <div class="s05-i" id="s05-i${i}" style="top:${300 + i * 236}px">
      <div class="label">${k}</div><div class="s05-t">${v}</div>
    </div>`).join('\n')
  S.s05 = scene('s05', `    <div id="s05-head" class="cap" style="left:0;top:70px;width:1920px;text-align:center;font-size:110px">${words('Let Hive keep it *realistic.')}</div>
    <div class="win" id="s05-win" style="${box(win)}">${shot('s05-a', '05-issues.png', [930, 243, 485, 632], win)}</div>
${cards}`, `
    // beat-locked: 20.19s
    inW('#s05-head', 0);
    tl.fromTo('#s05-win', { opacity: 0, y: 100 }, { opacity: 1, y: 0, duration: 0.7, ease: 'expo.out' }, 0.25);
    // beat-grid
    tl.fromTo('#s05-i0', { opacity: 0, x: 120 }, { opacity: 1, x: 0, duration: 0.55, ease: 'expo.out' }, 0.55);
    // beat-grid
    tl.fromTo('#s05-i1', { opacity: 0, x: 120 }, { opacity: 1, x: 0, duration: 0.55, ease: 'expo.out' }, 1.64);
    // beat-grid
    tl.fromTo('#s05-i2', { opacity: 0, x: 120 }, { opacity: 1, x: 0, duration: 0.55, ease: 'expo.out' }, 2.73);
    tl.fromTo('#s05-a img', { y: 0 }, { y: -40, duration: 6, ease: 'none' }, 0.5);
    tl.fromTo(['#s05-head', '#s05-win', '.s05-i'], { x: 0, filter: 'blur(0px)' }, { x: -2300, filter: 'blur(18px)', duration: 0.38, ease: 'power3.in', stagger: 0.03, immediateRender: false }, 7.3);`, `
    .s05-i { position: absolute; left: 900px; width: 900px; padding: 30px 38px; background: #f8f7f3; border: 1px solid #d9d4c9;
      border-left: 10px solid #d4622a; border-radius: 24px; box-shadow: 0 30px 60px -30px rgba(28,24,20,0.35); }
    .s05-t { margin-top: 10px; font-size: 40px; line-height: 1.22; color: #1c1814; font-weight: 600; }`)
}

// s06 28.00-36.00 @Hive in the chat, then the vote
{
  const win = { x: 1180, y: 90, w: 538, h: 900 }
  const panel = [1037, 243, 378, 632]
  S.s06 = scene('s06', `    <div class="win" id="s06-win" style="${box(win)}">
      ${shot('s06-a', '06-chat-typed.png', panel, win)}
      ${shot('s06-b', '06-chat-thinking.png', panel, win)}
      ${shot('s06-c', '06-chat-hive.png', panel, win)}
      ${shot('s06-d', '06-votes-approve.png', panel, win)}
    </div>
    <div id="s06-k1" class="cap" style="left:120px;top:380px;width:820px;font-size:88px">${words('Ask *@Hive right in the group chat.')}</div>
    <div id="s06-k2" class="cap" style="left:120px;top:380px;width:820px;font-size:88px">${words('Nothing changes until the group *votes.')}</div>`, `
    tl.fromTo('#s06-win', { x: 1000, opacity: 0 }, { x: 0, opacity: 1, duration: 0.5, ease: 'expo.out' }, 0);
    inW('#s06-k1', 0.25);
    fadeIn('#s06-b', 1.95, 0.25);
    fadeIn('#s06-c', 3.3, 0.4);
    outW('#s06-k1', 4.55);
    fadeIn('#s06-d', 4.75, 0.4);
    inW('#s06-k2', 4.85);
    tl.fromTo('#s06-d img', { scale: 1 }, { scale: 1.05, duration: 2.5, ease: 'none', transformOrigin: '50% 30%' }, 4.8);
    outW('#s06-k2', 7.4);
    tl.fromTo('#s06-win', { filter: 'blur(0px)', opacity: 1 }, { filter: 'blur(26px)', opacity: 0, duration: 0.45, ease: 'power3.in', immediateRender: false }, 7.45);`, `
    #s06-b, #s06-c, #s06-d { opacity: 0; }`)
}

// s07 36.00-42.00 logistics
{
  const strip = { x: 472, y: 200, w: 976, h: 82 }
  const stops = { x: 300, y: 320, w: 640, h: 680 }
  const cost = { x: 1000, y: 320, w: 470, h: 700 }
  S.s07 = scene('s07', `    <div id="s07-k" class="cap" style="left:0;top:64px;width:1920px;text-align:center;font-size:76px">${words('Split the cost. Check the *weather. Send the PDF.')}</div>
    <div class="win s07-card" id="s07-strip" style="${box(strip)};border-radius:20px">${shot('s07-s', '07-cost.png', [810, 72, 610, 46], strip)}</div>
    <div class="win s07-card" id="s07-stops" style="${box(stops)}">${shot('s07-p', '07-cost.png', [20, 240, 430, 450], stops)}</div>
    <div class="win s07-card" id="s07-cost" style="${box(cost)}">${shot('s07-c', '07-cost-card.png', [0, 0, 378, 560], cost, 378, 682)}</div>`, `
    inW('#s07-k', 0.1);
    tl.fromTo('#s07-strip', { opacity: 0, y: -60 }, { opacity: 1, y: 0, duration: 0.55, ease: 'expo.out' }, 0.3);
    tl.fromTo('#s07-stops', { opacity: 0, x: -140, rotation: -4 }, { opacity: 1, x: 0, rotation: -1.5, duration: 0.65, ease: 'expo.out' }, 0.9);
    tl.fromTo('#s07-cost', { opacity: 0, x: 140, rotation: 4 }, { opacity: 1, x: 0, rotation: 1.5, duration: 0.65, ease: 'expo.out' }, 1.5);
    tl.fromTo('#s07-c img', { y: 0 }, { y: -130, duration: 2.4, ease: 'power1.inOut' }, 2.6);
    outW('#s07-k', 5.3);
    tl.fromTo('.s07-card', { x: 0 }, { x: -2400, duration: 0.42, ease: 'power3.in', stagger: 0.06, immediateRender: false }, 5.4);`)
}

// s08 42.00-50.00 find your people
{
  const win = { x: 680, y: 178, w: 1140, h: 712 }
  const pw = { x: 640, y: 380, w: 1200, h: 304 }
  S.s08 = scene('s08', `    <div class="win" id="s08-win" style="${box(win)}">
      ${shot('s08-a', '08-discover.png', [150, 80, 1140, 720], win)}
      ${shot('s08-b', '08-ask-to-join.png', [840, 440, 390, 440], win)}
      ${shot('s08-c', '08-inbox-request.png', [525, 330, 746, 485], win)}
      ${shot('s08-d', '08-inbox-accepted.png', [540, 160, 720, 460], win)}
    </div>
    <div class="win" id="s08-pw" style="${box(pw)}">${shot('s08-e', '08-people.png', [168, 620, 1104, 280], pw)}</div>
    <div id="s08-k1" class="cap" style="left:110px;top:380px;width:540px;font-size:80px">${words('Find travelers going the *same way.')}</div>
    <div id="s08-k2" class="cap" style="left:110px;top:400px;width:540px;font-size:80px">${words('Ask to join with a *pitch.')}</div>
    <div id="s08-k3" class="cap" style="left:110px;top:400px;width:540px;font-size:80px">${words('Accept, and they are *in.')}</div>
    <div id="s08-k4" class="cap" style="left:110px;top:380px;width:540px;font-size:80px">${words('Know who you are traveling *with.')}</div>`, `
    tl.fromTo('#s08-win', { opacity: 0, x: 300 }, { opacity: 1, x: 0, duration: 0.6, ease: 'expo.out' }, 0);
    inW('#s08-k1', 0.2);
    outW('#s08-k1', 1.85);
    tl.fromTo('#s08-b', { opacity: 0, x: 400 }, { opacity: 1, x: 0, duration: 0.45, ease: 'expo.out' }, 2.0);
    inW('#s08-k2', 2.05);
    outW('#s08-k2', 3.85);
    tl.fromTo('#s08-c', { opacity: 0, x: 400 }, { opacity: 1, x: 0, duration: 0.45, ease: 'expo.out' }, 4.0);
    inW('#s08-k3', 4.05);
    fadeIn('#s08-d', 4.95, 0.3);
    outW('#s08-k3', 5.85);
    fadeOut('#s08-win', 5.95, 0.3);
    tl.fromTo('#s08-pw', { opacity: 0, y: 120 }, { opacity: 1, y: 0, duration: 0.55, ease: 'expo.out' }, 6.0);
    inW('#s08-k4', 6.05);
    tl.fromTo(['#s08-pw', '#s08-k4'], { scale: 1, opacity: 1 }, { scale: 0.55, opacity: 0, duration: 0.42, ease: 'power3.in', immediateRender: false }, 7.55);`, `
    #s08-b, #s08-c, #s08-d, #s08-pw { opacity: 0; }`)
}

// s09 50.00-56.00 montage
{
  const trip = { w: 515, h: 467 }
  const person = { w: 513, h: 370 }
  const people = [[168, 645, 354, 255], [543, 645, 353, 255], [918, 645, 353, 255]]
  const tripCards = [2, 3, 4].map((n, i) => `      <div class="win s09-c" id="s09-t${i}" style="left:${148 + i * 555}px;top:0;width:${trip.w}px;height:${trip.h}px;border-radius:24px">
        <img src="assets/ui/09-trip-${n}.png" alt="" style="position:absolute;left:0;top:0;width:${trip.w}px;height:${trip.h}px" /></div>`).join('\n')
  const personCards = people.map((r, i) => `      <div class="win s09-c" id="s09-p${i}" style="left:${148 + i * 555}px;top:0;width:${person.w}px;height:${person.h}px;border-radius:24px">
        ${shot(`s09-ps${i}`, '08-people.png', r, person)}</div>`).join('\n')
  S.s09 = scene('s09', `    <div id="s09-r1" style="position:absolute;left:0;top:70px;width:1920px;height:${trip.h}px">
${tripCards}
    </div>
    <div id="s09-r2" style="position:absolute;left:0;top:${70 + trip.h + 40}px;width:1920px;height:${person.h}px">
${personCards}
    </div>
    <div id="s09-flood"></div>`, `
    const ORDER = ['#s09-t0', '#s09-p1', '#s09-t1', '#s09-p0', '#s09-t2', '#s09-p2'];
    const BEATS = [0.46, 1.0, 1.55, 2.1, 2.64, 3.19];
    // beat-grid
    ORDER.forEach((sel, i) => tl.fromTo(sel, { opacity: 0, y: 90, scale: 0.9 }, { opacity: 1, y: 0, scale: 1, duration: 0.5, ease: 'expo.out' }, BEATS[i]));
    tl.fromTo('#s09-r1', { x: 80 }, { x: -80, duration: 6, ease: 'none' }, 0);
    tl.fromTo('#s09-r2', { x: -80 }, { x: 80, duration: 6, ease: 'none' }, 0);
    tl.fromTo('#s09-flood', { scale: 0 }, { scale: 70, duration: 0.6, ease: 'expo.in' }, 5.3);`, `
    #s09-flood { position: absolute; left: 930px; top: 510px; width: 60px; height: 60px; border-radius: 50%; background: #d4622a; }`)
}

// s10 56.00-60.00 end card
S.s10 = scene('s10', `    <img id="s10-mark" src="assets/brand/logo-mark.png" alt="" />
    <div id="s10-line" class="cap" style="left:0;top:400px;width:1920px;text-align:center;font-size:124px">
      <div>${words('Plan together.')}</div><div>${words('Hive keeps it *real.')}</div>
    </div>
    <div id="s10-url" style="position:absolute;left:0;top:740px;width:1920px;text-align:center;font-family:'IBM Plex Mono',monospace;font-size:44px;color:#1c1814">triphive.app.space</div>
    <div id="s10-credit" style="position:absolute;left:0;top:1000px;width:1920px;text-align:center;font-size:28px;color:#5c564c">Music: Sascha Ende, ende.app (CC BY 4.0)</div>
    <div id="s10-flood"></div>`, `
    tl.fromTo('#s10-flood', { scale: 70 }, { scale: 0, duration: 0.5, ease: 'expo.out' }, 0);
    tl.fromTo('#s10-mark', { scale: 0.3, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.6, ease: 'back.out(1.7)' }, 0.25);
    inW('#s10-line', 0.45);
    tl.fromTo('#s10-url', { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.5, ease: 'expo.out' }, 1.3);
    tl.fromTo('#s10-credit', { opacity: 0 }, { opacity: 1, duration: 0.5, ease: 'power2.out' }, 1.7);`, `
    #s10-mark { position: absolute; left: 885px; top: 200px; width: 150px; height: 150px; }
    #s10-flood { position: absolute; left: 930px; top: 510px; width: 60px; height: 60px; border-radius: 50%; background: #d4622a; }`)

for (const [id, html] of Object.entries(S)) writeFileSync(join(DIR, 'compositions', `${id}.html`), html)

// ---------- root ----------

const SCENES = [['s01', 0, 4.1], ['s02', 4.1, 8.2], ['s03', 8.2, 12.0], ['s04', 12.0, 20.19], ['s05', 20.19, 28.0],
  ['s06', 28.0, 36.0], ['s07', 36.0, 42.0], ['s08', 42.0, 50.0], ['s09', 50.0, 56.0], ['s10', 56.0, 60.0]]

// [absolute time, file, volume]; each marks an on-screen cause.
const SFX = [
  [0.05, 'card-place-1.ogg', 0.55], [0.42, 'keypress-001.wav', 0.5], [0.68, 'card-place-2.ogg', 0.55], [0.93, 'keypress-002.wav', 0.5],
  [1.18, 'card-place-3.ogg', 0.55], [1.37, 'impactSoft_medium_001.ogg', 0.8], [1.9, 'impactSoft_medium_002.ogg', 0.75],
  [2.46, 'impactSoft_heavy_001.ogg', 0.8], [3.4, 'switch_002.ogg', 0.6],
  [4.2, 'card-place-1.ogg', 0.6], [4.65, 'card-place-2.ogg', 0.6], [5.1, 'card-place-3.ogg', 0.6], [5.74, 'impactSoft_medium_001.ogg', 0.8],
  [7.72, 'card-slide-1.ogg', 0.6],
  [8.22, 'impactSoft_heavy_001.ogg', 0.85], [9.29, 'click_003.ogg', 0.55], [11.35, 'switch_002.ogg', 0.6],
  [12.0, 'card-slide-1.ogg', 0.6], [14.85, 'click_003.ogg', 0.65], [15.2, 'card-place-1.ogg', 0.6], [17.2, 'card-slide-1.ogg', 0.6],
  [19.81, 'switch_002.ogg', 0.6],
  [20.19, 'impactBell_heavy_000.ogg', 0.6], [20.74, 'card-place-1.ogg', 0.65], [21.83, 'card-place-2.ogg', 0.65], [22.92, 'card-place-3.ogg', 0.65],
  [27.5, 'glitch_002.ogg', 0.4],
  [28.0, 'card-slide-1.ogg', 0.6], [28.4, 'keypress-001.wav', 0.5], [28.75, 'keypress-003.wav', 0.5], [29.1, 'keypress-004.wav', 0.5],
  [29.45, 'keypress-005.wav', 0.5], [29.95, 'click_003.ogg', 0.7], [31.3, 'bong_001.ogg', 0.7], [32.75, 'click_003.ogg', 0.7],
  [35.45, 'switch_002.ogg', 0.6],
  [36.3, 'card-slide-1.ogg', 0.6], [36.9, 'card-place-1.ogg', 0.6], [37.5, 'card-place-2.ogg', 0.6], [38.6, 'chips-stack-1.ogg', 0.6],
  [41.4, 'switch_002.ogg', 0.55],
  [42.0, 'card-slide-1.ogg', 0.6], [44.0, 'card-slide-1.ogg', 0.6], [46.0, 'card-slide-1.ogg', 0.6], [46.95, 'click_003.ogg', 0.7],
  [48.0, 'card-slide-1.ogg', 0.6], [49.55, 'switch_002.ogg', 0.55],
  [50.46, 'card-place-1.ogg', 0.55], [51.0, 'card-place-2.ogg', 0.55], [51.55, 'card-place-3.ogg', 0.55],
  [52.1, 'card-place-1.ogg', 0.55], [52.64, 'card-place-2.ogg', 0.55], [53.19, 'card-place-3.ogg', 0.55],
  [55.3, 'card-fan-1.ogg', 0.6], [56.3, 'impactBell_heavy_000.ogg', 0.8],
]

const durCache = new Map()
function durationOf(file) {
  if (!durCache.has(file)) {
    const out = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', join(DIR, 'assets/sfx', file)]).toString().trim()
    const d = Number(out)
    if (!Number.isFinite(d) || d <= 0) throw new Error(`bad duration for ${file}: ${out}`)
    durCache.set(file, Math.round(d * 100) / 100)
  }
  return durCache.get(file)
}

// Lowest free SFX lane (11, 12, ...) so overlapping sounds never share one.
const SFX_UNDER_VO = 0.7 // SFX sit under the narration
const laneEnds = []
const sfxTags = SFX.map(([t, f, v], i) => {
  const d = durationOf(f)
  let lane = laneEnds.findIndex((end) => end <= t)
  if (lane === -1) { lane = laneEnds.length; laneEnds.push(0) }
  laneEnds[lane] = t + d
  return `    <audio id="sfx-${i}" class="clip" src="assets/sfx/${f}" data-start="${t}" data-duration="${d}" data-track-index="${11 + lane}" data-volume="${(v * SFX_UNDER_VO).toFixed(2)}"></audio>`
}).join('\n')

const hosts = SCENES.map(([id, s, e]) =>
  `    <div id="${id}" class="clip" data-composition-id="${id}" data-composition-src="compositions/${id}.html" data-start="${s}" data-duration="${(e - s).toFixed(2)}" data-track-index="1" data-width="${W}" data-height="${H}"></div>`).join('\n')

const bass = JSON.parse(readFileSync(BASS, 'utf8'))
if (!Array.isArray(bass) || bass.length < 10) throw new Error('bass envelope missing')
const bassRounded = bass.map((b) => Math.round(Math.min(1, Math.max(0, Number(b) || 0)) * 100) / 100)

const index = `<!doctype html>
<html lang="en" data-composition-variables='[{"id":"ground","type":"color","label":"Ground","default":"#ebe8e1"},{"id":"ink","type":"color","label":"Ink","default":"#1c1814"},{"id":"honey","type":"color","label":"Honey","default":"#d4622a"}]'>
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=${W}, height=${H}" />
<script src="https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js"></script>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { margin: 0; width: ${W}px; height: ${H}px; overflow: hidden; background: var(--ground, #ebe8e1); }
#root { position: relative; width: 100%; height: 100%; font-family: Inter, sans-serif; color: var(--ink, #1c1814); }
#bg { position: absolute; inset: 0; background: var(--ground, #ebe8e1); }
#glow { position: absolute; left: 460px; top: -60px; width: 1000px; height: 1000px; border-radius: 50%;
  background: radial-gradient(circle, rgba(212,98,42,0.5) 0%, rgba(212,98,42,0.16) 42%, rgba(212,98,42,0) 70%); opacity: 0.18; }
</style>
</head>
<body>
  <div id="root" data-composition-id="main" data-start="0" data-duration="60" data-width="${W}" data-height="${H}">
    <div id="bg"></div>
    <div id="glow"></div>
${hosts}
    <audio id="music" class="clip" src="assets/music/music-ducked.mp3" data-start="0" data-duration="60" data-track-index="10" data-volume="0.35" data-fade-in="0.3" data-fade-out="1.2"></audio>
    <!-- Voiceover: Kokoro af_heart, one line per scene; music is sidechain-ducked ~10 dB under it. -->
    <audio id="vo" class="clip" src="assets/voiceover.wav" data-start="0" data-duration="60" data-track-index="3" data-volume="1"></audio>
${sfxTags}
  </div>
<script>
  window.__timelines = window.__timelines || {};
  const tl = gsap.timeline({ paused: true });
  // Audio-reactive: the music's bass energy (10 samples/s, precomputed offline) breathes the honey glow by ~5%.
  const BASS = ${JSON.stringify(bassRounded)};
  const STEP = 0.1;
  tl.fromTo('#glow', { scale: 1, opacity: 0.18 }, { scale: 1 + 0.05 * BASS[0], opacity: 0.16 + 0.08 * BASS[0], duration: STEP, ease: 'none' }, 0);
  for (let i = 1; i < BASS.length; i++) {
    tl.to('#glow', { scale: 1 + 0.05 * BASS[i], opacity: 0.16 + 0.08 * BASS[i], duration: STEP, ease: 'none' }, i * STEP);
  }
  window.__timelines["main"] = tl;
</script>
</body>
</html>
`
writeFileSync(join(DIR, 'index.html'), index)
console.log(`wrote index.html + ${Object.keys(S).length} scenes, ${SFX.length} sfx on ${laneEnds.length} lanes`)
