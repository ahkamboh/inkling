#!/usr/bin/env python3
"""Extract per-frame RMS amplitude from audio for inkling --beat injection."""
import subprocess, json, sys, struct, math

def extract(audio_path, fps=24):
    # Get sample rate via ffprobe
    probe = json.loads(subprocess.check_output([
        'ffprobe', '-v', 'quiet', '-print_format', 'json',
        '-show_streams', audio_path
    ]).decode())
    sr = int(next(s['sample_rate'] for s in probe['streams'] if s.get('codec_type') == 'audio'))
    spf = max(1, sr // fps)  # samples per frame

    # Decode to mono 16-bit PCM
    raw = subprocess.check_output([
        'ffmpeg', '-i', audio_path, '-ac', '1', '-ar', str(sr),
        '-f', 's16le', '-loglevel', 'quiet', 'pipe:1'
    ])
    n = len(raw) // 2
    samples = struct.unpack('<' + 'h' * n, raw)

    # RMS per frame, normalised to [0, 1]
    out = []
    for i in range(0, n, spf):
        chunk = samples[i:i + spf]
        if not chunk:
            break
        rms = math.sqrt(sum(s * s for s in chunk) / len(chunk)) / 32768.0
        out.append(round(min(1.0, rms * 4), 4))  # ×4 headroom boost

    return out

if __name__ == '__main__':
    path = sys.argv[1]
    fps  = int(sys.argv[2]) if len(sys.argv) > 2 else 24
    print(json.dumps(extract(path, fps)))
