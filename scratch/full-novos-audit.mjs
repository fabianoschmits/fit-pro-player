import { createHash } from 'crypto'
import { createRequire } from 'module'
import { existsSync, readdirSync, readFileSync } from 'fs'
import { join } from 'path'
import {
  WORKOUT_GUIDE_BY_EXERCISE_ID,
  WORKOUT_GUIDE_PNG_SLUGS,
} from '../frontend/src/lib/exercise-guide-assets.js'

const PT = createRequire(import.meta.url)('../frontend/src/generated/pt-exercise-names.js').default
const SRC = 'C:/Users/FabianoSchmits/Downloads/Exercicios/novos/Novos'
const GUIDE = 'frontend/src/assets/workout-guide'
const pngSet = new Set(WORKOUT_GUIDE_PNG_SLUGS)

const FOLDER_ALIASES = {
  'Alongamento de panturrilhas com mãos': '1377',
  'Avanço para a frente': '3470',
  'Elevação de panturrilhas sentado agachamento no perna desenvolvimento': '1385',
  'Elevação de panturrilhas unilateral': '1387',
  'Flexão de braços inclinadoFlexão de braços inclinado': '0493',
  'Salto polichinelo': '3224',
  'Triceps mergulhos com peso adicional': '1755',
}
const FRAME_RE = /^(?:frame[_-]?(\d+)|(\d+))\.png$/i

function hash(p) {
  return createHash('sha1').update(readFileSync(p)).digest('hex')
}

function collect(dir) {
  const entries = readdirSync(dir, { withFileTypes: true })
  const direct = entries
    .filter(e => e.isFile() && FRAME_RE.test(e.name))
    .map(e => e.name)
    .sort((a, b) => {
      const ma = a.match(FRAME_RE)
      const mb = b.match(FRAME_RE)
      return Number(ma[1] || ma[2]) - Number(mb[1] || mb[2])
    })
  if (direct.length) return direct.map(n => join(dir, n))
  for (const e of entries) {
    if (!e.isDirectory()) continue
    const nested = collect(join(dir, e.name))
    if (nested.length) return nested
  }
  return []
}

function resolveId(folder) {
  if (FOLDER_ALIASES[folder]) return FOLDER_ALIASES[folder]
  const lower = folder.toLowerCase()
  const hits = Object.entries(PT).filter(([, n]) => String(n).toLowerCase() === lower)
  if (!hits.length) return null
  const active = hits.find(([id]) => WORKOUT_GUIDE_BY_EXERCISE_ID[id])
  return (active || hits[0])[0]
}

const ok = []
const bad = []
const unmapped = []

for (const folder of readdirSync(SRC, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name)) {
  const id = resolveId(folder)
  if (!id || !WORKOUT_GUIDE_BY_EXERCISE_ID[id]) {
    unmapped.push(folder)
    continue
  }
  const slug = WORKOUT_GUIDE_BY_EXERCISE_ID[id]
  const srcFrames = collect(join(SRC, folder))
  const destDir = join(GUIDE, slug)
  const framesJs = existsSync(join(destDir, 'frames.js')) ? readFileSync(join(destDir, 'frames.js'), 'utf8') : ''
  const destPngs = existsSync(destDir)
    ? readdirSync(destDir).filter(f => /^frame-\d+\.png$/i.test(f)).sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]))
    : []
  const issues = []
  if (!framesJs.includes("from './frame-")) issues.push('frames.js not PNG module')
  if (!pngSet.has(slug)) issues.push('missing from PNG catalogue')
  if (destPngs.length !== srcFrames.length) issues.push(`count src=${srcFrames.length} dest=${destPngs.length}`)
  const diffs = []
  for (let i = 0; i < Math.min(srcFrames.length, destPngs.length); i++) {
    if (hash(srcFrames[i]) !== hash(join(destDir, destPngs[i]))) diffs.push(i + 1)
  }
  if (diffs.length) issues.push(`hash mismatch: ${diffs.join(',')}`)

  const row = { folder, id, slug, name: PT[id], issues }
  if (issues.length) bad.push(row)
  else ok.push(row)
}

// Look for near-name confusion pairs: one PNG, one legacy
const legacySlugs = [...new Set(Object.values(WORKOUT_GUIDE_BY_EXERCISE_ID))].filter(s => !pngSet.has(s))
const confusions = []
for (const row of ok) {
  const key = row.name.toLowerCase().replace(/\s+/g, ' ')
  for (const [id, slug] of Object.entries(WORKOUT_GUIDE_BY_EXERCISE_ID)) {
    if (slug === row.slug || pngSet.has(slug)) continue
    const n = String(PT[id] || '').toLowerCase()
    if (!n) continue
    // share significant tokens
    const a = new Set(key.split(' ').filter(t => t.length > 3))
    const b = new Set(n.split(' ').filter(t => t.length > 3))
    let inter = 0
    for (const t of a) if (b.has(t)) inter++
    if (inter >= 3 && a.size && inter / Math.min(a.size, b.size) >= 0.6) {
      confusions.push({
        novo: `${row.name} [${row.id}] -> ${row.slug} (PNG OK)`,
        legadoParecido: `${PT[id]} [${id}] -> ${slug} (ainda SVG)`,
        overlap: inter,
      })
    }
  }
}

console.log(JSON.stringify({
  novosFolders: ok.length + bad.length + unmapped.length,
  ok: ok.length,
  bad,
  unmapped,
  confusions: confusions.sort((a, b) => b.overlap - a.overlap).slice(0, 40),
}, null, 2))
