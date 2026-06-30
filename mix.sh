#!/bin/bash
# inkling — mux the source YouTube audio back into the rendered explainer.
# Usage:  bash mix.sh <slug>     (the slug printed by yt.js, e.g. youtube/<slug>/)
set -e
cd "$(dirname "$0")"

SLUG="$1"
[ -n "$SLUG" ] || { echo "usage: bash mix.sh <slug>   (see youtube/ for the folder name)"; exit 1; }

AUDIO="youtube/$SLUG/audio.mp3"
SILENT="examples/yt-$SLUG.silent.mp4"   # slug-scoped render — never the shared demo.mp4
OUT="examples/yt-$SLUG.mp4"

[ -f "$SILENT" ] || { echo "$SILENT not found — render this slug first:"; echo "  OUT_NAME=yt-$SLUG.silent AMP_FILE=youtube/$SLUG/amp.json bash build.sh"; exit 1; }
[ -f "$AUDIO" ]  || { echo "$AUDIO not found — run 'node yt.js <url>' first"; exit 1; }

DUR=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$SILENT")

echo ">> mixing audio into $OUT (video ${DUR}s)"
ffmpeg -y -loglevel warning -i "$SILENT" -i "$AUDIO" \
  -t "$DUR" -c:v copy -c:a aac -b:a 128k -shortest "$OUT"

echo ">> done → $OUT"
ls -la "$OUT"
