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
`viewBox="0 0 680 453"`, a white background rect, the mascot, props, and labels,
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
