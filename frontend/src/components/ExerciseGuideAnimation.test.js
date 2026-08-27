import { describe, expect, it } from 'vitest'
import { guideTimelineState } from './ExerciseGuideAnimation.jsx'

const CONFIG = { duration: 3200, sequence: [0, 1, 2, 1] }

describe('Workout Guide animation timeline', () => {
  it('uses one continuous sequence for every visual layer', () => {
    expect(guideTimelineState(CONFIG, 0)).toEqual({ currentFrame: 0, nextFrame: 1, mix: 0 })

    const beforeBoundary = guideTimelineState(CONFIG, 799)
    const atBoundary = guideTimelineState(CONFIG, 800)
    expect(beforeBoundary.currentFrame).toBe(0)
    expect(beforeBoundary.nextFrame).toBe(1)
    expect(beforeBoundary.mix).toBeGreaterThan(0.99)
    expect(atBoundary).toEqual({ currentFrame: 1, nextFrame: 2, mix: 0 })
  })

  it('crossfades only near the end of a pose interval', () => {
    expect(guideTimelineState(CONFIG, 680).mix).toBe(0)
    expect(guideTimelineState(CONFIG, 744).mix).toBeGreaterThan(0)
    expect(guideTimelineState(CONFIG, 744).mix).toBeLessThan(1)
  })

  it('loops into the same frame that was already visible', () => {
    const beforeLoop = guideTimelineState(CONFIG, 3199)
    const afterLoop = guideTimelineState(CONFIG, 3200)
    expect(beforeLoop.nextFrame).toBe(afterLoop.currentFrame)
    expect(beforeLoop.mix).toBeGreaterThan(0.99)
    expect(afterLoop).toEqual({ currentFrame: 0, nextFrame: 1, mix: 0 })
  })
})
