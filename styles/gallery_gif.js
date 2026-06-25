// Renders styles/gallery.html to a perfect-loop frame sequence (for examples/styles.gif).
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
(async () => {
  const b = await puppeteer.launch({ headless: 'new' });
  const p = await b.newPage();
  await p.setViewport({ width: 1080, height: 960, deviceScaleFactor: 1 });
  await p.goto('file://' + path.resolve(__dirname, 'gallery.html'), { waitUntil: 'networkidle0' });
  // drop the stagger so the loop is seamless (bob 2.6s + blink 3.9s -> LCM 7.8s)
  await p.addStyleTag({ content: '.fig{animation-delay:0s !important}' });
  const el = await p.$('.wrap');
  const dir = path.resolve(__dirname, '../frames/gal');
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const N = 78, STEP = 100; // 7.8s @ 10fps, exact loop
  for (let i = 0; i < N; i++) {
    const t = i * STEP;
    await p.evaluate((t) => { document.getAnimations().forEach(a => { a.pause(); a.currentTime = t; }); }, t);
    await el.screenshot({ path: path.join(dir, String(i).padStart(3, '0') + '.png') });
  }
  await b.close();
  console.log('gallery frames done:', N);
})();
