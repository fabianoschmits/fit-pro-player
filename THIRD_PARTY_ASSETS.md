# Third-party exercise artwork

Fit Pro Player bundles selected exercise illustrations from
[Workout Guide](https://github.com/bryllim/workout-guide) by
[Bryl Lim](https://bryllim.com). The imported visual assets are licensed under the
[Creative Commons Attribution-ShareAlike 4.0 International license](https://creativecommons.org/licenses/by-sa/4.0/)
(CC BY-SA 4.0).

## Imported version

- Package: `@bryllim/workout-guide` 1.0.0
- Source commit: `ba0b709cb20430361b2cb33aaadd20998164a916`
- Imported catalogue subset: 172 Workout Guide exercises, 516 SVG frames
- Fit Pro Player mappings: 173 catalogue exercise IDs

The exact upstream attribution and source URL for each selected exercise are preserved in
`frontend/src/assets/workout-guide/manifest.json`. Copies of Workout Guide's
`ATTRIBUTION.md`, `LICENSE-ASSETS`, and `LICENSES.md` are stored alongside that manifest.

## Upstream attribution

Workout Guide credits the original pose artwork to
[Everkinetic](https://github.com/everkinetic/data), also under CC BY-SA 4.0. Bryl Lim expanded
that foundation with additional exercises and animation frames, normalized transparent
512 × 512 assets, structured metadata, package APIs, and the documentation gallery.

## Changes in Fit Pro Player

- Only exercises whose movement and equipment correspond to a Fit Pro Player catalogue entry
  are exposed. Similar but biomechanically different exercises are deliberately not mapped.
- Unmatched source records remain indexed only for compatibility with existing plans and workout
  history; they are hidden from new selections until a corresponding local animation is ready.
- Custom PNG sprite sets progressively replace the bundled SVG frames for redrawn exercises.
  The slug list lives in `frontend/src/lib/workout-guide-png-slugs.json`; import with
  `node frontend/scripts/import-guide-sprites.mjs`.
- Fit Pro Player supplies single-frame sequencing in the canonical 1-2-3 order, responsive
  layout, playback controls, and a theme-aware color treatment. Complete SVG drawings are never
  crossfaded or geometrically transformed, and their path geometry is unchanged.

The imported artwork and Fit Pro Player's visual adaptations remain available under CC BY-SA
4.0. This asset license is separate from the GNU AGPL-3.0-or-later license that covers the
application code.
