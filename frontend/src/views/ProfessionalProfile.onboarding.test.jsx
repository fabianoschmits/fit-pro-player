// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ auth: { status: 'authenticated', user: { id: 'student-user' } }, provision: vi.fn(), role: vi.fn(), own: vi.fn() }))
vi.mock('../auth/AuthProvider.jsx', () => ({ useAuth: () => mocks.auth }))
vi.mock('../lib/supabase-client.js', () => ({ getBrowserSupabaseClient: () => null }))
vi.mock('../lib/professional-profile.js', () => ({ createProfessionalProfileRepository: () => ({ role: mocks.role, own: mocks.own, provision: mocks.provision, save: vi.fn() }) }))
import ProfessionalProfile from './ProfessionalProfile.jsx'
let root, container
function Location() { const location = useLocation(); return <output data-location>{location.pathname}{location.search}</output> }
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  container = document.createElement('div'); document.body.append(container); root = createRoot(container)
  vi.resetAllMocks(); mocks.role.mockResolvedValue(false); mocks.own.mockResolvedValue(null)
  mocks.provision.mockResolvedValue({ userId: 'student-user', professionalName: 'Ana', verificationStatus: 'unverified' })
})
afterEach(async () => { await act(async () => root.unmount()); container.remove() })
describe('professional onboarding', () => {
  it('creates professional capability from the legacy settings flow and displays the saved profile', async () => {
    await act(async () => root.render(<MemoryRouter initialEntries={['/professional-profile?onboarding=1']}><ProfessionalProfile /><Location /></MemoryRouter>))
    const name = container.querySelector('input')
    await act(async () => {
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(name, 'Ana')
      name.dispatchEvent(new Event('input', { bubbles: true }))
    })
    const submit = [...container.querySelectorAll('button')].find(button => button.textContent.includes('Criar perfil profissional'))
    await act(async () => submit.click())
    expect(mocks.provision).toHaveBeenCalledWith('student-user', expect.objectContaining({ professionalName: 'Ana' }))
    expect(container.querySelector('[data-location]').textContent).toBe('/professional-profile')
    expect(container.textContent).toContain('Ana')
    expect(container.textContent).toContain('Perfil profissional criado.')
    expect(container.querySelector('input[name="professionalName"]')).toBeNull()
    expect(container.querySelector('input[type="file"]')).not.toBeNull()
  })
})
