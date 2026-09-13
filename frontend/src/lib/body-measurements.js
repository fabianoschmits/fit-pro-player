const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export const BODY_MEASUREMENT_PARTS = [
  { id: 'neck', label: 'Pescoço', shortLabel: 'Pescoço', muscles: ['neck', 'trapezius'], view: 'front', guide: 'Meça ao redor da base do pescoço, mantendo a fita nivelada.' },
  { id: 'shoulders', label: 'Ombros', shortLabel: 'Ombros', muscles: ['deltoids', 'upper-back'], view: 'back', guide: 'Passe a fita pela parte mais larga dos ombros e mantenha os braços relaxados.' },
  { id: 'chest', label: 'Peitoral', shortLabel: 'Peitoral', muscles: ['chest', 'serratus'], view: 'front', guide: 'Meça na altura dos mamilos, após uma expiração normal.' },
  { id: 'left-arm', label: 'Braço esquerdo', shortLabel: 'Braço E', muscles: ['biceps', 'triceps'], view: 'front', side: 'left', pair: 'arms', guide: 'Meça a parte mais larga do braço, relaxado e sem contrair.' },
  { id: 'right-arm', label: 'Braço direito', shortLabel: 'Braço D', muscles: ['biceps', 'triceps'], view: 'front', side: 'right', pair: 'arms', guide: 'Meça a parte mais larga do braço, relaxado e sem contrair.' },
  { id: 'left-forearm', label: 'Antebraço esquerdo', shortLabel: 'Antebraço E', muscles: ['forearm'], view: 'front', side: 'left', pair: 'forearms', guide: 'Meça a circunferência mais larga do antebraço com a mão relaxada.' },
  { id: 'right-forearm', label: 'Antebraço direito', shortLabel: 'Antebraço D', muscles: ['forearm'], view: 'front', side: 'right', pair: 'forearms', guide: 'Meça a circunferência mais larga do antebraço com a mão relaxada.' },
  { id: 'waist', label: 'Cintura', shortLabel: 'Cintura', muscles: ['obliques', 'lower-back'], view: 'front', guide: 'Meça a parte mais estreita do tronco, sem prender a respiração.' },
  { id: 'abdomen', label: 'Abdômen', shortLabel: 'Abdômen', muscles: ['abs'], view: 'front', guide: 'Passe a fita na altura do umbigo, sem comprimir a pele.' },
  { id: 'hips', label: 'Quadril', shortLabel: 'Quadril', muscles: ['gluteal', 'hip-flexors'], view: 'back', guide: 'Meça ao redor da parte mais larga dos glúteos.' },
  { id: 'left-thigh', label: 'Coxa esquerda', shortLabel: 'Coxa E', muscles: ['quadriceps', 'hamstring', 'adductors'], view: 'front', side: 'left', pair: 'thighs', guide: 'Meça a parte mais larga da coxa, com o peso distribuído nos dois pés.' },
  { id: 'right-thigh', label: 'Coxa direita', shortLabel: 'Coxa D', muscles: ['quadriceps', 'hamstring', 'adductors'], view: 'front', side: 'right', pair: 'thighs', guide: 'Meça a parte mais larga da coxa, com o peso distribuído nos dois pés.' },
  { id: 'left-calf', label: 'Panturrilha esquerda', shortLabel: 'Panturrilha E', muscles: ['calves', 'tibialis'], view: 'back', side: 'left', pair: 'calves', guide: 'Meça a parte mais larga da panturrilha em pé e com a perna relaxada.' },
  { id: 'right-calf', label: 'Panturrilha direita', shortLabel: 'Panturrilha D', muscles: ['calves', 'tibialis'], view: 'back', side: 'right', pair: 'calves', guide: 'Meça a parte mais larga da panturrilha em pé e com a perna relaxada.' },
]

export const BODY_MEASUREMENT_BY_ID = Object.fromEntries(BODY_MEASUREMENT_PARTS.map(part => [part.id, part]))
const VALID_PARTS = new Set(BODY_MEASUREMENT_PARTS.map(part => part.id))

const round1 = value => Math.round(value * 10) / 10
const validValue = value => {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 && number <= 400 ? round1(number) : null
}

export function bodyMeasurementWeekKey(value) {
  if (typeof value === 'string' && ISO_DATE.test(value)) {
    const parsed = new Date(`${value}T12:00:00`)
    const roundTrip = `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`
    if (roundTrip !== value) return null
  }
  const raw = typeof value === 'string' && ISO_DATE.test(value) ? `${value}T12:00:00` : value
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return null
  const monday = new Date(date)
  const day = monday.getDay() || 7
  monday.setDate(monday.getDate() - day + 1)
  return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`
}

export function normalizeBodyMeasurementGoals(source) {
  if (!source || typeof source !== 'object' || Array.isArray(source)) return {}
  return Object.fromEntries(Object.entries(source).flatMap(([partId, value]) => {
    const normalized = validValue(value)
    return VALID_PARTS.has(partId) && normalized != null ? [[partId, normalized]] : []
  }))
}

export function normalizeBodyMeasurementCheckins(source) {
  if (!Array.isArray(source)) return []
  const merged = new Map()
  source
    .filter(item => item && typeof item === 'object' && ISO_DATE.test(String(item.date || '')))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)) || Number(a.updatedAt || 0) - Number(b.updatedAt || 0))
    .forEach(item => {
      const week = bodyMeasurementWeekKey(item.date)
      if (!week) return
      const previous = merged.get(week) || { id: `body-${week}`, week, date: item.date, values: {}, createdAt: Number(item.createdAt || item.updatedAt || 0) }
      const values = { ...previous.values }
      Object.entries(item.values || {}).forEach(([partId, value]) => {
        const normalized = validValue(value)
        if (VALID_PARTS.has(partId) && normalized != null) values[partId] = normalized
      })
      const weight = validValue(item.weight)
      merged.set(week, {
        ...previous,
        id: String(item.id || previous.id),
        week,
        date: String(item.date) > String(previous.date) ? String(item.date) : String(previous.date),
        values,
        ...(weight != null ? { weight } : previous.weight != null ? { weight: previous.weight } : {}),
        ...(String(item.notes || '').trim() ? { notes: String(item.notes).trim().slice(0, 500) } : previous.notes ? { notes: previous.notes } : {}),
        createdAt: previous.createdAt || Number(item.createdAt || item.updatedAt || 0),
        updatedAt: Math.max(Number(previous.updatedAt || 0), Number(item.updatedAt || 0)),
      })
    })
  return [...merged.values()]
    .filter(item => Object.keys(item.values).length || item.weight != null || item.notes)
    .sort((a, b) => a.date.localeCompare(b.date))
}

export function currentBodyMeasurementCheckin(checkins, date) {
  const week = bodyMeasurementWeekKey(date)
  return normalizeBodyMeasurementCheckins(checkins).find(item => item.week === week) || null
}

export function upsertBodyMeasurement(checkins, { date, partId, value, now = Date.now() }) {
  if (!VALID_PARTS.has(partId)) return normalizeBodyMeasurementCheckins(checkins)
  const normalized = validValue(value)
  if (normalized == null || !ISO_DATE.test(String(date || ''))) return normalizeBodyMeasurementCheckins(checkins)
  const week = bodyMeasurementWeekKey(date)
  const all = normalizeBodyMeasurementCheckins(checkins)
  const index = all.findIndex(item => item.week === week)
  const next = index >= 0 ? { ...all[index], values: { ...all[index].values, [partId]: normalized }, date, updatedAt: now }
    : { id: `body-${week}`, week, date, values: { [partId]: normalized }, createdAt: now, updatedAt: now }
  if (index >= 0) all[index] = next
  else all.push(next)
  return normalizeBodyMeasurementCheckins(all)
}

export function removeBodyMeasurement(checkins, checkinId, partId) {
  return normalizeBodyMeasurementCheckins(checkins).flatMap(item => {
    if (item.id !== checkinId || !VALID_PARTS.has(partId)) return [item]
    const values = { ...item.values }
    delete values[partId]
    return Object.keys(values).length || item.weight != null || item.notes ? [{ ...item, values }] : []
  })
}

export function latestBodyMeasurements(checkins, throughDate = '9999-12-31') {
  const latest = {}
  normalizeBodyMeasurementCheckins(checkins).forEach(item => {
    if (item.date <= throughDate) Object.assign(latest, item.values)
  })
  return latest
}

export function bodyMeasurementHistory(checkins, partId) {
  if (!VALID_PARTS.has(partId)) return []
  return normalizeBodyMeasurementCheckins(checkins).flatMap(item => item.values[partId] == null ? [] : [{
    id: item.id, date: item.date, t: new Date(`${item.date}T12:00:00`).getTime(), value: item.values[partId], week: item.week,
  }])
}

export function measurementPartForMuscle(slug, selectedPartId) {
  const matches = BODY_MEASUREMENT_PARTS.filter(part => part.muscles.includes(slug))
  if (!matches.length) return null
  const selected = BODY_MEASUREMENT_BY_ID[selectedPartId]
  if (selected && matches.some(part => part.id === selected.id)) return selected.id
  return matches.find(part => part.side === 'right')?.id || matches[0].id
}

export function bodyMeasurementDelta(checkins, partId, days = 0) {
  const history = bodyMeasurementHistory(checkins, partId)
  if (!history.length) return { current: null, baseline: null, delta: null }
  const current = history.at(-1)
  if (history.length === 1) return { current, baseline: null, delta: null }
  const cutoff = days > 0 ? current.t - days * 86400000 : -Infinity
  const baseline = history.find(point => point.t >= cutoff) || history[0]
  if (baseline.id === current.id) return { current, baseline: null, delta: null }
  return { current, baseline, delta: round1(current.value - baseline.value) }
}
