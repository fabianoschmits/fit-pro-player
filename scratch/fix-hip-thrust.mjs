import { createHash } from 'crypto'
import { existsSync, readdirSync, readFileSync, copyFileSync, mkdirSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'

function hash(p) {
  return createHash('sha1').update(readFileSync(p)).digest('hex').slice(0, 12)
}

function pngFrames(dir) {
  return readdirSync(dir)
    .filter(f => /^frame[-_]?\d+\.png$/i.test(f))
    .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]))
}

function summarize(label, dir) {
  if (!existsSync(dir)) {
    console.log(label, 'MISSING')
    return
  }
  console.log(label, pngFrames(dir).map(f => `${f}:${hash(join(dir, f))}`).join(' '))
}

summarize('overlay hip-thrust', 'frontend/.png-overlay/hip-thrust')
summarize('guide barbell-glute-bridge', 'frontend/src/assets/workout-guide/barbell-glute-bridge')
summarize('guide hip-thrust pngs', 'frontend/src/assets/workout-guide/hip-thrust')
summarize('overlay standing-calf', 'frontend/.png-overlay/standing-calf-raise')
summarize('guide standing-calf', 'frontend/src/assets/workout-guide/standing-calf-raise')
summarize('guide calf-raise', 'frontend/src/assets/workout-guide/calf-raise')

const novos = 'C:/Users/FabianoSchmits/Downloads/Exercicios/novos/Novos'
for (const name of readdirSync(novos)) {
  if (/quadril|glute|panturrilha|ponte|hip|coice|barra/i.test(name)) {
    console.log('NOVOS:', name)
  }
}

// Fix hip-thrust from overlay
const src = 'frontend/.png-overlay/hip-thrust'
const dest = 'frontend/src/assets/workout-guide/hip-thrust'
if (existsSync(src)) {
  mkdirSync(dest, { recursive: true })
  for (const f of readdirSync(dest)) {
    if (/^frame-\d+\.png$/i.test(f) || f === 'frames.js') rmSync(join(dest, f), { force: true })
  }
  const frames = pngFrames(src)
  frames.forEach((name, i) => {
    copyFileSync(join(src, name), join(dest, `frame-${i + 1}.png`))
  })
  const imports = frames.map((_, i) => `import frame${i + 1} from './frame-${i + 1}.png'`).join('\n')
  const list = frames.map((_, i) => `frame${i + 1}`).join(', ')
  writeFileSync(join(dest, 'frames.js'), `${imports}\n\nconst FRAMES = Object.freeze([${list}])\nexport default FRAMES\n`)
  console.log('FIXED hip-thrust with', frames.length, 'png frames')
}

// Check if barbell-glute matches overlay hip (wrong alias)
const bg = 'frontend/src/assets/workout-guide/barbell-glute-bridge'
if (existsSync(src) && existsSync(bg)) {
  const a = pngFrames(src).map(f => hash(join(src, f))).join(',')
  const b = pngFrames(bg).map(f => hash(join(bg, f))).join(',')
  console.log('barbell-glute == overlay hip-thrust?', a === b)
}

const novosBridge = join(novos, 'Ponte de glúteos com barra')
if (existsSync(novosBridge)) {
  summarize('NOVOS ponte barra', novosBridge)
  const a = pngFrames(novosBridge).map(f => hash(join(novosBridge, f))).join(',')
  const b = pngFrames(bg).map(f => hash(join(bg, f))).join(',')
  console.log('barbell-glute == NOVOS ponte?', a === b)
}
