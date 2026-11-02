const validId = value => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value || '')

// Assign legacy entries an ID once, before persisting or sending them. Never generate
// replacement IDs inside a network retry; server IDs are always retained.
export function ensureBodyIds(state) {
  const assign = rows => (Array.isArray(rows) ? rows : []).filter(row => row && typeof row === 'object' && !Array.isArray(row)).map(row => validId(row.id) ? row : { ...row, id: crypto.randomUUID() })
  return { ...state, bodyweight: assign(state.bodyweight), bodyMeasurements: assign(state.bodyMeasurements) }
}
const ordered = rows => rows.sort((a, b) => a.id.localeCompare(b.id))
export function bodyInput(state) {
  return {
    weights: ordered(state.bodyweight.map(row => ({ id: row.id, date: row.d, weightKg: row.w }))),
    measurements: ordered(state.bodyMeasurements.map(row => ({ id: row.id, date: row.date, valuesCm: row.values || {}, note: row.notes || '' }))),
  }
}
export function bodyWire(data) {
  return {
    weights: ordered(data.weights.map(row => ({ id: row.id, date: row.date, weightKg: row.weightKg }))),
    measurements: ordered(data.measurements.map(row => ({ id: row.id, date: row.date, valuesCm: row.valuesCm || {}, note: row.note || '' }))),
  }
}
