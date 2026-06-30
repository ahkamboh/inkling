#!/bin/bash
# inkling — frames -> per-scene mp4 -> xfade -> examples/<name>.mp4
set -e
cd "$(dirname "$0")"
ONLY="$1"   # optional: render just one scene number (e.g. `bash build.sh 2`)
FPS=24
SDUR=7      # seconds per scene (matches render.js DUR)
OUT_NAME="${OUT_NAME:-demo}"  # output basename under examples/ (override via env)

# Crossfade seconds. Audio-reactive (YouTube) renders DO use transitions now —
# render.js compensates the --beat lookup for the xfade overlap, so the pulse
# stays in sync with the audio even though the timeline shortens. Override with XF=0
# for hard cuts. Default 0.6 for AMP_FILE renders, 0.5 otherwise.
if [ -n "$AMP_FILE" ]; then XF="${XF:-0.6}"; else XF="${XF:-0.5}"; fi
export XF   # render.js reads this to compensate the amplitude index

OUT="out"; mkdir -p "$OUT" examples

echo ">> rendering frames (puppeteer)"
node render.js $ONLY

# friendly transition name -> ffmpeg xfade type (mirrors SKILL.md §7)
map_tr(){ case "$1" in
  push) echo slideleft;; glide) echo smoothleft;; rise) echo slideup;;
  wipe) echo wiperight;; reveal) echo circleopen;; burst) echo radial;;
  dissolve) echo dissolve;; diagonal) echo diagtl;; fade) echo fade;;
  "") echo dissolve;; *) echo "$1";; esac; }

# scale (no pad bars — themes have different bg colours; 680x383 ≈ 16:9 so the
# ~0.1% stretch to 1920x1080 is invisible and avoids letterbox bars on any theme)
VF="scale=1920:1080,setsar=1,format=yuv420p"

SCENES=(); TR=()
for d in $(ls -d frames/s* | sort); do
  n=$(basename "$d" | tr -dc '0-9')
  echo ">> encoding scene $n"
  ffmpeg -y -loglevel error -framerate $FPS -i "$d/%04d.png" -vf "$VF" -c:v libx264 -crf 18 "$OUT/scene$n.mp4"
  SCENES+=("$OUT/scene$n.mp4")
  # this scene's out-transition (used when cutting TO the next scene)
  tr=$(sed -n 's/.*inkling:transition[^>]*content="\([a-z]*\)".*/\1/p' "scenes/scene$n.html" | head -1)
  TR+=("$(map_tr "$tr")")
done

N=${#SCENES[@]}
FINAL="$OUT/$OUT_NAME.mp4"
if [ "$N" -eq 1 ]; then
  cp "${SCENES[0]}" "$FINAL"
elif [ "$XF" = "0" ]; then
  echo ">> concatenating $N scenes (hard cuts)"
  list="$OUT/concat.txt"; : > "$list"
  for s in "${SCENES[@]}"; do echo "file '$(basename "$s")'" >> "$list"; done
  ffmpeg -y -loglevel error -f concat -safe 0 -i "$list" -c:v libx264 -crf 18 -pix_fmt yuv420p "$FINAL"
else
  # xfade chain — each cut uses the leaving scene's declared transition
  inputs=(); for s in "${SCENES[@]}"; do inputs+=(-i "$s"); done
  fc=""; cur="[0:v]"; acc=$SDUR
  for ((i=1; i<N; i++)); do
    off=$(awk "BEGIN{printf \"%.2f\", $acc - $XF}")
    tr=${TR[$((i-1))]:-dissolve}
    if [ "$i" -eq $((N-1)) ]; then out="[v]"; else out="[x$i]"; fi
    fc="${fc}${cur}[$i:v]xfade=transition=$tr:duration=$XF:offset=$off$out;"
    cur="[x$i]"
    acc=$(awk "BEGIN{printf \"%.2f\", $acc + $SDUR - $XF}")
  done
  fc="${fc%;}"
  echo ">> stitching $N scenes with transitions: ${TR[*]}"
  ffmpeg -y -loglevel error "${inputs[@]}" -filter_complex "$fc" -map "[v]" -r $FPS -c:v libx264 -crf 18 -pix_fmt yuv420p "$FINAL"
fi

cp "$FINAL" "examples/$OUT_NAME.mp4"
echo ">> done"
ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "examples/$OUT_NAME.mp4"
ls -la "examples/$OUT_NAME.mp4"
