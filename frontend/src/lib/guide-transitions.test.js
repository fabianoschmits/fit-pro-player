import { describe, expect, it } from 'vitest'
import { EXDB } from './exercises-data.js'
import { exerciseGuideAsset } from './exercise-guide-assets.js'
import {
  GUIDE_TRANSITION_BY_SLUG,
  GUIDE_TRANSITION_MODES,
  GUIDE_TRANSITION_PREVIEW_COUNT,
  guideTransitionMode,
} from './guide-transitions.js'

describe('guide transition presets', () => {
  it('assigns a distinct style to each of the first catalogue exercises (library order)', () => {
    const first = []
    for (const ex of EXDB) {
      const asset = exerciseGuideAsset(ex)
      if (!asset) continue
      first.push(asset.slug)
      if (first.length >= GUIDE_TRANSITION_PREVIEW_COUNT) break
    }
    expect(first.length).toBe(GUIDE_TRANSITION_PREVIEW_COUNT)
    const modes = first.map(slug => guideTransitionMode(slug))
    expect(new Set(modes).size).toBe(GUIDE_TRANSITION_MODES.length)
    expect(GUIDE_TRANSITION_BY_SLUG['bicycle-crunch']).toBe('drag')
    expect(GUIDE_TRANSITION_BY_SLUG['heel-tap']).toBe('slide-x')
    expect(guideTransitionMode('unknown-slug')).toBe('crossfade')
  })
})
