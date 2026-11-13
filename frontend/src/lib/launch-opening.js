/** @typedef {[number, number]} Point */
/** @typedef {{ start: Point, end: Point, control?: Point }} Segment */

const cross = (a, b) => a[0] * b[1] - a[1] * b[0]
const interpolate = (a, b, t) => /** @type {Point} */ ([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t])

/** Parse only the absolute commands used by the traced launch logo. */
function segmentsFromPath(data, originX, originY) {
  const tokens = data.match(/[a-zA-Z]|[-+]?(?:\d*\.)?\d+(?:e[-+]?\d+)?/g) || []
  const segments = []
  let index = 0, command, point = /** @type {Point} */ ([0, 0]), first = point
  const number = () => {
    const value = Number(tokens[index++])
    if (!Number.isFinite(value)) throw new Error('Invalid launch path coordinate')
    return value
  }
  const coordinate = () => /** @type {Point} */ ([number() - originX, number() - originY])
  while (index < tokens.length) {
    if (/^[a-zA-Z]$/.test(tokens[index])) command = tokens[index++]
    if (!['M', 'L', 'H', 'V', 'Q', 'Z'].includes(command)) throw new Error('Unsupported launch path command')
    if (command === 'M') { point = coordinate(); first = point; command = 'L'; continue }
    let control
    if (command === 'Q') control = coordinate()
    const end = command === 'Z' ? first
      : command === 'H' ? /** @type {Point} */ ([number() - originX, point[1]])
        : command === 'V' ? /** @type {Point} */ ([point[0], number() - originY]) : coordinate()
    if (point[0] !== end[0] || point[1] !== end[1] || control) segments.push({ start: point, end, control })
    point = end
    if (command === 'Z') command = undefined
  }
  return segments
}

/**
 * Split curves at radial tangencies so each swept ribbon has a simple boundary.
 * Two corners inside the P counters turn back in angle around the zoom origin.
 * Keeping those turns in one ribbon could create opposite winding/self-overlap.
 * @param {Segment} segment
 * @returns {Segment[]}
 */
function angularSegments(segment) {
  const { start, end, control } = segment
  if (!control) return [segment]
  const d = [2 * (control[0] - start[0]), 2 * (control[1] - start[1])]
  const e = [start[0] - 2 * control[0] + end[0], start[1] - 2 * control[1] + end[1]]
  // cross(B(t), B'(t)) = a*t² + b*t + c.
  const a = cross(d, e), b = 2 * cross(start, e), c = cross(start, d)
  const discriminant = b * b - 4 * a * c
  const roots = Math.abs(a) < 1e-9 ? (Math.abs(b) < 1e-9 ? [] : [-c / b])
    : discriminant <= 0 ? [] : [(-b - Math.sqrt(discriminant)) / (2 * a), (-b + Math.sqrt(discriminant)) / (2 * a)]
  const times = [0, ...roots.filter(t => t > 1e-9 && t < 1 - 1e-9).sort((x, y) => x - y), 1]
  const pointAt = t => interpolate(interpolate(start, control, t), interpolate(control, end, t), t)
  return times.slice(1).map((to, index) => {
    const from = times[index], first = pointAt(from)
    return { start: first, end: pointAt(to), control: /** @type {Point} */ ([
      first[0] + (to - from) * (d[0] + 2 * e[0] * from) / 2,
      first[1] + (to - from) * (d[1] + 2 * e[1] * from) / 2,
    ]) }
  })
}

/**
 * Build one continuous SVG sweep instead of retaining discrete zoom stamps.
 * Render this data in a black, nonzero-filled path alongside the INITIAL
 * evenodd logo opening. Their union is every opening from startScale to scale.
 * No nodes or frame history are required; resizing/seeking is deterministic.
 * @param {string[]} paths Outer contours AND counter contours of the logo.
 */
export function createLaunchOpeningSweep(paths, originX = 650, originY = 235) {
  const segments = paths.flatMap(data => segmentsFromPath(data, originX, originY)).flatMap(angularSegments).flatMap(segment => {
    const { start, end, control } = segment
    const midpoint = control ? interpolate(interpolate(start, control, .5), interpolate(control, end, .5), .5) : interpolate(start, end, .5)
    const direction = cross(midpoint, [end[0] - start[0], end[1] - start[1]])
    if (Math.abs(direction) < 1e-9) return [] // A radial edge sweeps no area.
    // Every ribbon must have the same winding so overlaps add rather than cut.
    return [direction < 0 ? { start: end, end: start, control } : segment]
  })
  return (startScale, scale) => {
    if (scale <= startScale) return ''
    const at = (point, size) => point.map(value => Number((value * size).toFixed(6))).join(' ')
    return segments.map(({ start, end, control }) => {
      const forward = control ? `Q${at(control, startScale)} ${at(end, startScale)}` : `L${at(end, startScale)}`
      const backward = control ? `Q${at(control, scale)} ${at(start, scale)}` : `L${at(start, scale)}`
      return `M${at(start, startScale)}${forward}L${at(end, scale)}${backward}Z`
    }).join('')
  }
}
