import { isDeepStrictEqual } from 'node:util'

export function stateTimestamp(state) {
  const value = Number(state?._ts || 0)
  return Number.isFinite(value) && value > 0 ? value : 0
}

export function newerStateExists(stored, incoming) {
  return stateTimestamp(stored) > stateTimestamp(incoming)
}

// Equal versions are only safe when they are an idempotent retry of the same payload.
// Two devices can legitimately produce the same millisecond timestamp; accepting both would
// make the last request silently erase the other device's changes.
export function stateVersionConflict(stored, incoming) {
  if (!stored) return false
  const storedTs = stateTimestamp(stored)
  const incomingTs = stateTimestamp(incoming)
  return storedTs > incomingTs || (storedTs === incomingTs && !isDeepStrictEqual(stored, incoming))
}
