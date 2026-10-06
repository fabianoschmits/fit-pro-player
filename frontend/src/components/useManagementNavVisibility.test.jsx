// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
import ManagementLayout from './ManagementLayout.jsx'

let root, container
afterEach(async () => { await act(async () => root?.unmount()); container?.remove(); vi.restoreAllMocks() })
it.each([['professional', '/professional/profile/edit'], ['student', '/student/professionals/add'], ['student', '/invite/A1B2C3D4E5']])('reveals the active %s link within the horizontal navigation without scrolling the page', async (audience, route) => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(600)
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(300)
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () { return this.matches('[aria-current="page"]') ? { left: 400, right: 500 } : { left: 0, right: 300 } })
  const scrollPage = vi.spyOn(window, 'scrollTo')
  container = document.createElement('div'); document.body.append(container); root = createRoot(container)
  await act(async () => root.render(<MemoryRouter initialEntries={[route]}><ManagementLayout audience={audience} title="Management" /></MemoryRouter>))
  if (route.startsWith('/invite/')) expect([...container.querySelectorAll('.management-nav [aria-current]')].map(link => link.textContent)).toEqual(['Adicionar profissional'])
  expect(container.querySelector('.management-nav').scrollLeft).toBe(200)
  expect(scrollPage).not.toHaveBeenCalled()
})
