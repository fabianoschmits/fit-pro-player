"""Original 180-second, 128 BPM instrumental score for Fit Pro Player.

Run from the repository: python -B brag-output-2026-10-14-193204/music.py
Reuses only the procedural instruments in brag-output/one-minute/music.py.
The earlier generator and its output are never changed or executed.
All generated artifacts are confined to composition/assets/music beside this file.
Requires NumPy and ffmpeg/ffprobe; no downloads, samples, credentials or vocals.
"""

from __future__ import annotations

import argparse
import collections
import gc
import hashlib
import importlib.util
import json
import math
import re
import shutil
import subprocess
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT.parent / "brag-output" / "one-minute" / "music.py"
OUT = ROOT / "composition" / "assets" / "music"
SR, BPM, BARS = 48_000, 128, 96
BEAT = 60.0 / BPM
BAR = 4 * BEAT
BEATS = BARS * 4
DURATION = BEATS * BEAT
FRAMES = round(DURATION * SR)
SEED = 1281801014
sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location("fitpro_original_instruments", SOURCE)
engine = importlib.util.module_from_spec(spec)
spec.loader.exec_module(engine)
# Imported functions resolve these globals in their original module. Redirect
# the length/output explicitly before calling any synthesizer, never main().
engine.FRAMES, engine.BEATS, engine.DURATION, engine.OUT = FRAMES, BEATS, DURATION, OUT
engine.RNG = np.random.default_rng(SEED)
seconds, db, synth = engine.seconds, engine.db, engine.synth

# The requested editorial boundaries and the nearest complete bar boundaries
# are both retained. Musical sections do not change tempo to meet a cut.
SECTIONS = [
    ("intro", 0, 6, 0, 12, "Rapid layer entry: kick, hats, clap, bass, soft stabs"),
    ("explanation", 6, 35, 12, 66, "Steady groove; three bass patterns, chord inversions and sparse answers"),
    ("change", 35, 46, 66, 86, "Real kick/bass withdrawal, suspended pads, half-time pulse, measured rebuild"),
    ("body", 46, 59, 86, 111, "Full groove returns; Bm7/C#m7 extension and syncopated bass"),
    ("variation", 59, 81, 111, 151, "New progression, alternate bass, stripped bridge, renewed percussion"),
    ("professional", 81, 91, 151, 171, "Restrained percussion, sustained harmony, rounded response"),
    ("closing", 91, 96, 171, 180, "Tonic resolution, instruments withdraw, final hit and fading room tail"),
]
CHORDS = {
    "F#m9": (30, [54, 57, 61, 68]), "Dmaj7": (38, [54, 57, 61, 62]),
    "Aadd9": (33, [52, 57, 59, 61]), "Eadd9": (28, [52, 56, 59, 66]),
    "Bm7": (35, [54, 57, 59, 62]), "C#m7": (37, [52, 56, 59, 61]),
    "F#m11": (30, [54, 57, 59, 64]), "D6": (38, [54, 57, 59, 62]),
}
PATTERNS = {
    "A": [(0, 0, .40), (.5, 0, .38), (1.5, 12, .27), (2, 0, .42), (2.5, 0, .35), (3.5, 0, .38)],
    "B": [(.5, 0, .43), (1.25, 0, .22), (1.75, 7, .20), (2.5, 0, .41), (3.25, 12, .23), (3.75, 0, .18)],
    "C": [(0, 0, .43), (.75, 0, .20), (1.5, 7, .36), (2.25, 0, .21), (2.75, 0, .34), (3.5, 12, .32)],
    "D": [(.5, 0, .42), (1.5, 0, .43), (2.5, 0, .44), (3.25, 7, .22), (3.5, 0, .34)],
    "sparse": [(.5, 0, .50), (2.5, 0, .53)],
}


def report(text: str) -> None:
    print(text, flush=True)


def write_json(name: str, value: object) -> None:
    (OUT / name).write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def run(args: list[str], log: str) -> subprocess.CompletedProcess:
    result = subprocess.run(args, capture_output=True, text=True, encoding="utf-8", errors="replace")
    (OUT / log).write_text(result.stdout + result.stderr, encoding="utf-8")
    if result.returncode:
        raise RuntimeError(f"Command failed: {args}\n{result.stderr}")
    return result


def section_of(bar: int) -> str:
    return next(name for name, start, end, *_ in SECTIONS if start <= bar < end)


def harmony(bar: int) -> tuple[str, int, list[int]]:
    if bar < 35:
        progression = ["F#m9", "Dmaj7", "Aadd9", "Eadd9"]
        index = max(0, bar - 6) // 2 % 4
        if 30 <= bar < 35:
            progression, index = ["Bm7", "Dmaj7", "Eadd9"], (bar - 30) // 2
    elif bar < 46:
        progression = ["Dmaj7", "Bm7", "Aadd9", "Eadd9", "Eadd9", "F#m9"]
        index = min((bar - 35) // 2, 5)
    elif bar < 59:
        progression = ["F#m9", "Dmaj7", "Bm7", "C#m7", "Aadd9", "Eadd9", "F#m9"]
        index = (bar - 46) // 2
    elif bar < 81:
        progression = ["Dmaj7", "Aadd9", "Eadd9", "F#m9", "Bm7", "Dmaj7", "C#m7", "Eadd9"]
        index = (bar - 59) // 2 % 8
    elif bar < 91:
        progression = ["F#m11", "D6", "Bm7", "Eadd9", "F#m9"]
        index = (bar - 81) // 2
    else:
        progression, index = ["F#m9"], 0
    name = progression[index]
    root, notes = CHORDS[name]
    notes = list(notes)
    if 14 <= bar < 22 or 67 <= bar < 75:
        notes = notes[1:] + [notes[0] + 12]
    return name, root, notes


def dark_room(signal: np.ndarray) -> np.ndarray:
    """Overlap-add convolution with original procedural room IR, bounded RAM."""
    wet = np.zeros_like(signal)
    length, block, fft_size = round(1.4 * SR), 32768, 131072
    t = np.arange(length, dtype=np.float64) / SR
    for channel in range(2):
        rng = np.random.default_rng(SEED + 600 + channel)
        ir = engine.shape_spectrum(rng.normal(0, 1, length), 400, 5000, 2)
        ir *= np.exp(-t / .30) * np.clip((t - .025) / .03, 0, 1)
        ir *= .61 / max(float(np.sqrt(np.sum(ir * ir))), 1e-9)
        for delay, gain in [(.027, .24), (.041, .18), (.063, .14), (.089, .09)]:
            ir[round((delay + channel * .0027) * SR)] += gain
        transfer = np.fft.rfft(ir, n=fft_size)
        for start in range(0, FRAMES, block):
            dry = signal[start:start + block, channel]
            clip = np.fft.irfft(np.fft.rfft(dry, n=fft_size) * transfer, n=fft_size)
            count = min(len(dry) + length - 1, FRAMES - start)
            wet[start:start + count, channel] += clip[:count].astype(np.float32)
    return wet


def arrange() -> tuple[np.ndarray, dict]:
    report("Synthesizing 96 bars with seven sections and event-based variation...")
    buses = {name: np.zeros((FRAMES, 2), dtype=np.float32)
             for name in ["drums", "bass", "chords", "pads", "arp", "lead", "fx"]}
    events, bar_map, kicks = [], [], []

    def event(bus, sound, beat, gain, pan=0, kind=None, midi=None):
        engine.add(buses[bus], sound, beat, gain, pan)
        entry = {"bus": bus, "kind": kind or bus, "beat": round(float(beat), 6),
                 "timeSeconds": round(seconds(float(beat)), 6),
                 "durationSeconds": len(sound) / SR, "gain": round(float(gain), 6)}
        if midi is not None:
            entry["midi"] = midi
        events.append(entry)

    kick = engine.kick() * .65
    claps = [engine.clap(SEED + 20 + i) for i in range(6)]
    hats = [engine.hat(False, SEED + 40 + i) for i in range(6)]
    opens = [engine.hat(True, SEED + 60 + i) for i in range(4)]
    shakers = [engine.shaker(SEED + 80 + i) for i in range(6)]
    for bar in range(BARS):
        start = bar * 4
        section = section_of(bar)
        chord_name, root, notes = harmony(bar)
        change = section == "change"
        bridge = 63 <= bar < 67
        professional = section == "professional"
        closing = section == "closing"
        full = section in ["explanation", "body", "variation"] and not bridge
        pattern_name = ("A" if bar < 14 else "B" if bar < 22 else "C" if bar < 30
                        else "D" if bar < 35 else "sparse" if bar < 46
                        else "B" if bar < 59 else "D" if bar < 63
                        else "sparse" if bridge else "C" if bar < 75
                        else "B" if bar < 81 else "A" if professional else "sparse")
        brightness = (.55 if bar < 6 else .72 if bar < 35 else .48 if change
                      else .92 if bar < 59 else .63 if bridge else 1.02 if bar < 81
                      else .63 if professional else .48)
        bar_map.append({"bar": bar + 1, "startSeconds": seconds(start), "section": section,
                        "chord": chord_name, "voicingMidi": notes, "bassPattern": pattern_name,
                        "brightness": brightness, "bridge": bridge})

        kick_positions = list(range(4))
        if 35 <= bar < 39:
            kick_positions = []
        elif 39 <= bar < 43:
            kick_positions = [0, 2]
        elif bar == 45:
            kick_positions = [0, 1, 2]
        elif bridge:
            kick_positions = [0, 2]
        elif bar == 93:
            kick_positions = [0, 1, 2]
        elif bar == 94:
            kick_positions = [0]
        elif bar == 95:
            kick_positions = []
        for position in kick_positions:
            gain = .91 if full else .75 if professional else .69
            if change:
                gain = .52 + .035 * (bar - 39)
            event("drums", kick, start + position, gain, kind="kick")
            kicks.append(start + position)

        if bar >= 2 and bar < 94 and not 35 <= bar < 39:
            backbeats = [3] if professional or bridge or 39 <= bar < 43 else [1, 3]
            for position in backbeats:
                if bar == 45 and position == 3:
                    continue
                event("drums", claps[(bar + position) % 6], start + position + .012,
                      .31 if full else .20, -.06 if position == 1 else .06, "clap")
            if (22 <= bar < 30 or 71 <= bar < 79) and bar % 2 == 1:
                event("drums", claps[bar % 6], start + 2.75, .067, .12, "ghost_clap")

        if 1 <= bar < 94:
            steps = [1, 5] if 35 <= bar < 39 else [1, 3, 5, 7] if bridge or professional else range(8)
            for step in steps:
                if bar == 45 and step >= 6:
                    continue
                gain = (.135 if step % 2 else .063) * (1 + .075 * math.sin(bar * 1.71 + step))
                if bar < 6 or change or professional:
                    gain *= .73
                event("drums", hats[(bar + step) % 6], start + step * .5 + (.016 if step % 2 else .003),
                      gain, .16 if step % 2 else -.17, "closed_hat")
            if full and not 30 <= bar < 35:
                for step in range(4):
                    if 59 <= bar < 63 and step % 2:
                        continue
                    event("drums", opens[(bar + step) % 4], start + step + .5,
                          .135 if bar < 59 else .15, .22, "open_hat")
            if full and bar >= 14 and not 30 <= bar < 35:
                positions = [1, 3, 6, 7, 9, 11, 14, 15] if bar < 59 else [1, 4, 7, 9, 12, 15]
                for step in positions:
                    event("drums", shakers[(bar + step) % 6], start + step / 4 + (.022 if step % 2 else 0),
                          .040 if bar < 59 else .046, -.36 if step % 2 else .36, "shaker")

        if bar in [5, 13, 21, 34, 58, 66, 74, 80, 90]:
            for local, note, gain in [(2.75, 55, .13), (3.25, 50, .15), (3.75, 47, .17)]:
                event("drums", engine.tom(note), start + local, gain,
                      -.22 if note == 55 else .20, "tom", note)
        if 42 <= bar < 46:
            subdivision = .5 if bar < 45 else .25
            for index, local in enumerate(np.arange(0, 3 if bar == 45 else 4, subdivision)):
                gain = (.035 + (bar - 42) * .015) * (1 if index % 2 == 0 else .65)
                event("drums", claps[index % 6], start + float(local), gain, .09 * math.sin(index), "build_clap")

        bass_active = 3 <= bar < 35 or 41 <= bar < 94
        if bass_active:
            for local, transpose, length in PATTERNS[pattern_name]:
                if bar == 45 and local >= 3 or bar == 93 and local >= 3:
                    continue
                gain = .34 if full else .25 if professional else .20
                gain *= .67 if transpose else 1
                event("bass", synth(root + transpose, seconds(length) + .045, "bass", brightness),
                      start + local, gain, kind="bass_note", midi=root + transpose)

        # Pads begin at every harmonic change, rather than being stuck to a
        # two-bar loop that could span the wrong chord at a section boundary.
        prev_chord = harmony(bar - 1)[0] if bar > 0 else None
        new_harmony = bar == 0 or chord_name != prev_chord or bar in [6, 35, 46, 59, 81, 91, 94]
        if new_harmony and bar <= 94:
            following = bar + 1
            while following < min(bar + 2, BARS) and harmony(following)[0] == chord_name:
                following += 1
            duration = BAR * (following - bar) + .48
            if bar == 94:
                duration = 3.35
            gain = .113 if change else .075 if professional or bridge else .048
            for note in notes:
                event("pads", synth(note, duration, "pad", .70 if change else .80),
                      start, gain / 2, kind="pad_note", midi=note)

        if bar >= 3 and not 35 <= bar < 43 and bar < 94:
            positions = [.75, 2.75] if bar < 6 or professional or bridge or closing else [0, .75, 1.5, 2.75, 3.5]
            if pattern_name in ["B", "D"] and full:
                positions = [.5, 1.5, 2.25, 3.5]
            for local in positions:
                if bar == 45 and local >= 3 or bar == 93 and local >= 3:
                    continue
                duration = .40 if full else .58
                gain = .093 if full else .061
                for note in notes:
                    event("chords", synth(note, duration, "stab", brightness * .85),
                          start + local, gain / 2, kind="chord_note", midi=note)

        if 5 <= bar < 91 and not 30 <= bar < 35:
            order = [0, 2, 1, 3, 2, 1, 0, 2] if bar < 59 else [3, 1, 2, 0, 1, 3, 2, 0]
            allowed = [0, 3, 6] if change else [1, 5] if professional or bridge else [0, 2, 3, 6]
            for step in allowed:
                if bar == 45 and step >= 6:
                    continue
                note = notes[order[step]] + 12
                event("arp", synth(note, .32, "arp", .68), start + step * .5 + .25,
                      .027 if change else .017, -.20 if step % 2 else .20, "arp_note", note)

        # Original short, chord-derived call/response; no continuous solo in
        # the narration register. Different gestures accompany different acts.
        if bar in [10, 11, 18, 19, 26, 27, 48, 49, 54, 55, 60, 61, 69, 70, 77, 78, 84, 85, 88, 89]:
            if bar < 59:
                phrase = [(.75, notes[2] + 12, .52), (2.5, notes[0] + 12, .72)]
            elif bar < 81:
                phrase = [(.5, notes[1] + 12, .43), (1.75, notes[3], .46), (3, notes[2] + 12, .60)]
            else:
                phrase = [(1, notes[1] + 12, .83), (3, notes[0] + 12, .70)]
            for local, note, length in phrase:
                event("lead", synth(note, seconds(length) + .09, "lead", .68),
                      start + local, .045 if not professional else .033, kind="lead_note", midi=note)

    # A final tonic hit at 176.25s leaves room for a natural delay/room tail.
    for note in [54, 57, 61, 66]:
        event("chords", synth(note, 1.35, "stab", .49), 376, .040, kind="final_chord", midi=note)
    event("bass", synth(30, .72, "bass", .50), 376, .22, kind="final_bass", midi=30)
    for beat, gain in [(0, .032), (24, .11), (140, .067), (184, .13), (236, .083), (324, .053), (364, .065)]:
        event("fx", engine.cymbal(SEED + beat, 1.65), beat, gain, -.12, "section_cymbal")
    for target, gain in [(24, .060), (140, .052), (184, .080), (236, .054), (268, .050), (324, .044), (364, .045)]:
        reverse = engine.cymbal(SEED + 300 + target, 1.20)[::-1].copy()
        reverse *= np.linspace(0, 1, len(reverse)) ** .6
        event("fx", reverse, target - 1.20 / BEAT, gain, .17, "reverse_cymbal")
    for start, length, gain in [(20, 4, .035), (172, 11, .052), (264, 4, .028), (320, 4, .025)]:
        t = engine.clock(seconds(length))
        noise = engine.RNG.normal(0, 1, len(t))
        low = engine.shape_spectrum(noise, 900, 2000, 2)
        high = engine.shape_spectrum(noise, 3800, 9000, 2)
        progress = t / max(t[-1], 1 / SR)
        riser = (low * (1 - progress) + high * progress) * progress ** 1.8
        riser *= engine.attack_release(t, .15, len(t) / SR, .08)
        event("fx", riser, start, gain, -.14, "riser")

    report("Mixing event-linked sidechain, rounded synths and original stereo room...")
    for name, gain in {"chords": 3.05, "pads": 1.65, "arp": 1.50, "lead": 1.85}.items():
        buses[name] *= gain
    stop, resume, fade = round(seconds(183) * SR), round(seconds(184) * SR), round(.035 * SR)
    for name in ["drums", "bass", "chords", "arp"]:
        buses[name][stop - fade:stop] *= np.linspace(1, 0, fade)[:, None]
        buses[name][stop:resume] = 0
    duck = np.ones(FRAMES, dtype=np.float32)
    t = engine.clock(.46)
    recovery = .15 + .85 * (1 - np.exp(-np.maximum(t - .010, 0) / .110))
    for beat in kicks:
        start = round(seconds(beat) * SR)
        count = min(len(recovery), FRAMES - start)
        duck[start:start + count] = np.minimum(duck[start:start + count], recovery[:count])
    buses["bass"] *= duck[:, None]
    for name, wet in [("chords", .16), ("arp", .28), ("lead", .25)]:
        buses[name] += engine.echo(buses[name], wet, .75)
    room_send = buses["chords"] * .13 + buses["pads"] * .22 + buses["arp"] * .12 + buses["lead"] * .17
    buses["room"] = dark_room(room_send)
    del room_send
    for name, dry in [("chords", .30), ("pads", .46), ("arp", .57), ("lead", .71), ("room", .47)]:
        buses[name] *= (dry + (1 - dry) * duck)[:, None]
    levels = {name: {section: round(db(float(np.sqrt(np.mean(
        bus[round(a * BAR * SR):round(b * BAR * SR)] ** 2)))), 3)
        for section, a, b, *_ in SECTIONS} for name, bus in buses.items()}
    mix = np.zeros((FRAMES, 2), dtype=np.float32)
    for bus in buses.values():
        mix += bus
    head, tail = round(.008 * SR), round(3.75 * SR)
    mix[:head] *= np.sin(np.linspace(0, np.pi / 2, head))[:, None]
    mix[-tail:] *= np.cos(np.linspace(0, np.pi / 2, tail))[:, None] ** 1.55
    mix *= .79 / max(float(np.max(np.abs(mix))), 1e-9)
    mix = (np.tanh(1.10 * mix) / 1.10).astype(np.float32)
    mix[0] = mix[-1] = 0
    counts = {section: dict(collections.Counter(e["kind"] for e in events
              if a * 4 <= e["beat"] < b * 4)) for section, a, b, *_ in SECTIONS}
    stats = {"seed": SEED, "sampleFrames": FRAMES, "bars": bar_map,
             "sourceInstrumentGenerator": str(SOURCE), "eventCount": len(events),
             "eventsBySection": counts, "busRmsDbfsBeforeMaster": levels,
             "preMasterPeakDbfs": db(float(np.max(np.abs(mix)))),
             "sidechainRecoveryMs": 110, "bassMono": True,
             "openingFadeMs": 8, "closingFadeSeconds": 3.75,
             "finalTonicHitSeconds": 176.25,
             "authorship": "Original procedural arrangement and sound design by Codex for Fit Pro Player",
             "license": "CC0-1.0 dedication for the newly generated audio and arrangement",
             "externalSamples": [], "vocals": False}
    write_json("arrangement-events.json", events)
    return mix, stats


def loudnorm_values(text: str) -> dict:
    matches = re.findall(r'\{\s*"input_i".*?\}', text, re.S)
    if not matches:
        raise RuntimeError("Missing loudnorm measurements")
    return json.loads(matches[-1])


def master(mix: np.ndarray) -> dict:
    raw = OUT / "synthesis-mix.f32"
    raw.write_bytes(mix.astype("<f4").tobytes())
    source = ["-f", "f32le", "-ar", str(SR), "-ac", "2", "-i", str(raw)]
    tone = "highpass=f=28:p=2,lowpass=f=16000:p=2,equalizer=f=1800:t=q:w=0.8:g=-1.8,equalizer=f=3200:t=q:w=1:g=-2.3"
    report("Measuring master input; target -15 LUFS / -1.5 dBTP...")
    first = run(["ffmpeg", "-hide_banner", "-nostats", *source, "-af",
                 tone + ",loudnorm=I=-15:TP=-1.5:LRA=8:print_format=json", "-f", "null", "-"], "master-pass1.log")
    measured = loudnorm_values(first.stderr)
    normalizer = ("loudnorm=I=-15:TP=-1.5:LRA=8:linear=true:"
                  f"measured_I={measured['input_i']}:measured_TP={measured['input_tp']}:"
                  f"measured_LRA={measured['input_lra']}:measured_thresh={measured['input_thresh']}:"
                  f"offset={measured['target_offset']}:print_format=json")
    final = run(["ffmpeg", "-y", "-hide_banner", "-nostats", *source, "-af",
                 tone + "," + normalizer + ",afade=t=in:st=0:d=0.008,afade=t=out:st=179.75:d=0.25",
                 "-ar", str(SR), "-ac", "2", "-c:a", "pcm_s24le", "-t", str(DURATION),
                 "-metadata", "title=Fit Pro Player - Original 180-second Gym Electronic",
                 "-metadata", "artist=Original procedural score by Codex for Fit Pro Player",
                 "-metadata", "comment=CC0-1.0; 128 BPM; original synthesis; no samples or vocals",
                 str(OUT / "gym-electronic.wav")], "master-pass2.log")
    return {"pass1": measured, "pass2": loudnorm_values(final.stderr), "toneFilter": tone,
            "targetIntegratedLufs": -15, "targetTruePeakDbtp": -1.5}


def verify() -> dict:
    wav = OUT / "gym-electronic.wav"
    probe = run(["ffprobe", "-v", "error", "-show_entries",
                 "format=duration,size:stream=codec_name,sample_rate,channels,channel_layout,bits_per_sample,duration,duration_ts,time_base",
                 "-of", "json", str(wav)], "ffprobe.json")
    metadata = json.loads(probe.stdout)
    ebu = run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(wav), "-af", "ebur128=peak=true", "-f", "null", "-"], "ebur128.log")
    summary = ebu.stderr[ebu.stderr.rfind("Summary:"):]
    integrated = float(re.search(r"I:\s*([\-\d.]+) LUFS", summary).group(1))
    lra = float(re.search(r"LRA:\s*([\-\d.]+) LU", summary).group(1))
    true_peak = float(re.search(r"Peak:\s*([\-\d.]+) dBFS", summary).group(1))
    volume = run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(wav), "-af", "volumedetect", "-f", "null", "-"], "volumedetect.log")
    run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(wav), "-af", "astats=metadata=0:reset=0", "-f", "null", "-"], "astats.log")
    decoded = subprocess.run(["ffmpeg", "-v", "error", "-i", str(wav), "-f", "f32le", "-acodec", "pcm_f32le", "-"], capture_output=True, check=True).stdout
    samples = np.frombuffer(decoded, dtype="<f4").reshape(-1, 2)
    section_metrics = []
    for name, a, b, nominal_a, nominal_b, _ in SECTIONS:
        clip = samples[round(a * BAR * SR):round(b * BAR * SR)]
        section_metrics.append({"name": name, "startSeconds": a * BAR, "endSeconds": b * BAR,
                                "nominalStartSeconds": nominal_a, "nominalEndSeconds": nominal_b,
                                "rmsDbfs": round(db(float(np.sqrt(np.mean(clip * clip)))), 4),
                                "samplePeakDbfs": round(db(float(np.max(np.abs(clip)))), 4)})
    report("Checking 8x bandlimited reconstruction, stereo, tails and non-repeated minutes...")
    peak8 = 0.0
    for start in range(0, FRAMES, SR):
        a, b = max(0, start - 1024), min(FRAMES, start + SR + 1024)
        chunk = samples[a:b]
        transform = np.fft.rfft(chunk, axis=0)
        transform[-1] *= .5
        interpolated = np.fft.irfft(transform, n=len(chunk) * 8, axis=0) * 8
        core_a, core_b = (start - a) * 8, (min(start + SR, FRAMES) - a) * 8
        peak8 = max(peak8, float(np.max(np.abs(interpolated[core_a:core_b]))))
    mono = np.mean(samples, axis=1)
    minute = 60 * SR
    comparisons = []
    for first, second in [(0, 1), (1, 2), (0, 2)]:
        left, right = mono[first * minute:(first + 1) * minute], mono[second * minute:(second + 1) * minute]
        comparisons.append({"minutes": [first + 1, second + 1], "identical": bool(np.array_equal(left, right)),
                            "waveformCorrelation": round(float(np.corrcoef(left, right)[0, 1]), 6),
                            "differenceRmsDbfs": round(db(float(np.sqrt(np.mean((left - right) ** 2)))), 4)})
    # Aggregate power from 1-second Hann windows avoids a full 180s FFT.
    spectrum = np.zeros(SR // 2 + 1)
    window = np.hanning(SR)
    for start in range(0, FRAMES, SR):
        spectrum += np.abs(np.fft.rfft(mono[start:start + SR] * window)) ** 2
    bins = np.fft.rfftfreq(SR, 1 / SR)
    energy = {name: round(float(np.sum(spectrum[(bins >= low) & (bins < high)]) / np.sum(spectrum) * 100), 3)
              for name, low, high in [("sub", 28, 100), ("bass", 100, 300), ("mid", 300, 1800),
                                     ("narrationPresence", 1800, 4500), ("air", 4500, 16000)]}
    result = {"ffprobe": metadata, "durationSeconds": len(samples) / SR, "sampleFrames": len(samples),
              "integratedLufs": integrated, "loudnessRangeLu": lra, "ffmpegTruePeakDbtp": true_peak,
              "oversampled8xPeakDbfs": round(db(peak8), 4),
              "samplePeakDbfs": round(db(float(np.max(np.abs(samples)))), 4),
              "meanVolumeDb": float(re.search(r"mean_volume:\s*([\-\d.]+) dB", volume.stderr).group(1)),
              "maxVolumeDb": float(re.search(r"max_volume:\s*([\-\d.]+) dB", volume.stderr).group(1)),
              "clippedSamples": int(np.count_nonzero(np.abs(samples) >= 1.0)),
              "firstFrame": samples[0].tolist(), "lastFrame": samples[-1].tolist(),
              "lastQuarterSecondRmsDbfs": round(db(float(np.sqrt(np.mean(samples[-SR // 4:] ** 2)))), 4),
              "dcOffsetLeftRight": np.mean(samples, axis=0, dtype=np.float64).tolist(),
              "stereoCorrelation": round(float(np.corrcoef(samples.T)[0, 1]), 6),
              "monoSpectralEnergyPercent": energy, "minuteComparisons": comparisons,
              "sections": section_metrics, "sha256": hashlib.sha256(wav.read_bytes()).hexdigest(),
              "measurementTools": {"ffmpeg": "9.0.2", "numpy": np.__version__},
              "listeningClaim": "Numerical and arrangement verification only; narration mix not reviewed here"}
    stream = metadata["streams"][0]
    checks = {"exact180Seconds": len(samples) == FRAMES and float(metadata["format"]["duration"]) == 180.0,
              "48000HzStereoPcm24": stream["sample_rate"] == "48000" and stream["channels"] == 2
                                     and stream["codec_name"] == "pcm_s24le" and stream["bits_per_sample"] == 24,
              "noClippingOrNonfinite": result["clippedSamples"] == 0 and bool(np.all(np.isfinite(samples))),
              "truePeakAtMostMinus1": true_peak <= -1 and db(peak8) <= -1,
              "loudnessNearMinus15": abs(integrated + 15) <= .5,
              "distinctMinutes": all(not c["identical"] and c["waveformCorrelation"] < .95 for c in comparisons),
              "tailEndsQuietly": result["lastQuarterSecondRmsDbfs"] < -55 and float(np.max(np.abs(samples[-1]))) < 1e-5}
    result["checks"] = checks
    write_json("verification.json", result)
    report(json.dumps({k: result[k] for k in ["durationSeconds", "sampleFrames", "integratedLufs",
          "loudnessRangeLu", "ffmpegTruePeakDbtp", "oversampled8xPeakDbfs", "clippedSamples", "checks"]}, indent=2))
    assert all(checks.values()), f"Verification failed: {checks}"
    return result


def write_cues() -> None:
    strong = [{"beat": a * 4, "bar": a + 1, "timeSeconds": a * BAR, "type": name,
               "nominalTimeSeconds": na, "offsetFromNominalSeconds": a * BAR - na,
               "strength": .9 if name == "body" else .7, "description": description}
              for name, a, b, na, nb, description in SECTIONS]
    for beat, name in [(12, "bass_entry"), (56, "bass_pattern_B"), (88, "bass_pattern_C"),
                       (120, "groove_thins"), (156, "half_time_return"), (172, "rebuild"),
                       (183, "pre_body_air"), (252, "stripped_bridge"), (268, "variation_relaunch"),
                       (300, "final_variation"), (372, "drum_withdrawal"), (376, "final_tonic_hit")]:
        strong.append({"beat": beat, "bar": beat // 4 + 1, "timeSeconds": seconds(beat), "type": name, "strength": .65})
    cues = {"file": "gym-electronic.wav", "original": True, "vocals": False,
            "tempo": BPM, "bpm": BPM, "tempoBpm": BPM, "timeSignature": "4/4", "key": "F# minor",
            "duration": DURATION, "durationSeconds": DURATION, "sampleRate": SR, "sampleFrames": FRAMES,
            "channels": 2, "beatCount": BEATS, "barCount": BARS,
            "beatIndexConvention": "Zero-based beats; one-based bars; beat 384 at 180s is the exclusive end",
            "beats": [seconds(i) for i in range(BEATS)], "barStarts": [i * BAR for i in range(BARS)],
            "endCue": {"beat": BEATS, "timeSeconds": DURATION},
            "sections": [{"name": name, "startBeat": a * 4, "endBeat": b * 4, "startSeconds": a * BAR,
                          "endSeconds": b * BAR, "nominalStartSeconds": na, "nominalEndSeconds": nb,
                          "description": description} for name, a, b, na, nb, description in SECTIONS],
            "strongCues": sorted(strong, key=lambda c: c["beat"]),
            "source": "Local procedural synthesis; no external audio or sample library",
            "license": "CC0-1.0", "author": "Codex for Fit Pro Player"}
    assert len(cues["beats"]) == 384 and cues["beats"][-1] == 179.53125
    assert len(cues["barStarts"]) == 96 and cues["endCue"]["timeSeconds"] == 180
    write_json("cues.json", cues)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--verify-only", action="store_true")
    args = parser.parse_args()
    if not shutil.which("ffmpeg") or not shutil.which("ffprobe"):
        raise RuntimeError("ffmpeg/ffprobe must be on PATH")
    OUT.mkdir(parents=True, exist_ok=True)
    if not args.verify_only:
        mix, stats = arrange()
        stats["mastering"] = master(mix)
        write_json("synthesis.json", stats)
        write_cues()
        del mix
        engine.CACHE.clear()
        gc.collect()
    verify()
    report(f"Verified master: {OUT / 'gym-electronic.wav'}")


if __name__ == "__main__":
    main()
