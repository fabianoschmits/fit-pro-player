#!/usr/bin/env node
// Copies new PNG sprite sets from the user's Downloads folder into workout-guide assets.
// Usage: node scripts/import-guide-sprites.mjs [sourceDir]

import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const GUIDE = join(ROOT, 'src', 'assets', 'workout-guide')
const DEFAULT_SRC = 'C:/Users/FabianoSchmits/Downloads/Exercicios/novos/Novos'

/** Portuguese folder name → workout-guide slug */
const FOLDER_TO_SLUG = {
  'Abdominal ajoelhado no cabo': 'cable-crunch',
  'Agachamento com faixa elástica': 'banded-squat',
  'Agachamento frontal com barra': 'front-squat',
  'Barra fixa assistida': 'assisted-pull-up',
  'Bom-dia com barra': 'good-morning',
  'Borboleta ioga posição': 'butterfly-stretch',
  'Burpee': 'burpee',
  'Básico toque nos pés (masculino)': 'toe-touch',
  'Caminhada do urso': 'bear-crawl',
  'Crucifixo inclinado no cabo': 'incline-cable-fly',
  'Elevação de panturrilhas em pé com peso corporal': 'standing-calf-raise',
  'Elevação de quadril com faixa elástica': 'banded-glute-bridge',
  'Elevação frontal no cabo': 'cable-front-raise',
  'Elevação lateral no cabo': 'cable-lateral-raise',
  'Encolhimento com barra': 'shrug',
  'Extensão de quadril com tronco inclinado e faixa elástica': 'banded-kickback',
  'Extensão de tríceps alto polia acima da cabeça': 'overhead-tricep-extension',
  'Extensão de tríceps deitado tríceps testa com barra': 'skull-crusher',
  'Flexão de braços do arqueiro': 'archer-push-up',
  'Flexão de punhos com barra': 'wrist-curl',
  'Levantamento terra romeno com barra': 'romanian-deadlift',
  'Mergulho banco (joelhos flexionado)': 'bench-dip',
  'Mergulho para tríceps assistido (ajoelhado)': 'assisted-dip',
  'Ponte de glúteos com barra': 'hip-thrust',
  'Pressão Pallof horizontal com faixa elástica': 'banded-pallof-press',
  'Quadril adução no cabo': 'cable-standing-hip-adduction',
  'Remada alta com barra': 'upright-row',
  'Remada em pé (com toalha) com peso corporal': 'towel-row',
  'Remada pendlay com barra': 'pendlay-row',
  'Rosca arrasto com barra': 'drag-curl',
  'Rosca invertido com barra': 'reverse-curl',
  'Rosca martelo (com corda) no cabo': 'rope-hammer-curl',
  'Rosca no cabo': 'cable-curl',
  'Supino com pegada fechada com barra': 'close-grip-bench-press',
  'Supino declinado com barra': 'decline-bench-press',
  'Supino inclinado com barra': 'incline-bench-press',
  'uxada suporte com barra': 'rack-pull',
}

/** slug → exercise catalogue id */
export const SLUG_TO_EXERCISE_ID = {
  'cable-crunch': '0175',
  'banded-squat': '1004',
  'front-squat': '0042',
  'assisted-pull-up': '0017',
  'good-morning': '0044',
  'butterfly-stretch': '1494',
  'burpee': '1160',
  'toe-touch': '3212',
  'bear-crawl': '3360',
  'incline-cable-fly': '0171',
  'standing-calf-raise': '1373',
  'banded-glute-bridge': '1408',
  'cable-front-raise': '0162',
  'cable-lateral-raise': '0178',
  'shrug': '0095',
  'banded-kickback': '0980',
  'overhead-tricep-extension': '1722',
  'skull-crusher': '0060',
  'archer-push-up': '3294',
  'wrist-curl': '0126',
  'romanian-deadlift': '0085',
  'bench-dip': '0129',
  'assisted-dip': '0019',
  'hip-thrust': '1409',
  'banded-pallof-press': '0979',
  'cable-standing-hip-adduction': '0168',
  'upright-row': '0120',
  'towel-row': '3165',
  'pendlay-row': '3017',
  'drag-curl': '0038',
  'reverse-curl': '0080',
  'rope-hammer-curl': '0165',
  'cable-curl': '0868',
  'close-grip-bench-press': '0030',
  'decline-bench-press': '0033',
  'incline-bench-press': '0047',
  'rack-pull': '0074',
}

const FRAME_RE = /^frame[_-]?(\d+)\.png$/i

function frameSortKey(name) {
  const m = name.match(FRAME_RE)
  return m ? Number(m[1]) : 0
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

function importSlug(srcDir, slug) {
  const destDir = join(GUIDE, slug)
  const pngs = collectFramePngs(srcDir)
  if (pngs.length < 2) throw new Error(`${slug}: expected at least 2 PNG frames in ${srcDir}`)

  mkdirSync(destDir, { recursive: true })
  for (const f of readdirSync(destDir)) {
    if (/^frame-\d+\.(png|svg)$/i.test(f) || f === 'frames.js') {
      rmSync(join(destDir, f), { force: true })
    }
  }

  pngs.forEach((srcPath, i) => {
    copyFileSync(srcPath, join(destDir, `frame-${i + 1}.png`))
  })
  writeFramesModule(destDir, pngs.length)
  return pngs.length
}

function cleanupGuideDirs(keepSlugs) {
  const keep = new Set(keepSlugs)
  for (const entry of readdirSync(GUIDE, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      rmSync(join(GUIDE, entry.name), { force: true, recursive: true })
      continue
    }
    if (!keep.has(entry.name)) {
      rmSync(join(GUIDE, entry.name), { force: true, recursive: true })
    }
  }
}

const srcRoot = process.argv[2] || DEFAULT_SRC
if (!existsSync(srcRoot)) {
  console.error('Source directory not found:', srcRoot)
  process.exit(1)
}

const folders = readdirSync(srcRoot, { withFileTypes: true }).filter(d => d.isDirectory())
const imported = []
const skipped = []

for (const entry of folders) {
  const slug = FOLDER_TO_SLUG[entry.name]
  if (!slug) {
    skipped.push(entry.name)
    continue
  }
  const count = importSlug(join(srcRoot, entry.name), slug)
  imported.push({ folder: entry.name, slug, frames: count })
}

cleanupGuideDirs(imported.map(r => r.slug))

const slugsPath = join(ROOT, 'src', 'lib', 'workout-guide-png-slugs.json')
writeFileSync(slugsPath, JSON.stringify(imported.map(r => r.slug).sort(), null, 2) + '\n', 'utf8')

const mappingPath = join(ROOT, 'src', 'lib', 'workout-guide-import-map.json')
const byId = {}
for (const { slug } of imported) {
  const id = SLUG_TO_EXERCISE_ID[slug]
  if (!id) throw new Error(`Missing exercise id for slug: ${slug}`)
  byId[id] = slug
}
writeFileSync(mappingPath, JSON.stringify(byId, null, 2) + '\n', 'utf8')

console.log(`Imported ${imported.length} exercises (${imported.reduce((n, r) => n + r.frames, 0)} PNG frames)`)
imported.forEach(r => console.log(`  ${r.slug} ← ${r.folder} (${r.frames} frames)`))
if (skipped.length) {
  console.warn('Unmapped folders (skipped):', skipped.join(', '))
}
