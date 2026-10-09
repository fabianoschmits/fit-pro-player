// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { beforeEach, afterEach, it, expect, vi } from 'vitest'
import { useStore } from '../../../store/useStore.js'
import ProgramVersionsPage from './ProgramVersionsPage.jsx'
import ProgramComparePage from './ProgramComparePage.jsx'
import ProfessionalPrograms from '../../../views/ProfessionalPrograms.jsx'
const account = '11111111-1111-4111-8111-111111111111'
const repo = vi.hoisted(() => ({ program: vi.fn(), version: vi.fn(), versions: vi.fn() }))
vi.mock('../../../auth/AuthProvider.jsx', () => ({ useAuth: () => ({ user: { id: '11111111-1111-4111-8111-111111111111' }, status: 'authenticated' }) }))
vi.mock('../../../lib/professional-workflow.js', () => ({ createProfessionalWorkflowRepository: () => repo }))
let root, node
beforeEach(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true; vi.clearAllMocks(); localStorage.clear(); await useStore.getState().activateLocalScope(account)
  repo.program.mockResolvedValue({ id: 'p', professional_user_id: account, title: 'Força' })
  repo.versions.mockResolvedValue([
    { id: 'new', program_id: 'p', version_number: 2, weekly_plan: { monday: [{ exerciseId: '9997', sets: 3, reps: 8, load: 45, unit: 'lb', rest: 95, rir: 2, rpe: 8, sg: 'A', notes: 'Nova observação' }] }, workout_titles: { monday: 'Força nova' } },
    { id: 'old', program_id: 'p', version_number: 1, weekly_plan: { tuesday: [{ exerciseId: '9997', mode: 'cardio', sets: 1, min: 24, speed: 8, rest: 70, notes: 'Anterior' }] }, workout_titles: { tuesday: 'Cardio anterior' } },
  ])
  node = document.createElement('div'); document.body.append(node); root = createRoot(node)
})
afterEach(async () => { await act(async () => root.unmount()); node.remove() })
const render = async path => act(async () => root.render(<MemoryRouter initialEntries={[path]}><Routes>
  <Route path="/professional/programs/:programId/versions" element={<ProgramVersionsPage />} />
  <Route path="/professional/programs/:programId/versions/compare" element={<ProgramComparePage />} />
  <Route path="/professional/programs/:programId/versions/:versionId" element={<ProfessionalPrograms />} />
</Routes></MemoryRouter>))
it('version_comparison_keeps_full_prescriptions', async () => {
  await render('/professional/programs/p/versions/compare?before=old&after=new&material=source')
  for (const value of ['45 lb', '95', 'RIR 2', 'RPE 8', 'A', 'Nova observação', '24 min / 8 km/h', '70', 'Anterior', 'Força nova', 'Cardio anterior']) expect(node.textContent).toContain(value)
  expect(node.querySelector('a[href*="/edit?version=new"]')).toBeTruthy(); expect(useStore.getState().S.professionalProgramDrafts).toEqual({})
})
it('exact version detail never substitutes latest or another program', async () => {
  repo.version.mockResolvedValue(null); await render('/professional/programs/p/versions/missing')
  expect(node.textContent).toContain('Versão não encontrada'); expect(repo.version).toHaveBeenCalledWith('missing'); expect(repo.versions).not.toHaveBeenCalled()
})
it('comparison missing explicit identity fails closed', async () => {
  await render('/professional/programs/p/versions/compare?before=missing&after=new')
  expect(node.textContent).toContain('Versão não encontrada'); expect(node.textContent).not.toContain('Nova observação')
})
it('versions navigate to exact published historical week', async () => {
  await render('/professional/programs/p/versions?material=source')
  expect(node.querySelector('a[href="/professional/programs/p/versions/old?material=source"]')).toBeTruthy(); expect(node.querySelectorAll('.professional-compact-list li')).toHaveLength(2)
})
