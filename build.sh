#!/bin/bash
# inkling — frames -> per-scene mp4 -> crossfade -> examples/demo.mp4
set -e
cd "$(dirname "$0")"
ONLY="$1"   # optional: render just one scene number (e.g. `bash build.sh 2`)
FPS=24
SDUR=7      # seconds per scene (matches render.js DUR)
XF=0.5      # crossfade seconds
OUT="out"; mkdir -p "$OUT" examples

echo ">> rendering frames (puppeteer)"
node render.js $ONLY

PAD="scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=white,format=yuv420p"

SCENES=()
for d in $(ls -d frames/s* | sort); do
  n=$(basename "$d" | tr -dc '0-9')
  echo ">> encoding scene $n"
  ffmpeg -y -loglevel error -framerate $FPS -i "$d/%04d.png" -vf "$PAD" -c:v libx264 -crf 18 "$OUT/scene$n.mp4"
  SCENES+=("$OUT/scene$n.mp4")
done

N=${#SCENES[@]}
if [ "$N" -eq 1 ]; then
  cp "${SCENES[0]}" "$OUT/demo.mp4"
else
  # build an xfade chain for any number of scenes
  inputs=(); for s in "${SCENES[@]}"; do inputs+=(-i "$s"); done
  fc=""; cur="[0:v]"; acc=$SDUR
  for ((i=1; i<N; i++)); do
    off=$(awk "BEGIN{printf \"%.2f\", $acc - $XF}")
    if [ "$i" -eq $((N-1)) ]; then out="[v]"; else out="[x$i]"; fi
    fc="${fc}${cur}[$i:v]xfade=transition=fade:duration=$XF:offset=$off$out;"
    cur="[x$i]"
    acc=$(awk "BEGIN{printf \"%.2f\", $acc + $SDUR - $XF}")
  done
  fc="${fc%;}"
  echo ">> crossfading $N scenes"
  ffmpeg -y -loglevel error "${inputs[@]}" -filter_complex "$fc" -map "[v]" -r $FPS -c:v libx264 -crf 18 -pix_fmt yuv420p "$OUT/demo.mp4"
fi

cp "$OUT/demo.mp4" examples/demo.mp4
echo ">> done"
ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 examples/demo.mp4
ls -la examples/demo.mp4
