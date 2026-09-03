// The Push/Pull/Legs starter plan. Shared by the "Load starter plan" action in Settings
// and by the demo build, which seeds a history on top of exactly these routines.
import { uid } from './format.js'
import { t } from './i18n-core.js'

const SPEC = [
  ['Push Day', 'barbell', [['0047', 4, 8], ['0030', 3, 10], ['0033', 3, 10], ['0162', 3, 12], ['0178', 3, 12], ['1722', 3, 12]]],
  ['Pull Day', 'pullup', [['0017', 4, 10], ['3017', 4, 8], ['3165', 3, 10], ['0120', 3, 10], ['0868', 3, 12], ['0165', 3, 12]]],
  ['Leg Day', 'legs', [['0042', 4, 8], ['0085', 3, 10], ['1409', 3, 12], ['1004', 3, 12], ['1373', 3, 15], ['0980', 3, 12]]],
]

// Fresh routine objects (new ids) — [push, pull, legs].
export const starterRoutines = () =>
  SPEC.map(([name, emoji, list]) => ({ id: uid(), name: t(name), emoji, ex: list.map(([id, sets, reps]) => ({ id, sets, reps, weight: 0 })) }))
