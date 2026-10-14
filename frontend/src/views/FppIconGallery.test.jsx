import { describe, expect, it } from 'vitest'
import { FPP_ICON_MANIFEST } from '../assets/icons/fpp/index.js'
describe('FPP icon gallery', () => { it('defines the three reference icons and required sizes', () => { expect(FPP_ICON_MANIFEST.map(icon => icon.id)).toEqual(['workout-push', 'workout-pull', 'workout-legs']); expect([16, 20, 24, 32, 48]).toHaveLength(5) }) })
