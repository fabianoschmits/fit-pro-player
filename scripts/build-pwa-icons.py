"""Export the landing-page lion to web/PWA icons. Requires Pillow.

Run from any directory: python scripts/build-pwa-icons.py [--check].
The fingerprint includes the source and export settings, so changing either
produces fresh URLs without changing the installed application's identity.
"""
import argparse
import hashlib
from io import BytesIO
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / 'frontend/public'
SOURCE = PUBLIC / 'brand-logo.png'
SETTINGS = b'lion-pwa-v1:black:any=.92:maskable=.64:preview=1200x630'
FINGERPRINT = hashlib.sha256(SOURCE.read_bytes() + SETTINGS).hexdigest()[:12]
PREFIX = f'icons/lion-{FINGERPRINT}'
ART = Image.open(SOURCE).convert('RGBA')


def tile(size, scale=.92):
    canvas = Image.new('RGB', (size, size), '#000000')
    artwork = ART.copy()
    artwork.thumbnail((round(size * scale), round(size * scale)), Image.Resampling.LANCZOS)
    canvas.paste(artwork, ((size - artwork.width) // 2, (size - artwork.height) // 2), artwork)
    return canvas


def encode(image, format='PNG', **options):
    buffer = BytesIO()
    image.save(buffer, format=format, **options)
    return buffer.getvalue()


def exports():
    files = {}
    for size in (16, 32, 48, 180, 192, 512):
        files[f'{PREFIX}-{size}.png'] = encode(tile(size))
    for size in (192, 512):
        files[f'{PREFIX}-maskable-{size}.png'] = encode(tile(size, .64))
    files[f'{PREFIX}.ico'] = encode(tile(256), 'ICO', sizes=[(s, s) for s in (16, 32, 48, 64, 128, 256)])
    preview = Image.new('RGB', (1200, 630), '#000000')
    preview.paste(tile(580), (310, 25))
    files[f'{PREFIX}-preview.png'] = encode(preview)

    # Keep OS auto-discovery and already-installed manifests on the same lion.
    aliases = {
        'favicon.ico': f'{PREFIX}.ico',
        'favicon.png': f'{PREFIX}-48.png',
        'apple-touch-icon.png': f'{PREFIX}-180.png',
        'apple-touch-icon-precomposed.png': f'{PREFIX}-180.png',
        'apple-touch-icon-v21.png': f'{PREFIX}-180.png',
        'apple-touch-icon-v22.png': f'{PREFIX}-180.png',
    }
    for size in (16, 32, 48):
        aliases[f'favicon-{size}.png'] = f'{PREFIX}-{size}.png'
    for size in (180, 192, 512):
        aliases[f'icon-{size}.png'] = f'{PREFIX}-{size}.png'
    for size in (192, 512):
        aliases[f'icon-{size}-v22.png'] = f'{PREFIX}-{size}.png'
        for suffix in ('', '-v22'):
            aliases[f'icon-maskable-{size}{suffix}.png'] = f'{PREFIX}-maskable-{size}.png'
    files.update({alias: files[target] for alias, target in aliases.items()})
    return files


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='Verify committed exports without modifying files.')
    args = parser.parse_args()
    files = exports()
    if args.check:
        stale = [name for name, data in files.items() if not (PUBLIC / name).is_file() or (PUBLIC / name).read_bytes() != data]
        if stale:
            raise SystemExit('Missing or stale lion exports: ' + ', '.join(stale))
        print(f'Verified {len(files)} lion exports from {SOURCE.name}: {PREFIX}')
    else:
        for name, data in files.items():
            target = PUBLIC / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)
        print(f'Exported {len(files)} lion assets: /{PREFIX}')
        print('Use this fingerprint in index.html, manifest.json and the notification icon in sw.js.')
