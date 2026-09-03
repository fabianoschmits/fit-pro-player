#!/usr/bin/env node
// Overlays custom PNG sprite folders onto restored SVG workout-guide assets.
// Run after: git checkout <base> -- frontend/src/assets/workout-guide/

import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const GUIDE = join(ROOT, 'src', 'assets', 'workout-guide')
const OVERLAY = join(ROOT, '.png-overlay')

/** Import slug → catalogue slug when they differ */
const SLUG_ALIASES = {
  'standing-calf-raise': 'calf-raise',
  'hip-thrust': 'barbell-glute-bridge',
}

function overlaySlug(importSlug) {
  const targetSlug = SLUG_ALIASES[importSlug] || importSlug
  const srcDir = join(OVERLAY, importSlug)
  const destDir = join(GUIDE, targetSlug)
  if (!existsSync(srcDir)) {
    console.warn('skip missing overlay:', importSlug)
    return null
  }

  mkdirSync(destDir, { recursive: true })
  for (const file of readdirSync(destDir)) {
    if (/^frame-\d+\.png$/i.test(file) || file === 'frames.js') {
      rmSync(join(destDir, file), { force: true })
    }
  }

  const pngs = readdirSync(srcDir)
    .filter(name => /^frame-\d+\.png$/i.test(name))
    .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]))

  pngs.forEach((name, i) => {
    copyFileSync(join(srcDir, name), join(destDir, `frame-${i + 1}.png`))
  })

  const imports = pngs.map((_, i) => `import frame${i + 1} from './frame-${i + 1}.png'`).join('\n')
  const list = pngs.map((_, i) => `frame${i + 1}`).join(', ')
  writeFileSync(join(destDir, 'frames.js'), `${imports}\n\nconst FRAMES = Object.freeze([${list}])\nexport default FRAMES\n`, 'utf8')

  return targetSlug
}

if (!existsSync(OVERLAY)) {
  console.error('Missing overlay directory:', OVERLAY)
  process.exit(1)
}

const imported = readdirSync(OVERLAY, { withFileTypes: true })
  .filter(entry => entry.isDirectory())
  .map(entry => overlaySlug(entry.name))
  .filter(Boolean)

const slugsPath = join(ROOT, 'src', 'lib', 'workout-guide-png-slugs.json')
writeFileSync(slugsPath, JSON.stringify([...new Set(imported)].sort(), null, 2) + '\n', 'utf8')
console.log(`Overlaid ${imported.length} PNG sprite sets`)
