"""Export application sprites and avatars as bounded WebP assets (Pillow required).

Original PNGs are retained as source files and are no longer imported into builds.
Run from any directory; paths are anchored to this repository.
"""
from pathlib import Path
import json
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'frontend' / 'src' / 'assets'

def convert(source: Path, longest: int) -> tuple[int, int]:
    with Image.open(source) as original:
        image = original.convert('RGBA')
        image.thumbnail((longest, longest), Image.Resampling.LANCZOS)
        target = source.with_suffix('.webp')
        image.save(target, 'WEBP', quality=86, method=6, exact=True)
        with Image.open(target) as check:
            if check.size != image.size or check.mode not in ('RGBA', 'RGB'):
                raise ValueError(f'Invalid export: {target}')
        return source.stat().st_size, target.stat().st_size

def main():
    original = optimized = count = 0
    for category, maximum in [('exercise-sprites', 768), ('avatars', 256)]:
        for source in sorted((ASSETS / category).rglob('*.png')):
            before, after = convert(source, maximum)
            original += before; optimized += after; count += 1
        if category == 'exercise-sprites':
            for module in (ASSETS / category).glob('*/frames.js'):
                module.write_text(module.read_text(encoding='utf-8').replace('.png', '.webp'), encoding='utf-8')
    print(json.dumps({'images': count, 'source_bytes': original, 'webp_bytes': optimized,
                      'reduction_percent': round((1 - optimized / original) * 100, 2)}, indent=2))

if __name__ == '__main__':
    main()
