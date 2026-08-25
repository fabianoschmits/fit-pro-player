import { describe, expect, it } from 'vitest'
import { spriteTimelineState } from './ExerciseSvgSprite.jsx'

const CONFIG = {
  duration: 4000,
  frameWidth: 400,
  sequence: [0, 1, 2, 1],
}

describe('exercise sprite timeline', () => {
  it('keeps both visual layers on one continuous frame sequence', () => {
    expect(spriteTimelineState(CONFIG, 0)).toEqual({ currentFrame: 0, nextFrame: 1, mix: 0 })

    const beforeBoundary = spriteTimelineState(CONFIG, 999)
    const atBoundary = spriteTimelineState(CONFIG, 1000)
    expect(beforeBoundary.currentFrame).toBe(0)
    expect(beforeBoundary.nextFrame).toBe(1)
    expect(beforeBoundary.mix).toBeGreaterThan(0.99)
    expect(atBoundary).toEqual({ currentFrame: 1, nextFrame: 2, mix: 0 })
  })

  it('crossfades only at the end of each frame interval', () => {
    expect(spriteTimelineState(CONFIG, 850).mix).toBe(0)
    expect(spriteTimelineState(CONFIG, 930).mix).toBeGreaterThan(0)
    expect(spriteTimelineState(CONFIG, 930).mix).toBeLessThan(1)
  })

  it('loops without changing the visible target frame', () => {
    const beforeLoop = spriteTimelineState(CONFIG, 3999)
    const afterLoop = spriteTimelineState(CONFIG, 4000)
    expect(beforeLoop.nextFrame).toBe(afterLoop.currentFrame)
    expect(beforeLoop.mix).toBeGreaterThan(0.99)
    expect(afterLoop).toEqual({ currentFrame: 0, nextFrame: 1, mix: 0 })
  })
})
