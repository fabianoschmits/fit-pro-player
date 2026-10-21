// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  state: { S: { body: 'male', targetW: 70, unit: 'kg', profile: { name: 'Ana', avatarId: 'avatar-1', birthDate: '1990-01-01', sex: 'female', heightCm: 167, startWeight: 71, goal: 'lose_weight', experience: 'intermediate' }, bodyweight: [] } },
  update: vi.fn(), toast: vi.fn(),
}))
vi.mock('../store/useStore.js', () => {
  const useStore = selector => selector({ ...mocks.state, update: mocks.update })
  useStore.getState = () => mocks.state
  return { useStore }
})
vi.mock('../store/useUI.js', () => ({ useUI: selector => selector({ toast: mocks.toast }) }))

import PersonalData from './PersonalData.jsx'

let root, container
beforeEach(() => { globalThis.IS_REACT_ACT_ENVIRONMENT = true; container = document.createElement('div'); document.body.append(container); root = createRoot(container); mocks.update.mockReset(); mocks.toast.mockReset(); mocks.state.persistence = { state: 'saved' } })
afterEach(async () => { await act(async () => root.unmount()); container.remove() })
const render = () => act(async () => root.render(<MemoryRouter><PersonalData /></MemoryRouter>) )

it('keeps personal fields locked until the user chooses to edit them', async () => {
  await render()
  const name = container.querySelector('[data-profile-field="name"] input')
  expect(name.disabled).toBe(true)
  await act(async () => container.querySelector('[data-profile-field="name"] button').click())
  expect(name.disabled).toBe(false)
  expect([...container.querySelectorAll('[data-profile-field="name"] button')].find(button => button.textContent.includes('Salvar'))).toBeTruthy()
})

it('saves only the edited personal field', async () => {
  await render()
  const field = container.querySelector('[data-profile-field="name"]')
  await act(async () => field.querySelector('button').click())
  await act(async () => { const input = field.querySelector('input'); input.value = 'Beatriz'; input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true })) })
  await act(async () => [...field.querySelectorAll('button')].find(button => button.textContent.includes('Salvar')).click())
  expect(mocks.update).toHaveBeenCalledTimes(1)
  expect(mocks.toast).not.toHaveBeenCalled()
})

it('keeps a failed local profile save editable and reports error without a success toast', async () => {
  mocks.update.mockImplementation(() => { mocks.state.persistence = { state: 'error' } })
  await render()
  const field = container.querySelector('[data-profile-field="name"]')
  await act(async () => field.querySelector('.personal-edit').click())
  await act(async () => field.querySelector('.personal-save').click())
  expect(field.querySelector('input').disabled).toBe(false)
  expect(field.querySelector('[data-state="error"]')).not.toBeNull()
  expect(mocks.toast).not.toHaveBeenCalled()
  mocks.update.mockImplementation(() => { mocks.state.persistence = { state: 'saved' } })
  await act(async () => field.querySelector('.personal-save').click())
  expect(field.querySelector('input').disabled).toBe(true)
  expect(mocks.toast).not.toHaveBeenCalled()
})

it('keeps the birth date controls disabled until editing is activated', async () => {
  await render()
  expect(container.querySelector('[data-profile-field="birthDate"] .date-wheel-column button').disabled).toBe(true)
  await act(async () => container.querySelector('[data-profile-field="birthDate"] .personal-edit').click())
  expect(container.querySelector('[data-profile-field="birthDate"] .date-wheel-column button').disabled).toBe(false)
})

it('saves a height entered with a comma in centimeters', async () => {
  mocks.update.mockImplementation(recipe => {
    recipe(mocks.state.S)
    mocks.state.persistence = { state: 'saved' }
  })
  await render()
  const field = container.querySelector('[data-profile-field="measures"]')
  await act(async () => field.querySelector('.personal-edit').click())
  const height = field.querySelector('input[inputmode="decimal"]')
  await act(async () => {
    const setValue = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setValue.call(height, '1,76')
    height.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await act(async () => {
    field.querySelector('.personal-save').dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }))
    await Promise.resolve()
  })
  expect(mocks.state.S.profile.heightCm).toBe(176)
})

it('records an edited personal weight as a bodyweight entry for sync', async () => {
  mocks.update.mockImplementation(recipe => { recipe(mocks.state.S); mocks.state.persistence = { state: 'saved' } })
  await render()
  const field = container.querySelector('[data-profile-field="measures"]')
  await act(async () => field.querySelector('.personal-edit').click())
  const weight = field.querySelectorAll('input[inputmode="decimal"]')[1]
  await act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(weight, '72,5')
    weight.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await act(async () => { field.querySelector('.personal-save').click(); await Promise.resolve() })
  expect(mocks.state.S.profile.startWeight).toBe(72.5)
  expect(mocks.state.S.bodyweight.some(entry => entry.w === 72.5)).toBe(true)
})

it('keeps personal weight persistence silent while the account queue runs in the background', async () => {
  mocks.state.S._pendingSync = { body: true, preferences: true }
  mocks.state.getActiveLocalScope = () => ({ kind: 'account' })
  mocks.state.retryAccountSync = vi.fn()
  mocks.update.mockImplementation(recipe => { recipe(mocks.state.S); mocks.state.persistence = { state: 'saved' } })
  await render()
  const field = container.querySelector('[data-profile-field="measures"]')
  await act(async () => field.querySelector('.personal-edit').click())
  await act(async () => field.querySelector('.personal-save').click())
  expect(mocks.state.retryAccountSync).not.toHaveBeenCalled()
  expect(mocks.toast).not.toHaveBeenCalled()
  delete mocks.state.getActiveLocalScope
  delete mocks.state.retryAccountSync
  delete mocks.state.S._pendingSync
})

it('renders the avatar picker as a horizontal scroller', async () => {
  await render()
  const picker = container.querySelector('.avatar-picker-grid')
  expect(picker.getAttribute('data-orientation')).toBe('horizontal')
  expect(picker.className).toContain('avatar-picker-horizontal')
  expect(picker.className).toContain('is-disabled')
  await act(async () => container.querySelector('[data-profile-field="avatarId"] .personal-edit').click())
  expect(picker.className).not.toContain('is-disabled')
  await act(async () => {
    picker.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 240, pointerId: 1, pointerType: 'touch' }))
    picker.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 80, pointerId: 1, pointerType: 'touch' }))
  })
  expect(picker.scrollLeft).toBe(160)
})
