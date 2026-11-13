// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEF, useStore } from '../../store/useStore.js'

const fixtures = vi.hoisted(() => ({ auth: null, client: null }))
vi.mock('../../auth/AuthProvider.jsx', () => ({ useAuth: () => fixtures.auth }))
vi.mock('../../lib/supabase-client.js', () => ({ getBrowserSupabaseClient: () => fixtures.client }))
import ProfessionalOnboarding from './ProfessionalOnboarding.jsx'

const OWNER = '11111111-1111-4111-8111-111111111111'
const OTHER = '22222222-2222-4222-8222-222222222222'
const record = { user_id: OWNER, professional_name: 'Ana Silva', bio: null, specialties: [], state_uf: null, city_name: null, neighborhood: null, registration_type: null, registration_number: null, verification_status: 'unverified' }
let container, root, profile, capability, savedCalls, failSave, pendingSave, done
function Route() { const location = useLocation(); return <output data-route>{location.pathname}</output> }
const render = () => act(async () => root.render(<MemoryRouter initialEntries={['/onboarding']}><ProfessionalOnboarding onDone={done} /><Route /></MemoryRouter>))
const button = text => [...container.querySelectorAll('button')].find(element => element.textContent === text)
const click = text => act(async () => { const element = button(text); expect(element, `Missing action: ${text}`).toBeTruthy(); element.click() })
const submit = () => act(async () => container.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
const fill = (name, value) => act(async () => {
  const field = container.querySelector(`[name="${name}"]`)
  expect(field, `Missing field: ${name}`).toBeTruthy()
  const prototype = field.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype
  Object.getOwnPropertyDescriptor(prototype, 'value').set.call(field, value)
  field.dispatchEvent(new Event('input', { bubbles: true }))
})
const cache = id => JSON.parse(localStorage.getItem(`fpp_account_cache_v1:${id}`))?.state
const review = async () => { await submit(); await submit() }

beforeEach(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  localStorage.clear(); vi.restoreAllMocks()
  fixtures.auth = { status: 'authenticated', user: { id: OWNER, displayName: 'Ana Silva' } }
  profile = null; capability = false; savedCalls = []; failSave = false; pendingSave = null; done = vi.fn()
  fixtures.client = {
    from(table) {
      const query = { select() { return query }, eq() { return query }, maybeSingle: async () => ({ data: profile, error: null }), then(resolve) { return Promise.resolve({ data: table === 'user_roles' && capability ? [{ role: 'professional' }] : [], error: null }).then(resolve) } }
      return query
    },
    async rpc(name, payload) {
      if (name === 'account_contact_phone') return { data: null, error: null }
      savedCalls.push({ name, payload })
      if (pendingSave) return pendingSave
      if (failSave) return { data: null, error: { code: '503' } }
      profile = { ...record, professional_name: payload.p_professional_name, bio: payload.p_bio, specialties: payload.p_specialties }
      capability = true
      return { data: profile, error: null }
    },
  }
  await useStore.getState().activateLocalScope(OWNER)
  useStore.setState({ S: { ...structuredClone(DEF), routines: [{ id: 'kept-plan', name: 'Meu treino', ex: [] }], onboardingDone: false }, ready: true })
  container = document.createElement('div'); document.body.append(container); root = createRoot(container)
})
afterEach(async () => { await act(async () => root.unmount()); container.remove(); localStorage.clear(); vi.restoreAllMocks() })

describe('professional first-use journey', () => {
  it('prefills the account name and validates it without requesting personal measurements', async () => {
    await render()
    expect(container.querySelector('[name="professionalName"]')?.value).toBe('Ana Silva')
    expect(container.querySelector('[name="startWeight"], [name="birthDate"], [name="heightCm"]')).toBeNull()
    await fill('professionalName', ' '); await submit()
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Informe seu nome profissional.')
    expect(savedCalls).toEqual([])
    expect(useStore.getState().S.onboardingDone).toBe(false)
  })

  it('saves supported professional fields, waits for the final action and preserves the personal plan', async () => {
    await render(); await fill('professionalName', '  Ana Coach  '); await fill('bio', 'Treinos de força com atenção à técnica.')
    await click('Força'); await fill('customSpecialty', '  Treino adaptado  ')
    await submit()
    await act(async () => {
      const state = container.querySelector('[name="stateUf"]'); state.value = 'SP'; state.dispatchEvent(new Event('change', { bubbles: true }))
    })
    await fill('cityName', 'São Paulo'); await fill('neighborhood', 'Centro'); await fill('registrationType', 'CREF'); await fill('registrationNumber', '12345-G/SP')
    await submit()
    expect(container.textContent).toContain('Ana Coach')
    expect(container.textContent).toContain('Não verificado')
    expect(savedCalls).toEqual([])
    await submit()
    expect(savedCalls).toEqual([{ name: 'provision_professional_profile', payload: { p_professional_name: 'Ana Coach', p_bio: 'Treinos de força com atenção à técnica.', p_specialties: ['força', 'treino adaptado'], p_city_region: 'Centro, São Paulo - SP', p_registration_type: 'CREF', p_registration_number: '12345-G/SP', p_state_uf: 'SP', p_city_name: 'São Paulo', p_neighborhood: 'Centro' } }])
    expect(useStore.getState().S).toMatchObject({ onboardingDone: true, onboardingVersion: 1, routines: [{ id: 'kept-plan', name: 'Meu treino', ex: [] }] })
    expect(cache(OWNER)).toMatchObject({ onboardingDone: true, onboardingVersion: 1 })
    expect(cache(OWNER).onboardingDraft).toBeNull()
    expect(done).not.toHaveBeenCalled()
    expect(container.querySelector('[data-route]').textContent).toBe('/onboarding')
    await click('Convidar alunos')
    expect(done).toHaveBeenCalledWith('/professional/invites')
  })

  it('retains the durable review draft after server failure and completes on retry', async () => {
    await render(); await review(); failSave = true; await submit()
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Não foi possível salvar')
    expect(useStore.getState().S.onboardingDone).toBe(false)
    expect(cache(OWNER).onboardingDraft).toMatchObject({ owner: `account:${OWNER}`, kind: 'professional', step: 2, values: { professionalName: 'Ana Silva' } })
    expect(done).not.toHaveBeenCalled()
    failSave = false; await submit()
    expect(savedCalls).toHaveLength(2)
    expect(useStore.getState().S.onboardingDone).toBe(true)
    expect(container.textContent).toContain('Seu espaço profissional está pronto')
  })

  it('restores only the account draft and keeps it over the saved server profile', async () => {
    profile = { ...record, professional_name: 'Nome antigo', bio: 'Bio antiga' }; capability = true
    useStore.getState().update(state => { state.onboardingDraft = { version: 1, owner: `account:${OWNER}`, kind: 'professional', step: 1, values: { professionalName: 'Rascunho Ana', bio: 'Bio atual', specialties: ['corrida'], cityName: 'Campinas', stateUf: 'SP' } } })
    await render()
    expect(container.querySelector('[name="cityName"]')?.value).toBe('Campinas')
    await submit()
    expect(container.textContent).toContain('Rascunho Ana')
    expect(container.textContent).not.toContain('Nome antigo')
    await submit()
    expect(savedCalls[0]).toMatchObject({ name: 'save_professional_profile', payload: { p_user_id: OWNER, p_professional_name: 'Rascunho Ana', p_bio: 'Bio atual', p_specialties: ['corrida'] } })
  })

  it('ignores a mismatched owner draft even inside the current account state', async () => {
    useStore.getState().update(state => { state.onboardingDraft = { version: 1, owner: `account:${OTHER}`, kind: 'professional', step: 2, values: { professionalName: 'Outra pessoa', bio: 'Privado' } } })
    await render()
    expect(container.querySelector('[name="professionalName"]')?.value).toBe('Ana Silva')
    expect(container.textContent).not.toContain('Outra pessoa')
    expect(container.textContent).not.toContain('Privado')
  })

  it('resumes the saved step after account reload and keeps another account draft separate', async () => {
    await render(); await fill('professionalName', 'Ana do rascunho'); await fill('bio', 'Acompanhamento de força'); await click('Força'); await submit()
    await act(async () => root.unmount())
    fixtures.auth = { status: 'authenticated', user: { id: OTHER, displayName: 'Bruna' } }
    await useStore.getState().activateLocalScope(OTHER)
    root = createRoot(container); await render()
    expect(container.querySelector('[name="professionalName"]')?.value).toBe('Bruna')
    await submit()
    await act(async () => root.unmount())
    fixtures.auth = { status: 'authenticated', user: { id: OWNER, displayName: 'Ana Silva' } }
    await useStore.getState().activateLocalScope(OWNER)
    root = createRoot(container); await render()
    expect(container.querySelector('[name="stateUf"]')).toBeTruthy()
    await submit()
    expect(container.textContent).toContain('Ana do rascunho')
    expect(container.textContent).toContain('Acompanhamento de força')
    expect(container.textContent).not.toContain('Bruna')
    expect(cache(OTHER).onboardingDraft.values.professionalName).toBe('Bruna')
  })

  it('ignores a late server save after switching accounts', async () => {
    let resolveSave; pendingSave = new Promise(resolve => { resolveSave = resolve })
    await render(); await review()
    await act(async () => { container.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await Promise.resolve() })
    expect(savedCalls).toHaveLength(1)
    fixtures.auth = { status: 'authenticated', user: { id: OTHER, displayName: 'Bruna' } }
    await act(async () => { await useStore.getState().activateLocalScope(OTHER) })
    await render()
    await act(async () => resolveSave({ data: { ...record, professional_name: 'Ana salvo' }, error: null }))
    expect(useStore.getState().S.onboardingDone).toBe(false)
    expect(container.textContent).not.toContain('Ana salvo')
    expect(container.textContent).not.toContain('Seu espaço profissional está pronto')
    expect(container.querySelector('[name="professionalName"]')?.value).toBe('Bruna')
    expect(cache(OTHER)?.onboardingDone).not.toBe(true)
    expect(done).not.toHaveBeenCalled()
  })

  it('locks duplicate submissions and ignores a late save after the journey unmounts', async () => {
    let resolveSave; pendingSave = new Promise(resolve => { resolveSave = resolve })
    await render(); await review()
    await act(async () => {
      const form = container.querySelector('form')
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
      await Promise.resolve()
    })
    expect(savedCalls).toHaveLength(1)
    await act(async () => root.render(<p>Outra tela</p>))
    await act(async () => resolveSave({ data: record, error: null }))
    expect(useStore.getState().S.onboardingDone).toBe(false)
    expect(cache(OWNER).onboardingDraft.step).toBe(2)
    expect(done).not.toHaveBeenCalled()
  })

  it('does not advance or complete when durable device persistence fails', async () => {
    await render()
    const write = vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new DOMException('Full', 'QuotaExceededError') })
    await submit()
    expect(container.querySelector('[name="professionalName"]')).toBeTruthy()
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('dispositivo')
    expect(savedCalls).toEqual([])
    write.mockRestore()
    await review()
    const originalProfile = structuredClone(useStore.getState().S.profile)
    const flush = vi.spyOn(useStore.getState(), 'flushPersistence').mockResolvedValueOnce(true).mockResolvedValue(false)
    await submit()
    expect(useStore.getState().S.onboardingDone).toBe(false)
    expect(useStore.getState().S.profile).toEqual(originalProfile)
    expect(container.textContent).not.toContain('Seu espaço profissional está pronto')
    expect(useStore.getState().S.onboardingDraft?.step).toBe(2)
    expect(done).not.toHaveBeenCalled()
    flush.mockRestore(); await submit()
    expect(useStore.getState().S.onboardingDone).toBe(true)
  })
})
