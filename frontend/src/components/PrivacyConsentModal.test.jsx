// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { PRIVACY_CONSENT_STORAGE_KEY, PRIVACY_CONSENT_VERSION } from '../lib/privacy-consent.js'

vi.mock('../auth/AuthProvider.jsx', () => ({ useAuth: () => ({ status: 'anonymous', user: null }) }))
vi.mock('../lib/supabase-client.js', () => ({ getBrowserSupabaseClient: () => null }))
import PrivacyConsentModal from './PrivacyConsentModal.jsx'

let root, container
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  localStorage.removeItem(PRIVACY_CONSENT_STORAGE_KEY)
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  localStorage.removeItem(PRIVACY_CONSENT_STORAGE_KEY)
})

const reopen = () => act(async () => window.dispatchEvent(new Event('fitproplayer:privacy-settings')))

it('dismisses reopened settings without saving the changed choices', async () => {
  const saved = JSON.stringify({ version: PRIVACY_CONSENT_VERSION, necessary: true, preferences: false, analytics: false, communications: false })
  localStorage.setItem(PRIVACY_CONSENT_STORAGE_KEY, saved)
  await act(async () => root.render(<PrivacyConsentModal />))
  await reopen()

  await act(async () => container.querySelector('h2').click())
  expect(container.querySelector('[role="dialog"]')).not.toBeNull()
  const preference = container.querySelectorAll('input[type="checkbox"]')[1]
  await act(async () => preference.click())
  expect(preference.checked).toBe(true)

  await act(async () => container.querySelector('.privacy-consent-backdrop').click())
  expect(container.querySelector('[role="dialog"]')).toBeNull()
  expect(localStorage.getItem(PRIVACY_CONSENT_STORAGE_KEY)).toBe(saved)

  await reopen()
  expect(container.querySelectorAll('input[type="checkbox"]')[1].checked).toBe(false)
})

it('keeps the initial privacy choice open when its backdrop is clicked', async () => {
  await act(async () => root.render(<PrivacyConsentModal />))
  await act(async () => container.querySelector('.privacy-consent-backdrop').click())

  expect(container.querySelector('[role="dialog"]')).not.toBeNull()
  expect(localStorage.getItem(PRIVACY_CONSENT_STORAGE_KEY)).toBeNull()
})
