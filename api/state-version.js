export function stateTimestamp(state) {
  const value = Number(state?._ts || 0)
  return Number.isFinite(value) && value > 0 ? value : 0
}

export function newerStateExists(stored, incoming) {
  return stateTimestamp(stored) > stateTimestamp(incoming)
}
