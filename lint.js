#!/usr/bin/env node
// lint.js — catch the #1 inkling failure modes BEFORE you render a video:
//   • OFF-FRAME    an element pushed outside the safe frame (the classic
//                  "mascot snapped to the corner" CSS-transform bug)
//   • TEXT⨯TEXT    two labels overlapping each other
//   • TEXT⨯SHAPE   a label crossing on top of an object (unreadable)
//
// It measures the ACTUAL rendered bounding boxes — every transform and CSS
// animation applied — at several moments across each scene, so nothing slips
// through. Run it before build.sh; fix what it reports; then render.
//
// Usage:
//   node lint.js                 lint every scenes/sceneN.html
//   node lint.js 3               lint just scene 3
//   node lint.js reel/scene01.html   lint any file
'use strict';
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const MARGIN = 16;                              // safe inset (viewBox units)
const SAMPLES = [300, 1500, 3000, 4500, 6200];  // ms — sampled across the scene
const TOL = 5;                                  // overlap tolerance (units)

const intersect = (a, b, tol = 0) =>
  a.x < b.x + b.w - tol && a.x + a.w > b.x + tol &&
  a.y < b.y + b.h - tol && a.y + a.h > b.y + tol;
const contains = (outer, inner, pad = 3) =>
  inner.x >= outer.x - pad && inner.y >= outer.y - pad &&
  inner.x + inner.w <= outer.x + outer.w + pad && inner.y + inner.h <= outer.y + outer.h + pad;

async function measure(page, t) {
  return page.evaluate((t) => {
    document.getAnimations().forEach(a => { a.pause(); a.currentTime = t; });
    const svg = document.querySelector('svg.sc');
    const sr = svg.getBoundingClientRect();
    const vb = svg.getAttribute('viewBox').split(/\s+/).map(Number);
    const W = vb[2], H = vb[3], sx = W / sr.width, sy = H / sr.height;
    const out = [];
    svg.querySelectorAll('text,rect,circle,ellipse,path,line,polygon,image').forEach(el => {
      if (el.closest('defs')) return;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') return;
      let op = parseFloat(cs.opacity || '1'), a = el.parentElement;
      while (a && a !== svg) { op *= parseFloat(getComputedStyle(a).opacity || '1'); a = a.parentElement; }
      if (op < 0.06) return;
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) return;
      const bb = { x: (r.left - sr.left) * sx, y: (r.top - sr.top) * sy, w: r.width * sx, h: r.height * sy };
      if (el.tagName === 'rect' && bb.w >= W * 0.97 && bb.h >= H * 0.97) return; // background
      const isText = el.tagName === 'text';
      const fill = cs.fill;
      const isSolid = !isText && fill && fill !== 'none' && !/rgba?\([^)]*,\s*0\s*\)/.test(fill);
      const cls = el.getAttribute('class');
      const label = el.tagName + (cls ? '.' + cls.split(' ')[0] : '') +
        (isText ? ' "' + (el.textContent || '').trim().slice(0, 22) + '"' : '');
      out.push({ label, bb, isText, isSolid });
    });
    return { out, W, H };
  }, t);
}

async function lintScene(page, file) {
  await page.goto('file://' + path.resolve(file), { waitUntil: 'networkidle0' });
  await page.evaluate(() => document.fonts.ready);
  // Count each issue across samples and note if it's present at the SETTLED frame.
  // Motion is allowed: an element may be off-frame / overlapping briefly while it
  // enters or acts. We only flag problems that are there when the scene RESTS
  // (last sample) or that PERSIST (≥60% of samples) — those are real bugs.
  const seen = new Map();
  const bump = (key, msg, isLast) => {
    const e = seen.get(key) || { msg, count: 0, inLast: false };
    e.count++; if (isLast) e.inLast = true; e.msg = msg; seen.set(key, e);
  };
  for (let si = 0; si < SAMPLES.length; si++) {
    const isLast = si === SAMPLES.length - 1;
    const { out, W, H } = await measure(page, SAMPLES[si]);
    for (const e of out) {
      if (e.bb.x < MARGIN - TOL || e.bb.y < MARGIN - TOL ||
          e.bb.x + e.bb.w > W - MARGIN + TOL || e.bb.y + e.bb.h > H - MARGIN + TOL)
        bump('oof:' + e.label, `OFF-FRAME   ${e.label}`, isLast);
    }
    const texts = out.filter(e => e.isText), solids = out.filter(e => e.isSolid);
    for (let i = 0; i < texts.length; i++)
      for (let j = i + 1; j < texts.length; j++)
        if (intersect(texts[i].bb, texts[j].bb, TOL))
          bump('tt:' + texts[i].label + texts[j].label, `TEXT ⨯ TEXT  ${texts[i].label}  ×  ${texts[j].label}`, isLast);
    for (const t2 of texts)
      for (const s of solids)
        if (intersect(t2.bb, s.bb, TOL) && !contains(s.bb, t2.bb))
          bump('ts:' + t2.label + s.label, `TEXT ⨯ SHAPE  ${t2.label}  on  ${s.label}`, isLast);
  }
  const persist = Math.ceil(SAMPLES.length * 0.6);
  return [...seen.values()].filter(e => e.inLast || e.count >= persist).map(e => e.msg);
}

(async () => {
  const arg = process.argv[2];
  let files;
  if (!arg) files = fs.readdirSync('scenes').filter(f => /^scene\d+\.html$/.test(f)).sort().map(f => 'scenes/' + f);
  else if (/^\d+$/.test(arg)) files = ['scenes/scene' + arg + '.html'];
  else files = [arg];

  const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--force-color-profile=srgb'] });
  const p = await b.newPage();
  await p.setViewport({ width: 1920, height: 1200, deviceScaleFactor: 1 });
  let bad = 0;
  for (const f of files) {
    const issues = await lintScene(p, f);
    if (issues.length) { bad++; console.log(`\n✗ ${f}`); issues.forEach(i => console.log('   ' + i)); }
    else console.log(`✓ ${f}`);
  }
  await b.close();
  console.log(bad ? `\n${bad} scene(s) need fixing — re-place the flagged elements, then re-lint.`
                  : `\n✓ all scenes clean — safe to render.`);
  process.exit(bad ? 1 : 0);
})();
