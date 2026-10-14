// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import PrivacyPages from './PrivacyPages.jsx'

let root, container
beforeEach(() => { container = document.createElement('div'); document.body.append(container); root = createRoot(container) })
afterEach(async () => { await act(async () => root.unmount()); container.remove() })

describe('public privacy pages', () => {
  it('renders the privacy notice with a rights link and configured legal identity', async () => {
    await act(async () => root.render(<MemoryRouter><PrivacyPages kind="privacy" /></MemoryRouter>))
    expect(container.querySelector('h1')?.textContent).toContain('Aviso de Privacidade')
    expect(container.querySelector('a[href="/data-rights"]')).toBeTruthy()
    expect(container.textContent).toContain('CONFILAR TECNOLOGIA INOVA SIMPLES')
  })

  it('renders the titular rights page with a request action', async () => {
    await act(async () => root.render(<MemoryRouter><PrivacyPages kind="rights" /></MemoryRouter>))
    expect(container.querySelector('h1')?.textContent).toContain('Direitos dos titulares')
    expect(container.querySelector('a[href^="mailto:privacidade@appconfilar.com.br"]')).toBeTruthy()
  })
})
