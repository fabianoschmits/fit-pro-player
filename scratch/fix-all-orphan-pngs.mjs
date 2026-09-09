import { existsSync, readdirSync, readFileSync, writeFileSync, copyFileSync, rmSync, mkdirSync } from 'fs'
import { join } from 'path'
import { execSync } from 'child_process'
import { createRequire } from 'module'
import {
  WORKOUT_GUIDE_BY_EXERCISE_ID,
  WORKOUT_GUIDE_PNG_SLUGS,
} from '../frontend/src/lib/exercise-guide-assets.js'

const PT = createRequire(import.meta.url)('../frontend/src/generated/pt-exercise-names.js').default
const GUIDE = 'frontend/src/assets/workout-guide'
const pngCatalogue = new Set(WORKOUT_GUIDE_PNG_SLUGS)

function listDiskPng(dir) {
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter(f => /^frame-\d+\.png$/i.test(f))
    .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]))
}

function isPngModule(frames) {
  return frames.includes("from './frame-")
}

function writePngFramesJs(dir, count) {
  const imports = Array.from({ length: count }, (_, i) => `import frame${i + 1} from './frame-${i + 1}.png'`).join('\n')
  const list = Array.from({ length: count }, (_, i) => `frame${i + 1}`).join(', ')
  writeFileSync(join(dir, 'frames.js'), `${imports}\n\nconst FRAMES = Object.freeze([${list}])\nexport default FRAMES\n`)
}

function gitHasPng(slug) {
  try {
    const out = execSync(`git ls-files -- "frontend/src/assets/workout-guide/${slug}/frame-*.png"`, { encoding: 'utf8' })
    return out.trim().split(/\r?\n/).filter(Boolean)
  } catch {
    return []
  }
}

function restorePngFromGit(slug, files) {
  const dir = join(GUIDE, slug)
  mkdirSync(dir, { recursive: true })
  for (const file of files) {
    const name = file.split('/').pop()
    execSync(`git checkout HEAD -- "${file.replace(/\\/g, '/')}"`, { stdio: 'ignore' })
  }
  return listDiskPng(dir).length
}

const report = {
  alreadyOk: [],
  fixedOrphanPngIgnoredBySvgModule: [],
  restoredFromGitAndFixed: [],
  stillLegacyNoPng: [],
  catalogueButNotPngModule: [],
}

for (const entry of readdirSync(GUIDE, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue
  const slug = entry.name
  const dir = join(GUIDE, slug)
  const framesPath = join(dir, 'frames.js')
  if (!existsSync(framesPath)) continue
  const frames = readFileSync(framesPath, 'utf8')
  const diskPng = listDiskPng(dir)
  const trackedPng = gitHasPng(slug)
  const pngMod = isPngModule(frames)

  if (pngMod && diskPng.length >= 2) {
    report.alreadyOk.push(slug)
    continue
  }

  // Same hip-thrust bug: SVG/embedded module while PNGs exist on disk
  if (!pngMod && diskPng.length >= 2) {
    writePngFramesJs(dir, diskPng.length)
    report.fixedOrphanPngIgnoredBySvgModule.push({ slug, frames: diskPng.length, inCatalogue: pngCatalogue.has(slug) })
    continue
  }

  // PNGs tracked in git but missing on disk + SVG module
  if (!pngMod && diskPng.length < 2 && trackedPng.length >= 2) {
    const count = restorePngFromGit(slug, trackedPng)
    if (count >= 2) {
      writePngFramesJs(dir, count)
      report.restoredFromGitAndFixed.push({ slug, frames: count, inCatalogue: pngCatalogue.has(slug) })
      continue
    }
  }

  if (pngCatalogue.has(slug) && !pngMod) {
    report.catalogueButNotPngModule.push(slug)
  }

  if (!pngMod) {
    const ids = Object.entries(WORKOUT_GUIDE_BY_EXERCISE_ID).filter(([, s]) => s === slug).map(([id]) => id)
    report.stillLegacyNoPng.push({
      slug,
      names: ids.map(id => PT[id] || id),
      diskPng: diskPng.length,
      trackedPng: trackedPng.length,
    })
  }
}

// Ensure catalogue includes every slug we fixed/restored
const slugsPath = 'frontend/src/lib/workout-guide-png-slugs.json'
const countsPath = 'frontend/src/lib/workout-guide-png-frame-counts.json'
const slugs = new Set(JSON.parse(readFileSync(slugsPath, 'utf8')))
const counts = JSON.parse(readFileSync(countsPath, 'utf8'))

for (const row of [...report.fixedOrphanPngIgnoredBySvgModule, ...report.restoredFromGitAndFixed]) {
  slugs.add(row.slug)
  counts[row.slug] = row.frames
}
// also ensure already-ok catalogue stays consistent
for (const slug of slugs) {
  const n = listDiskPng(join(GUIDE, slug)).length
  if (n >= 2) counts[slug] = n
}

const sorted = [...slugs].sort()
writeFileSync(slugsPath, JSON.stringify(sorted, null, 2) + '\n')
writeFileSync(countsPath, JSON.stringify(Object.fromEntries(sorted.map(s => [s, counts[s] || listDiskPng(join(GUIDE, s)).length || 4])), null, 2) + '\n')

console.log(JSON.stringify({
  alreadyOk: report.alreadyOk.length,
  fixedOrphan: report.fixedOrphanPngIgnoredBySvgModule,
  restoredFromGit: report.restoredFromGitAndFixed,
  catalogueBroken: report.catalogueButNotPngModule,
  stillLegacy: report.stillLegacyNoPng,
  pngCatalogueNow: sorted.length,
}, null, 2))
