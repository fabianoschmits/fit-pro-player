// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { Link, MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ repo: {} }))
vi.mock('./ConsoleAccess.jsx', () => ({ useConsoleAccess: () => ({ userId: 'admin-1', allowed: true, repo: mocks.repo }), AccessGate: ({ children }) => children }))
vi.mock('./ConsoleLayout.jsx', () => ({ default: ({ children }) => children }))
import { ConsoleUserPage } from './ConsoleUserPage.jsx'
import { ConsoleProfessionals } from './ConsoleProfessionals.jsx'
let root, host
const button = label => [...host.querySelectorAll('button')].find(item => item.textContent === label)
function Location() { return <output>{useLocation().pathname}</output> }
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true; host = document.createElement('div'); document.body.append(host); root = createRoot(host)
  mocks.repo = {
    userDetail: vi.fn().mockResolvedValue({ userId: 'user-1', displayName: 'Ana', email: 'ana@example.com', roles: ['student'], accountKind: 'account', studentLinks: 0, professionalLinks: 0 }),
    userTraining: vi.fn().mockResolvedValue(null), setDisplayName: vi.fn(), setProfessionalRole: vi.fn().mockResolvedValue(), deleteUser: vi.fn(),
    listProfessionals: vi.fn().mockResolvedValue([{ userId: 'user-1', professionalName: 'Ana', email: 'ana@example.com', verificationStatus: 'pending', studentLinks: 0 }]), setVerification: vi.fn(),
  }
})
afterEach(async () => { await act(async () => root.unmount()); host.remove(); delete window.confirm; vi.useRealTimers(); vi.restoreAllMocks() })

it.each(['account', 'verification'])('keeps a pointer result visible before refreshing the %s surface', async surface => {
  vi.useFakeTimers()
  await act(async () => root.render(<MemoryRouter initialEntries={['/console/users/user-1']}><Routes><Route path="/console/users/:userId" element={surface === 'account' ? <ConsoleUserPage /> : <ConsoleProfessionals />} /></Routes></MemoryRouter>))
  const reads = surface === 'account' ? mocks.repo.userDetail : mocks.repo.listProfessionals
  const action = button(surface === 'account' ? 'Salvar nome' : 'Aprovar')
  await act(async () => action.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 })))
  await act(async () => vi.advanceTimersByTimeAsync(320))

  expect(reads).toHaveBeenCalledTimes(1)
  expect(host.querySelector('[data-state="success"]')).not.toBeNull()
  expect(host.textContent).toContain('Ana')
  await act(async () => vi.advanceTimersByTimeAsync(519))
  expect(reads).toHaveBeenCalledTimes(1)
  await act(async () => vi.advanceTimersByTimeAsync(1))
  expect(reads).toHaveBeenCalledTimes(2)
})

it('locks account writes across controls and leaves a failed name edit available for retry', async () => {
  let reject
  mocks.repo.setDisplayName.mockImplementationOnce(() => new Promise((_, no) => { reject = no })).mockResolvedValueOnce(true)
  await act(async () => root.render(<MemoryRouter initialEntries={['/console/users/user-1']}><Routes><Route path="/console/users/:userId" element={<ConsoleUserPage />} /></Routes></MemoryRouter>))
  await act(async () => { const field = host.querySelector('input'); Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(field, 'Ana revisada'); field.dispatchEvent(new Event('input', { bubbles: true })) })
  act(() => { button('Salvar nome').click(); button('Salvar nome').click(); button('Conceder acesso profissional').click() })
  expect(mocks.repo.setDisplayName).toHaveBeenCalledTimes(1)
  expect(mocks.repo.setProfessionalRole).not.toHaveBeenCalled()
  expect(button('Salvar nome').getAttribute('data-state')).toBe('loading')
  await act(async () => reject(new Error('Não foi possível salvar')))
  expect(host.querySelector('input').value).toBe('Ana revisada')
  expect(host.querySelector('[data-state="error"]').disabled).toBe(false)
  await act(async () => host.querySelector('[data-state="error"]').click())
  expect(mocks.repo.setDisplayName).toHaveBeenCalledTimes(2)
  expect(host.textContent).toContain('Nome atualizado.')
})

it('guards verification writes and shows retry after a rejected request', async () => {
  let reject
  mocks.repo.setVerification.mockImplementationOnce(() => new Promise((_, no) => { reject = no })).mockResolvedValueOnce(true)
  await act(async () => root.render(<MemoryRouter><ConsoleProfessionals /></MemoryRouter>))
  act(() => { button('Aprovar').click(); button('Aprovar').click(); button('Rejeitar').click() })
  expect(mocks.repo.setVerification).toHaveBeenCalledTimes(1)
  expect(button('Aprovar').getAttribute('aria-busy')).toBe('true')
  await act(async () => reject(new Error('offline')))
  expect(host.querySelector('[data-state="error"]').disabled).toBe(false)
  expect(host.textContent).toContain('Não foi possível atualizar a verificação.')
  await act(async () => host.querySelector('[data-state="error"]').click())
  expect(mocks.repo.setVerification).toHaveBeenCalledTimes(2)
})

it('preserves account deletion confirmation and ignores late completion after navigation away', async () => {
  let resolve
  const confirm = vi.fn().mockReturnValue(false); window.confirm = confirm
  mocks.repo.deleteUser.mockImplementationOnce(() => new Promise(yes => { resolve = yes }))
  await act(async () => root.render(<MemoryRouter initialEntries={['/console/users/user-1']}><Link data-leave to="/elsewhere">Sair da página</Link><Location /><Routes><Route path="/console/users/:userId" element={<ConsoleUserPage />} /><Route path="/elsewhere" element={<p>Outra página</p>} /><Route path="/console/users" element={<p>Contas</p>} /></Routes></MemoryRouter>))
  await act(async () => button('Apagar conta').click())
  expect(mocks.repo.deleteUser).not.toHaveBeenCalled()
  confirm.mockReturnValue(true)
  act(() => button('Apagar conta').click())
  expect(mocks.repo.deleteUser).toHaveBeenCalledTimes(1)
  await act(async () => host.querySelector('[data-leave]').click())
  await act(async () => resolve(true))
  expect(mocks.repo.userDetail).toHaveBeenCalledTimes(1)
  expect(host.querySelector('output').textContent).toBe('/elsewhere')
})
