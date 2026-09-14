import { describe, expect, it } from 'vitest'
import { pathMatchesSelectedSide } from './BodyMap.jsx'
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

  it('keeps unrelated regions neutral when no circumference exists', () => {
    const scales = measurementShapeScales({ abdomen: 120 }, {}, 'male')
    expect(scales.abs).toBeGreaterThan(1)
    expect(scales.biceps).toBe(1)
    expect(scales.calves).toBe(1)
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
