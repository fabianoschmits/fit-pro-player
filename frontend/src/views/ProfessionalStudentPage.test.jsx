// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { Window } from 'happy-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ auth: { status: 'authenticated', user: { id: 'pro-1' } }, repo: { clientSummaries: vi.fn().mockResolvedValue([{ studentUserId: 's1', displayName: 'Ana', programTitle: 'Força', versionNumber: 1 }]), clientDetail: vi.fn().mockResolvedValue({ studentUserId: 's1', displayName: 'Ana', assignments: [{ id: 'a1', program_title: 'Força', version_number: 1 }], executions: [{ id: 'e1', day_key: 'monday', status: 'completed' }] }), relationships: vi.fn().mockResolvedValue([{ id: 'r1', student_user_id: 's1', status: 'active' }]), programs: vi.fn().mockResolvedValue([]), versions: vi.fn().mockResolvedValue([]), revokeRelationship: vi.fn() } }))
vi.mock('../auth/AuthProvider.jsx', () => ({ useAuth: () => mocks.auth }))
vi.mock('../lib/supabase-client.js', () => ({ getBrowserSupabaseClient: () => null }))
vi.mock('../lib/professional-workflow.js', () => ({ createProfessionalWorkflowRepository: () => mocks.repo }))
vi.mock('../components/AppHeader.jsx', () => ({ default: ({ title }) => <h1>{title}</h1> }))
import ProfessionalStudentPage from './ProfessionalStudentPage.jsx'

let dom, root, container
beforeEach(() => { dom = new Window({ url: 'https://app.example/#/professional/students/s1' }); globalThis.window = dom; globalThis.document = dom.document; container = document.createElement('div'); document.body.append(container); root = createRoot(container) })
afterEach(async () => { await act(async () => root.unmount()); dom.close() })

describe('professional student detail', () => {
  it('separates summary, training, history and relationship actions', async () => {
    await act(async () => root.render(<MemoryRouter initialEntries={['/professional/students/s1']}><Routes><Route path="/professional/students/:studentId" element={<ProfessionalStudentPage />} /></Routes></MemoryRouter>))
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)) })
    expect(container.textContent).toContain('Ana')
    expect(container.textContent).toContain('Resumo')
    expect(container.textContent).toContain('Treino')
    expect(container.textContent).toContain('Histórico')
    expect(container.textContent).toContain('Vínculo')
  })
})
