import { dateLocale } from './i18n-core.js'

export const KG_PER_LB = 0.45359237
export const MASS_UNIT = 'kg'
export const STATE_SCHEMA_VERSION = 2

export function normalizeDisplayUnit(value) {
  if (value === 'kg' || value === 'lb') return value
  throw new TypeError('invalid-display-unit')
}

function validMass(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

const precise = value => Math.round(value * 1_000_000) / 1_000_000

export function toDisplayMass(kg, displayUnit) {
  normalizeDisplayUnit(displayUnit)
  if (!validMass(kg)) return null
  return precise(displayUnit === 'lb' ? kg / KG_PER_LB : kg)
}

export function fromDisplayMass(value, displayUnit) {
  normalizeDisplayUnit(displayUnit)
  if (!validMass(value)) return null
  return precise(displayUnit === 'lb' ? value * KG_PER_LB : value)
}

export function formatDisplayMass(kg, displayUnit) {
  const value = toDisplayMass(kg, displayUnit)
  const formatted = value === null ? null : (Math.round(value * 10) / 10).toLocaleString(dateLocale())
  return formatted === null ? '—' : `${formatted} ${displayUnit}`
}
