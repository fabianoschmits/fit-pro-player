// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import ProgressPhotoCompare from './ProgressPhotoCompare.jsx'

vi.mock('./ui.jsx', () => ({ Button: ({ children, variant: _variant, ...props }) => <button {...props}>{children}</button> }))
const photo = { id: 'a', photo_date: '2026-01-01', width: 1000, height: 2000 }
let root, container
beforeEach(() => { globalThis.IS_REACT_ACT_ENVIRONMENT = true; container = document.createElement('div'); document.body.append(container); root = createRoot(container) })
afterEach(async () => { await act(async () => root.unmount()); container.remove() })
const render = async () => act(async () => root.render(<ProgressPhotoCompare before={photo} after={{ ...photo, id: 'b' }} beforeURL="/a.jpg" afterURL="/b.jpg" onSave={vi.fn()} />))

it('inicia em 50%, limita teclado e não redimensiona camadas ao revelar', async () => {
  await render()
  const slider = container.querySelector('[role=slider]')
  const initialImages = [...container.querySelectorAll('img')].map(img => img.getAttribute('style'))
  expect(slider.getAttribute('aria-valuenow')).toBe('50')
  for (const [key, expected] of [['End', '100'], ['ArrowRight', '100'], ['Home', '0'], ['ArrowLeft', '0'], ['ArrowRight', '2']]) {
    await act(async () => slider.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true })))
    expect(slider.getAttribute('aria-valuenow')).toBe(expected)
  }
  expect([...container.querySelectorAll('img')].map(img => img.getAttribute('style'))).toEqual(initialImages)
  await act(async () => [...container.querySelectorAll('button')].find(button => button.textContent === 'Centralizar divisor').click())
  expect(slider.getAttribute('aria-valuenow')).toBe('50')
})

it('usa captura de ponteiro e limita o divisor ao quadro', async () => {
  await render()
  const stage = container.querySelector('.bp-photo-stage')
  stage.getBoundingClientRect = () => ({ left: 100, width: 300, height: 400 })
  const slider = container.querySelector('[role=slider]')
  slider.setPointerCapture = vi.fn()
  slider.hasPointerCapture = () => true
  slider.releasePointerCapture = vi.fn()
  await act(async () => slider.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 7, button: 0, clientX: 250, bubbles: true })))
  expect(slider.setPointerCapture).toHaveBeenCalledWith(7)
  await act(async () => slider.dispatchEvent(new PointerEvent('pointermove', { pointerId: 7, clientX: 999, bubbles: true })))
  expect(slider.getAttribute('aria-valuenow')).toBe('100')
  await act(async () => slider.dispatchEvent(new PointerEvent('pointermove', { pointerId: 7, clientX: -9, bubbles: true })))
  expect(slider.getAttribute('aria-valuenow')).toBe('0')
  await act(async () => slider.dispatchEvent(new PointerEvent('pointerup', { pointerId: 7, bubbles: true })))
  expect(slider.releasePointerCapture).toHaveBeenCalledWith(7)
})

it('ajusta apenas uma foto e permite cancelar', async () => {
  await render()
  const original = container.querySelector('img').getAttribute('style')
  await act(async () => [...container.querySelectorAll('button')].find(button => button.textContent === 'Ajustar depois').click())
  const zoom = container.querySelector('input[type=range]')
  await act(async () => { const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; setter.call(zoom, '1.5'); zoom.dispatchEvent(new Event('input', { bubbles: true })); zoom.dispatchEvent(new Event('change', { bubbles: true })) })
  expect(container.querySelector('img').getAttribute('style')).toBe(original)
  await act(async () => [...container.querySelectorAll('button')].find(button => button.textContent === 'Cancelar').click())
  expect(container.querySelector('[role=slider]')).not.toBeNull()
})

it('mantém o divisor acessível sem ferramentas de edição no demonstrador', async () => {
  await act(async () => root.render(<ProgressPhotoCompare before={photo} after={{ ...photo, id: 'b' }} beforeURL="/a.jpg" afterURL="/b.jpg" controls={false} />))
  expect(container.querySelector('[role=slider]')).toBeTruthy()
  expect(container.querySelector('details,input')).toBeNull()
  expect(container.textContent).not.toMatch(/Ajustar|Centralizar|Detecção/)
})

it('encerra o carregamento quando as imagens falham e mantém o erro visível', async () => {
  await render()
  await act(async () => { for (const image of container.querySelectorAll('img')) image.dispatchEvent(new Event('error')) })
  expect(container.querySelector('.bp-photo-loading')).toBeNull()
  expect(container.textContent).toContain('Falha ao carregar')
})
