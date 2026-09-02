#!/usr/bin/env bash
# Regenerates demo/render/wli-demo.mp4 from an already-recorded
# demo/render/dashboard-capture.webm (see demo/record.mjs) plus the
# narration/captions built by demo/build_audio.py.
#
# On a normal machine with real system fonts this FONTCONFIG_FILE line
# is unnecessary and harmless to skip. It's only needed in dev
# containers with no font infrastructure at all — see PROGRESS.md.
set -euo pipefail
cd "$(dirname "$0")/.."

export FONTCONFIG_FILE="${FONTCONFIG_FILE:-$HOME/.local/playwright-libs/fonts.conf}"
FFMPEG=tools/bin/ffmpeg
[ -x "$FFMPEG" ] || FFMPEG=ffmpeg

"$FFMPEG" -y \
  -i demo/render/dashboard-capture.webm \
  -i demo/render/narration.wav \
  -filter_complex "[0:v]subtitles=demo/render/captions.srt:force_style='FontName=Liberation Sans,FontSize=15,Bold=1,PrimaryColour=&H00FFFFFF,OutlineColour=&H80000000,BorderStyle=3,Outline=1,Shadow=0,MarginV=36'[v]" \
  -map "[v]" -map 1:a \
  -c:v libx264 -pix_fmt yuv420p -crf 20 -preset veryfast \
  -c:a aac -b:a 160k \
  -shortest \
  demo/render/wli-demo.mp4

echo "Wrote demo/render/wli-demo.mp4"
