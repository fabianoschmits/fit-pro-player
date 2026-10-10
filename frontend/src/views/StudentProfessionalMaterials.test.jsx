// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ auth: { status: 'authenticated', user: { id: 's1' } }, repo: { studentProfessionals: vi.fn(), studentProfessionalDetail: vi.fn() }, replace: vi.fn(), start: vi.fn() }))
vi.mock('../auth/AuthProvider.jsx', () => ({ useAuth: () => mocks.auth }))
vi.mock('../lib/supabase-client.js', () => ({ getBrowserSupabaseClient: () => ({ storage: { from: () => ({ getPublicUrl: path => ({ data: { publicUrl: `https://project.test/storage/v1/object/public/professional-photos/${path}` } }) }) } }) }))
vi.mock('../lib/professional-workflow.js', () => ({ createProfessionalWorkflowRepository: () => mocks.repo }))
vi.mock('../store/useStore.js', () => ({ useStore: { getState: () => ({ S: {}, replaceState: mocks.replace }) } }))
vi.mock('../sheets.jsx', () => ({ startFlow: mocks.start }))
import StudentProfessionalMaterials from './StudentProfessionalMaterials.jsx'
let root, container
it('shows the professional photo beside received materials', async () => {
  const photoPath = '11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222.jpg'
  mocks.repo.studentProfessionals.mockResolvedValue([{ professionalId: 'p1', professionalName: 'Ana', photoPath }]); await render()
  expect(container.querySelector('.management-avatar img')?.getAttribute('src')).toContain(photoPath)
})
beforeEach(() => { vi.clearAllMocks(); mocks.repo.studentProfessionals.mockResolvedValue([{ professionalId: 'p1', professionalName: 'Ana Silva' }, { professionalId: 'p2', professionalName: 'João Reis' }]); mocks.repo.studentProfessionalDetail.mockImplementation(id => Promise.resolve({ professional: { professionalId: id }, materials: [{ assignmentId: `a-${id}`, title: `Programa ${id}`, status: id === 'p1' ? 'active' : 'replaced', versionNumber: 2 }] })); container = document.createElement('div'); document.body.append(container); root = createRoot(container) })
afterEach(async () => { await act(async () => root.unmount()); container.remove() })
const render = async () => act(async () => root.render(<MemoryRouter><StudentProfessionalMaterials /></MemoryRouter>))
it('groups only linked professionals and links to the exact assignment without starting or syncing', async () => { await render(); expect(container.textContent).toContain('Ana Silva'); expect(container.textContent).toContain('João Reis'); expect(container.querySelector('a[href="/student/professionals/p2?section=training&material=a-p2"]')).not.toBeNull(); expect(container.textContent).toContain('Encerrado'); expect(container.textContent).toContain('Até 100 materiais recentes por profissional'); expect(mocks.replace).not.toHaveBeenCalled(); expect(mocks.start).not.toHaveBeenCalled() })
it('keeps successful professionals usable when another material request fails', async () => { mocks.repo.studentProfessionalDetail.mockImplementation(id => id === 'p1' ? Promise.reject(new Error('offline')) : Promise.resolve({ professional: { professionalId: id }, materials: [{ assignmentId: 'a2', title: 'Corrida', status: 'active' }] })); await render(); expect(container.textContent).toContain('Corrida'); expect(container.textContent).toContain('Não foi possível carregar os materiais deste profissional.'); expect(container.textContent).toContain('Tentar novamente') })
it('drops material responses when the account changes', async () => { let resolve; mocks.repo.studentProfessionalDetail.mockReturnValueOnce(new Promise(r => { resolve = r })); await render(); mocks.auth = { status: 'anonymous', user: null }; await render(); await act(async () => resolve({ professional: { professionalId: 'p1' }, materials: [{ assignmentId: 'old', title: 'Wrong account material' }] })); expect(container.textContent).not.toContain('Wrong account material'); expect(container.textContent).not.toContain('Programa p2'); expect(container.textContent).toContain('Entre na sua conta para acessar seus profissionais.'); mocks.auth = { status: 'authenticated', user: { id: 's1' } } })
