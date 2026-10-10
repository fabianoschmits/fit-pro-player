// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ auth: { status: 'authenticated', user: { id: 'professional-a' } }, role: vi.fn(), own: vi.fn(), save: vi.fn(), provision: vi.fn(), upload: vi.fn(), remove: vi.fn() }))
vi.mock('../auth/AuthProvider.jsx', () => ({ useAuth: () => mocks.auth }))
vi.mock('../lib/supabase-client.js', () => ({ getBrowserSupabaseClient: () => null }))
vi.mock('../lib/professional-profile.js', () => ({ createProfessionalProfileRepository: () => mocks }))
vi.mock('../lib/professional-photo.js', async original => ({ ...await original(), createProfessionalPhotoRepository: () => mocks }))
import ProfessionalProfile from './ProfessionalProfile.jsx'

const saved = { professionalName: 'Ana Silva', bio: 'Treinamento de força', specialties: ['força', 'corrida'], cityRegion: 'São Paulo', registrationType: 'CREF', registrationNumber: '123', verificationStatus: 'unverified' }
let root, container
function Location() { const location = useLocation(); return <output data-location>{location.pathname}{location.search}</output> }
const render = (route = '/professional/profile') => act(async () => root.render(<MemoryRouter initialEntries={[route]}><ProfessionalProfile /><Location /></MemoryRouter>))
const click = text => act(async () => [...container.querySelectorAll('button,a')].find(element => element.textContent === text).click())
const fill = (name, value) => act(async () => { const input = container.querySelector(`[name="${name}"]`); Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true })) })
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  container = document.createElement('div'); document.body.append(container); root = createRoot(container)
  vi.resetAllMocks(); mocks.auth = { status: 'authenticated', user: { id: 'professional-a' } }
  mocks.role.mockResolvedValue(true); mocks.own.mockResolvedValue(saved); mocks.save.mockImplementation(async (_, profile) => profile)
})
afterEach(async () => { await act(async () => root.unmount()); container.remove() })

describe('professional profile workspace', () => {
  it('keeps the changed photo when an earlier text save finishes and preserves text drafts during photo updates', async () => {
    let resolveSave; mocks.save.mockReturnValueOnce(new Promise(resolve => { resolveSave = resolve }))
    mocks.upload.mockResolvedValue({ ...saved, photoPath: 'owner/new.jpg' })
    await render('/professional/profile/edit'); await fill('professionalName', 'Draft name'); await click('Salvar perfil')
    await act(async () => {
      const input = container.querySelector('input[type="file"]')
      Object.defineProperty(input, 'files', { configurable: true, value: [new File(['photo'], 'new.jpg', { type: 'image/jpeg' })] })
      input.dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(container.querySelector('[name="professionalName"]').value).toBe('Draft name')
    await act(async () => resolveSave({ ...saved, professionalName: 'Draft name', photoPath: null }))
    expect(container.textContent).toContain('Remover foto')
  })
  it('shows independent photo controls on the profile and edit page only for professionals', async () => {
    await render(); expect(container.querySelector('input[type="file"]')).not.toBeNull()
    await click('Editar perfil'); expect(container.querySelector('input[type="file"]')).not.toBeNull()
    mocks.auth = { status: 'authenticated', user: { id: 'new-account' } }; mocks.role.mockResolvedValue(false)
    await render('/professional/profile/edit'); expect(container.querySelector('input[type="file"]')).toBeNull()
  })
  it('opens saved values directly in the addressable edit page', async () => {
    await render('/professional/profile/edit')
    expect(container.querySelector('input[name="professionalName"]')?.value).toBe('Ana Silva')
    expect(container.querySelector('textarea[name="bio"]')?.value).toBe('Treinamento de força')
    expect(container.querySelector('input[name="specialties"]')?.value).toBe('força, corrida')
  })
  it('discards edits on cancel and reloads saved values when editing again', async () => {
    await render(); await click('Editar perfil'); await fill('professionalName', 'Rascunho'); await click('Cancelar')
    expect(container.querySelector('[data-location]').textContent).toBe('/professional/profile')
    expect(container.textContent).toContain('Ana Silva'); expect(container.textContent).not.toContain('Rascunho')
    await click('Editar perfil'); expect(container.querySelector('[name="professionalName"]').value).toBe('Ana Silva')
    expect(mocks.save).not.toHaveBeenCalled()
  })
  it('validates a whitespace-only name without losing the draft', async () => {
    await render('/professional/profile/edit'); await fill('professionalName', '  '); await click('Salvar perfil')
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Informe seu nome profissional.')
    expect(mocks.save).not.toHaveBeenCalled()
    expect(container.querySelector('[name="professionalName"]').getAttribute('aria-invalid')).toBe('true')
  })
  it('preserves commas while typing specialties and saves the profile to the existing repository', async () => {
    await render('/professional/profile/edit'); await fill('professionalName', 'Ana Souza'); await fill('specialties', 'força, ')
    expect(container.querySelector('[name="specialties"]').value).toBe('força, ')
    await fill('specialties', 'força, corrida'); await click('Salvar perfil')
    expect(mocks.save).toHaveBeenCalledWith('professional-a', expect.objectContaining({ professionalName: 'Ana Souza', specialties: ['força', 'corrida'] }))
    expect(container.querySelector('[data-location]').textContent).toBe('/professional/profile')
    expect(container.textContent).toContain('Ana Souza'); expect(container.textContent).toContain('Perfil salvo.')
  })
  it('shows a retry after a load failure instead of offering account provisioning', async () => {
    mocks.own.mockRejectedValueOnce(new Error('offline')); await render()
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Não foi possível carregar')
    expect(container.textContent).not.toContain('Criar perfil profissional')
    await click('Tentar novamente'); expect(container.textContent).toContain('Ana Silva')
  })
  it('ignores a late response after switching accounts and hides the previous identity during loading', async () => {
    await render()
    let resolveB; mocks.own.mockImplementationOnce(() => new Promise(resolve => { resolveB = resolve }))
    mocks.auth = { status: 'authenticated', user: { id: 'professional-b' } }; await render()
    expect(container.textContent).not.toContain('Ana Silva')
    mocks.own.mockResolvedValueOnce({ ...saved, professionalName: 'Carla' }); mocks.auth = { status: 'authenticated', user: { id: 'professional-c' } }; await render()
    await act(async () => resolveB({ ...saved, professionalName: 'Bruna' }))
    expect(container.textContent).toContain('Carla'); expect(container.textContent).not.toContain('Bruna')
  })
  it('ignores a late save from the previous account', async () => {
    let resolveSave; mocks.save.mockImplementationOnce(() => new Promise(resolve => { resolveSave = resolve }))
    await render('/professional/profile/edit'); await click('Salvar perfil')
    expect([...container.querySelectorAll('button')].find(button => button.textContent === 'Salvando…').disabled).toBe(true)
    mocks.auth = { status: 'authenticated', user: { id: 'professional-b' } }; mocks.own.mockResolvedValue({ ...saved, professionalName: 'Bruna' }); await render()
    await act(async () => resolveSave({ ...saved, professionalName: 'Ana antiga' }))
    expect(container.querySelector('[name="professionalName"]').value).toBe('Bruna')
    expect(container.querySelector('[data-location]').textContent).toBe('/professional/profile/edit')
    expect(container.textContent).not.toContain('Perfil salvo.')
  })
  it('keeps the legacy alias usable and routes its edit action to the canonical editor', async () => {
    await render('/professional-profile?onboarding=1'); expect(container.textContent).toContain('Ana Silva'); await click('Editar perfil')
    expect(container.querySelector('[data-location]').textContent).toBe('/professional/profile/edit')
  })
})
