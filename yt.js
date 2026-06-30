#!/usr/bin/env node
// yt.js — YouTube URL → inkling hand-drawn motion graphic explainer
//
// Usage:
//   node yt.js <url>
//   node yt.js <url> --max 120          # cap at 2 min of source video
//   node yt.js <url> --theme neon       # force a theme
//   node yt.js <url> --shape c-ghost    # force mascot shape
//   node yt.js <url> --beats 6          # force N scenes
//
// Requires: yt-dlp, ffmpeg, python3, ANTHROPIC_API_KEY

'use strict';
const { execSync, execFileSync, spawnSync } = require('child_process');
const fs   = require('fs');
const path = require('path');
const os   = require('os');

const ROOT = __dirname;
const WORK = path.join(os.tmpdir(), 'inkling-yt');
fs.mkdirSync(WORK, { recursive: true });

// ─── CLI args ────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const url  = argv.find(a => /^https?:\/\//.test(a));
if (!url) {
  console.error('Usage: node yt.js <youtube-url> [--max <secs>] [--theme <theme>] [--shape <shape>] [--beats <n>]');
  process.exit(1);
}
const flag = (name, def) => {
  const i = argv.indexOf('--' + name);
  return i !== -1 ? argv[i + 1] : def;
};
const maxSecs    = +(flag('max', 300));       // default 5 min
const themeArg   = flag('theme', null);       // auto-detect if null
const shapeArg   = flag('shape', null);
const beatsForce = flag('beats', null);

// ─── Helpers ─────────────────────────────────────────────────────────────────
function run(cmd, opts = {}) {
  return execSync(cmd, { stdio: opts.silent ? 'pipe' : 'inherit', encoding: 'utf8', cwd: ROOT, ...opts });
}
function esc(str) {
  return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// Theme CSS variable table (mirrors styles/themes.css)
const THEMES = {
  ink:       { bg:'#ffffff', ink:'#1c1c1c', a1:'#e8730c', a2:'#d6342a', a3:'#2563b0', label:'#7a7164' },
  flat:      { bg:'#f3efe6', ink:'#1c1c1c', a1:'#e8730c', a2:'#d6342a', a3:'#2f6fb0', label:'#4a463f' },
  blueprint: { bg:'#112a4c', ink:'#8fd2ff', a1:'#ffd27f', a2:'#ff9d9d', a3:'#bfe2ff', label:'#bfe2ff' },
  chalk:     { bg:'#243b33', ink:'#f1ece1', a1:'#f0d79a', a2:'#e7a0b6', a3:'#a9c7f0', label:'#ece7da' },
  riso:      { bg:'#f3ead7', ink:'#2f4fd0', a1:'#ff6f61', a2:'#ff6f61', a3:'#2f4fd0', label:'#9a6a55' },
  neon:      { bg:'#161823', ink:'#3fe0d0', a1:'#ff5ad8', a2:'#ff5ad8', a3:'#3fe0d0', label:'#9fe7dd' },
  grid:      { bg:'#fcfdff', ink:'#1c1c1c', a1:'#e8730c', a2:'#d6342a', a3:'#2563b0', label:'#7a7164' },
  marker:    { bg:'#ffffff', ink:'#1c1c1c', a1:'#e8730c', a2:'#d6342a', a3:'#2563b0', label:'#7a7164' },
  pastel:    { bg:'#fff6f1', ink:'#4a4a52', a1:'#f0a35e', a2:'#f5a8c0', a3:'#a9c7f0', label:'#b07f93' },
};

// ─── Scene generators ─────────────────────────────────────────────────────────
function mascotSVG(cx, cy, r, t, fill, stroke) {
  const rx = r, ry = Math.round(r * 1.15);
  const legY = cy + ry, legLen = Math.round(r * 0.7);
  const eyeR = Math.round(r * 0.18), eyeOff = Math.round(r * 0.32), eyeUp = Math.round(r * 0.22);
  return `
    <g class="mascot" transform="translate(${cx},${cy})">
      <ellipse cx="0" cy="0" rx="${rx}" ry="${ry}" fill="${fill}" stroke="${stroke}" stroke-width="2.4" class="mbody"/>
      <g class="meyes">
        <circle cx="-${eyeOff}" cy="-${eyeUp}" r="${eyeR}" fill="${stroke}"/>
        <circle cx="${eyeOff}" cy="-${eyeUp}" r="${eyeR}" fill="${stroke}"/>
      </g>
      <path d="M-${eyeOff},${Math.round(r*0.28)} Q0,${Math.round(r*0.45)} ${eyeOff},${Math.round(r*0.28)}" fill="none" stroke="${stroke}" stroke-width="1.8" stroke-linecap="round"/>
      <line x1="-${Math.round(r*0.35)}" y1="${ry}" x2="-${Math.round(r*0.35)}" y2="${ry+legLen}" stroke="${stroke}" stroke-width="2.2" stroke-linecap="round"/>
      <line x1="${Math.round(r*0.35)}" y1="${ry}" x2="${Math.round(r*0.35)}" y2="${ry+legLen}" stroke="${stroke}" stroke-width="2.2" stroke-linecap="round"/>
    </g>`;
}

function titleScene(beat, t) {
  const c = THEMES[t] || THEMES.ink;
  const isDark = c.bg.startsWith('#0') || c.bg.startsWith('#1') || c.bg.startsWith('#2');
  return `<html><head><meta charset="utf-8">
<link rel="stylesheet" href="../styles/themes.css">
<style>
html,body{margin:0;background:${c.bg}}
.stage{width:1920px}
svg.sc{display:block;width:1920px;height:auto}
.hl{animation:wipe 0.9s 0.2s cubic-bezier(.25,1,.5,1) both}
.sub{animation:fin 0.6s 1s ease-out both}
.badge{animation:fin 0.5s 1.5s ease-out both}
.mascot{transform-origin:center bottom;animation:bob 1.8s infinite cubic-bezier(.45,.05,.55,.95)}
.mbody,.meyes{transform-box:fill-box}
.mbody{transform-origin:center bottom}
.meyes{transform-origin:center;animation:blink 3.2s infinite ease-in-out}
.ring{animation:breathe 2s infinite ease-in-out;transform-origin:center;transform-box:fill-box}
@keyframes wipe{from{clip-path:inset(0 100% 0 0)}to{clip-path:inset(0 -2% 0 0)}}
@keyframes fin{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
@keyframes bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
@keyframes blink{0%,88%,100%{transform:scaleY(1)}92%{transform:scaleY(.08)}95%{transform:scaleY(1)}}
@keyframes breathe{0%,100%{transform:scale(1);opacity:.35}50%{transform:scale(calc(1+var(--beat,0)*.4));opacity:.7}}
</style></head>
<body><div class="stage" data-theme="${t}">
<svg class="sc" viewBox="0 0 680 383" xmlns="http://www.w3.org/2000/svg">
<rect width="680" height="383" fill="${c.bg}"/>
<!-- accent rule -->
<rect x="40" y="148" width="3" height="90" fill="${c.a1}" rx="1.5"/>
<line x1="40" y1="148" x2="640" y2="148" stroke="${c.a1}" stroke-width="1" opacity="0.3"/>
<!-- title -->
<text class="hl" x="56" y="192" font-family="'Permanent Marker','Bradley Hand',cursive" font-size="44" fill="${c.a1}">${esc(beat.headline)}</text>
<text class="sub" x="56" y="228" font-family="'Bradley Hand','Comic Sans MS',cursive" font-size="20" fill="${c.label}">${esc(beat.sub || '')}</text>
<!-- inkling badge -->
<text class="badge" x="56" y="320" font-family="'Bradley Hand','Comic Sans MS',cursive" font-size="14" fill="${c.label}" opacity="0.7">✦ inkling auto-summary</text>
<!-- audio ring -->
<circle class="ring" cx="590" cy="230" r="56" fill="none" stroke="${c.a1}" stroke-width="1.5"/>
<circle class="ring" cx="590" cy="230" r="40" fill="none" stroke="${c.ink}" stroke-width="0.8" opacity="0.4"/>
${mascotSVG(590, 218, 28, t, isDark ? c.bg : '#fff', c.ink)}
</svg></div></body></html>`;
}

function conceptScene(beat, t, idx, total) {
  const c = THEMES[t] || THEMES.ink;
  const isDark = c.bg.startsWith('#0') || c.bg.startsWith('#1') || c.bg.startsWith('#2');
  // Alternate mascot sides to add visual rhythm
  const mascotX = idx % 2 === 0 ? 590 : 90;
  const textX   = idx % 2 === 0 ? 56  : 150;
  const textAnchor = idx % 2 === 0 ? 'start' : 'start';

  return `<html><head><meta charset="utf-8">
<link rel="stylesheet" href="../styles/themes.css">
<style>
html,body{margin:0;background:${c.bg}}
.stage{width:1920px}
svg.sc{display:block;width:1920px;height:auto}
.num{animation:fin .4s .05s ease-out both}
.hl{animation:wipe .8s .2s cubic-bezier(.25,1,.5,1) both}
.ins{animation:fin .6s .85s ease-out both}
.bar{animation:grow .6s .1s ease-out both;transform-origin:left center;transform-box:fill-box}
.mascot{transform-origin:center bottom;animation:bob 1.6s infinite cubic-bezier(.45,.05,.55,.95)}
.mbody,.meyes{transform-box:fill-box}
.mbody{transform-origin:center bottom}
.meyes{transform-origin:center;animation:blink 3.6s infinite ease-in-out}
.ring{transform-origin:center;transform-box:fill-box;animation:pulse 1.1s infinite ease-in-out}
.dot{animation:pop .5s 1.2s cubic-bezier(.3,1.5,.5,1) both;transform-origin:center;transform-box:fill-box}
@keyframes wipe{from{clip-path:inset(0 100% 0 0)}to{clip-path:inset(0 -2% 0 0)}}
@keyframes fin{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
@keyframes grow{from{transform:scaleX(0)}to{transform:scaleX(1)}}
@keyframes bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
@keyframes blink{0%,86%,100%{transform:scaleY(1)}90%{transform:scaleY(.09)}93%{transform:scaleY(1)}}
@keyframes pulse{0%,100%{transform:scale(1);opacity:.4}50%{transform:scale(calc(1+var(--beat,0)*.45));opacity:.85}}
@keyframes pop{0%{transform:scale(0);opacity:0}70%{transform:scale(1.15);opacity:1}100%{transform:scale(1);opacity:1}}
</style></head>
<body><div class="stage" data-theme="${t}">
<svg class="sc" viewBox="0 0 680 383" xmlns="http://www.w3.org/2000/svg">
<rect width="680" height="383" fill="${c.bg}"/>
<!-- scene counter -->
<text class="num" x="640" y="30" text-anchor="end" font-family="'Bradley Hand','Comic Sans MS',cursive" font-size="13" fill="${c.label}" opacity="0.6">${idx + 1} / ${total}</text>
<!-- accent bar -->
<rect class="bar" x="${textX - 4}" y="152" width="4" height="72" fill="${c.a1}" rx="2"/>
<!-- headline -->
<text class="hl" x="${textX + 8}" y="193" font-family="'Permanent Marker','Bradley Hand',cursive" font-size="36" fill="${c.a1}">${esc(beat.headline)}</text>
<!-- insight (word-wrap via tspan if long) -->
${wrapText(beat.insight || '', textX + 8, 225, 18, c.label, 44)}
<!-- audio-reactive ring around mascot -->
<circle class="ring" cx="${mascotX}" cy="216" r="52" fill="none" stroke="${c.a1}" stroke-width="1.4"/>
<circle class="ring" cx="${mascotX}" cy="216" r="38" fill="none" stroke="${c.ink}" stroke-width="0.8" opacity="0.3"/>
${mascotSVG(mascotX, 204, 26, t, isDark ? c.bg : '#fff', c.ink)}
<!-- small accent dot -->
<circle class="dot" cx="${textX + 8}" cy="152" r="4" fill="${c.a1}"/>
</svg></div></body></html>`;
}

function wrapText(text, x, y, size, fill, charsPerLine) {
  const words = text.split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > charsPerLine && cur) {
      lines.push(cur.trim());
      cur = w;
    } else {
      cur = cur ? cur + ' ' + w : w;
    }
  }
  if (cur) lines.push(cur.trim());
  return lines.map((l, i) =>
    `<text class="ins" x="${x}" y="${y + i * (size + 4)}" font-family="'Bradley Hand','Comic Sans MS',cursive" font-size="${size}" fill="${fill}">${esc(l)}</text>`
  ).join('\n');
}

// ─── Pipeline ─────────────────────────────────────────────────────────────────
async function main() {
  // 1. Video info
  console.log('⬇  fetching video info…');
  const infoRaw = execFileSync('yt-dlp', ['--dump-json', '--no-playlist', url]).toString();
  const info = JSON.parse(infoRaw);
  const { title, duration, uploader } = info;
  const capDur = Math.min(duration, maxSecs);
  console.log(`   "${title}" by ${uploader || 'unknown'} (${Math.round(capDur)}s of ${Math.round(duration)}s)`);

  // 2. Download audio
  const audioPath = path.join(WORK, 'audio.mp3');
  if (!fs.existsSync(audioPath)) {
    console.log('⬇  downloading audio…');
    execFileSync('yt-dlp', [
      '--extract-audio', '--audio-format', 'mp3', '--audio-quality', '5',
      '--match-filter', `duration <= ${Math.max(duration, 1)}`,
      '-o', path.join(WORK, 'audio.%(ext)s'), '--no-playlist', url
    ], { stdio: 'inherit' });
  } else {
    console.log('✔  audio cached');
  }

  // 3. Transcribe
  const transcriptPath = path.join(WORK, 'audio.json');
  if (!fs.existsSync(transcriptPath)) {
    console.log('📝 transcribing with Whisper…');
    execFileSync('python3', [
      '-m', 'whisper', audioPath,
      '--output_format', 'json', '--output_dir', WORK,
      '--model', 'base', '--verbose', 'False'
    ], { stdio: 'inherit' });
  } else {
    console.log('✔  transcript cached');
  }
  const transcript = JSON.parse(fs.readFileSync(transcriptPath));
  const clipped = transcript.segments.filter(s => s.start < capDur);
  const fullText = clipped.map(s => s.text.trim()).join(' ');
  console.log(`   ${fullText.split(' ').length} words transcribed`);

  // 4. Claude: extract beats
  console.log('🧠 extracting beats with Claude…');
  const Anthropic = require('@anthropic-ai/sdk');
  const client = new Anthropic.default();
  const nBeats = beatsForce ? +beatsForce : Math.min(8, Math.max(3, Math.ceil(capDur / 45)));
  const themePick = themeArg || 'neon';   // sensible default for motion graphic feel
  const shapePick = shapeArg || 'c-bean';

  const prompt = `You are extracting content beats from a YouTube video transcript to make a hand-drawn animated explainer video.

Video: "${title}"
Channel: ${uploader || ''}
Duration shown: ${Math.round(capDur)}s
Transcript: ${fullText.slice(0, 6000)}

Extract exactly ${nBeats} beats. Beat 1 is always a title card. The rest are key ideas.

Rules:
- Beat 1 type = "title": headline = short punchy video title (≤7 words), sub = channel name or one-liner hook
- Beat 2+ type = "concept": headline ≤ 5 words (the idea), insight ≤ 20 words (the concrete takeaway)
- Insights should be specific facts or actions, not vague summary
- theme choices: ink flat blueprint chalk riso neon grid marker pastel — pick ONE that fits the video mood and use it for ALL beats
- transition choices: push glide rise wipe reveal burst dissolve diagonal fade — vary them

Return ONLY raw JSON, no markdown:
{"beats":[{"n":1,"type":"title","headline":"…","sub":"…","theme":"${themePick}","transition":"fade"},{"n":2,"type":"concept","headline":"…","insight":"…","theme":"${themePick}","transition":"push"}]}`;

  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }],
  });

  let beatsData;
  try {
    const raw = msg.content[0].text.match(/\{[\s\S]*\}/)[0];
    beatsData = JSON.parse(raw).beats;
  } catch {
    console.error('Claude returned invalid JSON:\n', msg.content[0].text);
    process.exit(1);
  }
  console.log(`   ${beatsData.length} beats ready`);

  // 5. Generate scene HTML files
  console.log('🎨 generating scenes…');
  const sceneDir = path.join(ROOT, 'scenes');
  // Remove old generated scenes (keep story/ scenes safe)
  fs.readdirSync(sceneDir)
    .filter(f => /^scene\d+\.html$/.test(f))
    .forEach(f => fs.unlinkSync(path.join(sceneDir, f)));

  const resolvedTheme = beatsData[0]?.theme || themePick;
  beatsData.forEach((beat, i) => {
    const html = beat.type === 'title'
      ? titleScene(beat, resolvedTheme)
      : conceptScene(beat, resolvedTheme, i, beatsData.length);
    const file = path.join(sceneDir, `scene${i + 1}.html`);
    fs.writeFileSync(file, html);
    console.log(`   scene${i + 1} [${beat.type}] "${beat.headline}"`);

    // Write transition meta for build-reel.sh
    const trans = beat.transition || 'push';
    const metaTag = `<meta name="inkling:transition" content="${trans}">`;
    const content = fs.readFileSync(file, 'utf8');
    if (!content.includes('inkling:transition')) {
      fs.writeFileSync(file, content.replace('<meta charset="utf-8">', `<meta charset="utf-8">\n${metaTag}`));
    }
  });

  // 6. Extract per-frame amplitude
  console.log('🎵 extracting amplitude…');
  const ampPath = path.join(WORK, 'amp.json');
  const ampResult = spawnSync('python3', [path.join(ROOT, 'amp.py'), audioPath, '24'], { encoding: 'utf8' });
  if (ampResult.status === 0 && ampResult.stdout.trim()) {
    fs.writeFileSync(ampPath, ampResult.stdout.trim());
    console.log(`   amplitude ready (${JSON.parse(ampResult.stdout).length} frames)`);
  } else {
    console.warn('   amplitude extraction skipped:', ampResult.stderr?.slice(0, 120));
    fs.writeFileSync(ampPath, '[]');
  }

  // 7. Render scenes (amplitude injected via AMP_FILE env)
  console.log('🎬 rendering…');
  const env = { ...process.env, AMP_FILE: ampPath };
  execSync(`bash "${path.join(ROOT, 'build.sh')}"`, { stdio: 'inherit', cwd: ROOT, env });

  // 8. Mix original audio back in
  const silentMp4 = path.join(ROOT, 'examples', 'demo.mp4');
  const videoDur = beatsData.length * 7; // 7s per scene
  const outName = title.replace(/[^a-z0-9]/gi, '-').slice(0, 40).toLowerCase();
  const outMp4 = path.join(ROOT, 'examples', `yt-${outName}.mp4`);

  console.log('🔊 mixing audio…');
  execSync(
    `ffmpeg -y -i "${silentMp4}" -i "${audioPath}" ` +
    `-t ${videoDur} -c:v copy -c:a aac -b:a 128k -shortest "${outMp4}" -loglevel warning`
  );

  console.log(`\n✅ done → ${outMp4}`);
  console.log(`   theme: ${resolvedTheme} · shape: ${shapePick} · ${beatsData.length} scenes · ~${videoDur}s`);
}

main().catch(e => {
  console.error('yt.js error:', e.message || e);
  process.exit(1);
});
