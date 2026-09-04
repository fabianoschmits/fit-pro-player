// The Push/Pull/Legs starter plan. Shared by the "Load starter plan" action in Settings
// and by the demo build, which seeds a history on top of exactly these routines.
import { uid } from './format.js'
import { t } from './i18n-core.js'
import { suggestedWeightFor } from './history.js'

const SPEC = [
  ['Dia de Peito', 'chest', [['0025', 4, 8], ['0047', 3, 10], ['0289', 3, 10], ['0308', 3, 12], ['0251', 3, 10], ['0314', 3, 10]]],
  ['Dia de Costas', 'back', [['0652', 4, 10], ['0027', 4, 8], ['2330', 3, 10], ['1323', 3, 10], ['0293', 3, 10], ['0076', 3, 12]]],
  ['Dia de Pernas', 'legs', [['0043', 4, 8], ['0085', 3, 10], ['0739', 3, 12], ['0585', 3, 12], ['0586', 3, 12], ['0605', 4, 15]]],
  ['Dia de Abdômen', 'abs', [['0274', 3, 15], ['0472', 3, 12], ['0687', 3, 20], ['0630', 3, 30], ['0002', 3, 15], ['0267', 3, 15]]],
  ['Dia de Braços', 'arm', [['0031', 3, 10], ['0313', 3, 10], ['0070', 3, 12], ['0060', 3, 10], ['0201', 3, 12], ['0057', 3, 10]]],
  ['Dia de Ombros', 'shoulders', [['0091', 4, 8], ['0334', 3, 12], ['0041', 3, 12], ['0076', 3, 12], ['2137', 3, 10], ['0326', 3, 12]]],
  ['Dia de Glúteos', 'glutes', [['1409', 4, 10], ['0043', 3, 10], ['0085', 3, 10], ['0054', 3, 12], ['0431', 3, 12], ['0586', 3, 12]]]
]

// Fresh routine objects (new ids)
export const starterRoutines = (st) =>
  SPEC.map(([name, emoji, list]) => ({ id: uid(), name: t(name), emoji, ex: list.map(([id, sets, reps]) => ({ id, sets, reps, weight: suggestedWeightFor(st, id) })) }))
