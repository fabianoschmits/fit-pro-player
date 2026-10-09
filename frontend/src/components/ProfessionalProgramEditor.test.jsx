// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, afterEach, it, expect, vi } from 'vitest'
import ProfessionalProgramEditor from './ProfessionalProgramEditor.jsx'
import { useStore } from '../store/useStore.js'
const accountId = '11111111-1111-4111-8111-111111111111'
let root, node
beforeEach(async () => { globalThis.IS_REACT_ACT_ENVIRONMENT = true; localStorage.clear(); await useStore.getState().activateLocalScope(accountId); node = document.createElement('div'); document.body.append(node); root = createRoot(node) })
afterEach(async () => { await act(async () => root.unmount()); node.remove() })
const render = async props => act(async () => root.render(<MemoryRouter><ProfessionalProgramEditor {...props} /></MemoryRouter>))
const click = async text => act(async () => [...document.querySelectorAll('button')].find(b => b.textContent === text).click())
const publish = async () => { await click('Publicar nova versão'); await click('Publicar semana') }
it('compatibility entry shows seven vertical days and compact quick edit preserving advanced values', async () => { const onPublish = vi.fn(); const initialPlan = { monday: [{ exerciseId: '9997', sets: 3, reps: 8, rest: 75, effort: 'rir', rir: 2, notes: 'Controle' }] }; await render({ initialPlan, onPublish }); expect(node.querySelectorAll('.professional-workout-day')).toHaveLength(7); await act(async () => node.querySelector('.professional-row-link').click()); expect(node.querySelector('input[type="number"]')).toBeNull(); await act(async () => node.querySelector('.professional-prescription-edit').click()); expect(document.querySelector('details').open).toBe(false); await act(async () => document.querySelector('[role="dialog"] .primary').click()); await act(async () => {}); await click('Concluir treino'); await publish(); expect(onPublish).toHaveBeenCalledWith(expect.objectContaining({ monday: [expect.objectContaining({ rest: 75, rir: 2, notes: 'Controle' })] })) })
it('picker filters and multiple adds stay open with translated real exercise names', async () => { await render({ exercises: [{ id: '9997', n: 'Agachamento', bp: 'legs', eq: 'barbell' }, { id: '9998', n: 'Remada', bp: 'back', eq: 'cable' }], onPublish: vi.fn() }); await act(async () => node.querySelector('.professional-row-link').click()); await click('Adicionar exercício'); const muscle = document.querySelector('select[aria-label="Filtrar por músculo"]'); await act(async () => { muscle.value = 'back'; muscle.dispatchEvent(new Event('change', { bubbles: true })) }); expect(document.querySelector('[role="dialog"]').textContent).not.toContain('Agachamento'); await click('Adicionar'); expect(document.querySelector('[role="dialog"]')).toBeTruthy(); expect(document.querySelector('[role="dialog"]').textContent).toContain('Selecionado'); expect(node.textContent).toContain('Remada') })
it('copy requires overwrite confirmation and cancel preserves populated day', async () => { const onPublish = vi.fn(); await render({ initialPlan: { monday: [{ exerciseId: '9997', sets: 3, reps: 8 }], tuesday: [{ exerciseId: '9998', sets: 4, reps: 10 }] }, onPublish }); await act(async () => node.querySelector('.professional-row-link').click()); await click('Copiar dia'); expect(document.querySelector('[role="dialog"]').textContent).toContain('Substituir exercícios'); await click('Cancelar'); await act(async () => {}); await click('Concluir treino'); await publish(); expect(onPublish.mock.calls[0][0].tuesday[0].exerciseId).toBe('9998') })
it('failed publish keeps the entire scoped draft and blocks repeated submission', async () => { let reject; const onPublish = vi.fn(() => new Promise((_, fail) => { reject = fail })); await render({ draftKey: `${accountId}:p`, initialPlan: { monday: [{ exerciseId: '9997', sets: 3, reps: 8, rest: 75 }], friday: [{ exerciseId: '9998', sets: 2, reps: 12, notes: 'Outro dia' }] }, onPublish }); await publish(); expect([...document.querySelectorAll('[role="dialog"] button')].find(b => b.textContent === 'Publicando…').disabled).toBe(true); await act(async () => reject(new Error('offline'))); expect(node.querySelector('[role="alert"]').textContent).toContain('rascunho'); expect(useStore.getState().S.professionalProgramDrafts[`${accountId}:p`].weeklyPlan.friday[0].notes).toBe('Outro dia'); expect(onPublish).toHaveBeenCalledTimes(1) })
it('empty week cannot publish', async () => { const onPublish = vi.fn(); await render({ onPublish }); await click('Publicar nova versão'); expect(node.textContent).toContain('Adicione pelo menos um exercício'); expect(onPublish).not.toHaveBeenCalled() })
it('compatibility metadata can save independently and remains in the local draft', async () => {
  const onSaveMetadata = vi.fn(), onPublish = vi.fn()
  await render({ initialMetadata: { title: 'Base', description: 'Original' }, onSaveMetadata, onPublish })
  await click('Editar')
  const input = [...document.querySelectorAll('label')].find(label => label.textContent === 'Nome do programa').querySelector('input')
  await act(async () => { Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(input, 'Revisado'); input.dispatchEvent(new Event('input', { bubbles: true })) })
  await click('Salvar dados do programa')
  expect(onSaveMetadata).toHaveBeenCalledWith(expect.objectContaining({ title: 'Revisado' }))
  expect(onPublish).not.toHaveBeenCalled()
  expect(useStore.getState().S.professionalProgramDrafts[`${accountId}:legacy-editor`].title).toBe('Revisado')
})
