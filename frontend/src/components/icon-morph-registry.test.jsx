import { describe, expect, it } from 'vitest'
import { getVisualId, findIconMorph, ICON_MORPH_REGISTRY } from './icon-morph-registry.jsx'

describe('icon-morph-registry', () => {
  it('correctly maps visual IDs for static items', () => {
    expect(getVisualId({ k: 'home' }, { active: false })).toBe('home')
    expect(getVisualId({ k: 'plan' }, { active: false })).toBe('plan')
    expect(getVisualId({ k: 'stats' }, { active: false })).toBe('stats')
    expect(getVisualId({ k: 'library' }, { active: false })).toBe('library')
    expect(getVisualId({ k: 'history' }, { active: false })).toBe('history')
    expect(getVisualId({ k: 'prof-overview' }, { active: false })).toBe('prof-overview')
    expect(getVisualId({ k: 'prof-students' }, { active: false })).toBe('prof-students')
  })

  it('correctly detects start vs resume without changing item.k (essential test)', () => {
    const item = { k: 'start' }

    // Initial state: inactive workout
    const visualIdBefore = getVisualId(item, { active: false })
    expect(visualIdBefore).toBe('start')

    // Next state: active workout
    const visualIdAfter = getVisualId(item, { active: true })
    expect(visualIdAfter).toBe('resume')

    // Registry finds the morph
    const morph = findIconMorph(visualIdBefore, visualIdAfter)
    expect(morph).not.toBeNull()
    expect(morph.id).toBe('start-resume')
    expect(morph.isReversed).toBe(false)
  })

  it('finds reverse morph for resume -> start when workout finishes', () => {
    const morph = findIconMorph('resume', 'start')
    expect(morph).not.toBeNull()
    expect(morph.id).toBe('start-resume')
    expect(morph.isReversed).toBe(true)
  })

  it('finds specific morph for resume -> library and reverse', () => {
    const direct = findIconMorph('resume', 'library')
    expect(direct).not.toBeNull()
    expect(direct.id).toBe('resume-library')
    expect(direct.isReversed).toBe(false)

    const reverse = findIconMorph('library', 'resume')
    expect(reverse).not.toBeNull()
    expect(reverse.id).toBe('resume-library')
    expect(reverse.isReversed).toBe(true)
  })

  it('finds specific morph for stats -> history and reverse', () => {
    const direct = findIconMorph('stats', 'history')
    expect(direct).not.toBeNull()
    expect(direct.id).toBe('stats-history')
    expect(direct.isReversed).toBe(false)

    const reverse = findIconMorph('history', 'stats')
    expect(reverse).not.toBeNull()
    expect(reverse.id).toBe('stats-history')
    expect(reverse.isReversed).toBe(true)
  })

  it('finds specific morph for plan -> stats and reverse', () => {
    const direct = findIconMorph('plan', 'stats')
    expect(direct).not.toBeNull()
    expect(direct.id).toBe('plan-stats')
    expect(direct.isReversed).toBe(false)

    const reverse = findIconMorph('stats', 'plan')
    expect(reverse).not.toBeNull()
    expect(reverse.id).toBe('plan-stats')
    expect(reverse.isReversed).toBe(true)
  })

  it('finds specific morph for professional overview -> students and reverse', () => {
    const direct = findIconMorph('prof-overview', 'prof-students')
    expect(direct).not.toBeNull()
    expect(direct.id).toBe('professional-students')
    expect(direct.isReversed).toBe(false)

    const reverse = findIconMorph('prof-students', 'prof-overview')
    expect(reverse).not.toBeNull()
    expect(reverse.id).toBe('professional-students')
    expect(reverse.isReversed).toBe(true)
  })

  it('returns null (fallback to generic transition) for unmapped pairs or identical IDs', () => {
    expect(findIconMorph('home', 'home')).toBeNull()
    expect(findIconMorph('home', 'plan')).toBeNull()
    expect(findIconMorph('home', 'history')).toBeNull()
    expect(findIconMorph('settings', 'support')).toBeNull()
    expect(findIconMorph(null, 'stats')).toBeNull()
    expect(findIconMorph('stats', null)).toBeNull()
  })
})
