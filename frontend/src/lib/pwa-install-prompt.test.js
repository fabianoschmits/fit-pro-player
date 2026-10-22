import { describe, expect, it } from 'vitest'
import {
  dismissPwaInstallForever,
  normalizePwaInstallPrompt,
  shouldShowPwaInstallPrompt,
  snoozePwaInstall,
  PWA_INSTALL_SNOOZE_MS,
} from './pwa-install-prompt.js'

describe('pwa install prompt preferences', () => {
  it('shows for onboarded users who have not dismissed or snoozed', () => {
    expect(shouldShowPwaInstallPrompt({ onboardingDone: true, pwaInstallPrompt: null }, { installed: false })).toBe(true)
  })

  it('hides when already installed, onboarding incomplete, dismissed forever, or snoozed', () => {
    const now = 1_700_000_000_000
    expect(shouldShowPwaInstallPrompt({ onboardingDone: true }, { installed: true }, now)).toBe(false)
    expect(shouldShowPwaInstallPrompt({ onboardingDone: false }, { installed: false }, now)).toBe(false)
    expect(shouldShowPwaInstallPrompt({ onboardingDone: true, pwaInstallPrompt: { dismissForever: true } }, { installed: false }, now)).toBe(false)
    expect(shouldShowPwaInstallPrompt({ onboardingDone: true, pwaInstallPrompt: { snoozeUntil: now + 1000 } }, { installed: false }, now)).toBe(false)
    expect(shouldShowPwaInstallPrompt({ onboardingDone: true, pwaInstallPrompt: { snoozeUntil: now - 1 } }, { installed: false }, now)).toBe(true)
  })

  it('normalizes and builds dismiss / snooze payloads', () => {
    expect(normalizePwaInstallPrompt({ dismissForever: true, snoozeUntil: 9 })).toEqual({ dismissForever: true })
    expect(normalizePwaInstallPrompt({ snoozeUntil: 42 })).toEqual({ snoozeUntil: 42 })
    expect(normalizePwaInstallPrompt('nope')).toBeNull()
    expect(dismissPwaInstallForever()).toEqual({ dismissForever: true })
    expect(snoozePwaInstall(1000)).toEqual({ snoozeUntil: 1000 + PWA_INSTALL_SNOOZE_MS })
  })
})
