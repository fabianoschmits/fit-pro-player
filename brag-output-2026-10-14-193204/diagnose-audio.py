"""Inspect sub-millisecond placement, retaining every measured result."""
import json
from pathlib import Path
import subprocess
import numpy as np

BASE = Path(__file__).resolve().parent
SR = 16000


def decode(path):
    result = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path), '-vn',
                             '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'],
                            check=True, capture_output=True)
    return np.frombuffer(result.stdout, dtype='<f4').copy()


def band(samples):
    spectrum = np.fft.rfft(samples)
    frequencies = np.fft.rfftfreq(len(samples), 1 / SR)
    spectrum[(frequencies < 600) | (frequencies > 4000)] = 0
    return np.fft.irfft(spectrum, n=len(samples))


mixed = decode(BASE / 'fit-pro-player-3min.mp4')
meta = json.loads((BASE / 'narration-meta.json').read_text(encoding='utf-8'))
for line in meta['lines'][:8]:
    source = band(decode(BASE / 'composition' / line['path']))
    start = round(line['start'] * SR)
    best = (-1, None)
    for shift in range(-32, 33):
        clip = band(mixed[start + shift:start + shift + len(source)])
        score = float(np.dot(source, clip) / np.sqrt(np.dot(source, source) * np.dot(clip, clip)))
        if score > best[0]:
            best = (score, shift / SR)
    print(json.dumps({'id': line['id'], 'correlation': best[0],
                      'offsetSeconds': best[1],
                      'roundToMsErrorSeconds': round(line['start'] * 1000) / 1000 - line['start']}), flush=True)
