import { describe, expect, it } from 'vitest'
import FppIcon from './FppIcon.jsx'

describe('FppIcon', () => {
  it('renders a named icon at the requested size', () => {
    const element = FppIcon({ name: 'workout-push', size: 24 })
    expect(element.props.style).toMatchObject({ width: 24, height: 24 })
    expect(element.props.dangerouslySetInnerHTML.__html).toContain('<svg')
  })
  it('exposes a title as an accessible image', () => {
    const element = FppIcon({ name: 'workout-pull', title: 'Pull workout' })
    expect(element.props.role).toBe('img')
    expect(element.props['aria-label']).toBe('Pull workout')
  })
  it('rejects unknown names', () => { expect(() => FppIcon({ name: 'missing' })).toThrow('Unknown FPP icon: missing') })
})
