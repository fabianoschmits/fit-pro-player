"""Compare processed music after cancelling the known mono narration."""
import json
from pathlib import Path
import subprocess
import numpy as np

BASE = Path(__file__).resolve().parent
SR = 48000


def decode(path):
    p = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path), '-vn',
                        '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'],
                       capture_output=True, check=True)
    return np.frombuffer(p.stdout, dtype='<f4').copy()


def band(samples, low, high):
    f = np.fft.rfftfreq(len(samples), 1 / SR)
    x = np.fft.rfft(samples)
    x[(f < low) | (f > high)] = 0
    return np.fft.irfft(x, n=len(samples))


mixed = decode(BASE / 'fit-pro-player-3min.mp4')
music = decode(BASE / 'qc/music-only-reference.m4a')
lines = json.loads((BASE / 'narration-meta.json').read_text(encoding='utf-8'))['lines']
cache = {}
checks = []
for start, end in [(4, 6), (20, 22), (39, 41), (72, 74), (91, 93),
                   (119, 121), (142, 144), (158, 160), (174, 176)]:
    lo, hi = round(start * SR), round(end * SR)
    speech = np.zeros(hi - lo)
    for line in lines:
        if line['end'] <= start or line['start'] >= end:
            continue
        if line['id'] not in cache:
            source = decode(BASE / 'composition' / line['path'])
            at = round(line['start'] * 1000) * 48
            voice = band(source, 600, 4000)
            observed = band(mixed[at:at + len(source)], 600, 4000)
            gain = float(np.dot(voice, observed) / np.dot(voice, voice))
            cache[line['id']] = (source, at, gain)
        source, at, gain = cache[line['id']]
        left, right = max(lo, at), min(hi, at + len(source))
        speech[left - lo:right - lo] += source[left - at:right - at] * gain
    residual = band(mixed[lo:hi] - speech, 45, 105)
    reference = band(music[lo:hi], 45, 105)
    corr = float(np.dot(residual, reference) /
                 np.sqrt(np.dot(residual, residual) * np.dot(reference, reference)))
    db = float(20 * np.log10(max(np.sqrt(np.mean(residual ** 2)), 1e-12)))
    item = {'start': start, 'end': end, 'processedMusicBassCorrelation': corr,
            'musicResidualBassRmsDbfs': db, 'present': corr > .70 and db > -60}
    checks.append(item)
    print(json.dumps(item), flush=True)
result = {'ok': all(x['present'] for x in checks), 'method':
          '48kHz exact-ms known-voice cancellation; compare native-FX music bass',
          'checks': checks, 'voiceCancellationGains': {k: v[2] for k, v in cache.items()}}
(BASE / 'qc/music-presence.json').write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
assert result['ok'], 'Music reference mismatch; inspect measured output.'
