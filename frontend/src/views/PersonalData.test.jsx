// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  state: { S: { body: 'male', targetW: 70, unit: 'kg', profile: { name: 'Ana', avatarId: 'avatar-1', birthDate: '1990-01-01', sex: 'female', heightCm: 167, startWeight: 71, goal: 'lose_weight', experience: 'intermediate' }, bodyweight: [] } },
  update: vi.fn(),
}))
vi.mock('../store/useStore.js', () => ({ useStore: selector => selector({ ...mocks.state, update: mocks.update }) }))

import PersonalData from './PersonalData.jsx'

let root, container
beforeEach(() => { globalThis.IS_REACT_ACT_ENVIRONMENT = true; container = document.createElement('div'); document.body.append(container); root = createRoot(container); mocks.update.mockReset() })
afterEach(async () => { await act(async () => root.unmount()); container.remove() })
const render = () => act(async () => root.render(<MemoryRouter><PersonalData /></MemoryRouter>) )

it('keeps personal fields locked until the user chooses to edit them', async () => {
  await render()
  const name = container.querySelector('[data-profile-field="name"] input')
  expect(name.disabled).toBe(true)
  await act(async () => container.querySelector('[data-profile-field="name"] button').click())
  expect(name.disabled).toBe(false)
  expect(container.querySelector('[data-profile-field="name"] button').textContent).toContain('Salvar')
})

it('saves only the edited personal field', async () => {
  await render()
  const field = container.querySelector('[data-profile-field="name"]')
  await act(async () => field.querySelector('button').click())
  await act(async () => { const input = field.querySelector('input'); input.value = 'Beatriz'; input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true })) })
  await act(async () => [...field.querySelectorAll('button')].find(button => button.textContent.includes('Salvar')).click())
  expect(mocks.update).toHaveBeenCalledTimes(1)
})

it('renders the avatar picker as a horizontal scroller', async () => {
  await render()
  const picker = container.querySelector('.avatar-picker-grid')
  expect(picker.getAttribute('data-orientation')).toBe('horizontal')
  expect(picker.className).toContain('avatar-picker-horizontal')
})
