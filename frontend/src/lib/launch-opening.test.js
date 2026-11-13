import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { createLaunchOpeningSweep } from './launch-opening.js'

// Independent paint oracle: flatten the exported SVG, then use its nonzero
// winding rule. Samples are safely inside/outside, away from antialiasing edges.
function contours(data) {
  const tokens = data.match(/[MLHVQZ]|-?(?:\d*\.)?\d+(?:e[+-]?\d+)?/gi) || []
  const result = []
  let index = 0, point = [0, 0], contour
  const number = () => Number(tokens[index++])
  while (index < tokens.length) {
    const command = tokens[index++]
    if (command === 'M') { point = [number(), number()]; contour = [point]; result.push(contour) }
    else if (command === 'Q') {
      const control = [number(), number()], end = [number(), number()], start = point
      for (let sample = 1; sample <= 64; sample++) {
        const t = sample / 64
        contour.push(start.map((value, axis) => (1 - t) ** 2 * value + 2 * (1 - t) * t * control[axis] + t ** 2 * end[axis]))
      }
      point = end
    } else if (command === 'Z') { contour.push(contour[0]); point = contour[0] }
    else {
      point = command === 'H' ? [number(), point[1]] : command === 'V' ? [point[0], number()] : [number(), number()]
      contour.push(point)
    }
  }
  return result
}

function contains(painted, x, y) {
  let winding = 0
  for (const contour of painted) for (let i = 1; i < contour.length; i++) {
    const [ax, ay] = contour[i - 1], [bx, by] = contour[i]
    const cross = (bx - ax) * (y - ay) - (by - ay) * (x - ax)
    if (ay <= y && by > y && cross > 0) winding++
    else if (ay > y && by <= y && cross < 0) winding--
  }
  return winding !== 0
}

it('reveals the continuous space between zoom frames instead of leaving stamped teeth', () => {
  const sweep = createLaunchOpeningSweep(['M4 1L6 1L5 2Z'], 0, 0)
  const painted = contours(sweep(1, 4))
  // This point is inside the triangle at scale 1.3, but outside both endpoints.
  expect(contains(painted, 6.5, 1.7)).toBe(true)
  expect(contains(painted, 8, 0.8)).toBe(false)
  expect(contains(painted, 8, 4)).toBe(false)
})

it('unions overlapping ribbons even when source contours have opposite winding', () => {
  const sweep = createLaunchOpeningSweep(['M4 1L6 1L5 2Z', 'M4 1L5 2L6 1Z'], 0, 0)
  expect(contains(contours(sweep(1, 4)), 6.5, 1.7)).toBe(true)
})

it('sweeps the real FPP curves without filling counters that have never been crossed', () => {
  const html = readFileSync('index.html', 'utf8')
  const paths = ['fpp-logo-shape', 'fpp-logo-counters'].flatMap(id => {
    const group = html.match(new RegExp(`<g id="${id}"[^>]*>([\\s\\S]*?)</g>`))[1]
    return [...group.matchAll(/<path d="([^"]+)"/g)].map(match => match[1])
  })
  const sweep = createLaunchOpeningSweep(paths)
  const painted = contours(sweep(.16, 1.84))
  const initialOuter = contours(paths.slice(0, 3).join('')), initialCounters = contours(paths.slice(3).join(''))
  const initiallyOpen = (x, y) => contains(initialOuter, x / .16 + 650, y / .16 + 235)
    && !contains(initialCounters, x / .16 + 650, y / .16 + 235)
  for (const scale of [.23, .37, .5, .76, 1.13]) {
    for (const [x, y] of [[300, 180], [600, 230], [790, 170], [1050, 230]]) {
      const px = (x - 650) * scale, py = (y - 235) * scale
      expect(initiallyOpen(px, py) || contains(painted, px, py), `${x},${y} at ${scale}`).toBe(true)
    }
  }
  // Native Chromium at 75% used to leave a 9.5 CSS-pixel black tooth here:
  // viewport 390x844, trail origin (195,398), screen point (325.5,458).
  expect(contains(painted, 130.5, 60)).toBe(true)
  // The first P's counter overlaps itself throughout this short zoom.
  expect(contains(contours(sweep(.16, .20)), 9, -11.7)).toBe(false)
})

it('adds no swept area until the opening actually grows', () => {
  expect(createLaunchOpeningSweep(['M4 1L6 1L5 2Z'], 0, 0)(1, 1)).toBe('')
})
