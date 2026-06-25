# Style system — shapes & themes (shortcut reference)

One character identity (white-dot eyes · thin legs · deadpan) that you re-skin by
combining a **shape** and a **theme**. Both are called by a short key.

```
look = shape + theme        e.g.  bean + ink   (default)
                                  ghost + riso
                                  square + neon
```

Files live in `styles/`:
| file | what it is |
|------|------------|
| `styles/themes.css` | the 9 theme palettes as CSS vars — the mechanism |
| `styles/characters.svg` | the 8 body shapes as `<symbol>`s |
| `styles/gallery.html` | live preview of every shape + theme (open it) |

---

## Themes — call with `data-theme="<key>"`

| key | name | vibe |
|-----|------|------|
| `ink` | hand-drawn ink *(default)* | max contrast, signature, cheapest to animate |
| `flat` | bold flat | friendly product look |
| `blueprint` | blueprint | dev / infra, dark + grid |
| `chalk` | chalkboard | teacher / learn-AI |
| `riso` | riso duotone | editorial print, great thumbnails |
| `neon` | neon | dark-mode, pops on a black slide |
| `grid` | notebook | study / explainer, graph paper |
| `marker` | marker | punchy, social feed |
| `pastel` | pastel | soft, approachable |

```html
<link rel="stylesheet" href="styles/themes.css">
<div data-theme="neon"> …scene svg here… </div>
```

## Shapes — call with `<use href="#c-<key>">`

`bean` · `round` · `square` · `tall` · `triangle` · `pill` · `cloud` · `ghost`

```html
<svg viewBox="0 0 100 130"><use href="#c-ghost"/></svg>
```

## Token vocabulary (what each scene should use)

Draw with the vars — never hard-coded colours — so a single `data-theme` swap reskins
a whole scene:

| var | meaning | var | meaning |
|-----|---------|-----|---------|
| `--bg` | background | `--ink` | main line / outline |
| `--fill` | body fill (`none` = outline themes) | `--eye` | eye dots |
| `--bw` | base stroke width | `--block` | held square / highlight |
| `--a1` | flow / path / arrows | `--a2` | warning / problem |
| `--a3` | note / system state | `--grid` | graph-paper lines |
| `--label` | caption text | | |

## Apply a theme to the whole video

The example `scenes/scene*.html` hard-code `ink`. To make them theme-swappable,
replace literal colours with the vars above, add
`<link rel="stylesheet" href="../styles/themes.css">` + `data-theme` on the stage,
then `bash build.sh` renders in whatever theme is set.
