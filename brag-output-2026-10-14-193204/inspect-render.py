"""Extract actual delivered frames for visual review and poster verification."""
from concurrent.futures import ThreadPoolExecutor
import json
from pathlib import Path
import subprocess

import numpy as np
from PIL import Image, ImageDraw

BASE = Path(__file__).resolve().parent
VIDEO = BASE / 'fit-pro-player-3min.mp4'
OUT = BASE / 'qc/delivery-stills'
OUT.mkdir(parents=True, exist_ok=True)
TIMES = [2.5, 7.5, 13.5, 22, 29.5, 35.5, 43.5, 49.5, 57.5, 65, 71.5,
         79, 88, 97, 106, 115, 125, 131, 139, 147, 156, 166, 176, 179.7]


def extract(item):
    index, time = item
    path = OUT / f'{index + 1:02d}-at-{time:06.1f}s.png'
    if path.exists() and path.stat().st_mtime >= VIDEO.stat().st_mtime:
        return path
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', str(time), '-i',
                    str(VIDEO), '-frames:v', '1', str(path)], check=True)
    return path


with ThreadPoolExecutor(max_workers=3) as pool:
    files = list(pool.map(extract, enumerate(TIMES)))
for n in range(3):
    sheet = Image.new('RGB', (4 * 270, 2 * 510), (16, 25, 26))
    draw = ImageDraw.Draw(sheet)
    for k, path in enumerate(files[n * 8:(n + 1) * 8]):
        frame = Image.open(path).convert('RGB')
        frame.thumbnail((270, 480))
        x, y = (k % 4) * 270, (k // 4) * 510
        sheet.paste(frame, (x, y))
        draw.text((x + 8, y + 486), path.stem, fill='white')
    target = OUT / f'contact-{n + 1}.jpg'
    sheet.save(target, quality=93)
    print(target, flush=True)

first = OUT / 'frame-zero.png'
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(VIDEO), '-frames:v',
                '1', str(first)], check=True)
# Compare with the same media decoder. Pillow's JPEG YCbCr-to-RGB conversion
# is not identical to FFmpeg's conversion used by the video pipeline.
poster_reference = BASE / 'qc/poster-decoded.png'
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i',
                str(BASE / 'fit-pro-player-3min.jpg'), '-frames:v', '1',
                str(poster_reference)], check=True)
poster = np.asarray(Image.open(poster_reference).convert('RGB'), dtype=float)
actual = np.asarray(Image.open(first).convert('RGB'), dtype=float)
assert actual.shape == poster.shape == (1920, 1080, 3)
mean_error = float(np.mean(np.abs(poster - actual)))
assert mean_error < 3, f'Frame zero does not match poster: mean error {mean_error}'
result = {'actualMp4FramesExtracted': len(files), 'times': TIMES,
          'posterFrameZeroVerified': True, 'posterMeanAbsoluteRgbError': mean_error,
          'posterReferenceDecoder': 'FFmpeg, same as delivery pipeline'}
(BASE / 'qc/delivery-image-proof.json').write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
print(f'PASS: 24 actual MP4 frames; frame-zero poster error {mean_error:.4f}/255.', flush=True)
