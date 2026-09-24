// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { Window } from 'happy-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ auth: { status: 'authenticated', user: { id: 'pro-1' } }, repo: { programs: vi.fn().mockResolvedValue([{ id: 'p1', title: 'Força', description: 'Base' }]), versions: vi.fn().mockResolvedValue([{ id: 'v1', program_id: 'p1', version_number: 1, weekly_plan: { monday: [{ exerciseId: '1', sets: 3, reps: 8 }] } }]), createProgram: vi.fn(), publishProgramVersion: vi.fn() } }))
vi.mock('../auth/AuthProvider.jsx', () => ({ useAuth: () => mocks.auth }))
vi.mock('../lib/supabase-client.js', () => ({ getBrowserSupabaseClient: () => null }))
vi.mock('../lib/professional-workflow.js', () => ({ createProfessionalWorkflowRepository: () => mocks.repo }))
vi.mock('../components/AppHeader.jsx', () => ({ default: ({ title }) => <h1>{title}</h1> }))
vi.mock('../lib/exercises.js', () => ({ PROFESSIONAL_EXERCISES: [{ id: '1', n: 'Agachamento' }] }))
import ProfessionalPrograms from './ProfessionalPrograms.jsx'

let dom, root, container
beforeEach(() => { dom = new Window({ url: 'https://app.example/#/professional/programs' }); globalThis.window = dom; globalThis.document = dom.document; container = document.createElement('div'); document.body.append(container); root = createRoot(container) })
afterEach(async () => { await act(async () => root.unmount()); dom.close() })

describe('professional programs page', () => {
  it('shows versioned programs independently from client assignment', async () => {
    await act(async () => root.render(<MemoryRouter initialEntries={['/professional/programs']}><ProfessionalPrograms /></MemoryRouter>))
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)) })
    expect(container.textContent).toContain('Programas')
    expect(container.textContent).toContain('Força')
    expect(container.textContent).toContain('Versão 1')
    expect(container.textContent).not.toContain('Enviar para cliente selecionado')
  })
})
