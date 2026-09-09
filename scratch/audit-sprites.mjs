import { createHash } from 'crypto'
import { createRequire } from 'module'
import { existsSync, readdirSync, readFileSync } from 'fs'
import { join } from 'path'
import {
  WORKOUT_GUIDE_BY_EXERCISE_ID,
  WORKOUT_GUIDE_PNG_SLUGS,
} from '../frontend/src/lib/exercise-guide-assets.js'

const require = createRequire(import.meta.url)
const PT = (require('../frontend/src/generated/pt-exercise-names.js')).default
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
const PNG_IMPORT_RE = /from '\.\/frame-\d+\.png'/

function hash(p) {
  return createHash('sha1').update(readFileSync(p)).digest('hex').slice(0, 12)
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

const folders = readdirSync(SRC, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name)
const ok = []
const mismatch = []
const unmapped = []
const wrongFramesJs = []

for (const folder of folders) {
  const id = resolveId(folder)
  if (!id) {
    unmapped.push(folder)
    continue
  }
  const slug = WORKOUT_GUIDE_BY_EXERCISE_ID[id]
  if (!slug) {
    unmapped.push(`${folder} (id ${id} inactive)`)
    continue
  }
  const srcFrames = collect(join(SRC, folder))
  const destDir = join(GUIDE, slug)
  if (!existsSync(destDir)) {
    mismatch.push({ folder, id, slug, name: PT[id], issues: ['missing dest dir'] })
    continue
  }
  const framesJs = readFileSync(join(destDir, 'frames.js'), 'utf8')
  const isPngModule = PNG_IMPORT_RE.test(framesJs)
  const destPngs = readdirSync(destDir)
    .filter(f => /^frame-\d+\.png$/i.test(f))
    .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]))
  const issues = []
  if (!isPngModule) issues.push('frames.js still SVG/embedded, not PNG imports')
  if (!pngSet.has(slug)) issues.push('slug not in WORKOUT_GUIDE_PNG_SLUGS')
  if (destPngs.length !== srcFrames.length) {
    issues.push(`frame count src=${srcFrames.length} dest=${destPngs.length}`)
  }
  const cmp = Math.min(srcFrames.length, destPngs.length)
  const hashDiff = []
  for (let i = 0; i < cmp; i++) {
    if (hash(srcFrames[i]) !== hash(join(destDir, destPngs[i]))) hashDiff.push(i + 1)
  }
  if (hashDiff.length) issues.push(`hash mismatch frames: ${hashDiff.join(',')}`)

  // Same PT name mapped to multiple active IDs?
  const sameName = Object.entries(PT)
    .filter(([, n]) => String(n).toLowerCase() === folder.toLowerCase())
    .filter(([otherId]) => WORKOUT_GUIDE_BY_EXERCISE_ID[otherId])
  if (sameName.length > 1) {
    issues.push(`ambiguous active IDs: ${sameName.map(([i]) => i).join(',')}`)
  }

  const row = {
    folder,
    id,
    slug,
    name: PT[id],
    src: srcFrames.length,
    dest: destPngs.length,
    pngModule: isPngModule,
    inCatalogue: pngSet.has(slug),
    issues,
  }
  if (issues.length) mismatch.push(row)
  else ok.push(row)
}

for (const slug of WORKOUT_GUIDE_PNG_SLUGS) {
  const framesJsPath = join(GUIDE, slug, 'frames.js')
  if (!existsSync(framesJsPath)) {
    wrongFramesJs.push({ slug, issue: 'missing frames.js' })
    continue
  }
  const src = readFileSync(framesJsPath, 'utf8')
  if (!PNG_IMPORT_RE.test(src)) wrongFramesJs.push({ slug, issue: 'not png import module' })
}

const coice = [...ok, ...mismatch].filter(r =>
  /coice|kickback/i.test(`${r.folder} ${r.slug} ${r.name}`),
)

console.log(JSON.stringify({
  folders: folders.length,
  ok: ok.length,
  mismatch: mismatch.length,
  unmapped,
  mismatches: mismatch,
  wrongFramesJs,
  coice,
}, null, 2))
