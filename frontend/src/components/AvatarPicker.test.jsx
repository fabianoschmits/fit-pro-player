// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import AvatarPicker from './AvatarPicker.jsx'

let root, container, onChange
const t = value => value
const pointer = (element, type, clientX, pointerType = 'mouse') => element.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 1, pointerType, button: 0, clientX }))

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  onChange = vi.fn()
})
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.restoreAllMocks() })

async function render() {
  await act(async () => root.render(<AvatarPicker value="avatar-27" onChange={onChange} t={t} orientation="horizontal" />))
  const grid = container.querySelector('[role="radiogroup"]')
  grid.setPointerCapture = vi.fn()
  grid.releasePointerCapture = vi.fn()
  grid.hasPointerCapture = () => grid.setPointerCapture.mock.calls.length > grid.releasePointerCapture.mock.calls.length
  return grid
}

it.each(['mouse', 'touch'])('keeps a %s tap on the avatar button without capturing the pointer', async pointerType => {
  const grid = await render()
  const avatar = container.querySelector('[data-avatar-index="1"]')
  await act(async () => {
    pointer(avatar, 'pointerdown', 100, pointerType)
    pointer(avatar, 'pointermove', 104, pointerType)
  })
  expect(grid.setPointerCapture).not.toHaveBeenCalled()
  expect(grid.scrollLeft).toBe(0)
  await act(async () => {
    pointer(avatar, 'pointerup', 104, pointerType)
    avatar.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }))
  })
  expect(onChange).toHaveBeenCalledExactlyOnceWith('avatar-02')
  expect(grid.releasePointerCapture).not.toHaveBeenCalled()
})

it('captures a horizontal drag after the threshold and suppresses its avatar click', async () => {
  const grid = await render()
  const avatar = container.querySelector('[data-avatar-index="1"]')
  await act(async () => {
    pointer(avatar, 'pointerdown', 240)
    pointer(avatar, 'pointermove', 235)
    pointer(grid, 'pointermove', 80)
  })
  expect(grid.setPointerCapture).toHaveBeenCalledExactlyOnceWith(1)
  expect(grid.scrollLeft).toBe(160)
  await act(async () => {
    pointer(grid, 'pointerup', 80)
    avatar.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }))
  })
  expect(grid.releasePointerCapture).toHaveBeenCalledExactlyOnceWith(1)
  expect(onChange).not.toHaveBeenCalled()
})

it('ends a cancelled drag without selecting and accepts the next tap', async () => {
  const grid = await render()
  const avatar = container.querySelector('[data-avatar-index="1"]')
  await act(async () => {
    pointer(avatar, 'pointerdown', 240, 'touch')
    pointer(avatar, 'pointermove', 80, 'touch')
    pointer(grid, 'pointercancel', 80, 'touch')
    pointer(grid, 'pointermove', 20, 'touch')
  })
  expect(grid.scrollLeft).toBe(160)
  expect(grid.releasePointerCapture).toHaveBeenCalledExactlyOnceWith(1)
  expect(onChange).not.toHaveBeenCalled()
  await act(async () => {
    pointer(avatar, 'pointerdown', 100, 'touch')
    pointer(avatar, 'pointerup', 100, 'touch')
    avatar.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }))
  })
  expect(onChange).toHaveBeenCalledExactlyOnceWith('avatar-02')
})

it('reveals the selected avatar in the horizontal scroller on mount', async () => {
  vi.spyOn(HTMLElement.prototype, 'offsetLeft', 'get').mockImplementation(function () { return this.getAttribute('data-avatar-index') === '26' ? 1560 : 0 })
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function () { return this.getAttribute('role') === 'radiogroup' ? 320 : 64 })
  const grid = await render()
  expect(grid.scrollLeft).toBe(1432)
  expect(grid.scrollTop).toBe(0)
})
