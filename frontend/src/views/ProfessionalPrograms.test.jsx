// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { Window } from 'happy-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ auth: { status: 'authenticated', user: { id: 'pro-1' } }, repo: { programs: vi.fn().mockResolvedValue([{ id: 'p1', title: 'Força', description: 'Base' }]), versions: vi.fn().mockResolvedValue([{ id: 'v1', program_id: 'p1', version_number: 1, weekly_plan: { monday: [{ exerciseId: '1', sets: 3, reps: 8 }] } }]), createProgram: vi.fn(), updateProgram: vi.fn(), publishProgramVersion: vi.fn() } }))
vi.mock('../auth/AuthProvider.jsx', () => ({ useAuth: () => mocks.auth }))
vi.mock('../lib/supabase-client.js', () => ({ getBrowserSupabaseClient: () => null }))
vi.mock('../lib/professional-workflow.js', () => ({ createProfessionalWorkflowRepository: () => mocks.repo }))
vi.mock('../components/AppHeader.jsx', () => ({ default: ({ title }) => <h1>{title}</h1> }))
vi.mock('../lib/exercises.js', async importOriginal => ({ ...(await importOriginal()), PROFESSIONAL_EXERCISES: [{ id: '1', n: 'Agachamento' }] }))
import ProfessionalPrograms from './ProfessionalPrograms.jsx'

let dom, root, container
beforeEach(() => { dom = new Window({ url: 'https://app.example/#/professional/programs' }); globalThis.window = dom; globalThis.document = dom.document; container = document.createElement('div'); document.body.append(container); root = createRoot(container) })
afterEach(async () => { await act(async () => root.unmount()); dom.close() })

describe('professional programs page', () => {
  it('compares published prescriptions and requires an explicit archive action', async () => {
    mocks.repo.versions.mockResolvedValueOnce([{ id: 'v2', program_id: 'p1', version_number: 2, weekly_plan: { monday: [{ exerciseId: '1', sets: 3, reps: 8, load: 45 }] } }, { id: 'v1', program_id: 'p1', version_number: 1, weekly_plan: { monday: [{ exerciseId: '1', sets: 3, reps: 8, load: 40 }] } }])
    await act(async () => root.render(<MemoryRouter><ProfessionalPrograms /></MemoryRouter>))
    await act(async () => [...container.querySelectorAll('button')].find(button => button.textContent === 'Comparar versões').click())
    expect(document.body.textContent).toContain('45 kg')
    expect(document.body.textContent).toContain('40 kg')
    await act(async () => document.querySelector('[role="dialog"] button').click())
    await act(async () => [...container.querySelectorAll('button')].find(button => button.textContent === 'Arquivar').click())
    expect(container.textContent).toContain('encerra as atribuições ativas')
    await act(async () => [...container.querySelectorAll('button')].find(button => button.textContent === 'Confirmar arquivo').click())
    expect(mocks.repo.updateProgram).toHaveBeenCalledWith('p1', expect.objectContaining({ archived: true }))
  })
  it('shows versioned programs independently from client assignment', async () => {
    await act(async () => root.render(<MemoryRouter initialEntries={['/professional/programs']}><ProfessionalPrograms /></MemoryRouter>))
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)) })
    expect(container.textContent).toContain('Programas')
    expect(container.textContent).toContain('Força')
    expect(container.textContent).toContain('Versão 1')
    expect(container.textContent).not.toContain('Enviar para cliente selecionado')
  })
})
