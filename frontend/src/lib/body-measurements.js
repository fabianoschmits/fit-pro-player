const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export const BODY_MEASUREMENT_PARTS = [
  { id: 'neck', label: 'Pescoço', circumferenceLabel: 'Circunferência do pescoço', shortLabel: 'Pescoço', shapeKey: 'neck', muscles: ['neck', 'trapezius'], view: 'front', guide: 'Contorne a base do pescoço, logo abaixo da laringe, com a cabeça neutra e a fita nivelada.' },
  { id: 'shoulders', label: 'Ombros', circumferenceLabel: 'Circunferência dos ombros', shortLabel: 'Ombros', shapeKey: 'shoulders', muscles: ['deltoids', 'upper-back'], view: 'back', guide: 'Passe a fita ao redor da maior circunferência dos deltoides, cruzando a parte superior do tórax e das costas, com os braços relaxados.' },
  { id: 'chest', label: 'Tórax', circumferenceLabel: 'Circunferência do tórax', shortLabel: 'Tórax', shapeKey: 'chest', muscles: ['chest', 'serratus'], view: 'front', guide: 'Meça horizontalmente na linha dos mamilos ou no ponto mais cheio do busto, passando pelas escápulas, após uma expiração normal.' },
  { id: 'left-arm', label: 'Braço esquerdo', circumferenceLabel: 'Circunferência do braço esquerdo', shortLabel: 'Braço E', shapeKey: 'arms', muscles: ['biceps', 'triceps'], view: 'front', side: 'left', pair: 'arms', guide: 'No ponto médio entre o ombro e o cotovelo, contorne o braço solto ao lado do corpo, sem contrair.' },
  { id: 'right-arm', label: 'Braço direito', circumferenceLabel: 'Circunferência do braço direito', shortLabel: 'Braço D', shapeKey: 'arms', muscles: ['biceps', 'triceps'], view: 'front', side: 'right', pair: 'arms', guide: 'No ponto médio entre o ombro e o cotovelo, contorne o braço solto ao lado do corpo, sem contrair.' },
  { id: 'left-forearm', label: 'Antebraço esquerdo', circumferenceLabel: 'Circunferência do antebraço esquerdo', shortLabel: 'Antebraço E', shapeKey: 'forearms', muscles: ['forearm'], view: 'front', side: 'left', pair: 'forearms', guide: 'Contorne a parte mais larga do antebraço, com o cotovelo estendido e a mão relaxada.' },
  { id: 'right-forearm', label: 'Antebraço direito', circumferenceLabel: 'Circunferência do antebraço direito', shortLabel: 'Antebraço D', shapeKey: 'forearms', muscles: ['forearm'], view: 'front', side: 'right', pair: 'forearms', guide: 'Contorne a parte mais larga do antebraço, com o cotovelo estendido e a mão relaxada.' },
  { id: 'waist', label: 'Cintura', circumferenceLabel: 'Circunferência da cintura', shortLabel: 'Cintura', shapeKey: 'waist', muscles: ['obliques', 'lower-back'], view: 'front', guide: 'Meça no ponto médio entre a última costela e o topo do quadril, após uma expiração normal, sem encolher a barriga.' },
  { id: 'abdomen', label: 'Abdômen', circumferenceLabel: 'Circunferência do abdômen', shortLabel: 'Abdômen', shapeKey: 'abdomen', muscles: ['abs'], view: 'front', guide: 'Passe a fita horizontalmente ao redor de todo o abdômen, na altura do umbigo, sem prender a respiração nem comprimir a pele.' },
  { id: 'hips', label: 'Quadris', circumferenceLabel: 'Circunferência dos quadris', shortLabel: 'Quadris', shapeKey: 'hips', muscles: ['gluteal', 'hip-flexors'], view: 'back', guide: 'Contorne a parte mais larga dos glúteos, com os pés juntos e o peso igualmente distribuído.' },
  { id: 'left-thigh', label: 'Coxa esquerda', circumferenceLabel: 'Circunferência da coxa esquerda', shortLabel: 'Coxa E', shapeKey: 'thighs', muscles: ['quadriceps', 'hamstring', 'adductors'], view: 'front', side: 'left', pair: 'thighs', guide: 'No ponto médio entre a virilha e o topo da patela, contorne a coxa com a perna relaxada.' },
  { id: 'right-thigh', label: 'Coxa direita', circumferenceLabel: 'Circunferência da coxa direita', shortLabel: 'Coxa D', shapeKey: 'thighs', muscles: ['quadriceps', 'hamstring', 'adductors'], view: 'front', side: 'right', pair: 'thighs', guide: 'No ponto médio entre a virilha e o topo da patela, contorne a coxa com a perna relaxada.' },
  { id: 'left-calf', label: 'Panturrilha esquerda', circumferenceLabel: 'Circunferência da panturrilha esquerda', shortLabel: 'Panturrilha E', shapeKey: 'calves', muscles: ['calves', 'tibialis'], view: 'back', side: 'left', pair: 'calves', guide: 'Contorne a parte mais larga da panturrilha em pé, com o peso distribuído nos dois pés.' },
  { id: 'right-calf', label: 'Panturrilha direita', circumferenceLabel: 'Circunferência da panturrilha direita', shortLabel: 'Panturrilha D', shapeKey: 'calves', muscles: ['calves', 'tibialis'], view: 'back', side: 'right', pair: 'calves', guide: 'Contorne a parte mais larga da panturrilha em pé, com o peso distribuído nos dois pés.' },
]

export const BODY_MEASUREMENT_PROTOCOL = 'Use uma fita métrica flexível e inextensível, sempre nivelada, justa sem apertar a pele e nas mesmas condições de horário, hidratação e treino.'

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

export function bodyMeasurementSnapshots(checkins) {
  const latest = {}
  const sources = {}
  return normalizeBodyMeasurementCheckins(checkins).map(item => {
    Object.entries(item.values).forEach(([partId, value]) => {
      latest[partId] = value
      sources[partId] = item.date
    })
    return {
      ...item,
      values: { ...latest },
      sources: { ...sources },
      directValues: { ...item.values },
    }
  })
}

export function interpolateBodyMeasurementSnapshot(checkins, timestamp) {
  const snapshots = bodyMeasurementSnapshots(checkins)
  if (!snapshots.length) return null
  const times = snapshots.map(item => new Date(`${item.date}T12:00:00`).getTime())
  const requested = Number.isFinite(Number(timestamp)) ? Number(timestamp) : times.at(-1)
  const time = Math.min(times.at(-1), Math.max(times[0], requested))
  let upperIndex = times.findIndex(value => value >= time)
  if (upperIndex < 0) upperIndex = times.length - 1
  const lowerIndex = Math.max(0, times[upperIndex] === time ? upperIndex : upperIndex - 1)
  const lower = snapshots[lowerIndex]
  const upper = snapshots[upperIndex]
  const span = times[upperIndex] - times[lowerIndex]
  const progress = span > 0 ? (time - times[lowerIndex]) / span : 0
  const values = {}
  const partIds = new Set([...Object.keys(lower.values), ...Object.keys(upper.values)])
  partIds.forEach(partId => {
    const from = lower.values[partId]
    const to = upper.values[partId]
    if (from != null && to != null) values[partId] = Math.round((from + (to - from) * progress) * 100) / 100
    else if (from != null) values[partId] = from
    else if (to != null) values[partId] = to
  })
  const nearestIndex = progress < 0.5 ? lowerIndex : upperIndex
  return {
    time,
    progress,
    lower,
    upper,
    nearest: snapshots[nearestIndex],
    nearestIndex,
    values,
  }
}

export function bodyMeasurementHistoryInPeriod(checkins, partId, days = 0, throughTimestamp = Infinity) {
  const history = bodyMeasurementHistory(checkins, partId).filter(point => point.t <= throughTimestamp)
  if (!days || !history.length) return history
  const anchor = Number.isFinite(throughTimestamp) ? throughTimestamp : history.at(-1).t
  const cutoff = anchor - days * 86400000
  return history.filter(point => point.t >= cutoff)
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
