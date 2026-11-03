export const MAX_PROFESSIONAL_SPECIALTIES = 16
export const MAX_SPECIALTY_LENGTH = 48

export const PRACTICE_SPECIALTIES = Object.freeze([
  { id: 'hipertrofia', label: 'Hipertrofia' },
  { id: 'força', label: 'Força' },
  { id: 'emagrecimento', label: 'Emagrecimento' },
  { id: 'condicionamento físico', label: 'Condicionamento físico' },
  { id: 'funcional', label: 'Treinamento funcional' },
  { id: 'mobilidade', label: 'Mobilidade' },
  { id: 'alongamento', label: 'Alongamento' },
  { id: 'pilates', label: 'Pilates' },
  { id: 'yoga', label: 'Yoga' },
  { id: 'corrida', label: 'Corrida' },
  { id: 'natação', label: 'Natação' },
  { id: 'ciclismo', label: 'Ciclismo' },
  { id: 'dança', label: 'Dança' },
  { id: 'artes marciais', label: 'Artes marciais' },
  { id: 'cross training', label: 'Cross training' },
  { id: 'preparação física', label: 'Preparação física' },
  { id: 'performance esportiva', label: 'Performance esportiva' },
  { id: 'reabilitação', label: 'Reabilitação' },
  { id: 'idosos', label: 'Treinamento para idosos' },
  { id: 'infantojuvenil', label: 'Infantojuvenil' },
  { id: 'gestantes', label: 'Gestantes' },
  { id: 'avaliação física', label: 'Avaliação física' },
  { id: 'educação física escolar', label: 'Educação física escolar' },
])

const PRACTICE_IDS = new Set(PRACTICE_SPECIALTIES.map(item => item.id))

export function teachingSpecialty(id) {
  return `lecionar ${id}`
}

export function specialtyIdFromTeaching(value) {
  return String(value || '').startsWith('lecionar ') ? String(value).slice('lecionar '.length) : null
}

export function normalizeSpecialtyValue(value) {
  return String(value || '').trim().toLowerCase().slice(0, MAX_SPECIALTY_LENGTH)
}

export function splitProfessionalSpecialties(values = []) {
  const practice = []
  const teaching = []
  const custom = []
  for (const raw of values) {
    const value = normalizeSpecialtyValue(raw)
    if (!value) continue
    if (PRACTICE_IDS.has(value)) {
      if (!practice.includes(value)) practice.push(value)
      continue
    }
    const taught = specialtyIdFromTeaching(value)
    if (taught && PRACTICE_IDS.has(taught)) {
      if (!teaching.includes(taught)) teaching.push(taught)
      continue
    }
    if (!custom.includes(value)) custom.push(value)
  }
  return { practice, teaching, custom }
}

export function combineProfessionalSpecialties({ practice = [], teaching = [], custom = [] } = {}) {
  const values = [
    ...practice.map(normalizeSpecialtyValue),
    ...teaching.map(id => teachingSpecialty(normalizeSpecialtyValue(id))),
    ...custom.map(normalizeSpecialtyValue),
  ].filter(Boolean)
  return [...new Set(values)].slice(0, MAX_PROFESSIONAL_SPECIALTIES)
}

export function describeSpecialty(value) {
  const normalized = normalizeSpecialtyValue(value)
  const taught = specialtyIdFromTeaching(normalized)
  if (taught && PRACTICE_IDS.has(taught)) {
    return { kind: 'teaching', label: PRACTICE_SPECIALTIES.find(item => item.id === taught)?.label || taught }
  }
  return { kind: 'practice', label: PRACTICE_SPECIALTIES.find(item => item.id === normalized)?.label || normalized }
}
