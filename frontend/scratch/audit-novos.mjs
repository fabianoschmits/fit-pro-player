import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { WORKOUT_GUIDE_BY_EXERCISE_ID } from '../src/lib/exercise-guide-assets.js'
import PNG_SLUGS from '../src/lib/workout-guide-png-slugs.json' with { type: 'json' }

const require = createRequire(import.meta.url)
const PT = require('../src/generated/pt-exercise-names.js').default
  || require('../src/generated/pt-exercise-names.js')

const SRC = 'C:/Users/FabianoSchmits/Downloads/Exercicios/novos'
const GUIDE = join(process.cwd(), 'src/assets/workout-guide')
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
const FRAME_RE = /^(?:frame[_-]?(\d+)|(\d+))\.png$/i
const pngSet = new Set(PNG_SLUGS)

function frameSortKey(name) {
  const m = name.match(FRAME_RE)
  return m ? Number(m[1] || m[2]) : 0
}

function collectFramePngs(dir) {
  const entries = readdirSync(dir, { withFileTypes: true })
  const direct = entries
    .filter(e => e.isFile() && FRAME_RE.test(e.name))
    .map(e => e.name)
    .sort((a, b) => frameSortKey(a) - frameSortKey(b))
  if (direct.length) return direct.map(n => join(dir, n))
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const nested = collectFramePngs(join(dir, entry.name))
    if (nested.length) return nested
  }
  return []
}

function fileHash(path) {
  return createHash('sha1').update(readFileSync(path)).digest('hex')
}

function resolveExerciseId(folderName) {
  if (FOLDER_ALIASES[folderName]) return FOLDER_ALIASES[folderName]
  const lower = folderName.toLowerCase()
  const hits = Object.entries(PT).filter(([, name]) => String(name).toLowerCase() === lower)
  if (!hits.length) return null
  const active = hits.find(([id]) => WORKOUT_GUIDE_BY_EXERCISE_ID[id])
  return (active || hits[0])[0]
}

const folders = readdirSync(SRC, { withFileTypes: true })
  .filter(d => d.isDirectory() && !SKIP.has(d.name))
let ok = 0
const problems = []

for (const entry of folders) {
  const id = resolveExerciseId(entry.name)
  if (!id) {
    problems.push({ type: 'UNMAPPED', folder: entry.name })
    continue
  }
  const slug = WORKOUT_GUIDE_BY_EXERCISE_ID[id]
  if (!slug) {
    problems.push({ type: 'INACTIVE', folder: entry.name, id })
    continue
  }
  const srcFrames = collectFramePngs(join(SRC, entry.name))
  const destDir = join(GUIDE, slug)
  const destFrames = existsSync(destDir)
    ? readdirSync(destDir)
      .filter(n => /^frame-\d+\.png$/i.test(n))
      .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]))
      .map(n => join(destDir, n))
    : []

  if (!pngSet.has(slug)) problems.push({ type: 'NOT_IN_CATALOGUE', folder: entry.name, slug })
  const jsPath = join(destDir, 'frames.js')
  const js = existsSync(jsPath) ? readFileSync(jsPath, 'utf8') : ''
  if (!/from '\.\/frame-\d+\.png'/.test(js)) {
    problems.push({ type: 'BAD_FRAMES_JS', folder: entry.name, slug })
  }
  if (
    destFrames.length !== srcFrames.length
    || srcFrames.some((p, i) => fileHash(p) !== fileHash(destFrames[i]))
  ) {
    problems.push({
      type: 'HASH',
      folder: entry.name,
      id,
      slug,
      src: srcFrames.length,
      dest: destFrames.length,
    })
    continue
  }
  ok += 1
}

console.log(JSON.stringify({ total: folders.length, ok, problems }, null, 2))
