// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEF, useStore } from '../../store/useStore.js'
import { createTrainingDraft, onboardingOwner, saveTrainingDraft } from '../../lib/onboarding.js'
import TrainingOnboarding from './TrainingOnboarding.jsx'

const fixtures = vi.hoisted(() => ({ user: null }))
vi.mock('../../auth/AuthProvider.jsx', () => ({ useAuth: () => fixtures }))
const ACCOUNT = '11111111-1111-4111-8111-111111111111'
let root, container, done
const render = () => act(async () => root.render(<TrainingOnboarding onDone={done} />))
const submit = () => act(async () => container.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
const click = text => act(async () => {
  const button = [...container.querySelectorAll('button')].find(element => element.textContent.includes(text))
  expect(button, `Missing action: ${text}`).toBeTruthy()
  button.click()
})
const fill = (name, value) => act(async () => {
  const field = container.querySelector(`[name="${name}"]`)
  expect(field, `Missing field: ${name}`).toBeTruthy()
  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(field, value)
  field.dispatchEvent(new Event('input', { bubbles: true }))
})

beforeEach(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  localStorage.clear()
  fixtures.user = { id: ACCOUNT, displayName: 'ana de SOUZA' }
  await useStore.getState().activateLocalScope(ACCOUNT)
  useStore.setState({ S: structuredClone(DEF), persistence: { state: 'saved', error: null } })
  container = document.createElement('div'); document.body.append(container); root = createRoot(container)
  done = vi.fn()
})
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.restoreAllMocks() })

describe('training first-use journey', () => {
  it('resumes the saved step and answers after remount', async () => {
    await render()
    expect(container.querySelector('[name="name"]').value).toBe('Ana de Souza')
    await click('Criar meu plano'); await submit()
    expect(document.activeElement).toBe(container.querySelector('h1'))
    expect(document.activeElement.textContent).toBe('Um plano com o seu ponto de partida.')
    await click('Ganhar massa muscular'); await click('Iniciante'); await fill('startWeight', '72,5'); await submit()
    expect(container.querySelector('[name="birthDate"]')).toBeNull()
    expect(useStore.getState().S.onboardingDraft.step).toBe(2)
    await act(async () => root.unmount()); root = createRoot(container); await render()
    expect(container.textContent).toContain('Como o treino cabe na sua rotina?')
    expect(document.activeElement).toBe(container.querySelector('h1'))
    expect(document.activeElement.textContent).toBe('Como o treino cabe na sua rotina?')
    await click('Voltar')
    expect(container.querySelector('[name="startWeight"]').value).toBe('72,5')
    expect(container.querySelector('[name="birthDate"]').value).toBe('')
    expect(container.querySelector('[aria-label="Sex"] [aria-pressed="true"]')).toBeNull()
  })

  it('completes a generated plan with unset optional personal data and waits for the final action', async () => {
    await render(); await click('Criar meu plano'); await submit()
    await click('Ganhar massa muscular'); await click('Iniciante'); await fill('startWeight', '70'); await submit()
    await click('45 min'); await submit()
    expect(useStore.getState().S.routines).toEqual([])
    await submit()
    expect(useStore.getState().S.onboardingDone).toBe(true)
    expect(useStore.getState().S.profile.birthDate).toBe('')
    expect(useStore.getState().S.profile.heightCm).toBeNull()
    expect(useStore.getState().S.routines.filter(routine => routine.planGenerated)).toHaveLength(3)
    expect(done).not.toHaveBeenCalled()
    await click('Abrir meu plano')
    expect(done).toHaveBeenCalledWith('/plan')
  })

  it('bypasses measurements and generation when following a professional', async () => {
    await render(); await click('Seguir um profissional'); await submit()
    expect(container.querySelector('[name="startWeight"], [name="birthDate"], [name="height"]')).toBeNull()
    await submit()
    expect(useStore.getState().S.onboardingDone).toBe(true)
    expect(useStore.getState().S.routines).toEqual([])
    expect(useStore.getState().S.bodyweight).toEqual([])
    expect(done).not.toHaveBeenCalled()
    await click('Conectar profissional')
    expect(done).toHaveBeenCalledWith('/student/professionals/add')
  })

  it('shows failed persistence without advancing and retries with entered answers', async () => {
    await render(); await click('Criar meu plano')
    const write = vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new Error('quota') })
    await submit()
    expect(container.querySelector('[role="alert"]').textContent).toContain('Não foi possível salvar')
    expect(container.querySelector('[name="name"]').value).toBe('Ana de Souza')
    expect(useStore.getState().S.onboardingDone).toBe(false)
    write.mockRestore(); await submit()
    expect(container.querySelector('[name="startWeight"]')).toBeTruthy()
  })

  it('rejects completion failures and retains its review draft for retry', async () => {
    const draft = createTrainingDraft(useStore.getState().S, fixtures.user)
    draft.step = 3
    draft.values.intention = 'professional'
    await saveTrainingDraft(useStore, onboardingOwner(useStore, fixtures.user), draft)
    await render()
    const write = vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new Error('quota') })
    await submit()
    expect(container.querySelector('[role="alert"]').textContent).toContain('Não foi possível salvar')
    expect(useStore.getState().S.onboardingDone).toBe(false)
    expect(done).not.toHaveBeenCalled()
    write.mockRestore(); await submit(); await click('Conectar profissional')
    expect(done).toHaveBeenCalledWith('/student/professionals/add')
  })

  it('restarts with the new account instead of displaying the previous account answers', async () => {
    await render(); await click('Criar meu plano'); await submit()
    await fill('startWeight', '72,5')
    const otherAccount = '22222222-2222-4222-8222-222222222222'
    await act(async () => {
      fixtures.user = { id: otherAccount, displayName: 'Bruna' }
      await useStore.getState().activateLocalScope(otherAccount)
    })
    expect(container.querySelector('[name="name"]').value).toBe('Bruna')
    expect(container.querySelector('[name="startWeight"]')).toBeNull()
    expect(useStore.getState().S.onboardingDone).toBe(false)
    expect(done).not.toHaveBeenCalled()
  })
})
