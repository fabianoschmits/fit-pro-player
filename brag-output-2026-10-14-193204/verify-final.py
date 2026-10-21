"""Verify the actual delivery encode, not only its composition metadata."""
import json
import re
import subprocess
import sys
from pathlib import Path

import numpy as np

BASE = Path(__file__).resolve().parent
VIDEO = BASE / 'fit-pro-player-3min.mp4'
RAW = BASE / 'fit-pro-player-3min.render.mp4'
SR = 16000


def run(args):
    result = subprocess.run(args, capture_output=True)
    if result.returncode:
        raise RuntimeError(result.stderr.decode('utf-8', errors='replace'))
    return result.stdout


def decode(path):
    return np.frombuffer(run(['ffmpeg', '-v', 'error', '-i', str(path), '-vn',
                              '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-']),
                         dtype='<f4').copy()


def band(samples, low, high):
    spectrum = np.fft.rfft(samples)
    frequencies = np.fft.rfftfreq(len(samples), 1 / SR)
    spectrum[(frequencies < low) | (frequencies > high)] = 0
    return np.fft.irfft(spectrum, n=len(samples))


def correlation(reference, observed):
    denom = np.sqrt(np.dot(reference, reference) * np.dot(observed, observed))
    return float(np.dot(reference, observed) / denom) if denom else 0.0


metadata = json.loads(run(['ffprobe', '-v', 'error', '-show_streams',
                           '-show_format', '-of', 'json', str(VIDEO)]))
v = next(s for s in metadata['streams'] if s['codec_type'] == 'video')
a = next(s for s in metadata['streams'] if s['codec_type'] == 'audio')
assert v['codec_name'] == 'h264' and (v['width'], v['height']) == (1080, 1920)
assert v['r_frame_rate'] == '30/1' and int(v['nb_frames']) == 5400
assert abs(float(metadata['format']['duration']) - 180) < .001
assert a['codec_name'] == 'aac' and int(a['channels']) == 2
assert int(a['sample_rate']) == 48000
run(['ffmpeg', '-v', 'error', '-xerror', '-i', str(VIDEO), '-f', 'null', '-'])
print('PASS: complete decode, 180 seconds, 5400 frames, 1080x1920, H.264/AAC.', flush=True)

mixed = decode(VIDEO)
voice = json.loads((BASE / 'narration-meta.json').read_text(encoding='utf-8'))
checks = []
assert len(voice['lines']) == 82
for line in voice['lines']:
    expected = decode(BASE / 'composition' / line['path'])
    ref = band(expected, 600, 4000)
    start = round(line['start'] * SR)
    best = (-1, None)
    # The render mixer rounds adelay to milliseconds. Search every audio sample
    # inside one millisecond, not only coarse 1/2/5/10/20 ms steps.
    for shift in sorted(range(-16, 17), key=abs):
        lo = start + shift
        if lo < 0:
            continue
        observed = mixed[lo:lo + len(expected)]
        if len(observed) != len(expected):
            continue
        score = correlation(ref, band(observed, 600, 4000))
        if score > best[0]:
            best = (score, shift / SR)
        if score > .995:
            break
    check = {'id': line['id'], 'start': line['start'], 'duration': line['duration'],
             'vocalBandCorrelation': round(best[0], 6), 'bestOffsetSeconds': best[1],
             'present': best[0] > .85}
    checks.append(check)
    print(json.dumps(check), flush=True)
    assert check['present'], f"Voice absent or misaligned: {line['id']}"

# The approved time-varying EQ changes phase. The bed is mostly mono, so a
# stereo-side comparison also cannot establish its audible level. Cancel the
# exact known voices at 48kHz, then compare the native-FX music reference.
print(run([sys.executable, str(BASE / 'diagnose-music.py')]).decode(), flush=True)
music_proof = json.loads((BASE / 'qc/music-presence.json').read_text(encoding='utf-8'))
assert music_proof['ok']
music_checks = music_proof['checks']


def audio_hash(path):
    return run(['ffmpeg', '-v', 'error', '-i', str(path), '-map', '0:a:0',
                '-c', 'copy', '-f', 'hash', '-hash', 'sha256', '-']).decode().strip()


original_hash = audio_hash(RAW)
final_hash = audio_hash(VIDEO)
assert original_hash == final_hash, 'Poster processing changed the audio.'


def stamp(value):
    h, m, s, ms = map(int, re.split(r'[:,]', value))
    return 3600 * h + 60 * m + s + ms / 1000


blocks = (BASE / 'fit-pro-player-3min.srt').read_text(encoding='utf-8').strip().split('\n\n')
assert len(blocks) == 82
for index, (block, line) in enumerate(zip(blocks, voice['lines']), 1):
    rows = block.splitlines()
    assert rows[0] == str(index)
    start, end = rows[1].split(' --> ')
    assert abs(stamp(start) - line['start']) <= .001
    assert abs(stamp(end) - line['end']) <= .001
    assert ' '.join(rows[2:]) == line['text']

result = {'ok': True, 'durationSeconds': 180, 'frames': 5400, 'width': 1080,
          'height': 1920, 'fps': '30/1', 'videoCodec': v['codec_name'],
          'audioCodec': a['codec_name'], 'sampleRate': a['sample_rate'],
          'channels': a['channels'], 'sizeBytes': int(metadata['format']['size']),
          'decodePassed': True, 'voiceSegments': checks, 'musicPresence': music_checks,
          'srtCues': len(blocks), 'srtMatchesMeasuredVoice': True,
          'audioPreservedByPoster': True, 'audioPacketHash': final_hash}
(BASE / 'qc/final-verification.json').write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
print('PASS: all 82 voices, music across nine sections, SRT timing, copied audio.', flush=True)
