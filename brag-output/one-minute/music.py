"""Original, sample-free 60-second fitness house score for Fit Pro Player.

Run: python brag-output/one-minute/music.py
Only NumPy, Python's standard library, ffmpeg and ffprobe are required.
All generated files stay in composition/assets/music beside this script.
No network, external samples, voices, credentials or app modifications.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
import shutil
import subprocess
from pathlib import Path

import numpy as np


SR = 48_000
BPM = 128
BEAT = 60.0 / BPM
BAR = 4.0 * BEAT
BEATS = 128
DURATION = BEATS * BEAT
FRAMES = int(DURATION * SR)
OUT = Path(__file__).resolve().parent / "composition" / "assets" / "music"
RNG = np.random.default_rng(1286014)
TAU = 2.0 * np.pi
CACHE: dict[tuple, np.ndarray] = {}
SECTIONS = [
    ("intro", 0, 32, "Filtered groove; layers enter every two bars"),
    ("drop_1", 32, 64, "Full house groove and original melodic answer"),
    ("breakdown", 64, 80, "Kick and bass withdraw; suspended pads and echoes"),
    ("build", 80, 96, "Snare subdivisions, noise lift and pre-drop stop"),
    ("drop_2", 96, 120, "Brighter bass, stronger hook, extra percussion"),
    ("outro", 120, 128, "Tonic resolution, last hit, decaying stereo tail"),
]


def report(message: str) -> None:
    print(message, flush=True)


def run(args: list[str], *, log: str | None = None) -> subprocess.CompletedProcess:
    result = subprocess.run(args, capture_output=True, text=True, encoding="utf-8")
    if log:
        (OUT / log).write_text(result.stdout + result.stderr, encoding="utf-8")
    if result.returncode:
        raise RuntimeError(f"Command failed ({result.returncode}): {args}\n{result.stderr}")
    return result


def seconds(beat: float) -> float:
    return beat * BEAT


def frequency(midi: float) -> float:
    return 440.0 * 2.0 ** ((midi - 69.0) / 12.0)


def clock(duration: float) -> np.ndarray:
    return np.arange(round(duration * SR), dtype=np.float64) / SR


def db(value: float) -> float:
    return float(20.0 * np.log10(max(value, 1e-12)))


def shape_spectrum(signal: np.ndarray, hp: float = 0, lp: float = 20_000,
                   slope: int = 4) -> np.ndarray:
    """Offline smooth spectral filter; envelope applied after filtering notes."""
    n = len(signal)
    size = 1 << (2 * n - 1).bit_length()
    bins = np.fft.rfftfreq(size, 1.0 / SR)
    transfer = 1.0 / np.sqrt(1.0 + (bins / lp) ** (2 * slope))
    if hp:
        transfer *= 1.0 / np.sqrt(1.0 + (hp / np.maximum(bins, 1e-6)) ** (2 * slope))
    if signal.ndim == 2:
        transfer = transfer[:, None]
    return np.fft.irfft(np.fft.rfft(signal, n=size, axis=0) * transfer,
                        n=size, axis=0)[:n].astype(np.float32)


def attack_release(t: np.ndarray, attack: float, end: float,
                   release: float) -> np.ndarray:
    envelope = np.minimum(t / max(attack, 1 / SR), 1.0)
    envelope *= np.clip((end - t) / max(release, 1 / SR), 0.0, 1.0)
    return envelope


def stereo(signal: np.ndarray, pan: float = 0.0) -> np.ndarray:
    angle = (pan + 1.0) * np.pi / 4.0
    return np.column_stack((signal * np.cos(angle), signal * np.sin(angle))).astype(np.float32)


def add(bus: np.ndarray, signal: np.ndarray, beat: float,
        gain: float = 1.0, pan: float = 0.0) -> None:
    start = int(round(seconds(beat) * SR))
    source_start = max(-start, 0)
    start = max(start, 0)
    length = min(len(signal) - source_start, FRAMES - start)
    if length <= 0:
        return
    clip = signal[source_start:source_start + length]
    if clip.ndim == 1:
        clip = stereo(clip, pan)
    bus[start:start + length] += clip * gain


def saw(t: np.ndarray, hz: float, phase: float = 0.0) -> np.ndarray:
    """PolyBLEP saw: remove oscillator discontinuity instead of aliasing it."""
    p = np.remainder(t * hz + phase, 1.0)
    dt = hz / SR
    correction = np.zeros_like(p)
    rising = p < dt
    x = p[rising] / dt
    correction[rising] = 2 * x - x * x - 1
    falling = p > 1 - dt
    x = (p[falling] - 1) / dt
    correction[falling] = x * x + 2 * x + 1
    return 2 * p - 1 - correction


def synth(midi: int, duration: float, patch: str,
          brightness: float = 1.0) -> np.ndarray:
    key = (midi, round(duration, 5), patch, brightness)
    if key in CACHE:
        return CACHE[key]
    t = clock(duration)
    f = frequency(midi)
    out = np.zeros((len(t), 2), dtype=np.float32)
    if patch == "bass":
        # Solid mono sub plus a driven, filtered saw: useful on small speakers.
        core = .66 * np.sin(TAU * f * t) + .13 * np.sin(TAU * 2 * f * t + .15)
        rich = .58 * saw(t, f, .05) + .22 * saw(t, f * 1.0018, .11)
        bright = shape_spectrum(np.tanh(2.0 * rich), 32, 1350 * brightness)
        dark = shape_spectrum(bright, 0, 420 * brightness)
        snap = np.exp(-t / .070)
        mono = core + .43 * (dark + (bright - dark) * snap)
        env = attack_release(t, .003, duration, .042)
        env *= .76 + .24 * np.exp(-t / .080)
        out = stereo(mono * env)
    else:
        widths = [-.65, 0.0, .65]
        cents = [-6.5, 0.0, 6.0]
        for i, (pan, detune) in enumerate(zip(widths, cents)):
            hz = f * 2 ** (detune / 1200)
            phase = [.07, .13, .22][i]
            analog = saw(t, hz, phase)
            if patch == "lead":
                # A rounded FM centre, octave body and restrained saw edge.
                bend = .20 * np.exp(-t / .18) * np.sin(TAU * hz * 2 * t)
                tone = (.53 * np.sin(TAU * hz * t + bend)
                        + .18 * np.sin(TAU * hz * 2 * t + .21)
                        + .29 * analog)
                tone = shape_spectrum(tone, 170, 3400 * brightness)
                env = attack_release(t, .008, duration, .085)
                env *= .62 + .38 * np.exp(-t / .17)
            elif patch == "arp":
                tone = .68 * analog + .32 * np.sin(TAU * hz * t)
                bright = shape_spectrum(tone, 280, 4200 * brightness)
                dark = shape_spectrum(tone, 280, 1100)
                tone = dark + (bright - dark) * np.exp(-t / .060)
                env = attack_release(t, .004, duration, .095) * np.exp(-t / .135)
            elif patch == "pad":
                tone = (.65 * analog + .20 * np.sin(TAU * hz * t)
                        + .15 * np.sin(TAU * hz * 2 * t))
                tone = shape_spectrum(tone, 185, 1450 * brightness)
                env = attack_release(t, .28, duration, .72)
                env *= .92 + .08 * np.sin(TAU * .17 * t + i)
            else:
                # Detuned house chord stab with a brighter attack than sustain.
                bright = shape_spectrum(analog, 175, 3800 * brightness)
                dark = shape_spectrum(analog, 175, 1050 * brightness)
                tone = dark + (bright - dark) * np.exp(-t / .065)
                env = attack_release(t, .0045, duration, .12)
                env *= .38 + .62 * np.exp(-t / .13)
            out += stereo(tone * env, pan) / 2.45
    out = out.astype(np.float32)
    CACHE[key] = out
    return out


def kick() -> np.ndarray:
    t = clock(.48)
    # Analytic integral of an exponential pitch drop; consistent low end.
    phase = TAU * (47.0 * t + 108.0 * .018 * (1 - np.exp(-t / .018))
                   + 23.0 * .075 * (1 - np.exp(-t / .075)))
    env = (1 - np.exp(-t / .00065)) * np.exp(-t / .125)
    env *= np.clip((.48 - t) / .035, 0, 1)
    body = np.sin(phase) * env
    punch = .14 * np.sin(TAU * 123 * t) * np.exp(-t / .014)
    click = shape_spectrum(RNG.normal(0, 1, len(t)), 3300, 12_000)
    click *= .045 * np.exp(-t / .003) * (1 - np.exp(-t / .00025))
    signal = np.tanh(1.35 * (body + punch)) / 1.20 + click
    signal *= attack_release(t, .0003, .48, .03)
    return signal.astype(np.float32)


def clap(seed: int = 1) -> np.ndarray:
    rng = np.random.default_rng(seed)
    t = clock(.32)
    noise = shape_spectrum(rng.normal(0, 1, len(t)), 1050, 9700)
    bursts = np.zeros(len(t))
    for offset, weight in [(0, .9), (.009, .8), (.019, .85), (.030, .66)]:
        age = np.maximum(t - offset, 0)
        bursts += weight * (t >= offset) * (1 - np.exp(-age / .0007)) * np.exp(-age / .014)
    bursts += .35 * np.exp(-np.maximum(t - .029, 0) / .072) * (t >= .029)
    body = .14 * np.sin(TAU * 187 * t + .35 * np.exp(-t / .01)) * np.exp(-t / .035)
    return ((noise * bursts + body) * attack_release(t, .0003, .32, .045)).astype(np.float32)


def hat(opened: bool, seed: int) -> np.ndarray:
    rng = np.random.default_rng(seed)
    duration = .31 if opened else .10
    t = clock(duration)
    metal = np.zeros(len(t))
    for f in [3471, 4283, 5639, 6977, 8231, 10127]:
        metal += np.sin(TAU * f * t + rng.uniform(0, TAU))
    noise = rng.normal(0, 1, len(t))
    signal = shape_spectrum(.90 * noise + .13 * metal, 6100, 16_200, 3)
    decay = .087 if opened else .024
    env = np.exp(-t / decay) * attack_release(t, .0005, duration, .026)
    return (signal * env).astype(np.float32)


def shaker(seed: int) -> np.ndarray:
    rng = np.random.default_rng(seed)
    t = clock(.13)
    noise = shape_spectrum(rng.normal(0, 1, len(t)), 4100, 12_500)
    env = (1 - np.exp(-t / .010)) * np.exp(-t / .025)
    return (noise * env).astype(np.float32)


def tom(midi: int) -> np.ndarray:
    t = clock(.25)
    hz = frequency(midi)
    phase = TAU * (hz * t + 25 * .026 * (1 - np.exp(-t / .026)))
    tone = np.sin(phase + .35 * np.sin(1.47 * phase) * np.exp(-t / .016))
    return (tone * np.exp(-t / .067) * attack_release(t, .001, .25, .025)).astype(np.float32)


def cymbal(seed: int, duration: float = 1.8) -> np.ndarray:
    rng = np.random.default_rng(seed)
    t = clock(duration)
    noise = shape_spectrum(rng.normal(0, 1, len(t)), 2100, 13_300, 3)
    metal = sum(np.sin(TAU * f * t + i) for i, f in enumerate([3127, 4973, 6511, 7927])) / 4
    env = np.exp(-t / .47) * attack_release(t, .002, duration, .20)
    return ((.92 * noise + .08 * metal) * env).astype(np.float32)


def echo(signal: np.ndarray, wet: float, spacing: float = .75) -> np.ndarray:
    out = np.zeros_like(signal)
    for tap in range(1, 5):
        delay = round(seconds(spacing * tap) * SR)
        gain = wet * .49 ** (tap - 1)
        out[delay:, tap % 2] += signal[:-delay, (tap + 1) % 2] * gain
        out[delay:, (tap + 1) % 2] += signal[:-delay, tap % 2] * gain * .32
    return out


def reverb(signal: np.ndarray) -> np.ndarray:
    """Original decorrelated room IR: early reflections and diffuse dark tail."""
    size = 1 << (FRAMES + round(1.25 * SR) - 1).bit_length()
    out = np.zeros_like(signal)
    t = clock(1.25)
    for channel in range(2):
        rng = np.random.default_rng(600 + channel)
        ir = shape_spectrum(rng.normal(0, 1, len(t)), 420, 6500, 2)
        ir *= np.exp(-t / .24) * np.clip((t - .022) / .028, 0, 1)
        ir /= max(np.sqrt(np.sum(ir * ir)), 1e-9)
        ir *= .65
        for delay, gain in [(.024, .27), (.038, .21), (.053, .17), (.081, .12)]:
            ir[round((delay + channel * .0031) * SR)] += gain
        wet = np.fft.irfft(np.fft.rfft(signal[:, channel], n=size)
                          * np.fft.rfft(ir, n=size), n=size)[:FRAMES]
        out[:, channel] = wet
    return out


def harmony(bar: int) -> tuple[int, list[int]]:
    # F#m9 - Dmaj7 - Aadd9 - Eadd9, voice-led in a compact register.
    progression = [
        (30, [54, 57, 61, 68]), (38, [54, 57, 61, 62]),
        (33, [52, 57, 59, 61]), (28, [52, 56, 59, 66]),
    ]
    if bar >= 30:
        return progression[0]
    if 24 <= bar < 30:
        index = [0, 0, 1, 1, 2, 3][bar - 24]
    elif 16 <= bar < 20:
        index = [1, 1, 3, 3][bar - 16]
    elif 20 <= bar < 24:
        index = 3 if bar < 22 else 0
    else:
        index = (bar % 8) // 2
    return progression[index]


def arrange() -> tuple[np.ndarray, dict]:
    report("Synthesizing original instruments and 32-bar arrangement...")
    drums = np.zeros((FRAMES, 2), dtype=np.float32)
    bass = np.zeros_like(drums)
    chords = np.zeros_like(drums)
    pads = np.zeros_like(drums)
    arp = np.zeros_like(drums)
    lead = np.zeros_like(drums)
    fx = np.zeros_like(drums)
    k = kick() * .65
    claps = [clap(20 + i) for i in range(4)]
    hats = [hat(False, 40 + i) for i in range(4)]
    opens = [hat(True, 60 + i) for i in range(3)]
    shakers = [shaker(80 + i) for i in range(4)]
    kick_times: list[float] = []
    drum_events = {"kick": 0, "clap_snare": 0, "closed_hat": 0,
                   "open_hat": 0, "shaker": 0, "tom": 0}
    note_events = {"bass": 0, "chord_stabs": 0, "pad_chords": 0,
                   "arpeggio": 0, "lead": 0}

    for bar in range(32):
        beat0 = bar * 4
        root, notes = harmony(bar)
        intro = bar < 8
        drop1 = 8 <= bar < 16
        breaking = 16 <= bar < 20
        building = 20 <= bar < 24
        drop2 = 24 <= bar < 30
        outro = bar >= 30
        full = drop1 or drop2

        # Four-on-floor in both drops and intro; a deliberate space in the break.
        kicks = [] if breaking else list(range(4))
        if building:
            kicks = list(range(4)) if bar < 23 else [0, 1, 2]
        if bar == 31:
            kicks = [0, 1]  # Final tonic hit at beat 125 / 58.59375 seconds.
        for beat in kicks:
            amp = .97 if full else (.79 if intro else .73)
            if building:
                amp = .64
            add(drums, k, beat0 + beat, amp)
            kick_times.append(beat0 + beat)
            drum_events["kick"] += 1

        if not breaking and (bar >= 2) and bar != 31:
            for beat in [1, 3]:
                if bar == 23 and beat == 3:
                    continue
                add(drums, claps[(bar + beat) % 4], beat0 + beat + .012,
                    .39 if full else .25, -.07 if beat == 1 else .07)
                drum_events["clap_snare"] += 1

        if (not breaking and bar >= 1) and bar != 31:
            for step in range(8):
                time = beat0 + step * .5 + (.013 if step % 2 else .003)
                if bar == 23 and time >= 95:
                    continue
                velocity = .17 if step % 2 else .085
                velocity *= 1 + .07 * math.sin(bar * 2.7 + step * 1.2)
                if intro:
                    velocity *= .70
                if building:
                    velocity *= .80
                add(drums, hats[(bar + step) % 4], time, velocity,
                    .16 if step % 2 else -.14)
                drum_events["closed_hat"] += 1
            if full or 4 <= bar < 8:
                for step in range(4):
                    add(drums, opens[(bar + step) % 3], beat0 + step + .5,
                        .17 if full else .10, .24)
                    drum_events["open_hat"] += 1
            if full:
                # Quiet swung sixteenths, with holes to keep the groove breathing.
                for step in [1, 3, 6, 7, 9, 11, 14, 15]:
                    swing = .018 if step % 2 else 0
                    amp = (.064 if drop2 else .045) * (1 if step % 4 == 3 else .65)
                    add(drums, shakers[(bar + step) % 4], beat0 + step / 4 + swing,
                        amp, -.4 if step % 2 else .4)
                    drum_events["shaker"] += 1
                if bar % 4 == 3:
                    for step in [12.5, 13.5, 14.5, 15.5]:
                        add(drums, hats[int(step) % 4], beat0 + step / 4,
                            .062, -.35)
                        drum_events["closed_hat"] += 1

        if bar in [7, 15, 27, 29]:
            for position, midi, gain in [(2.75, 55, .19), (3.25, 50, .22), (3.75, 47, .23)]:
                add(drums, tom(midi), beat0 + position, gain,
                    -.25 if midi == 55 else .20)
                drum_events["tom"] += 1

        if building:
            subdivision = [.5, .5, .25, .125][bar - 20]
            limit = 3.0 if bar == 23 else 4.0
            for index, local in enumerate(np.arange(0, limit, subdivision)):
                progress = ((bar - 20) * 4 + local) / 16
                amp = (.055 + .14 * progress) * (1.0 if index % 2 == 0 else .65)
                add(drums, claps[index % 4], beat0 + float(local), amp,
                    .18 * math.sin(index))
                drum_events["clap_snare"] += 1

        # Syncopated bass ostinato with an occasional fifth/octave pickup.
        if full or (intro and bar >= 4) or (outro and bar == 30):
            pattern = [(0, 0, .42), (.5, 0, .44), (1.25, 0, .21),
                       (1.5, 12, .27), (2, 0, .42), (2.5, 0, .40),
                       (3.25, 7 if bar % 2 else 0, .21), (3.5, 0, .39)]
            for local, transpose, length in pattern:
                if intro and local in [1.25, 3.25]:
                    continue
                amp = .43 if drop2 else (.40 if drop1 else .26)
                if transpose:
                    amp *= .67
                brightness = 1.18 if drop2 else (.90 if drop1 else .48)
                add(bass, synth(root + transpose, seconds(length) + .042,
                                "bass", brightness), beat0 + local, amp)
                note_events["bass"] += 1
        if bar == 31:
            add(bass, synth(30, .48, "bass", .70), 125, .35)
            note_events["bass"] += 1

        # Wide pads carry harmony through the break instead of another drum loop.
        if bar % 2 == 0 or bar in [28, 29, 30]:
            duration = BAR * (1 if bar in [28, 29] else 2) + .48
            amp = .14 if breaking else (.073 if intro else .055)
            if building:
                amp = .092
            for note in notes:
                add(pads, synth(note, duration, "pad", .70 if intro else 1.0),
                    beat0, amp / 2)
            note_events["pad_chords"] += 1

        if full or (intro and bar >= 4) or (outro and bar == 30):
            positions = [0, .75, 1.5, 2.75, 3.5]
            if bar % 2:
                positions = [.5, 1.5, 2.25, 3.5]
            if intro:
                positions = [.75, 2.75]
            for local in positions:
                duration = .34 if local in [1.5, 3.5] else .45
                for note in notes:
                    amp = .108 if full else .060
                    if drop2:
                        amp *= 1.09
                    add(chords, synth(note, duration, "stab", 1.0 if full else .47),
                        beat0 + local, amp / 2)
                note_events["chord_stabs"] += 1
        if bar == 31:
            for note in [54, 57, 61, 66]:
                add(chords, synth(note, 1.20, "stab", .70), 125, .055)
            note_events["chord_stabs"] += 1

        if bar >= 6 and not outro:
            arp_notes = [n + 12 for n in notes]
            order = [0, 2, 1, 3, 2, 1, 0, 2]
            for step, index in enumerate(order):
                # Space under the hook and in the early half of the breakdown.
                if (breaking and step not in [0, 3, 6]) or (bar % 2 and step in [1, 5]):
                    continue
                if bar == 23 and step >= 6:
                    continue
                amp = .026 if full else (.037 if breaking else .023)
                add(arp, synth(arp_notes[index], .32, "arp", .85),
                    beat0 + step * .5 + .25, amp,
                    -.22 if step % 2 else .22)
                note_events["arpeggio"] += 1

        # A composed two-bar call/response; altered answers fit each harmony.
        if bar in [10, 11, 12, 13, 14, 15, 24, 25, 26, 27, 28, 29]:
            if bar % 2 == 0:
                phrase = [(.75, 73, .42), (1.5, 76 if bar != 26 else 74, .50),
                          (2.25, 73, .78), (3.5, 71, .36)]
            else:
                phrase = [(0, 71, .74), (1, 69, .55), (2, 68, .53),
                          (3, 66 if bar not in [13, 29] else 68, .70)]
            for local, note, length in phrase:
                amp = .073 if drop2 else .055
                add(lead, synth(note, seconds(length) + .075, "lead", 1.0),
                    beat0 + local, amp)
                if drop2 and bar in [25, 27, 29] and local in [1, 3]:
                    add(lead, synth(note + 12, seconds(length) + .075, "lead", .8),
                        beat0 + local, amp * .16)
                note_events["lead"] += 1

    report("Adding transitions, musical sidechain, stereo delays and dark room...")
    for beat, gain in [(0, .055), (32, .23), (64, .12), (96, .29), (120, .13)]:
        add(fx, cymbal(200 + beat), beat, gain, -.13)
    for target in [32, 64, 96]:
        reverse = cymbal(300 + target, 1.25)[::-1].copy()
        reverse *= np.linspace(0, 1, len(reverse)) ** .55
        add(fx, reverse, target - 1.25 / BEAT, .18, .18)
    for start, length, gain in [(28, 4, .070), (84, 11, .13)]:
        t = clock(seconds(length))
        noise = RNG.normal(0, 1, len(t))
        low = shape_spectrum(noise, 900, 2200, 2)
        high = shape_spectrum(noise, 2800, 11_000, 2)
        progress = t / max(t[-1], 1 / SR)
        rising = (low * (1 - progress) + high * progress) * progress ** 1.8
        rising *= attack_release(t, .12, len(t) / SR, .055)
        add(fx, rising, start, gain, -.15)
    # Mix harmonic material at useful level alongside the punchy rhythm section.
    # Detuned oscillators retain a clear fundamental instead of cancelling it.
    chords *= 3.10
    pads *= 1.90
    arp *= 1.90
    lead *= 3.30
    # One beat of air before drop 2; mute dry build percussion at beat 95.
    stop = round(seconds(95) * SR)
    resume = round(seconds(96) * SR)
    for bus in [drums, arp, pads]:
        fade_len = round(.035 * SR)
        bus[stop - fade_len:stop] *= np.linspace(1, 0, fade_len)[:, None]
        bus[stop:resume] = 0

    duck = np.ones(FRAMES, dtype=np.float32)
    recovery_t = clock(.46)
    recovery = .13 + .87 * (1 - np.exp(-np.maximum(recovery_t - .010, 0) / .104))
    for beat in kick_times:
        begin = round(seconds(beat) * SR)
        size = min(len(recovery), FRAMES - begin)
        duck[begin:begin + size] = np.minimum(duck[begin:begin + size], recovery[:size])
    bass *= duck[:, None]
    chords += echo(chords, .18, .75)
    arp += echo(arp, .37, .75)
    lead += echo(lead, .33, .75)
    room_send = chords * .14 + pads * .22 + arp * .13 + lead * .22
    room = reverb(room_send)
    chords *= (.24 + .76 * duck)[:, None]
    pads *= (.42 + .58 * duck)[:, None]
    arp *= (.53 + .47 * duck)[:, None]
    lead *= (.66 + .34 * duck)[:, None]
    room *= (.43 + .57 * duck)[:, None]
    buses = {"drums": drums, "bass": bass, "chords": chords, "pads": pads,
             "arp": arp, "lead": lead, "fx": fx, "room": room}
    bus_levels = {
        name: {section: round(db(float(np.sqrt(np.mean(
            bus[round(seconds(start) * SR):round(seconds(end) * SR)] ** 2)))), 3)
               for section, start, end, _ in SECTIONS}
        for name, bus in buses.items()
    }
    mix = drums + bass + chords + pads + arp + lead + fx + room

    # Short opening taper and 1.2-second musical tail to exactly zero.
    start_fade = round(.008 * SR)
    end_fade = round(1.20 * SR)
    mix[:start_fade] *= np.sin(np.linspace(0, np.pi / 2, start_fade))[:, None]
    mix[-end_fade:] *= np.cos(np.linspace(0, np.pi / 2, end_fade))[:, None] ** 1.35
    mix[-1] = 0
    pre_peak = float(np.max(np.abs(mix)))
    mix *= .79 / pre_peak
    mix = (np.tanh(1.10 * mix) / 1.10).astype(np.float32)
    mix[0] = mix[-1] = 0
    stats = {
        "seed": 1286014, "sample_frames": FRAMES,
        "bus_rms_dbfs_before_master": bus_levels,
        "drum_events": drum_events, "note_events": note_events,
        "pre_master_peak_dbfs": db(float(np.max(np.abs(mix)))),
        "bass_mono": True, "synth_sidechain_recovery_ms": 104,
        "opening_fade_ms": 8, "ending_fade_ms": 1200,
        "original_sound_design": "PolyBLEP oscillators, analytic kick, procedural noise drums, original room IR",
    }
    return mix, stats


def loudnorm_values(text: str) -> dict:
    matches = re.findall(r'\{\s*"input_i".*?\}', text, re.S)
    if not matches:
        raise RuntimeError("ffmpeg loudnorm did not report measured values")
    return json.loads(matches[-1])


def master(mix: np.ndarray) -> dict:
    raw = OUT / "synthesis-mix.f32"
    raw.write_bytes(mix.astype("<f4").tobytes())
    source = ["-f", "f32le", "-ar", str(SR), "-ac", "2", "-i", str(raw)]
    # Keep the low end tight, remove DC, and avoid harsh narration-band edges.
    tone = "highpass=f=28:p=2,lowpass=f=18000:p=2,equalizer=f=2700:t=q:w=1.1:g=-1.3"
    first = run(["ffmpeg", "-hide_banner", "-nostats", *source, "-af",
                 tone + ",loudnorm=I=-14:TP=-1.3:LRA=8:print_format=json",
                 "-f", "null", "-"], log="master-pass1.log")
    measured = loudnorm_values(first.stderr)
    normalizer = ("loudnorm=I=-14:TP=-1.3:LRA=8:linear=true:"
                  f"measured_I={measured['input_i']}:measured_TP={measured['input_tp']}:"
                  f"measured_LRA={measured['input_lra']}:measured_thresh={measured['input_thresh']}:"
                  f"offset={measured['target_offset']}:print_format=json")
    report("Mastering to 48 kHz stereo PCM24 and measuring true peak...")
    final = OUT / "gym-electronic.wav"
    second = run(["ffmpeg", "-y", "-hide_banner", "-nostats", *source,
                  "-af", tone + "," + normalizer, "-ar", str(SR), "-ac", "2",
                  "-c:a", "pcm_s24le", "-t", "60", "-metadata",
                  "title=Fit Pro Player - Original Gym Electronic", "-metadata",
                  "comment=Original procedural composition; no samples or vocals; 128 BPM",
                  str(final)], log="master-pass2.log")
    return {"pass1": measured, "pass2": loudnorm_values(second.stderr)}


def verify() -> dict:
    wav = OUT / "gym-electronic.wav"
    probe = run(["ffprobe", "-v", "error", "-show_entries",
                 "format=duration,size:stream=codec_name,sample_rate,channels,channel_layout,bits_per_sample,duration,duration_ts,time_base",
                 "-of", "json", str(wav)], log="ffprobe.json")
    metadata = json.loads(probe.stdout)
    ebu = run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(wav), "-af",
               "ebur128=peak=true", "-f", "null", "-"], log="ebur128.log")
    summary = ebu.stderr[ebu.stderr.rfind("Summary:"):]
    loudness = float(re.search(r"I:\s*([\-\d.]+) LUFS", summary).group(1))
    lra = float(re.search(r"LRA:\s*([\-\d.]+) LU", summary).group(1))
    true_peak = float(re.search(r"Peak:\s*([\-\d.]+) dBFS", summary).group(1))
    volume = run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(wav), "-af",
                  "volumedetect", "-f", "null", "-"], log="volumedetect.log")
    mean_volume = float(re.search(r"mean_volume:\s*([\-\d.]+) dB", volume.stderr).group(1))
    maximum_volume = float(re.search(r"max_volume:\s*([\-\d.]+) dB", volume.stderr).group(1))
    run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(wav), "-af",
         "astats=metadata=0:reset=0", "-f", "null", "-"], log="astats.log")
    decoded = subprocess.run(["ffmpeg", "-v", "error", "-i", str(wav),
                              "-f", "f32le", "-acodec", "pcm_f32le", "-"],
                             capture_output=True, check=True).stdout
    samples = np.frombuffer(decoded, dtype="<f4").reshape(-1, 2)
    sample_peak = db(float(np.max(np.abs(samples))))
    clipped_samples = int(np.count_nonzero(np.abs(samples) >= 1.0))
    correlation = float(np.corrcoef(samples.T)[0, 1])
    section_metrics = []
    for name, start, end, _ in SECTIONS:
        clip = samples[round(seconds(start) * SR):round(seconds(end) * SR)]
        section_metrics.append({"name": name, "startSeconds": seconds(start),
                                "endSeconds": seconds(end),
                                "rmsDbfs": round(db(float(np.sqrt(np.mean(clip * clip)))), 3),
                                "samplePeakDbfs": round(db(float(np.max(np.abs(clip)))), 3)})
    # A broadband energy distribution is also saved as a diagnostic, not a listening claim.
    energy = {}
    mono = np.mean(samples, axis=1)
    spectrum = np.abs(np.fft.rfft(mono)) ** 2
    bins = np.fft.rfftfreq(len(mono), 1 / SR)
    for name, low, high in [("sub", 28, 100), ("bass", 100, 300),
                            ("mid", 300, 2500), ("presence", 2500, 7000),
                            ("air", 7000, 18000)]:
        energy[name] = round(float(np.sum(spectrum[(bins >= low) & (bins < high)])
                                   / np.sum(spectrum) * 100), 2)
    # An 8x bandlimited reconstruction complements ffmpeg's BS.1770 peak check.
    report("Checking oversampled reconstruction and exact decoded sample count...")
    peak8 = 0.0
    window = SR
    overlap = 1024
    for start in range(0, len(samples), window):
        a, b = max(0, start - overlap), min(len(samples), start + window + overlap)
        chunk = samples[a:b]
        transform = np.fft.rfft(chunk, axis=0)
        transform[-1] *= .5
        interpolated = np.fft.irfft(transform, n=len(chunk) * 8, axis=0) * 8
        core_start = (start - a) * 8
        core_end = (min(start + window, len(samples)) - a) * 8
        peak8 = max(peak8, float(np.max(np.abs(interpolated[core_start:core_end]))))
    result = {
        "ffprobe": metadata,
        "sampleFrames": len(samples), "durationSeconds": len(samples) / SR,
        "integratedLufs": loudness, "loudnessRangeLu": lra,
        "ffmpegTruePeakDbtp": true_peak,
        "oversampled8xPeakDbfs": round(db(peak8), 4),
        "samplePeakDbfs": round(sample_peak, 4),
        "ffmpegMeanVolumeDb": mean_volume, "ffmpegMaxVolumeDb": maximum_volume,
        "clippedSamples": clipped_samples,
        "firstFrame": samples[0].tolist(), "lastFrame": samples[-1].tolist(),
        "dcOffsetLeftRight": np.mean(samples, axis=0, dtype=np.float64).tolist(),
        "stereoCorrelation": round(correlation, 5),
        "monoSpectralEnergyPercent": energy, "sections": section_metrics,
        "sha256": hashlib.sha256(wav.read_bytes()).hexdigest(),
    }
    stream = metadata["streams"][0]
    assert len(samples) == FRAMES and float(metadata["format"]["duration"]) == 60.0
    assert stream["sample_rate"] == "48000" and stream["channels"] == 2
    assert stream["codec_name"] == "pcm_s24le" and stream["bits_per_sample"] == 24
    assert clipped_samples == 0 and np.all(np.isfinite(samples))
    assert true_peak <= -1.0 and db(peak8) <= -1.0, "True-peak ceiling failed"
    assert abs(loudness + 14) <= .5, "Loudness did not meet -14 LUFS target"
    (OUT / "verification.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    report(json.dumps({k: result[k] for k in ["durationSeconds", "sampleFrames", "integratedLufs",
                                             "loudnessRangeLu", "ffmpegTruePeakDbtp",
                                             "oversampled8xPeakDbfs", "clippedSamples"]}, indent=2))
    return result


def write_cues() -> None:
    strong = []
    for name, start, end, description in SECTIONS:
        strong.append({"beat": start, "bar": start // 4 + 1, "timeSeconds": seconds(start),
                       "type": name, "strength": 1.0 if "drop" in name else .8,
                       "description": description})
    strong.extend([
        {"beat": 16, "bar": 5, "timeSeconds": seconds(16), "type": "bass_entry", "strength": .7},
        {"beat": 48, "bar": 13, "timeSeconds": seconds(48), "type": "drop_1_variation", "strength": .8},
        {"beat": 88, "bar": 23, "timeSeconds": seconds(88), "type": "build_acceleration", "strength": .8},
        {"beat": 95, "bar": 24, "timeSeconds": seconds(95), "type": "pre_drop_air", "strength": .9},
        {"beat": 112, "bar": 29, "timeSeconds": seconds(112), "type": "second_drop_answer", "strength": .85},
        {"beat": 125, "bar": 32, "timeSeconds": seconds(125), "type": "final_tonic_hit", "strength": 1.0},
    ])
    cues = {
        "file": "gym-electronic.wav", "original": True, "vocals": False,
        "tempo": BPM, "bpm": BPM, "tempoBpm": BPM, "timeSignature": "4/4",
        "key": "F# minor", "duration": DURATION, "durationSeconds": DURATION,
        "sampleRate": SR, "sampleFrames": FRAMES, "channels": 2,
        "beatCount": BEATS, "barCount": 32,
        "beatIndexConvention": "Zero-based beats; one-based bars; end at beat 128 is exclusive",
        "beats": [seconds(i) for i in range(BEATS)],
        "barStarts": [seconds(i * 4) for i in range(32)],
        "endCue": {"beat": 128, "timeSeconds": 60.0},
        "sections": [{"name": name, "startBeat": start, "endBeat": end,
                      "startSeconds": seconds(start), "endSeconds": seconds(end),
                      "description": description} for name, start, end, description in SECTIONS],
        "strongCues": sorted(strong, key=lambda x: x["beat"]),
    }
    assert len(cues["beats"]) == 128 and cues["beats"][-1] == 59.53125
    assert cues["endCue"]["timeSeconds"] == 60.0
    (OUT / "cues.json").write_text(json.dumps(cues, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--verify-only", action="store_true")
    parser.add_argument("--mp3", action="store_true", help="Also export an optional 320 kbps listening copy")
    args = parser.parse_args()
    if not shutil.which("ffmpeg") or not shutil.which("ffprobe"):
        raise RuntimeError("ffmpeg and ffprobe must be available on PATH")
    OUT.mkdir(parents=True, exist_ok=True)
    if not args.verify_only:
        mix, arrangement = arrange()
        arrangement["mastering"] = master(mix)
        (OUT / "synthesis.json").write_text(json.dumps(arrangement, indent=2) + "\n", encoding="utf-8")
        write_cues()
    verify()
    if args.mp3:
        run(["ffmpeg", "-y", "-hide_banner", "-nostats", "-i", str(OUT / "gym-electronic.wav"),
             "-c:a", "libmp3lame", "-b:a", "320k", str(OUT / "gym-electronic.mp3")], log="mp3-export.log")
    report(f"Verified master: {OUT / 'gym-electronic.wav'}")


if __name__ == "__main__":
    main()
