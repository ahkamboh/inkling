// Renders reel/sceneNN.html in a chosen THEME, deterministic frame-grab.
// Usage: node render-reel.js <theme>   (theme = ink|flat|blueprint|chalk|riso|neon|grid|marker|pastel)
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const FPS = 24;
const DUR = 2800; // ms per scene
const W = 1920, H = 1080;
const THEME = process.argv[2] || 'ink';

(async () => {
  const dir = path.resolve(__dirname, 'reel');
  const scenes = fs.readdirSync(dir).filter(f => /^scene\d+\.html$/.test(f)).sort();
  const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--force-color-profile=srgb'] });
  const p = await b.newPage();
  await p.setViewport({ width: W, height: 1200, deviceScaleFactor: 1 });
  for (const f of scenes) {
    const n = f.match(/\d+/)[0];
    await p.goto('file://' + path.join(dir, f), { waitUntil: 'networkidle0' });
    await p.evaluate((t) => document.body.setAttribute('data-theme', t), THEME);
    const el = await p.$('svg.sc');
    const od = path.resolve(__dirname, 'frames', 'reel', THEME, 's' + n);
    fs.rmSync(od, { recursive: true, force: true });
    fs.mkdirSync(od, { recursive: true });
    const frames = Math.round(DUR / 1000 * FPS);
    for (let i = 0; i < frames; i++) {
      const t = i * (1000 / FPS);
      await p.evaluate((t) => { document.getAnimations().forEach(a => { a.pause(); a.currentTime = t; }); }, t);
      await el.screenshot({ path: path.join(od, String(i).padStart(4, '0') + '.png') });
    }
    console.log(THEME, 'scene', n, 'done');
  }
  await b.close();
})();
