// inkling — deterministic frame-grabber.
// Loads each scenes/sceneN.html headless, freezes the CSS animation clock
// frame-by-frame via document.getAnimations(), and screenshots a frame sequence.
//
// Audio-reactive mode: set AMP_FILE=/path/to/amp.json (array of [0,1] floats,
// one per frame at 24 fps). Each frame gets --beat injected on :root before
// the screenshot so CSS can drive pulse/glow effects from the audio amplitude.
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const FPS = 24;
const DUR = 7000; // ms per scene (one story loop)
const W = 1920;

// Load per-frame amplitude data if provided (from yt.js pipeline).
let ampData = null;
if (process.env.AMP_FILE && fs.existsSync(process.env.AMP_FILE)) {
  try {
    ampData = JSON.parse(fs.readFileSync(process.env.AMP_FILE, 'utf8'));
  } catch { /* amplitude is optional — silently skip */ }
}

(async () => {
  const sceneDir = path.resolve(__dirname, 'scenes');
  const scenes = fs.readdirSync(sceneDir).filter(f => /^scene\d+\.html$/.test(f)).sort();
  const only = process.argv[2]; // `node render.js 3` renders only scene3
  const list = only ? scenes.filter(f => f === `scene${only}.html`) : scenes;
  console.log('rendering:', list.join(', '));
  if (ampData) console.log('audio-reactive: amplitude loaded,', ampData.length, 'frames');

  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--force-color-profile=srgb'] });
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: 1200, deviceScaleFactor: 1 });

  // Crossfade compensation: when build.sh stitches with an xfade of XF seconds,
  // each scene's content lands at video-time sIdx*(SDUR-XF) + f/FPS (the overlap
  // shortens the timeline). The audio mix plays from t=0, so to keep the baked
  // --beat in sync with the audio we look it up at THAT video-time, not at the
  // naive cumulative frame. XF=0 (hard cuts) reduces to the plain cumulative index.
  const SDUR = DUR / 1000;                       // seconds per scene
  const XF = parseFloat(process.env.XF || '0');  // crossfade seconds (from build.sh)

  let sIdx = 0;
  for (const file of list) {
    const n = file.match(/\d+/)[0];
    const url = 'file://' + path.join(sceneDir, file);
    await page.goto(url, { waitUntil: 'networkidle0' });
    await page.evaluate(() => document.fonts.ready); // ensure web fonts are applied before capture

    // Auto-centre the composition vertically (set NO_CENTER=1 to disable). Measures
    // the RESTING content at the hold frame, computes one constant vertical shift that
    // gives equal top/bottom margins, and wraps the content so every frame is centred.
    if (process.env.NO_CENTER !== '1') {
      const delta = await page.evaluate((holdMs) => {
        document.getAnimations().forEach(a => { a.pause(); a.currentTime = holdMs; });
        const svg = document.querySelector('svg.sc');
        const sr = svg.getBoundingClientRect();
        const vb = svg.getAttribute('viewBox').split(/\s+/).map(Number);
        const H = vb[3], sy = H / sr.height;
        let ymin = 1e9, ymax = -1e9;
        svg.querySelectorAll('text,rect,circle,ellipse,path,line,polygon,image').forEach(el => {
          if (el.closest('defs')) return;
          const cs = getComputedStyle(el);
          if (cs.display === 'none' || cs.visibility === 'hidden') return;
          let op = parseFloat(cs.opacity || '1'), a = el.parentElement;
          while (a && a !== svg) { op *= parseFloat(getComputedStyle(a).opacity || '1'); a = a.parentElement; }
          if (op < 0.2) return;                                   // ignore fading-out props
          const r = el.getBoundingClientRect();
          if (r.width < 1 || r.height < 1) return;
          const y = (r.top - sr.top) * sy, h = r.height * sy;
          if (y <= H * 0.02 && y + h >= H * 0.98) return;          // skip the full-frame background
          ymin = Math.min(ymin, y); ymax = Math.max(ymax, y + h);
        });
        if (ymin > ymax) return 0;
        let d = (H - ymin - ymax) / 2;                            // centre the content band
        d = Math.max(d, 14 - ymin);                               // keep ≥14u top margin
        d = Math.min(d, (H - 14) - ymax);                         // keep ≥14u bottom margin
        return Math.round(d);
      }, DUR);
      if (delta) {
        await page.evaluate((d) => {
          const svg = document.querySelector('svg.sc');
          const bg = svg.querySelector('rect');                   // full-frame background, stays put
          const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
          g.setAttribute('transform', `translate(0,${d})`);
          let nx = bg.nextSibling;
          while (nx) { const after = nx.nextSibling; g.appendChild(nx); nx = after; }
          svg.appendChild(g);
        }, delta);
      }
    }

    const el = await page.$('svg.sc');
    const outdir = path.resolve(__dirname, 'frames', 's' + n);
    fs.rmSync(outdir, { recursive: true, force: true });
    fs.mkdirSync(outdir, { recursive: true });
    const frames = Math.round(DUR / 1000 * FPS);
    const base = Math.round(sIdx * (SDUR - XF) * FPS); // amplitude index at this scene's start
    for (let f = 0; f < frames; f++) {
      const t = f * (1000 / FPS);
      await page.evaluate((t) => {
        document.getAnimations().forEach(a => { a.pause(); a.currentTime = t; });
      }, t);
      // Inject audio amplitude as --beat CSS custom property on :root
      if (ampData) {
        const beat = ampData[base + f] ?? 0;
        await page.evaluate((v) => {
          document.documentElement.style.setProperty('--beat', String(v));
        }, beat);
      }
      await el.screenshot({ path: path.join(outdir, String(f).padStart(4, '0') + '.png') });
    }
    console.log('scene', n, 'done —', frames, 'frames');
    sIdx++;
  }
  await browser.close();
})();
