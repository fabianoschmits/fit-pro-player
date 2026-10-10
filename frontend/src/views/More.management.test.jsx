// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ auth:{status:'authenticated',user:{id:'a'}}, role:vi.fn(), admin:vi.fn().mockResolvedValue(false) }))
vi.mock('../auth/AuthProvider.jsx', () => ({ useAuth:() => mocks.auth }))
vi.mock('../lib/supabase-client.js', () => ({getBrowserSupabaseClient:() => null}))
vi.mock('../lib/professional-workflow.js', () => ({createProfessionalWorkflowRepository:() => ({professionalRole:mocks.role})}))
vi.mock('../lib/console.js', () => ({createConsoleRepository:() => ({adminRole:mocks.admin})}))
import More from './More.jsx'
let root, container
function Location() { const location = useLocation(); return <output>{location.pathname}{location.search}</output> }
const render = () => act(async () => root.render(<MemoryRouter><More /><Location /></MemoryRouter>))
beforeEach(() => { globalThis.IS_REACT_ACT_ENVIRONMENT = true; container=document.createElement('div');document.body.append(container);root=createRoot(container);mocks.auth={status:'authenticated',user:{id:'a'}};mocks.role.mockReset() })
afterEach(async () => { await act(async () => root.unmount()); container.remove() })
it('opens the canonical profile workspace from More', async () => {
  mocks.role.mockResolvedValue(true); await render()
  const row=[...container.querySelectorAll('[role="button"],button')].find(element => element.textContent.includes('Perfil profissional'))
  await act(async () => row.click())
  expect(container.querySelector('output').textContent).toBe('/professional/profile')
})
it('does not expose professional entries from a previous account response', async () => {
  let resolve; mocks.role.mockImplementationOnce(() => new Promise(done => { resolve=done })).mockResolvedValue(false)
  await render(); mocks.auth={status:'authenticated',user:{id:'b'}}; await render()
  await act(async () => resolve(true))
  expect(container.textContent).not.toContain('Área profissional')
  expect(container.textContent).not.toContain('Perfil profissional')
  expect(container.textContent).toContain('Meus profissionais')
})
it('groups professional shortcuts above personal training and routes personal data to settings', async () => {
  mocks.role.mockResolvedValue(true); await render()
  expect(container.querySelector('[data-menu-group="professional"]')).not.toBeNull()
  const buttons = [...container.querySelectorAll('button')]
  expect(buttons.some(button => button.textContent.includes('Convidar aluno'))).toBe(true)
  await act(async () => buttons.find(button => button.textContent.includes('Dados pessoais')).click())
  expect(container.querySelector('output').textContent).toBe('/settings?profile=edit')
})
it('shows an administration group only for admins and removes it immediately on account switch', async () => {
  mocks.role.mockResolvedValue(false); mocks.admin.mockResolvedValueOnce(true).mockResolvedValue(false); await render()
  expect(container.querySelector('[data-menu-group="admin"]')).not.toBeNull()
  mocks.auth = {status:'authenticated',user:{id:'b'}}; await render()
  expect(container.querySelector('[data-menu-group="admin"]')).toBeNull()
})
