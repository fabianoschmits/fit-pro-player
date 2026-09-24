// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { Window } from 'happy-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auth: { status: 'authenticated', user: { id: 'professional-1' } },
  repo: {
    professionalRole: vi.fn().mockResolvedValue(true),
    clientSummaries: vi.fn().mockResolvedValue([{ studentUserId: 'student-1', displayName: 'Ana', programTitle: 'Força' }]),
    clientDetail: vi.fn().mockResolvedValue({ assignments: [], executions: [] }),
    invites: vi.fn().mockResolvedValue([]), programs: vi.fn().mockResolvedValue([]), assignments: vi.fn().mockResolvedValue([]), executions: vi.fn().mockResolvedValue([]),
  },
  navigate: vi.fn(),
}))

vi.mock('../auth/AuthProvider.jsx', () => ({ useAuth: () => mocks.auth }))
vi.mock('../lib/supabase-client.js', () => ({ getBrowserSupabaseClient: () => null }))
vi.mock('../lib/professional-workflow.js', () => ({ createProfessionalWorkflowRepository: () => mocks.repo }))
vi.mock('../components/AppHeader.jsx', () => ({ default: ({ title }) => <h1>{title}</h1> }))

import ProfessionalDashboard from './ProfessionalDashboard.jsx'

let dom
let root
let container

beforeEach(() => {
  dom = new Window({ url: 'https://app.example/#/professional' })
  globalThis.window = dom; globalThis.document = dom.document; globalThis.IS_REACT_ACT_ENVIRONMENT = true
  container = document.createElement('div'); document.body.append(container); root = createRoot(container)
})
afterEach(async () => { await act(async () => root.unmount()); dom.close() })

describe('professional dashboard', () => {
  it('organizes the client area around real client summaries', async () => {
    await act(async () => root.render(<ProfessionalDashboard />))
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)) })
    expect(container.textContent).toContain('Clientes')
    await act(async () => [...container.querySelectorAll('button')].find(button => button.textContent === 'Clientes').click())
    expect(container.textContent).toContain('Ana')
    expect(container.textContent).toContain('Programas')
  })
})
