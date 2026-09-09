import { createRequire } from 'node:module'
import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { WORKOUT_GUIDE_BY_EXERCISE_ID } from '../src/lib/exercise-guide-assets.js'

const require = createRequire(import.meta.url)
const PT = require('../src/generated/pt-exercise-names.js').default
  || require('../src/generated/pt-exercise-names.js')

const SRC = 'C:/Users/FabianoSchmits/Downloads/Exercicios/novos'
const SKIP = new Set(['sprites_academia_v3'])
const FOLDER_ALIASES = {
  'Alongamento de panturrilhas com mãos': '1377',
  'Avanço para a frente': '3470',
  'Elevação de panturrilhas sentado agachamento no perna desenvolvimento': '1385',
  'Elevação de panturrilhas unilateral': '1387',
  'Extensão de tríceps alto polia acima da cabeça': '1722',
  'Flexão de braços inclinadoFlexão de braços inclinado': '0493',
  'Salto polichinelo': '3224',
  'Triceps mergulhos com peso adicional': '1755',
  'uxada suporte com barra': '0074',
}

function resolve(folderName) {
  if (FOLDER_ALIASES[folderName]) {
    const id = FOLDER_ALIASES[folderName]
    return { id, slug: WORKOUT_GUIDE_BY_EXERCISE_ID[id], pt: PT[id], via: 'alias' }
  }
  const lower = folderName.toLowerCase()
  const hits = Object.entries(PT).filter(([, name]) => String(name).toLowerCase() === lower)
  if (!hits.length) return null
  const active = hits.find(([id]) => WORKOUT_GUIDE_BY_EXERCISE_ID[id])
  const [id, pt] = active || hits[0]
  return {
    id,
    slug: WORKOUT_GUIDE_BY_EXERCISE_ID[id] || null,
    pt,
    via: 'exact',
    ambiguous: hits.length > 1 ? hits.map(([i, n]) => `${i}:${n}`) : null,
  }
}

const folders = readdirSync(SRC, { withFileTypes: true })
  .filter(d => d.isDirectory() && !SKIP.has(d.name))
  .map(d => d.name)
  .sort((a, b) => a.localeCompare(b, 'pt'))

const rows = []
for (const folder of folders) {
  const r = resolve(folder)
  rows.push({
    folder,
    id: r?.id || null,
    slug: r?.slug || null,
    pt: r?.pt || null,
    via: r?.via || null,
    nameMatch: r ? folder.toLowerCase() === String(r.pt).toLowerCase() : false,
    ambiguous: r?.ambiguous || null,
  })
}

const mismatches = rows.filter(r => r.via === 'alias' || (r.pt && !r.nameMatch) || r.ambiguous)
console.log('total', rows.length)
console.log('aliases_or_name_diff_or_ambiguous', mismatches.length)
for (const r of mismatches) {
  console.log(`- ${r.folder}`)
  console.log(`  -> ${r.id} ${r.slug} | PT: ${r.pt} | via=${r.via}`)
  if (r.ambiguous) console.log(`  ambiguous: ${r.ambiguous.join(' | ')}`)
}

// highlight ab wheel
const ab = rows.find(r => /roda/i.test(r.folder))
console.log('\\nAB WHEEL:', ab)
