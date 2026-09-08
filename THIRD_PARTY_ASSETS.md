# Third-party and adapted exercise artwork

Fit Pro Player bundles 156 local PNG sprite sequences (646 individual frames). The app no
longer ships or renders the previous SVG animation modules. The active sprite inventory and
frame counts are generated in:

- `frontend/src/lib/workout-guide-png-slugs.json`
- `frontend/src/lib/workout-guide-png-frame-counts.json`

The project-specific PNG sets are imported with
`node frontend/scripts/import-guide-sprites.mjs`. Each exercise is mapped explicitly so that a
similar name cannot silently select a biomechanically different movement or piece of equipment.

## Upstream attribution

Where the PNG artwork adapts exercise poses from
[Workout Guide](https://github.com/bryllim/workout-guide) by
[Bryl Lim](https://bryllim.com), Workout Guide credits the original pose artwork to
[Everkinetic](https://github.com/everkinetic/data). Those upstream assets and adaptations remain
licensed under the
[Creative Commons Attribution-ShareAlike 4.0 International license](https://creativecommons.org/licenses/by-sa/4.0/)
(CC BY-SA 4.0), separately from the application code's AGPL license.

The corresponding attribution and license copies are stored in
`frontend/src/assets/workout-guide/ATTRIBUTION.md`, `LICENSE-ASSETS`, and `LICENSES.md`.

## Fit Pro Player changes

- Only exercises with a complete local PNG sprite sequence are exposed in new catalogue
  selections.
- Source records without a new PNG sequence remain indexed only for compatibility with existing
  plans and workout history; they do not load the removed legacy artwork.
- Duplicate source records are collapsed to one active exercise per movement and sprite set.
- Fit Pro Player supplies the animation timing, responsive layout, playback controls, and local
  image loading.
