import { describe, expect, it } from 'vitest'
import { pathMatchesSelectedSide, shapeScaleForPath } from './BodyMap.jsx'
import { measurementMusclesFor, measurementShapeScales } from './MeasurementBodyMap.jsx'

describe('measurement body-map proportions', () => {
  it('changes the original abdomen geometry from the recorded circumference', () => {
    const baseline = { abdomen: 126, waist: 118, chest: 124 }
    const start = measurementShapeScales(baseline, baseline, 'male')
    const finish = measurementShapeScales({ abdomen: 84, waist: 78, chest: 105 }, baseline, 'male')

    expect(start.abs).toBeGreaterThan(1.25)
    expect(finish.abs).toBeLessThan(1)
    expect(finish.obliques).toBeLessThan(start.obliques)
    expect(finish.chest).toBeLessThan(start.chest)
  })

  it('lets every recorded circumference family change the historical silhouette', () => {
    const baseline = {
      neck: 43.5, shoulders: 127, chest: 119,
      'left-arm': 38.7, 'right-arm': 39.4,
      'left-forearm': 31.7, 'right-forearm': 32.2,
      waist: 116, abdomen: 122, hips: 112,
      'left-thigh': 66.5, 'right-thigh': 67.3,
      'left-calf': 42.5, 'right-calf': 43,
    }
    const finishValues = {
      neck: 38.5, shoulders: 118, chest: 101.5,
      'left-arm': 34.3, 'right-arm': 35,
      'left-forearm': 29.3, 'right-forearm': 29.8,
      waist: 81, abdomen: 84, hips: 94,
      'left-thigh': 55.5, 'right-thigh': 56.3,
      'left-calf': 38, 'right-calf': 38.5,
    }
    const start = measurementShapeScales(baseline, baseline, 'male')
    const finish = measurementShapeScales(finishValues, baseline, 'male')

    ;['neck', 'deltoids', 'chest', 'biceps', 'forearm', 'obliques', 'abs', 'gluteal', 'quadriceps', 'calves']
      .forEach(region => expect(finish[region]).not.toEqual(start[region]))
  })

  it('keeps unrelated regions neutral when no circumference exists', () => {
    const scales = measurementShapeScales({ abdomen: 120 }, {}, 'male')
    expect(scales.abs).toBeGreaterThan(1)
    expect(scales.biceps).toEqual({ left: 1, right: 1 })
    expect(scales.calves).toEqual({ left: 1, right: 1 })
  })

  it('uses weight fallback only for unmeasured regions and lets real values win', () => {
    const fallback = {
      neck: 1.08, shoulders: 1.07, chest: 1.17,
      'left-arm': 1.13, 'right-arm': 1.13,
      'left-forearm': 1.08, 'right-forearm': 1.08,
      waist: 1.3, abdomen: 1.34, hips: 1.19,
      'left-thigh': 1.16, 'right-thigh': 1.16,
      'left-calf': 1.1, 'right-calf': 1.1,
    }
    const estimated = measurementShapeScales({}, {}, 'male', fallback)
    const withMeasuredAbdomen = measurementShapeScales({ abdomen: 88 }, {}, 'male', fallback)

    expect(estimated.abs).toBe(1.34)
    expect(estimated.biceps).toEqual({ left: 1.13, right: 1.13 })
    expect(estimated.quadriceps).toEqual({ left: 1.16, right: 1.16 })
    expect(withMeasuredAbdomen.abs).toBe(1)
    expect(withMeasuredAbdomen.biceps).toEqual({ left: 1.13, right: 1.13 })
  })

  it('keeps left and right limb measurements visually independent', () => {
    const fallback = { 'left-arm': 1.1, 'right-arm': 1.1 }
    const scales = measurementShapeScales({ 'left-arm': 45 }, {}, 'male', fallback)

    expect(scales.biceps.left).toBeGreaterThan(scales.biceps.right)
    expect(shapeScaleForPath(scales, 'biceps', 0, 2, 'front')).toBe(scales.biceps.right)
    expect(shapeScaleForPath(scales, 'biceps', 1, 2, 'front')).toBe(scales.biceps.left)
    expect(shapeScaleForPath(scales, 'biceps', 0, 2, 'back')).toBe(scales.biceps.left)
  })

  it('clamps extreme values so the existing silhouette cannot invert or overflow', () => {
    const large = measurementShapeScales({ abdomen: 350 }, { abdomen: 80 }, 'male')
    const small = measurementShapeScales({ abdomen: 20 }, { abdomen: 160 }, 'male')
    expect(large.abs).toBe(1.34)
    expect(small.abs).toBe(.76)
  })
})

describe('measurement body-map selection', () => {
  it('highlights the complete circumference region on the original silhouette', () => {
    expect(measurementMusclesFor('abdomen')).toEqual(['abs', 'obliques', 'lower-back'])
    expect(measurementMusclesFor('left-thigh')).toEqual(['quadriceps', 'hamstring', 'adductors'])
    expect(measurementMusclesFor('hips')).toEqual(['hip-flexors', 'gluteal'])
  })

  it('keeps bilateral circumference selections consistent across both views', () => {
    expect(measurementMusclesFor('left-arm')).toEqual(measurementMusclesFor('right-arm'))
    expect(measurementMusclesFor('left-calf')).toEqual(measurementMusclesFor('right-calf'))
    expect(measurementMusclesFor('unknown')).toEqual([])
  })

  it('selects only the requested anatomical side in front and back views', () => {
    expect(pathMatchesSelectedSide(0, 2, 'left', 'front')).toBe(false)
    expect(pathMatchesSelectedSide(1, 2, 'left', 'front')).toBe(true)
    expect(pathMatchesSelectedSide(0, 2, 'left', 'back')).toBe(true)
    expect(pathMatchesSelectedSide(1, 2, 'left', 'back')).toBe(false)
    expect(pathMatchesSelectedSide(0, 2, null, 'front')).toBe(true)
  })
})
