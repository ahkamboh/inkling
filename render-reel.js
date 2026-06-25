// Renders reel/sceneNN.html in a chosen THEME, deterministic frame-grab.
// Also reads each scene's declared out-transition from
//   <meta name="inkling:transition" content="reveal">
// and writes frames/reel/<theme>/transitions.txt (one normalized ffmpeg name per scene).
// Usage: node render-reel.js <theme>
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const FPS = 24;
const DUR = 2800; // ms per scene
const W = 1920;
const THEME = process.argv[2] || 'ink';

// friendly transition names -> ffmpeg xfade types
const ALIAS = {
  push: 'slideleft', 'push-left': 'slideleft', 'push-right': 'slideright',
  reveal: 'circleopen', spotlight: 'circleopen', close: 'circleclose',
  rise: 'slideup', drop: 'slidedown',
  wipe: 'wiperight', 'wipe-left': 'wipeleft',
  dissolve: 'dissolve', fade: 'fade', cut: 'fade',
  burst: 'radial', radial: 'radial',
  glide: 'smoothleft', 'glide-right': 'smoothright', 'glide-up': 'smoothup',
  diagonal: 'diagtl', zoom: 'zoomin',
};
const norm = (s) => { s = (s || '').trim().toLowerCase(); return ALIAS[s] || s; };

(async () => {
  const dir = path.resolve(__dirname, 'reel');
  const scenes = fs.readdirSync(dir).filter(f => /^scene\d+\.html$/.test(f)).sort();
  const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--force-color-profile=srgb'] });
  const p = await b.newPage();
  await p.setViewport({ width: W, height: 1200, deviceScaleFactor: 1 });
  const themeDir = path.resolve(__dirname, 'frames', 'reel', THEME);
  const transitions = [];
  for (const f of scenes) {
    const n = f.match(/\d+/)[0];
    await p.goto('file://' + path.join(dir, f), { waitUntil: 'networkidle0' });
    const declared = await p.evaluate(() => {
      const m = document.querySelector('meta[name="inkling:transition"]');
      return m ? m.getAttribute('content') : '';
    });
    transitions.push(norm(declared) || 'fade');
    await p.evaluate((t) => document.body.setAttribute('data-theme', t), THEME);
    const el = await p.$('svg.sc');
    const od = path.join(themeDir, 's' + n);
    fs.rmSync(od, { recursive: true, force: true });
    fs.mkdirSync(od, { recursive: true });
    const frames = Math.round(DUR / 1000 * FPS);
    for (let i = 0; i < frames; i++) {
      const t = i * (1000 / FPS);
      await p.evaluate((t) => { document.getAnimations().forEach(a => { a.pause(); a.currentTime = t; }); }, t);
      await el.screenshot({ path: path.join(od, String(i).padStart(4, '0') + '.png') });
    }
    console.log(THEME, 'scene', n, '→ transition:', transitions[transitions.length - 1]);
  }
  fs.writeFileSync(path.join(themeDir, 'transitions.txt'), transitions.join('\n') + '\n');
  await b.close();
})();
