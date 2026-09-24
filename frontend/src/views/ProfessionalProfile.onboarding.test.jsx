// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { Window } from 'happy-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auth: { status: 'authenticated', user: { id: 'student-user' } },
  navigate: vi.fn(),
  provision: vi.fn().mockResolvedValue({ userId: 'student-user', professionalName: 'Ana', verificationStatus: 'unverified' }),
  role: vi.fn().mockResolvedValue(false),
  own: vi.fn().mockResolvedValue(null),
}))

vi.mock('../auth/AuthProvider.jsx', () => ({ useAuth: () => mocks.auth }))
vi.mock('react-router-dom', () => ({ useNavigate: () => mocks.navigate, useSearchParams: () => [new URLSearchParams('onboarding=1')] }))
vi.mock('../lib/supabase-client.js', () => ({ getBrowserSupabaseClient: () => null }))
vi.mock('../lib/professional-profile.js', () => ({ createProfessionalProfileRepository: () => ({ role: mocks.role, own: mocks.own, provision: mocks.provision, save: vi.fn() }) }))
vi.mock('../components/AppHeader.jsx', () => ({ default: ({ title }) => <h1>{title}</h1> }))

import ProfessionalProfile from './ProfessionalProfile.jsx'

let dom
let root
let container

beforeEach(() => {
  dom = new Window({ url: 'https://app.example/#/professional-profile?onboarding=1' })
  globalThis.window = dom; globalThis.document = dom.document; globalThis.IS_REACT_ACT_ENVIRONMENT = true
  container = document.createElement('div'); document.body.append(container); root = createRoot(container)
  mocks.navigate.mockClear(); mocks.provision.mockClear(); mocks.role.mockClear(); mocks.own.mockClear()
})

afterEach(async () => { await act(async () => root.unmount()); dom.close() })

describe('professional onboarding', () => {
  it('creates professional capability from the account settings flow', async () => {
    await act(async () => root.render(<ProfessionalProfile />))
    const name = container.querySelector('input')
    await act(async () => {
      Object.getOwnPropertyDescriptor(dom.HTMLInputElement.prototype, 'value').set.call(name, 'Ana')
      name.dispatchEvent(new dom.Event('input', { bubbles: true }))
    })
    const submit = [...container.querySelectorAll('button')].find(button => button.textContent.includes('Criar perfil profissional'))
    await act(async () => submit.click())

    expect(mocks.provision).toHaveBeenCalledWith('student-user', expect.objectContaining({ professionalName: 'Ana' }))
    expect(mocks.navigate).toHaveBeenCalledWith('/professional-profile', { replace: true })
  })
})
