import { describe, expect, it } from 'vitest'
import { getPrivacyConfig, isPrivacyConfigComplete } from './privacy-config.js'

describe('privacy configuration', () => {
  it('keeps legal identity explicit and reports incomplete configuration', () => {
    const config = getPrivacyConfig({})
    expect(config.controllerName).toContain('PREENCHER')
    expect(isPrivacyConfigComplete(config)).toBe(false)
  })

  it('accepts a complete controller and data-protection contact', () => {
    const config = getPrivacyConfig({ VITE_PRIVACY_CONTROLLER_NAME: 'Fit Pro Player Ltda.', VITE_PRIVACY_DPO_EMAIL: 'privacidade@example.com' })
    expect(isPrivacyConfigComplete(config)).toBe(true)
  })
})
