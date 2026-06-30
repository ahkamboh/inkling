#!/bin/bash
# inkling — frames -> per-scene mp4 -> crossfade -> examples/<name>.mp4
set -e
cd "$(dirname "$0")"
ONLY="$1"   # optional: render just one scene number (e.g. `bash build.sh 2`)
FPS=24
SDUR=7      # seconds per scene (matches render.js DUR)
XF="${XF:-0.5}"             # crossfade seconds (override via env, XF=0 → hard cuts)
OUT_NAME="${OUT_NAME:-demo}"  # output basename under examples/ (override via env)

# Audio-reactive (YouTube) renders bake the --beat pulse per frame, so the video
# timeline MUST equal the audio timeline. The crossfade overlaps scenes and would
# shorten the video by (N-1)*XF, drifting the pulses ahead of the audio. So when
# AMP_FILE is set we force hard cuts (XF=0) → video length == N*SDUR, frame-exact.
if [ -n "$AMP_FILE" ]; then XF=0; fi

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
FINAL="$OUT/$OUT_NAME.mp4"
if [ "$N" -eq 1 ]; then
  cp "${SCENES[0]}" "$FINAL"
elif [ "$XF" = "0" ]; then
  # Hard cuts: straight concat. Total = sum of scenes (frame-exact for audio sync).
  echo ">> concatenating $N scenes (no crossfade)"
  list="$OUT/concat.txt"; : > "$list"
  for s in "${SCENES[@]}"; do echo "file '$(basename "$s")'" >> "$list"; done
  ffmpeg -y -loglevel error -f concat -safe 0 -i "$list" -c:v libx264 -crf 18 -pix_fmt yuv420p "$FINAL"
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
  ffmpeg -y -loglevel error "${inputs[@]}" -filter_complex "$fc" -map "[v]" -r $FPS -c:v libx264 -crf 18 -pix_fmt yuv420p "$FINAL"
fi

cp "$FINAL" "examples/$OUT_NAME.mp4"
echo ">> done"
ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "examples/$OUT_NAME.mp4"
ls -la "examples/$OUT_NAME.mp4"
