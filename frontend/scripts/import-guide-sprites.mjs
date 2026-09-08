#!/usr/bin/env node
// Copies new PNG sprite sets from the user's Downloads folder into workout-guide assets.
// Replaces SVG/PNG frames for every matched exercise; unmapped catalogue entries keep SVG.
// Usage: node scripts/import-guide-sprites.mjs [sourceDir]

import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { WORKOUT_GUIDE_BY_EXERCISE_ID } from '../src/lib/exercise-guide-assets.js'

const require = createRequire(import.meta.url)
const ptNames = require('../src/generated/pt-exercise-names.js')
const PT = ptNames.default || ptNames

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const GUIDE = join(ROOT, 'src', 'assets', 'workout-guide')
const DEFAULT_SRC = 'C:/Users/FabianoSchmits/Downloads/Exercicios/novos/Novos'

/** Folder names that do not match PT catalogue names exactly */
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
  if (direct.length) return direct.map(name => join(dir, name))

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const nested = collectFramePngs(join(dir, entry.name))
    if (nested.length) return nested
  }
  return []
}

function writeFramesModule(destDir, count) {
  const imports = Array.from({ length: count }, (_, i) =>
    `import frame${i + 1} from './frame-${i + 1}.png'`,
  ).join('\n')
  const list = Array.from({ length: count }, (_, i) => `frame${i + 1}`).join(', ')
  const source = `${imports}\n\nconst FRAMES = Object.freeze([${list}])\nexport default FRAMES\n`
  writeFileSync(join(destDir, 'frames.js'), source, 'utf8')
}

function clearGuideDir(destDir) {
  mkdirSync(destDir, { recursive: true })
  for (const f of readdirSync(destDir)) {
    if (/^frame-\d+\.png$/i.test(f) || f === 'frames.js' || /\.svg$/i.test(f)) {
      rmSync(join(destDir, f), { force: true })
    }
  }
}

function importSlug(srcDir, slug) {
  const destDir = join(GUIDE, slug)
  const pngs = collectFramePngs(srcDir)
  if (pngs.length < 2) throw new Error(`${slug}: expected at least 2 PNG frames in ${srcDir}`)

  clearGuideDir(destDir)
  pngs.forEach((srcPath, i) => {
    copyFileSync(srcPath, join(destDir, `frame-${i + 1}.png`))
  })
  writeFramesModule(destDir, pngs.length)
  return pngs.length
}

function resolveExerciseId(folderName) {
  if (FOLDER_ALIASES[folderName]) return FOLDER_ALIASES[folderName]
  const lower = folderName.toLowerCase()
  const hits = Object.entries(PT).filter(([, name]) => String(name).toLowerCase() === lower)
  if (!hits.length) return null
  const active = hits.find(([id]) => WORKOUT_GUIDE_BY_EXERCISE_ID[id])
  return (active || hits[0])[0]
}

const srcRoot = process.argv[2] || DEFAULT_SRC
if (!existsSync(srcRoot)) {
  console.error('Source directory not found:', srcRoot)
  process.exit(1)
}

const folders = readdirSync(srcRoot, { withFileTypes: true }).filter(d => d.isDirectory())
const imported = []
const skipped = []
const frameCounts = {}

for (const entry of folders) {
  const id = resolveExerciseId(entry.name)
  if (!id) {
    skipped.push({ folder: entry.name, reason: 'no PT name match' })
    continue
  }
  const slug = WORKOUT_GUIDE_BY_EXERCISE_ID[id]
  if (!slug) {
    skipped.push({ folder: entry.name, reason: `id ${id} not in active guide catalogue` })
    continue
  }
  try {
    const count = importSlug(join(srcRoot, entry.name), slug)
    frameCounts[slug] = count
    imported.push({ folder: entry.name, id, slug, frames: count })
  } catch (err) {
    skipped.push({ folder: entry.name, reason: err.message })
  }
}

const slugsPath = join(ROOT, 'src', 'lib', 'workout-guide-png-slugs.json')
const countsPath = join(ROOT, 'src', 'lib', 'workout-guide-png-frame-counts.json')

// Keep previous custom PNG sets that were not replaced in this import run.
if (existsSync(GUIDE)) {
  for (const entry of readdirSync(GUIDE, { withFileTypes: true })) {
    if (!entry.isDirectory() || frameCounts[entry.name]) continue
    const dir = join(GUIDE, entry.name)
    const pngs = readdirSync(dir).filter(name => /^frame-\d+\.png$/i.test(name))
    if (pngs.length >= 2 && existsSync(join(dir, 'frames.js'))) {
      const source = readFileSync(join(dir, 'frames.js'), 'utf8')
      if (/from '\.\/frame-\d+\.png'/.test(source)) {
        frameCounts[entry.name] = pngs.length
      }
    }
  }
}

const pngSlugs = Object.keys(frameCounts).sort()
writeFileSync(slugsPath, JSON.stringify(pngSlugs, null, 2) + '\n', 'utf8')
writeFileSync(countsPath, JSON.stringify(Object.fromEntries(pngSlugs.map(s => [s, frameCounts[s]])), null, 2) + '\n', 'utf8')

console.log(`Imported ${imported.length} exercises (${imported.reduce((n, r) => n + r.frames, 0)} PNG frames)`)
imported.forEach(r => console.log(`  ${r.slug} ← ${r.folder} [${r.id}] (${r.frames} frames)`))
console.log(`PNG catalogue total: ${pngSlugs.length} slugs`)
if (skipped.length) {
  console.warn('Skipped:')
  skipped.forEach(s => console.warn(`  ${s.folder}: ${s.reason}`))
}
