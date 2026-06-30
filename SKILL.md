# SKILL — authoring inkling scenes

How an AI agent (or you) turns a topic into animated hand-drawn explainer scenes.
A scene is one **idea**, authored as a single animated SVG in `scenes/sceneN.html`,
starring a recurring mascot that *performs the idea* (never decorates it).

## 1. Digest the topic
Extract the cognitive anchors — the moments worth drawing: a key judgement, a
before/after, an input→output loop, a split, a common pitfall, a role/state change.
Don't illustrate evenly. 4–8 scenes is the sweet spot.

## 2. One idea → one fresh metaphor
For each anchor, invent a low-tech, absurd-but-coherent physical metaphor and give the
mascot a meaningful role in it. If you could remove the mascot and the picture still
makes sense, the scene failed.

## 3. Direct the motion — the 7-beat skeleton
Every scene reuses the same timing structure (one loop, seamless):

| beat | what happens | principle |
|------|--------------|-----------|
| establish | mascot idle, breathing, blink | staging |
| arrive | the thing enters on an arc, lands with a squash | arcs, slow-out, squash |
| notice | mascot reacts (eyes widen / lean) | anticipation |
| wind-up | pull back before the action | anticipation (sells weight) |
| act | the action snaps (ease-in) | exaggeration |
| recover | overshoot, then settle | follow-through |
| loop | first frame == last frame | seamless |

Use `cubic-bezier` easing everywhere — never linear. Breathing is a `scaleY`
(not a position bob, which makes the line texture crawl). Blinks are irregular.

## 4. Write the SVG
Copy an existing `scenes/sceneN.html`. Each is a self-contained page:
`viewBox="0 0 680 383"`, a white background rect, the mascot, props, and labels,
animated with CSS keyframes. Conventions:
- Hand-drawn texture = one `feTurbulence` + `feDisplacementMap` filter applied to the
  **static** line work only (animating a filtered group makes it shimmer).
- Pops/draw-ons are one-shot (`animation: … both`); breathing/blink loop infinitely.
- Draw-on lines: animate `stroke-dashoffset`. A leading dot uses `offset-path`.
- Sparse handwritten labels only: orange = flow/path, red = warning/problem, blue = note.
- Colours via the theme tokens (see STYLES.md) so `data-theme` can re-skin the video.

## 5. Render
```bash
bash build.sh        # all scenes → examples/demo.mp4
bash build.sh 2      # iterate on scene 2 only
```
`render.js` loads each scene headless, sets `document.getAnimations()` `currentTime`
frame-by-frame (deterministic), screenshots, and ffmpeg crossfades the scenes.

## 6. QA each scene
- mascot performs the core action (not decoration)
- ≥35% whitespace, one idea per scene
- not a flowchart / slide / dense diagram
- labels correct and sparse; clean white (or themed) background
- the loop has no visible seam

## 7. Transitions — native & declarative

Each scene declares the transition used when cutting **to the next scene**, in its `<head>`:

```html
<meta name="inkling:transition" content="reveal">
```

`render-reel.js` reads it → `frames/reel/<theme>/transitions.txt` → `build-reel.sh` applies it.
Use a **friendly name** (mapped to an ffmpeg `xfade` type), or pass a raw xfade name directly:

| name | feel | use it when… | xfade |
|------|------|--------------|-------|
| `push` | momentum | the same thread continues / attention moves sideways | `slideleft` |
| `glide` | smooth continue | gentle progression, same energy | `smoothleft` |
| `rise` | building up | stacking, growth, "more" | `slideup` |
| `wipe` | step / next | a checklist or sequence advances | `wiperight` |
| `reveal` | spotlight | a result, answer or payoff appears | `circleopen` |
| `burst` | aha / energy | a realization or surprise lands | `radial` |
| `dissolve` | mood shift | changing topic or tone softly | `dissolve` |
| `diagonal` | dynamic | high-energy beats (jumps, action) | `diagtl` |
| `fade` | neutral / end | the final scene or a calm reset | `fade` |

**Rubric for picking (this is how an agent decides):** match the transition to *what happens at the
cut*, never at random — a result appearing → `reveal`; an idea landing → `burst`; a sequence
advancing → `wipe`/`rise`; the same subject continuing → `push`/`glide`; a topic change →
`dissolve`; the last scene → `fade` (its transition is unused — nothing follows it).

## 8. From a YouTube video — you author it, no API key

`yt.js` does the mechanical prep only (download + transcribe + amplitude). **You** (the agent)
do the creative work — same as authoring any other scene. There is no API call; you are the brain.

```bash
node yt.js <youtube-url>            # → youtube/<slug>/{transcript.txt, amp.json, audio.mp3, brief.md}
node yt.js <url> --max 120          # only use the first 2 min
node yt.js <url> --theme neon --beats 6   # hints, written into brief.md
```

Then (the brief itself prints the exact slug + commands):

1. **Read** `youtube/<slug>/brief.md` — it has the title, channel, hints, and the transcript.
2. **Clear the shipped demo scenes** so they don't leak into the render (`render.js` renders
   *every* `scenes/sceneN.html`): `rm -f scenes/scene*.html`.
3. **Digest** the transcript into beats (scene 1 = title card, the rest = key ideas). Honour the
   theme / shape / beat-count hints in the brief; otherwise pick what fits the video's mood.
4. **Author** `scenes/scene1.html … sceneN.html` per sections 1–7 above, **numbered sequentially
   from 1** (the amplitude lookup counts frames in scene order).
5. **Audio-reactive pulse:** drive any transform from `var(--beat, 0)` — e.g.
   `transform: scale(calc(1 + var(--beat,0) * 0.4))`. During a YouTube render, inkling sets
   `--beat` (0→1, the live audio amplitude) on `:root` every frame from `amp.json`.
6. **Render with the audio reacting** (`OUT_NAME` keeps it slug-scoped so the committed
   `demo.mp4` is never touched; `AMP_FILE` drives the pulse and forces clean cuts):
   ```bash
   OUT_NAME=yt-<slug>.silent AMP_FILE=youtube/<slug>/amp.json bash build.sh
   ```
7. **Mix the original audio back in:**
   ```bash
   bash mix.sh <slug>          # → examples/yt-<slug>.mp4
   ```

**Why clean cuts for YouTube:** `render.js` reads `AMP_FILE` (an array of `[0,1]` floats, one per
24fps frame) and bakes the beat per frame, counting frames cumulatively across scenes — so scene
*s* encodes the audio at `s×7s + local-time`. A crossfade would overlap scenes and shorten the
video, drifting the baked pulses ahead of the audio. So an `AMP_FILE` render forces `XF=0` (hard
cuts) → video length `== N×7s`, frame-exact with the audio that `mix.sh` overlays. Keep the default
max at 5 min unless the user asks for longer; for a long video, summarise the *whole thing* in a few
more scenes rather than transcribing all of it verbatim.
