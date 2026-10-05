// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { Window } from 'happy-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ auth: { status: 'authenticated', user: { id: 'pro-1' } }, repo: { programs: vi.fn().mockResolvedValue([{ id: 'p1', title: 'Força', description: 'Base' }]), versions: vi.fn().mockResolvedValue([{ id: 'v1', program_id: 'p1', version_number: 1, weekly_plan: { monday: [{ exerciseId: '1', sets: 3, reps: 8 }] } }]), createProgram: vi.fn(), updateProgram: vi.fn(), publishProgramVersion: vi.fn() } }))
vi.mock('../auth/AuthProvider.jsx', () => ({ useAuth: () => mocks.auth }))
vi.mock('../lib/supabase-client.js', () => ({ getBrowserSupabaseClient: () => null }))
vi.mock('../lib/professional-workflow.js', () => ({ createProfessionalWorkflowRepository: () => mocks.repo }))
vi.mock('../components/AppHeader.jsx', () => ({ default: ({ title, action }) => <header><h1>{title}</h1>{action}</header> }))
vi.mock('../lib/exercises.js', async importOriginal => ({ ...(await importOriginal()), PROFESSIONAL_EXERCISES: [{ id: '1', n: 'Agachamento' }] }))
import ProfessionalPrograms from './ProfessionalPrograms.jsx'

const page = (path = '/professional/programs') => <MemoryRouter initialEntries={[path]}><Routes><Route path="/professional/programs" element={<ProfessionalPrograms />} /><Route path="/professional/programs/new" element={<ProfessionalPrograms />} /><Route path="/professional/programs/:programId" element={<ProfessionalPrograms />} /><Route path="/professional/programs/:programId/edit" element={<ProfessionalPrograms />} /></Routes></MemoryRouter>
let dom, root, container
beforeEach(() => { vi.clearAllMocks(); mocks.auth.user = { id: 'pro-1' }; dom = new Window({ url: 'https://app.example/#/professional/programs' }); globalThis.window = dom; globalThis.document = dom.document; globalThis.IS_REACT_ACT_ENVIRONMENT = true; container = document.createElement('div'); document.body.append(container); root = createRoot(container) })
afterEach(async () => { await act(async () => root.unmount()); dom.close() })

describe('professional programs page', () => {
  it('separates archived programs without loading their versions', async () => {
    mocks.repo.programs.mockResolvedValueOnce([{ id: 'p1', title: 'Disponível' }, { id: 'p2', title: 'Programa antigo', archived: true }])
    await act(async () => root.render(page()))
    expect(container.textContent).not.toContain('Programa antigo')
    await act(async () => [...container.querySelectorAll('button')].find(button => button.textContent === 'Arquivados').click())
    expect(container.textContent).toContain('Programa antigo')
    expect(mocks.repo.versions).not.toHaveBeenCalled()
  })
  it('creates on its focused page and opens the returned program editor', async () => {
    mocks.repo.createProgram.mockResolvedValueOnce({ id: 'p2', title: 'Resistência' })
    mocks.repo.programs.mockResolvedValueOnce([{ id: 'p2', title: 'Resistência' }])
    await act(async () => root.render(page('/professional/programs/new')))
    const input = container.querySelector('input[aria-label="Nome do programa"]')
    await act(async () => { Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(input, 'Resistência'); input.dispatchEvent(new Event('input', { bubbles: true })) })
    await act(async () => container.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
    expect(mocks.repo.createProgram).toHaveBeenCalledWith('pro-1', 'Resistência', '')
    expect(container.textContent).toContain('Editar programa semanal')
    expect(mocks.repo.versions).toHaveBeenCalledWith('p2')
  })
  it('keeps the previous account response out of a pending library load', async () => {
    let finishOld
    mocks.repo.programs.mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve }))
    await act(async () => root.render(page()))
    mocks.auth.user = { id: 'pro-2' }
    mocks.repo.programs.mockResolvedValueOnce([{ id: 'p2', title: 'Nova conta' }])
    await act(async () => root.render(page()))
    await act(async () => finishOld([{ id: 'old', title: 'Conta anterior' }]))
    expect(container.textContent).toContain('Nova conta')
    expect(container.textContent).not.toContain('Conta anterior')
  })
  it('opens the editor directly and cancels back to program detail', async () => {
    await act(async () => root.render(page('/professional/programs/p1/edit')))
    expect(container.textContent).toContain('Editar programa semanal')
    await act(async () => [...container.querySelectorAll('button')].find(button => button.textContent === 'Cancelar').click())
    expect(container.textContent).not.toContain('Editar programa semanal')
    expect(container.textContent).toContain('Versão 1')
    expect(container.querySelector('a[href="/professional/students?program=p1&version=v1"]')).toBeTruthy()
  })

  it('compares published prescriptions and requires an explicit archive action', async () => {
    mocks.repo.versions.mockResolvedValueOnce([{ id: 'v2', program_id: 'p1', version_number: 2, weekly_plan: { monday: [{ exerciseId: '1', sets: 3, reps: 8, load: 45 }] } }, { id: 'v1', program_id: 'p1', version_number: 1, weekly_plan: { monday: [{ exerciseId: '1', sets: 3, reps: 8, load: 40 }] } }])
    await act(async () => root.render(page('/professional/programs/p1')))
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
    await act(async () => root.render(page()))
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)) })
    expect(container.textContent).toContain('Programas')
    expect(container.textContent).toContain('Força')
    expect(mocks.repo.versions).not.toHaveBeenCalled()
    expect(container.querySelector('a[href="/professional/programs/new"]')).toBeTruthy()
    expect(container.querySelector('input[aria-label="Nome do programa"]')).toBeNull()
    expect(container.textContent).not.toContain('Enviar para cliente selecionado')
  })
})
