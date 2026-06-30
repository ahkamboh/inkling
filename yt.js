#!/usr/bin/env node
// yt.js — prep a YouTube video for an inkling explainer.
//
// This does ONLY the deterministic, mechanical work — no AI, no API key:
//   1. yt-dlp downloads the audio
//   2. Whisper transcribes it
//   3. amp.py extracts per-frame audio amplitude (for the audio-reactive --beat)
//   4. writes everything to youtube/<slug>/ + a brief.md
//
// Then YOUR agent (Claude Code, Cursor, Codex — whatever you're in) reads the
// brief, authors the scenes per SKILL.md, renders, and mixes the audio.
// The agent IS the brain. inkling stays "paste into any agent, no API key".
//
// Usage:
//   node yt.js <url>
//   node yt.js <url> --max 120        # only use the first 2 min of the video
//   node yt.js <url> --theme neon     # hint: author in this theme
//   node yt.js <url> --shape c-ghost  # hint: use this mascot shape
//   node yt.js <url> --beats 6        # hint: aim for N scenes
//
// Requires: yt-dlp, ffmpeg, python3 (with openai-whisper).  NO API key.

'use strict';
const { execFileSync, spawnSync } = require('child_process');
const fs   = require('fs');
const path = require('path');

const ROOT = __dirname;

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
const maxSecs   = +(flag('max', 300));      // default cap: 5 min of source
const themeHint = flag('theme', null);
const shapeHint = flag('shape', null);
const beatsHint = flag('beats', null);

const slugify = s => (s || 'video').replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 48).toLowerCase();

// YouTube keeps breaking the default player clients (SABR / 403). This client
// list falls back through the ones that still serve plain audio URLs. Override
// with YT_DLP_CLIENT=… if your video needs a different one.
const YT_CLIENTS = process.env.YT_DLP_CLIENT || 'tvhtml5,web_safari,web,android';
const YT_EXTRA = ['--extractor-args', `youtube:player_client=${YT_CLIENTS}`];

// ─── 1. Video info ───────────────────────────────────────────────────────────
console.log('⬇  fetching video info…');
let info;
try {
  info = JSON.parse(execFileSync('yt-dlp', ['--dump-json', '--no-playlist', ...YT_EXTRA, url]).toString());
} catch (e) {
  console.error('yt-dlp failed — is it installed? (brew install yt-dlp)\n', e.message);
  process.exit(1);
}
const title    = info.title || 'video';
const uploader = info.uploader || info.channel || '';
const duration = info.duration || 0;
const slug     = slugify(title);
const capDur   = Math.min(duration || maxSecs, maxSecs);

const DIR = path.join(ROOT, 'youtube', slug);
fs.mkdirSync(DIR, { recursive: true });
console.log(`   "${title}" — ${uploader} (${Math.round(duration)}s, using first ${Math.round(capDur)}s)`);

// ─── 2. Audio (trim to --max so transcribe/amplitude/mix all respect it) ─────
const audioPath = path.join(DIR, 'audio.mp3');
const needTrim  = duration && capDur < duration - 1;
if (fs.existsSync(audioPath)) {
  console.log('✔  audio cached');
} else {
  const full = path.join(DIR, 'audio.full.mp3');
  const dlBase = needTrim ? 'audio.full.%(ext)s' : 'audio.%(ext)s';
  if (!(needTrim && fs.existsSync(full))) {
    console.log('⬇  downloading audio…');
    execFileSync('yt-dlp', [
      '--extract-audio', '--audio-format', 'mp3', '--audio-quality', '5',
      '-o', path.join(DIR, dlBase), '--no-playlist', ...YT_EXTRA, url,
    ], { stdio: 'inherit' });
  }
  if (needTrim) {
    console.log(`✂  trimming to first ${Math.round(capDur)}s…`);
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', full, '-t', String(capDur), '-c', 'copy', audioPath]);
  }
}

// ─── 3. Transcribe (local Whisper, no API) ───────────────────────────────────
const whisperJson = path.join(DIR, 'audio.json');
if (fs.existsSync(whisperJson)) {
  console.log('✔  transcript cached');
} else {
  console.log('📝 transcribing with local Whisper (base model)…');
  const w = spawnSync('python3', [
    '-m', 'whisper', audioPath,
    '--output_format', 'json', '--output_dir', DIR,
    '--model', 'base', '--verbose', 'False',
  ], { stdio: 'inherit' });
  if (w.status !== 0) {
    console.error('Whisper failed — install it: pip install -U openai-whisper');
    process.exit(1);
  }
}
const transcript = JSON.parse(fs.readFileSync(whisperJson, 'utf8'));
const clipped  = (transcript.segments || []).filter(s => s.start < capDur);
const fullText = clipped.map(s => s.text.trim()).join(' ').trim();
fs.writeFileSync(path.join(DIR, 'transcript.txt'), fullText);
fs.writeFileSync(path.join(DIR, 'segments.json'), JSON.stringify(clipped, null, 2));
console.log(`   ${fullText.split(/\s+/).filter(Boolean).length} words → transcript.txt`);

// ─── 4. Amplitude (for the audio-reactive --beat) ────────────────────────────
console.log('🎵 extracting amplitude…');
const ampPath = path.join(DIR, 'amp.json');
const amp = spawnSync('python3', [path.join(ROOT, 'amp.py'), audioPath, '24'], { encoding: 'utf8' });
if (amp.status === 0 && amp.stdout.trim()) {
  fs.writeFileSync(ampPath, amp.stdout.trim());
  console.log(`   amplitude ready → amp.json (${JSON.parse(amp.stdout).length} frames @ 24fps)`);
} else {
  fs.writeFileSync(ampPath, '[]');
  console.warn('   amplitude skipped (optional):', (amp.stderr || '').slice(0, 120));
}

// ─── 5. Brief for the agent ──────────────────────────────────────────────────
const suggestedBeats = beatsHint || Math.min(8, Math.max(3, Math.ceil(capDur / 45)));
const hints = [
  themeHint ? `- **Theme:** \`${themeHint}\` (the user asked for this one — use it for every scene).`
            : `- **Theme:** pick ONE that fits the video's mood (ink·flat·blueprint·chalk·riso·neon·grid·marker·pastel) and use it for every scene.`,
  shapeHint ? `- **Mascot shape:** \`${shapeHint}\`.` : `- **Mascot shape:** pick one from STYLES.md that fits.`,
  `- **Scenes:** aim for **${suggestedBeats}** (scene 1 = title card, the rest = key ideas). 4–8 is the sweet spot.`,
].join('\n');

const rel = p => path.relative(ROOT, p);
const ampRel = rel(ampPath);
const brief = `# inkling brief — "${title}"

**Source:** ${url}
**Channel:** ${uploader}
**Length used:** first ${Math.round(capDur)}s of ${Math.round(duration)}s

## What to do (you are the agent — do the authoring yourself)

1. **Read** \`SKILL.md\` and \`STYLES.md\` if you haven't.
2. **Clear the shipped demo scenes** so they don't leak into your video:
   \`\`\`bash
   rm -f scenes/scene*.html
   \`\`\`
3. **Digest** the transcript below into **${suggestedBeats}** beats (scene 1 = title card,
   the rest = one key idea each). Don't summarise evenly — pick the moments worth drawing.
4. **Author** each beat as \`scenes/scene1.html … scene${suggestedBeats}.html\` per SKILL.md
   (mascot *performs* the idea, 7-beat motion, hand-drawn texture, sparse labels,
   \`data-theme\` set on the stage). Number them sequentially from 1.
   - For the **audio-reactive** pulse, drive any transform from \`var(--beat, 0)\` — e.g.
     \`transform: scale(calc(1 + var(--beat,0) * 0.4))\`. inkling injects \`--beat\` (0→1,
     the live audio amplitude) onto \`:root\` every frame during the YouTube render.
   - YouTube renders use **clean cuts** (no crossfade) so the pulse stays exactly in sync
     with the audio — you don't need \`<meta inkling:transition>\` here.
5. **Render with the audio reacting** (\`OUT_NAME\` keeps it slug-scoped; \`AMP_FILE\` drives
   the pulse and forces clean cuts):
   \`\`\`bash
   OUT_NAME=yt-${slug}.silent AMP_FILE=${ampRel} bash build.sh
   \`\`\`
6. **Mix the original audio back in:**
   \`\`\`bash
   bash mix.sh ${slug}
   \`\`\`
   → \`examples/yt-${slug}.mp4\`

## Hints
${hints}

## Transcript (first ${Math.round(capDur)}s)

${fullText || '_(no speech detected — base the scenes on the title + channel)_'}
`;
fs.writeFileSync(path.join(DIR, 'brief.md'), brief);

// ─── Done — tell the agent what's next ───────────────────────────────────────
console.log(`\n✅ prep done → ${rel(DIR)}/`);
console.log(`   transcript.txt · segments.json · amp.json · audio.mp3 · brief.md`);
console.log(`\nNext (the agent does this — no API key needed):`);
console.log(`   1. read ${rel(path.join(DIR, 'brief.md'))}`);
console.log(`   2. rm -f scenes/scene*.html   (clear the demo scenes)`);
console.log(`   3. author ${suggestedBeats} scenes/scene1..${suggestedBeats}.html per SKILL.md`);
console.log(`   4. OUT_NAME=yt-${slug}.silent AMP_FILE=${ampRel} bash build.sh`);
console.log(`   5. bash mix.sh ${slug}        → examples/yt-${slug}.mp4\n`);
