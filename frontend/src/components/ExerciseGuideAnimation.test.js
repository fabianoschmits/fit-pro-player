import { describe, expect, it } from 'vitest'
import { guideTimelineState } from './ExerciseGuideAnimation.jsx'

const CONFIG = { duration: 2400, sequence: [0, 1, 2] }

describe('Workout Guide animation timeline', () => {
  it('uses the three canonical frames in their original order', () => {
    expect(guideTimelineState(CONFIG, 0)).toEqual({ frame: 0 })

    const beforeBoundary = guideTimelineState(CONFIG, 799)
    const atBoundary = guideTimelineState(CONFIG, 800)
    expect(beforeBoundary).toEqual({ frame: 0 })
    expect(atBoundary).toEqual({ frame: 1 })
    expect(guideTimelineState(CONFIG, 1600)).toEqual({ frame: 2 })
  })

  it('never inserts or repeats a synthetic pose', () => {
    expect(CONFIG.sequence).toEqual([0, 1, 2])
    expect(new Set(CONFIG.sequence).size).toBe(CONFIG.sequence.length)
  })

  it('loops from the final ordered frame back to the first', () => {
    expect(guideTimelineState(CONFIG, 2399)).toEqual({ frame: 2 })
    expect(guideTimelineState(CONFIG, 2400)).toEqual({ frame: 0 })
  })
})
