// Coordinates use a fixed 3:4 stage, in units of stage height. One uniform scale.
export function defaultTransform(width, height) {
  const ratio = width / height
  const scale = Math.min(1, .75 / ratio)
  return { scale, x: (.75 - ratio * scale) / 2, y: (1 - scale) / 2 }
}

export function clampTransform(value) {
  const bounded = (n, min, max, fallback) => Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback
  return { scale: bounded(value?.scale, .1, 4, 1), x: bounded(value?.x, -2, 2, 0), y: bounded(value?.y, -2, 2, 0) }
}

export function alignmentFromLandmarks(points, width, height, angle) {
  const valid = i => points[i] && (points[i].visibility ?? 0) >= .65 && Number.isFinite(points[i].x) && Number.isFinite(points[i].y)
  const center = indices => {
    const good = indices.filter(valid)
    if (!good.length) return null
    return { x: good.reduce((s, i) => s + points[i].x, 0) / good.length, y: good.reduce((s, i) => s + points[i].y, 0) / good.length }
  }
  const shoulders = center([11, 12]), hips = center([23, 24])
  if (!shoulders || !hips || hips.y - shoulders.y < .12) return null
  // Side/back poses never require a face; shoulders are the fallback anchor.
  const face = angle === 'front' && [0, 2, 5].every(valid) ? center([0, 2, 5]) : null
  const head = center([7, 8, 0])
  const knees = center([25, 26]), ankles = center([27, 28])
  const anchor = face || (head && head.y < shoulders.y ? head : shoulders)
  const anchorTargetY = face || anchor === head ? .12 : .27
  const bottom = ankles || knees || hips
  const targetBottom = ankles ? .92 : knees ? .72 : .52
  let scale = (targetBottom - anchorTargetY) / (bottom.y - anchor.y)
  if (!Number.isFinite(scale) || scale <= 0) return null
  const ratio = width / height
  const visible = points.filter((_, i) => valid(i))
  const left = Math.min(...visible.map(p => p.x))
  const right = Math.max(...visible.map(p => p.x))
  // Both poses share an anchor. Constrain scale to retain detected body extrema.
  const horizontalExtent = Math.max(anchor.x - left, right - anchor.x) * ratio
  if (horizontalExtent > 0) scale = Math.min(scale, .34 / horizontalExtent)
  scale = Math.min(scale, 2.5)
  return clampTransform({ scale, x: .375 - anchor.x * ratio * scale, y: anchorTargetY - anchor.y * scale })
}

export async function analyzeProgressPhoto(blob, width, height, angle, signal) {
  if (signal?.aborted) return null
  let worker
  try {
    if (typeof Worker === 'undefined') return null
    worker = new Worker(new URL('./progress-photo-pose.worker.js', import.meta.url), { type: 'module' })
  } catch { return null }
  return new Promise(resolve => {
    const finish = value => {
      clearTimeout(timeout)
      signal?.removeEventListener('abort', abort)
      worker.terminate()
      resolve(value)
    }
    const abort = () => finish(null)
    const timeout = setTimeout(abort, 45000)
    signal?.addEventListener('abort', abort, { once: true })
    worker.onerror = () => finish(null)
    worker.onmessage = event => finish(event.data?.points ? alignmentFromLandmarks(event.data.points, width, height, angle) : null)
    if (signal?.aborted) { finish(null); return }
    try { worker.postMessage({ blob, base: new URL(`${import.meta.env.BASE_URL}pose/`, location.href).href }) }
    catch { finish(null) }
  })
}
