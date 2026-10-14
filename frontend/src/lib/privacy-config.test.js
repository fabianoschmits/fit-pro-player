import { describe, expect, it } from 'vitest'
import { getPrivacyConfig, isPrivacyConfigComplete } from './privacy-config.js'

describe('privacy configuration', () => {
  it('reports an incomplete configuration when legal values are placeholders', () => {
    const config = getPrivacyConfig({ VITE_PRIVACY_CONTROLLER_NAME: 'PREENCHER controlador', VITE_PRIVACY_DPO_EMAIL: 'PREENCHER canal' })
    expect(config.controllerName).toContain('PREENCHER')
    expect(isPrivacyConfigComplete(config)).toBe(false)
  })

  it('accepts a complete controller and data-protection contact', () => {
    const config = getPrivacyConfig({ VITE_PRIVACY_CONTROLLER_NAME: 'Fit Pro Player Ltda.', VITE_PRIVACY_DPO_EMAIL: 'privacidade@example.com' })
    expect(isPrivacyConfigComplete(config)).toBe(true)
  })
})
