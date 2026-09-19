// Visual-only body-width fallback for profiles that do not have circumference
// check-ins yet. These values are dimensionless scaleX factors; they must never
// be stored as, or presented as, measured circumferences.

export const BODY_SHAPE_REFERENCE_BMI = 22.5
export const BODY_SHAPE_BMI_RANGE = Object.freeze({ min: 16, max: 40 })

export const BODY_SHAPE_PART_IDS = Object.freeze([
  'neck', 'shoulders', 'chest',
  'left-arm', 'right-arm', 'left-forearm', 'right-forearm',
  'waist', 'abdomen', 'hips',
  'left-thigh', 'right-thigh', 'left-calf', 'right-calf',
])

const REGIONS = Object.freeze([
  'neck', 'shoulders', 'chest', 'arms', 'forearms',
  'waist', 'abdomen', 'hips', 'thighs', 'calves',
])

const PART_REGION = Object.freeze({
  neck: 'neck',
  shoulders: 'shoulders',
  chest: 'chest',
  'left-arm': 'arms',
  'right-arm': 'arms',
  'left-forearm': 'forearms',
  'right-forearm': 'forearms',
  waist: 'waist',
  abdomen: 'abdomen',
  hips: 'hips',
  'left-thigh': 'thighs',
  'right-thigh': 'thighs',
  'left-calf': 'calves',
  'right-calf': 'calves',
})

// Endpoints describe restrained visual width at the supported BMI limits.
// Region-specific exponents let the torso respond sooner than distal limbs.
const PROFILE = Object.freeze({
  male: Object.freeze({
    neck: Object.freeze({ low: .92, high: 1.11, lowCurve: .95, highCurve: .94 }),
    shoulders: Object.freeze({ low: .94, high: 1.07, lowCurve: .9, highCurve: .78 }),
    chest: Object.freeze({ low: .89, high: 1.17, lowCurve: 1.02, highCurve: 1.03 }),
    arms: Object.freeze({ low: .88, high: 1.13, lowCurve: 1.04, highCurve: .86 }),
    forearms: Object.freeze({ low: .91, high: 1.08, lowCurve: .96, highCurve: .78 }),
    waist: Object.freeze({ low: .83, high: 1.30, lowCurve: 1.12, highCurve: 1.18 }),
    abdomen: Object.freeze({ low: .81, high: 1.34, lowCurve: 1.16, highCurve: 1.24 }),
    hips: Object.freeze({ low: .88, high: 1.19, lowCurve: 1.04, highCurve: .96 }),
    thighs: Object.freeze({ low: .87, high: 1.16, lowCurve: 1.02, highCurve: .9 }),
    calves: Object.freeze({ low: .91, high: 1.10, lowCurve: .94, highCurve: .8 }),
  }),
  female: Object.freeze({
    neck: Object.freeze({ low: .93, high: 1.08, lowCurve: .92, highCurve: .82 }),
    shoulders: Object.freeze({ low: .94, high: 1.06, lowCurve: .9, highCurve: .76 }),
    chest: Object.freeze({ low: .89, high: 1.17, lowCurve: 1.02, highCurve: 1.02 }),
    arms: Object.freeze({ low: .87, high: 1.15, lowCurve: 1.06, highCurve: .92 }),
    forearms: Object.freeze({ low: .90, high: 1.09, lowCurve: .98, highCurve: .82 }),
    waist: Object.freeze({ low: .83, high: 1.25, lowCurve: 1.12, highCurve: 1.08 }),
    abdomen: Object.freeze({ low: .81, high: 1.30, lowCurve: 1.16, highCurve: 1.15 }),
    hips: Object.freeze({ low: .85, high: 1.28, lowCurve: 1.12, highCurve: 1.18 }),
    thighs: Object.freeze({ low: .83, high: 1.23, lowCurve: 1.14, highCurve: 1.1 }),
    calves: Object.freeze({ low: .89, high: 1.12, lowCurve: 1, highCurve: .88 }),
  }),
})

const LB_TO_KG = 0.45359237
const clamp = (min, value, max) => Math.min(max, Math.max(min, value))
const round4 = value => Math.round(value * 10000) / 10000

const neutralRegions = () => Object.fromEntries(REGIONS.map(region => [region, 1]))

function kilograms(weight, unit) {
  const value = Number(weight)
  if (!Number.isFinite(value) || value <= 0) return null
  const normalizedUnit = String(unit || 'kg').trim().toLowerCase()
  if (['kg', 'kgs', 'kilogram', 'kilograms'].includes(normalizedUnit)) return value
  if (['lb', 'lbs', 'pound', 'pounds'].includes(normalizedUnit)) return value * LB_TO_KG
  return null
}

/**
 * Return the clamped BMI used by the visual fallback, or null for an unusable
 * adult profile. Height remains canonical centimetres regardless of weight unit.
 */
export function bodyShapeBmi({ heightCm, weight, unit = 'kg' } = {}) {
  const height = Number(heightCm)
  const weightKg = kilograms(weight, unit)
  if (!Number.isFinite(height) || height < 100 || height > 250 || weightKg == null) return null
  const metres = height / 100
  const bmi = weightKg / (metres * metres)
  if (!Number.isFinite(bmi) || bmi <= 0) return null
  return clamp(BODY_SHAPE_BMI_RANGE.min, bmi, BODY_SHAPE_BMI_RANGE.max)
}

function regionalScale(config, bmi) {
  const isHigh = bmi >= BODY_SHAPE_REFERENCE_BMI
  const limit = isHigh ? BODY_SHAPE_BMI_RANGE.max : BODY_SHAPE_BMI_RANGE.min
  const span = Math.abs(limit - BODY_SHAPE_REFERENCE_BMI)
  const progress = clamp(0, Math.abs(bmi - BODY_SHAPE_REFERENCE_BMI) / span, 1)
  const exponent = isHigh ? config.highCurve : config.lowCurve
  const curved = 1 - Math.pow(1 - progress, exponent)
  const target = isHigh ? config.high : config.low
  return round4(1 + (target - 1) * curved)
}

/**
 * Dimensionless scaleX values for the ten body regions. The result is neutral
 * when height, weight, or unit cannot produce a trustworthy BMI.
 */
export function bodyShapeRegionalScales({ sex = 'male', heightCm, weight, unit = 'kg' } = {}) {
  const bmi = bodyShapeBmi({ heightCm, weight, unit })
  if (bmi == null) return neutralRegions()
  const profile = PROFILE[String(sex).toLowerCase()] || PROFILE.male
  return Object.fromEntries(REGIONS.map(region => [region, regionalScale(profile[region], bmi)]))
}

/**
 * Expand regional scaleX values to every measurement part. Paired limbs are
 * deliberately symmetric until a real left/right circumference overrides them.
 */
export function bodyShapeFallbackScales(profile = {}) {
  const regions = bodyShapeRegionalScales(profile)
  return Object.fromEntries(BODY_SHAPE_PART_IDS.map(partId => [partId, regions[PART_REGION[partId]]]))
}
