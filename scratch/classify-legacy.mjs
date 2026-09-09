import { readdirSync, readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { createRequire } from 'module'
import {
  WORKOUT_GUIDE_BY_EXERCISE_ID,
  WORKOUT_GUIDE_PNG_SLUGS,
  WORKOUT_GUIDE_SLUGS,
} from '../frontend/src/lib/exercise-guide-assets.js'

const PT = createRequire(import.meta.url)('../frontend/src/generated/pt-exercise-names.js').default
const png = new Set(WORKOUT_GUIDE_PNG_SLUGS)
const GUIDE = 'frontend/src/assets/workout-guide'

const bySlug = new Map()
for (const [id, slug] of Object.entries(WORKOUT_GUIDE_BY_EXERCISE_ID)) {
  if (!bySlug.has(slug)) bySlug.set(slug, [])
  bySlug.get(slug).push(id)
}

let pngImportOk = 0
for (const slug of WORKOUT_GUIDE_PNG_SLUGS) {
  const frames = readFileSync(join(GUIDE, slug, 'frames.js'), 'utf8')
  if (frames.includes("from './frame-")) pngImportOk++
}

const still = []
for (const slug of WORKOUT_GUIDE_SLUGS) {
  if (png.has(slug)) continue
  const frames = readFileSync(join(GUIDE, slug, 'frames.js'), 'utf8')
  let style = 'svg-vetorial'
  if (frames.includes('data:image/png;base64')) style = 'png-embutido-em-svg'
  if (frames.includes("from './frame-")) style = 'png-import-fora-do-catalogo'
  const orphanPng = existsSync(join(GUIDE, slug))
    ? readdirSync(join(GUIDE, slug)).filter(f => /^frame-\d+\.png$/i.test(f)).length
    : 0
  still.push({
    slug,
    names: bySlug.get(slug).map(id => `${PT[id]} [${id}]`),
    style,
    orphanPng,
  })
}

still.sort((a, b) => a.names[0].localeCompare(b.names[0], 'pt'))
console.log(JSON.stringify({
  pngCatalogue: WORKOUT_GUIDE_PNG_SLUGS.length,
  pngImportModulesOk: pngImportOk,
  stillLegacy: still.length,
  still,
}, null, 2))
