import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import WORKOUT_GUIDE_PNG_SLUGS from '../frontend/src/lib/workout-guide-png-slugs.json' with { type: 'json' }
import WORKOUT_GUIDE_PNG_FRAME_COUNTS from '../frontend/src/lib/workout-guide-png-frame-counts.json' with { type: 'json' }

const GUIDE = 'frontend/src/assets/workout-guide'
const png = new Set(WORKOUT_GUIDE_PNG_SLUGS)
const report = {
  pngOk: [],
  pngBroken: [],
  orphanPngOnLegacy: [],
  svgFilesDeleted: [],
  orphanPngDeleted: [],
  extraFilesDeleted: [],
}

function list(dir) {
  return existsSync(dir) ? readdirSync(dir) : []
}

for (const entry of readdirSync(GUIDE, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue
  const slug = entry.name
  const dir = join(GUIDE, slug)
  const files = list(dir)
  const pngFiles = files.filter(f => /^frame-\d+\.png$/i.test(f)).sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]))
  const svgFiles = files.filter(f => /\.svg$/i.test(f))
  const other = files.filter(f => f !== 'frames.js' && !/^frame-\d+\.png$/i.test(f) && !/\.svg$/i.test(f))
  const framesPath = join(dir, 'frames.js')
  const frames = existsSync(framesPath) ? readFileSync(framesPath, 'utf8') : ''
  const isPngImport = frames.includes("from './frame-")
  const isEmbedded = frames.includes('data:image/png;base64')
  const inCatalogue = png.has(slug)

  // Delete any leftover .svg files everywhere under guide exercise folders
  for (const svg of svgFiles) {
    rmSync(join(dir, svg), { force: true })
    report.svgFilesDeleted.push(`${slug}/${svg}`)
  }

  if (inCatalogue) {
    if (!isPngImport || pngFiles.length < 2) {
      report.pngBroken.push({
        slug,
        isPngImport,
        pngFiles: pngFiles.length,
        expected: WORKOUT_GUIDE_PNG_FRAME_COUNTS[slug],
        embedded: isEmbedded,
        sample: frames.slice(0, 120),
      })
      continue
    }
    // Remove unexpected extras in PNG folders (keep only frames.js + frame-N.png)
    for (const f of other) {
      rmSync(join(dir, f), { force: true })
      report.extraFilesDeleted.push(`${slug}/${f}`)
    }
    // Drop PNG files beyond declared count / renumber sanity
    const expected = WORKOUT_GUIDE_PNG_FRAME_COUNTS[slug] || pngFiles.length
    if (pngFiles.length !== expected) {
      report.pngBroken.push({ slug, issue: 'count-mismatch', pngFiles: pngFiles.length, expected })
    } else {
      report.pngOk.push(slug)
    }
    continue
  }

  // Legacy slug: remove orphan PNG files that are NOT used by frames.js
  if (pngFiles.length && !isPngImport) {
    report.orphanPngOnLegacy.push({ slug, pngFiles: pngFiles.length, style: isEmbedded ? 'embedded' : 'vector' })
    for (const f of pngFiles) {
      rmSync(join(dir, f), { force: true })
      report.orphanPngDeleted.push(`${slug}/${f}`)
    }
  }
}

// manifest.json still points at .svg paths — it is metadata only, but keep a note
const manifestPath = join(GUIDE, 'manifest.json')
const manifestUsed = false

writeFileSync('scratch/sprite-cleanup-report.json', JSON.stringify({
  ...report,
  pngOkCount: report.pngOk.length,
  pngBrokenCount: report.pngBroken.length,
  svgDeletedCount: report.svgFilesDeleted.length,
  orphanPngDeletedCount: report.orphanPngDeleted.length,
  manifestPathExists: existsSync(manifestPath),
  manifestUsedAtRuntime: manifestUsed,
}, null, 2))

console.log(JSON.stringify({
  pngOkCount: report.pngOk.length,
  pngBrokenCount: report.pngBroken.length,
  pngBroken: report.pngBroken,
  svgDeletedCount: report.svgFilesDeleted.length,
  orphanPngDeletedCount: report.orphanPngDeleted.length,
  orphanPngOnLegacy: report.orphanPngOnLegacy,
  extraFilesDeleted: report.extraFilesDeleted,
}, null, 2))
