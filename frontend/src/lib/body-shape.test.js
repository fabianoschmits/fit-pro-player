import { describe, expect, it } from 'vitest'
import {
  BODY_SHAPE_BMI_RANGE, BODY_SHAPE_PART_IDS, BODY_SHAPE_REFERENCE_BMI,
  bodyShapeBmi, bodyShapeFallbackScales, bodyShapeRegionalScales,
} from './body-shape.js'

const allNeutral = scales => Object.values(scales).every(value => value === 1)

describe('visual body-shape fallback', () => {
  it('is neutral when height, weight, or unit is unusable', () => {
    expect(allNeutral(bodyShapeFallbackScales({ heightCm: null, weight: 80, unit: 'kg' }))).toBe(true)
    expect(allNeutral(bodyShapeFallbackScales({ heightCm: 178, weight: 0, unit: 'kg' }))).toBe(true)
    expect(allNeutral(bodyShapeFallbackScales({ heightCm: 99, weight: 80, unit: 'kg' }))).toBe(true)
    expect(allNeutral(bodyShapeFallbackScales({ heightCm: 178, weight: 80, unit: 'stone' }))).toBe(true)
  })

  it('uses BMI 22.5 as the neutral reference', () => {
    const heightCm = 178
    const weight = BODY_SHAPE_REFERENCE_BMI * (heightCm / 100) ** 2
    expect(bodyShapeBmi({ heightCm, weight, unit: 'kg' })).toBeCloseTo(22.5, 10)
    expect(allNeutral(bodyShapeFallbackScales({ sex: 'male', heightCm, weight, unit: 'kg' }))).toBe(true)
  })

  it('produces identical silhouettes from equivalent kg and lb records', () => {
    const kg = bodyShapeFallbackScales({ sex: 'male', heightCm: 178, weight: 110, unit: 'kg' })
    const lb = bodyShapeFallbackScales({ sex: 'male', heightCm: 178, weight: 110 / 0.45359237, unit: 'lb' })
    expect(lb).toEqual(kg)
  })

  it('widens every region monotonically while keeping central gain more visible', () => {
    const lean = bodyShapeRegionalScales({ sex: 'male', heightCm: 178, weight: 58, unit: 'kg' })
    const reference = bodyShapeRegionalScales({ sex: 'male', heightCm: 178, weight: 71.29, unit: 'kg' })
    const high = bodyShapeRegionalScales({ sex: 'male', heightCm: 178, weight: 110, unit: 'kg' })

    Object.keys(high).forEach(region => {
      expect(lean[region]).toBeLessThan(reference[region])
      expect(reference[region]).toBeLessThan(high[region])
    })
    expect(high.abdomen).toBeGreaterThan(high.waist)
    expect(high.waist).toBeGreaterThan(high.arms)
    expect(high.arms).toBeGreaterThan(high.shoulders)
  })

  it('changes every measured body part between 110 kg and 71 kg', () => {
    const start = bodyShapeFallbackScales({ sex: 'male', heightCm: 178, weight: 110, unit: 'kg' })
    const finish = bodyShapeFallbackScales({ sex: 'male', heightCm: 178, weight: 71, unit: 'kg' })

    BODY_SHAPE_PART_IDS.forEach(partId => expect(start[partId]).toBeGreaterThan(finish[partId]))
  })

  it('applies sex-specific fat-distribution curves at the same BMI', () => {
    const male = bodyShapeRegionalScales({ sex: 'male', heightCm: 170, weight: 100, unit: 'kg' })
    const female = bodyShapeRegionalScales({ sex: 'female', heightCm: 170, weight: 100, unit: 'kg' })
    expect(female.hips).toBeGreaterThan(male.hips)
    expect(female.thighs).toBeGreaterThan(male.thighs)
    expect(male.waist).toBeGreaterThan(female.waist)
    expect(male.abdomen).toBeGreaterThan(female.abdomen)
  })

  it('returns all measurement parts with symmetric paired limbs', () => {
    const scales = bodyShapeFallbackScales({ sex: 'female', heightCm: 165, weight: 92, unit: 'kg' })
    expect(Object.keys(scales)).toEqual(BODY_SHAPE_PART_IDS)
    expect(scales['left-arm']).toBe(scales['right-arm'])
    expect(scales['left-forearm']).toBe(scales['right-forearm'])
    expect(scales['left-thigh']).toBe(scales['right-thigh'])
    expect(scales['left-calf']).toBe(scales['right-calf'])
  })

  it('clamps extreme BMI values to conservative visual endpoints', () => {
    const veryLow = bodyShapeRegionalScales({ sex: 'male', heightCm: 178, weight: 20, unit: 'kg' })
    const atLow = bodyShapeRegionalScales({ sex: 'male', heightCm: 178, weight: BODY_SHAPE_BMI_RANGE.min * 1.78 ** 2, unit: 'kg' })
    const veryHigh = bodyShapeRegionalScales({ sex: 'male', heightCm: 178, weight: 300, unit: 'kg' })
    const atHigh = bodyShapeRegionalScales({ sex: 'male', heightCm: 178, weight: BODY_SHAPE_BMI_RANGE.max * 1.78 ** 2, unit: 'kg' })

    expect(veryLow).toEqual(atLow)
    expect(veryHigh).toEqual(atHigh)
    expect(Math.min(...Object.values(veryLow))).toBeGreaterThanOrEqual(.8)
    expect(Math.max(...Object.values(veryHigh))).toBeLessThanOrEqual(1.35)
  })
})
