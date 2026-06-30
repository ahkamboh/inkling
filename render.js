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

  let globalFrame = 0; // cumulative frame index across all scenes for amplitude lookup

  for (const file of list) {
    const n = file.match(/\d+/)[0];
    const url = 'file://' + path.join(sceneDir, file);
    await page.goto(url, { waitUntil: 'networkidle0' });
    const el = await page.$('svg.sc');
    const outdir = path.resolve(__dirname, 'frames', 's' + n);
    fs.rmSync(outdir, { recursive: true, force: true });
    fs.mkdirSync(outdir, { recursive: true });
    const frames = Math.round(DUR / 1000 * FPS);
    for (let f = 0; f < frames; f++) {
      const t = f * (1000 / FPS);
      await page.evaluate((t) => {
        document.getAnimations().forEach(a => { a.pause(); a.currentTime = t; });
      }, t);
      // Inject audio amplitude as --beat CSS custom property on :root
      if (ampData) {
        const beat = ampData[globalFrame] ?? 0;
        await page.evaluate((v) => {
          document.documentElement.style.setProperty('--beat', String(v));
        }, beat);
      }
      await el.screenshot({ path: path.join(outdir, String(f).padStart(4, '0') + '.png') });
      globalFrame++;
    }
    console.log('scene', n, 'done —', frames, 'frames');
  }
  await browser.close();
})();
