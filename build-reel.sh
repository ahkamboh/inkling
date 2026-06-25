#!/bin/bash
# inkling — render a 10-scene reel in one theme with premium varied transitions.
# Usage: bash build-reel.sh <theme>
set -e
cd "$(dirname "$0")"
THEME="${1:-ink}"
FPS=24; SDUR=2.8; XF=0.7
mkdir -p out examples

echo ">> rendering reel frames ($THEME)"
node render-reel.js "$THEME"

PAD="scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,format=yuv420p"
# premium, varied transitions (cycled across cuts)
TR=(smoothleft circleopen slideup wiperight diagtl radial smoothup slidedown circleclose)

SCENES=()
for d in $(ls -d frames/reel/$THEME/s* | sort); do
  n=$(basename "$d" | tr -dc '0-9')
  ffmpeg -y -loglevel error -framerate $FPS -i "$d/%04d.png" -vf "$PAD" -c:v libx264 -crf 18 "out/r-$THEME-$n.mp4"
  SCENES+=("out/r-$THEME-$n.mp4")
done

inputs=(); for s in "${SCENES[@]}"; do inputs+=(-i "$s"); done
N=${#SCENES[@]}; fc=""; cur="[0:v]"; acc=$SDUR
for ((i=1; i<N; i++)); do
  off=$(awk "BEGIN{printf \"%.2f\", $acc - $XF}")
  tr=${TR[$(( (i-1) % ${#TR[@]} ))]}
  if [ "$i" -eq $((N-1)) ]; then out="[v]"; else out="[x$i]"; fi
  fc="${fc}${cur}[$i:v]xfade=transition=$tr:duration=$XF:offset=$off$out;"
  cur="[x$i]"
  acc=$(awk "BEGIN{printf \"%.2f\", $acc + $SDUR - $XF}")
done
fc="${fc%;}"
echo ">> stitching $N scenes with premium transitions"
ffmpeg -y -loglevel error "${inputs[@]}" -filter_complex "$fc" -map "[v]" -r $FPS -c:v libx264 -crf 18 -pix_fmt yuv420p "examples/reel-$THEME.mp4"

# bigger gif for the README (640px)
ffmpeg -y -loglevel error -i "examples/reel-$THEME.mp4" -filter_complex "fps=12,scale=640:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=2" "examples/reel-$THEME.gif"
echo ">> done $THEME"
ls -la "examples/reel-$THEME.mp4" "examples/reel-$THEME.gif"
