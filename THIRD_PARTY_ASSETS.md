# Exercise artwork

Fit Pro Player ships custom PNG sprite animations for exercises that have a validated
local guide. Each exercise folder under `frontend/src/assets/workout-guide/` contains
four frames (five for burpee) plus a generated `frames.js` module.

To import a new batch from the artist workflow:

```bash
node frontend/scripts/import-guide-sprites.mjs "path/to/Novos"
```

The import script copies PNGs, regenerates `frames.js`, updates
`workout-guide-png-slugs.json` and `workout-guide-import-map.json`, and removes any
stale guide folders that are not part of the import.

Exercises without a local animation remain in the source dataset for history and existing
plans, but are hidden from new selections until sprites are added.
