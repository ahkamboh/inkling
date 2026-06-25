<h1 align="center">inkling</h1>

<p align="center">
  <b>Code-driven, hand-drawn animated explainer videos — with a themeable mascot.</b><br>
  No AI image model. No AI video model. Just SVG + CSS → frames → ffmpeg. Deterministic & free.
</p>

---

## 🤖 Set it up by pasting this into any AI agent

Copy-paste the block below into Claude Code, Cursor, Codex, or any coding agent. It will clone, install, learn the system, and render the demo for you:

```text
Set up the "inkling" toolkit for me, end to end:

1. git clone https://github.com/ahkamboh/inkling && cd inkling
2. Read README.md, SKILL.md and STYLES.md fully — this is a system for generating
   hand-drawn animated explainer videos purely from SVG + CSS (no AI image/video model).
3. Run: npm install      (installs Puppeteer + Chromium)
4. Render the example:  bash build.sh   →  produces examples/demo.mp4
5. Learn the model: each "scene" is one idea, authored as an animated SVG in
   scenes/sceneN.html (CSS keyframes + a recurring mascot). The renderer freezes the
   CSS clock frame-by-frame and ffmpeg stitches + crossfades the scenes.
6. The look is a design system: re-skin with a THEME (data-theme="ink|flat|blueprint|
   chalk|riso|neon|grid|marker|pastel") and a SHAPE (<use href="#c-bean|round|square|
   tall|triangle|pill|cloud|ghost">). Full reference in STYLES.md.

When done: confirm the demo rendered, then propose 3 scene ideas (with the 7-beat
structure: establish → arrive → notice → wind-up → act → recover → loop) for my topic:
<<PUT YOUR TOPIC HERE>>
```

---

## 🎬 Demo — one reel, three themes

The **same 10-scene reel**, rendered in three different themes just by changing `data-theme` — with premium cinematic transitions (slide · circle-open · wipe · radial) between every scene. This *is* the pitch: **author once, ship any look.**

**`ink`**
<img src="examples/reel-ink.gif" width="100%" alt="inkling reel — ink theme">

**`neon`**
<img src="examples/reel-neon.gif" width="100%" alt="inkling reel — neon theme">

**`chalk`**
<img src="examples/reel-chalk.gif" width="100%" alt="inkling reel — chalkboard theme">

```bash
bash build-reel.sh neon      # render the reel in any theme you name
```

> Also in the box — two concept micro-explainers (`scenes/scene1–2.html`): **caffeine blocks your sleepy signal** and **tiny habits compound** → [`examples/demo.mp4`](examples/demo.mp4). Preview every shape × theme in [`styles/gallery.html`](styles/gallery.html).

---

## Why

Most "AI explainer" tools give you generic, drifting, un-editable images. `inkling` is the opposite:

- **Deterministic** — same input always renders the same frames. Safe for a real video pipeline.
- **Consistent IP** — one recurring mascot (white-dot eyes, thin legs, deadpan) across an entire series.
- **Directable motion** — a reusable 7-beat acting structure (anticipation, squash, follow-through, easing) — not a Ken Burns pan over a still.
- **Free & offline** — no API keys, no per-render cost, no model that warps your line art or garbles labels.
- **Diff-able** — scenes are text. Version them, review them, template them.

## Quickstart

```bash
git clone https://github.com/ahkamboh/inkling && cd inkling
npm install          # Puppeteer + Chromium
bash build.sh        # renders all scenes → examples/demo.mp4
bash build.sh 3      # render just scene 3 while iterating
```

Requirements: **Node 18+**, **ffmpeg** on PATH.

## How it works

```
scenes/sceneN.html   one idea = one animated SVG (CSS keyframes + the mascot)
        │
   render.js         Puppeteer loads each scene, freezes document.getAnimations()
        │            frame-by-frame, screenshots a deterministic frame sequence
        ▼
   build.sh          ffmpeg: frames → per-scene mp4 → white-padded 1080p → xfade → demo.mp4
```

Add a scene = add a `scenes/sceneN.html` and re-run `bash build.sh`. The 7-beat skeleton
(establish → arrive → notice → wind-up → act → recover → loop) is the template; copy an
existing scene and swap the props, paths and labels.

## The look — every shape × every theme

![inkling — every shape and theme](examples/styles.gif)

A "look" is one **shape** + one **theme**. Each is called by a short **key** — name them and everything re-skins:

| | keys (call by name) |
|---|---|
| **themes** → `data-theme="…"` | `ink` · `flat` · `blueprint` · `chalk` · `riso` · `neon` · `grid` · `marker` · `pastel` |
| **shapes** → `<use href="#c-…">` | `c-bean` · `c-round` · `c-square` · `c-tall` · `c-triangle` · `c-pill` · `c-cloud` · `c-ghost` |

**In code** — drop a shape into a theme:

```html
<link rel="stylesheet" href="styles/themes.css">

<div data-theme="neon">                                <!-- theme, by name -->
  <svg viewBox="0 0 100 130"><use href="#c-ghost"/></svg>     <!-- shape, by name -->
</div>
<!--  →  a ghost mascot in the neon palette  -->
```

**When prompting an agent** — just name the keys:

```text
Make a new inkling scene about <topic> in the `chalk` theme using the `c-cloud` shape.
```
```text
Re-skin the demo — switch every scene to data-theme="riso" with the `c-tall` shape.
```

Preview them live (animated) in [`styles/gallery.html`](styles/gallery.html) · full token reference in [STYLES.md](STYLES.md).

## Repo layout

```
inkling/
├─ scenes/        scene1–2.html   — the demo scenes, one idea per file
├─ styles/        themes.css · characters.svg · gallery.html   — the design system
├─ render.js      Puppeteer deterministic frame-grabber
├─ build.sh       frames → mp4 → crossfade → demo.mp4
├─ examples/      demo.mp4 · demo.gif
├─ STYLES.md      shape + theme shortcut reference
└─ SKILL.md       how an AI agent authors new scenes
```

## License

MIT © 2026 [Ali Hamza Kamboh (@ahkamboh)](https://github.com/ahkamboh)

<sub>Built with Claude Code. Style inspired by hand-drawn "body-text" explainer illustration.</sub>
