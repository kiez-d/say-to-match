#!/usr/bin/env python3
"""Concatenate the per-line narration clips with small silence gaps into
one track, and emit a matching .srt caption file with real cumulative
timestamps (not guessed)."""
import subprocess
import json
import os

ROOT = os.path.dirname(os.path.abspath(__file__))
SEG_DIR = os.path.join(ROOT, "render", "segments")
FFMPEG = os.path.join(ROOT, "..", "tools", "bin", "ffmpeg")
FFPROBE = os.path.join(ROOT, "..", "tools", "bin", "ffprobe")
GAP_SEC = 0.45
# Extra silence (seconds) inserted after specific 0-indexed lines, on
# top of GAP_SEC — used for the ~0.5s breathing pause between the
# intro's explanation (lines 0-3) and the live-demo mechanics (line 4
# onward), so the cut doesn't feel abrupt. Keyed by the 0-indexed line
# AFTER which the extra gap lands (line index 3 = the 4th line, "Here's
# what that actually looks like, running live.").
EXTRA_GAP = {3: 0.5}
# The first N narration lines play over broker/public/intro.html, which
# already displays that same text as large stylized on-screen typography
# (see its .risk-line/.solution-line/.tagline elements). Burning the
# same words in again as bottom-of-frame SRT captions during that
# stretch is redundant clutter, so we skip emitting caption entries for
# them — captions still cover every line once the video cuts to the
# live dashboard, which has no on-screen text of its own. Keep this in
# sync with intro.html's phases if narration.txt's opening changes.
SKIP_CAPTIONS_FOR_FIRST_N_LINES = 4

with open(os.path.join(ROOT, "narration.txt")) as f:
    lines = [l.strip() for l in f if l.strip()]

seg_files = sorted(
    os.path.join(SEG_DIR, f) for f in os.listdir(SEG_DIR) if f.endswith(".wav")
)
assert len(seg_files) == len(lines), f"{len(seg_files)} clips vs {len(lines)} lines"


def duration(path):
    out = subprocess.check_output(
        [FFPROBE, "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path]
    )
    return float(out.strip())


def fmt_ts(t):
    h = int(t // 3600)
    m = int((t % 3600) // 60)
    s = t % 60
    return f"{h:02d}:{m:02d}:{s:06.3f}".replace(".", ",")


def gap_after(i):
    return GAP_SEC + EXTRA_GAP.get(i, 0)


durations = [duration(f) for f in seg_files]
total_gaps = sum(gap_after(i) for i in range(len(durations) - 1))
print("durations:", durations, "total:", sum(durations) + total_gaps)

# Build ffmpeg concat filter: seg1 [silence] seg2 [silence] ...
# A distinct silence clip is generated per unique gap duration (usually
# just the default GAP_SEC, plus one longer clip for any EXTRA_GAP
# boundary) and reused by reference in the concat list.
silence_files = {}
for i in range(len(seg_files) - 1):
    g = gap_after(i)
    if g not in silence_files:
        path = os.path.join(ROOT, "render", f"silence_{str(g).replace('.', '_')}.wav")
        subprocess.run(
            [FFMPEG, "-y", "-f", "lavfi", "-i", "anullsrc=r=22050:cl=mono", "-t", str(g), path],
            check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        )
        silence_files[g] = path

concat_list_path = os.path.join(ROOT, "render", "concat_list.txt")
with open(concat_list_path, "w") as f:
    for i, seg in enumerate(seg_files):
        f.write(f"file '{seg}'\n")
        if i < len(seg_files) - 1:
            f.write(f"file '{silence_files[gap_after(i)]}'\n")

narration_out = os.path.join(ROOT, "render", "narration.wav")
subprocess.run(
    [FFMPEG, "-y", "-f", "concat", "-safe", "0", "-i", concat_list_path, narration_out],
    check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
)
print("wrote", narration_out, "total duration", duration(narration_out))

# Build SRT with real cumulative timestamps
srt_path = os.path.join(ROOT, "render", "captions.srt")
timeline = []  # (start, end, text)
t = 0.0
for i, (line, dur) in enumerate(zip(lines, durations)):
    timeline.append((t, t + dur, line))
    t += dur + gap_after(i)

with open(srt_path, "w") as f:
    cue_num = 1
    for i, (start, end, text) in enumerate(timeline):
        if i < SKIP_CAPTIONS_FOR_FIRST_N_LINES:
            continue
        f.write(f"{cue_num}\n{fmt_ts(start)} --> {fmt_ts(end)}\n{text}\n\n")
        cue_num += 1
print(
    "wrote", srt_path,
    f"(skipped captions for the first {SKIP_CAPTIONS_FOR_FIRST_N_LINES} lines — "
    "they're already shown as on-screen text by intro.html)",
)

# Also emit the per-segment plan (duration + gap) as JSON for the
# Playwright recording script to pace itself against.
plan_path = os.path.join(ROOT, "render", "segment_plan.json")
with open(plan_path, "w") as f:
    json.dump(
        # gap_after() only covers boundaries between clips (0..len-2); the
        # last line has nothing after it in the audio, but we still give
        # it GAP_SEC of trailing hold so the final frame doesn't cut the
        # instant the last word ends.
        [{"index": i + 1, "text": lines[i], "duration": durations[i],
          "gap": gap_after(i) if i < len(lines) - 1 else GAP_SEC}
         for i in range(len(lines))],
        f, indent=2,
    )
print("wrote", plan_path)
