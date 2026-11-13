// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { MemoryRouter, useLocation } from 'react-router-dom'
const mocks = vi.hoisted(() => ({ user: null, state: {} }))
vi.mock('../auth/AuthProvider.jsx', () => ({ useAuth: () => ({ user: mocks.user }) }))
vi.mock('../store/useStore.js', () => ({ useStore: selector => selector({ S: mocks.state }) }))
vi.mock('../components/onboarding/TrainingOnboarding.jsx', () => ({ default: ({ onDone }) => <button onClick={() => onDone('/plan')}>training-setup</button> }))
vi.mock('../components/onboarding/ProfessionalOnboarding.jsx', () => ({ default: ({ onDone }) => <button onClick={() => onDone('/professional')}>professional-setup</button> }))
import AccountOnboarding from './AccountOnboarding.jsx'
let root, container
function View() {
  const location = useLocation()
  return <><output>{location.pathname}</output><AccountOnboarding /></>
}
async function render() { await act(async () => root.render(<MemoryRouter initialEntries={['/onboarding']}><View /></MemoryRouter>)) }
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  mocks.user = { id: 'ana', accountType: 'student' }
  mocks.state = { onboardingDone: false, onboardingDraft: null }
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})
afterEach(async () => { await act(async () => root.unmount()); container.remove() })
it('opens coaching setup for a professional account', async () => {
  mocks.user.accountType = 'professional'
  await render()
  expect(container.textContent).toContain('professional-setup')
  expect(container.textContent).not.toContain('training-setup')
})
it('ignores a professional draft owned by another account', async () => {
  mocks.state.onboardingDraft = { kind: 'professional', owner: 'account:other' }
  await render()
  expect(container.textContent).toContain('training-setup')
})
it('keeps the success screen mounted until its final action', async () => {
  await render()
  mocks.state = { ...mocks.state, onboardingDone: true }
  await render()
  expect(container.querySelector('output').textContent).toBe('/onboarding')
  await act(async () => container.querySelector('button').click())
  expect(container.querySelector('output').textContent).toBe('/plan')
})
it('returns completed accounts to their workspace', async () => {
  mocks.state.onboardingDone = true
  mocks.user.accountType = 'professional'
  await render()
  expect(container.querySelector('output').textContent).toBe('/professional')
})
