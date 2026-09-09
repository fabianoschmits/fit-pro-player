import { readdirSync, readFileSync, existsSync } from 'fs'
import { join } from 'path'
import WORKOUT_GUIDE_PNG_SLUGS from '../frontend/src/lib/workout-guide-png-slugs.json' with { type: 'json' }

const GUIDE = 'frontend/src/assets/workout-guide'
const png = new Set(WORKOUT_GUIDE_PNG_SLUGS)
const orphans = []
const svgModules = []

for (const entry of readdirSync(GUIDE, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue
  const slug = entry.name
  const dir = join(GUIDE, slug)
  const files = readdirSync(dir)
  const pngFiles = files.filter(f => /^frame-\d+\.png$/i.test(f))
  if (!existsSync(join(dir, 'frames.js'))) continue
  const frames = readFileSync(join(dir, 'frames.js'), 'utf8')
  const isPngImport = frames.includes("from './frame-")
  if (pngFiles.length && !isPngImport) {
    orphans.push({ slug, pngFiles: pngFiles.length, inCatalogue: png.has(slug) })
  }
  if (!isPngImport) svgModules.push(slug)
}

console.log(JSON.stringify({
  orphanPngWithSvgModule: orphans,
  svgModuleCount: svgModules.length,
  svgModules,
}, null, 2))
