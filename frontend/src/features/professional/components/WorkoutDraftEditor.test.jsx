// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { useStore } from '../../../store/useStore.js'
import { useProgramDraft } from '../hooks/useProgramDraft.js'
import WorkoutDraftEditor from './WorkoutDraftEditor.jsx'

const accountId = '11111111-1111-4111-8111-111111111111'
const prescription = { exerciseId: '9997', sets: 3, reps: 8, rest: 75, effort: 'rir', rir: 2, notes: 'Não perder' }
let root, node, api
function Editor() {
  api = useProgramDraft({ accountId, programId: 'p', initialDraft: { title: 'Base', weeklyPlan: { monday: [prescription] } } })
  return <WorkoutDraftEditor api={api} day="monday" exercises={[{ id: '9997', n: 'Agachamento' }]} />
}
beforeEach(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  localStorage.clear()
  await useStore.getState().activateLocalScope(accountId)
  node = document.createElement('div'); document.body.append(node); root = createRoot(node)
  await act(async () => root.render(<MemoryRouter><Editor /></MemoryRouter>))
})
afterEach(async () => { await act(async () => root.unmount()); node.remove() })
async function chooseRemoval() {
  await act(async () => node.querySelector('button[aria-label="Ações do exercício 1"]').click())
  await act(async () => [...document.querySelectorAll('[role="dialog"] button')].find(b => b.textContent === 'Remover').click())
  if (!document.querySelector('[role="dialog"]')) {
    await act(async () => window.dispatchEvent(new Event('popstate')))
  }
  expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Remover exercício?')
}
const confirm = async () => act(async () => [...document.querySelectorAll('[role="dialog"] button')].find(b => b.textContent === 'Confirmar remoção').click())
it('removal confirmation can cancel without losing full prescription and confirms exact target', async () => {
  await chooseRemoval()
  expect(api.draft.weeklyPlan.monday).toHaveLength(1)
  await act(async () => [...document.querySelectorAll('[role="dialog"] button')].find(b => b.textContent === 'Cancelar').click())
  await act(async () => window.dispatchEvent(new Event('popstate')))
  expect(api.draft.weeklyPlan.monday[0]).toEqual(expect.objectContaining(prescription))
  await chooseRemoval()
  await confirm()
  expect(api.draft.weeklyPlan.monday || []).toEqual([])
  expect(node.querySelectorAll('.professional-prescription-row')).toHaveLength(0)
})
it('removal confirmation refuses target after revision changes', async () => {
  await chooseRemoval()
  await act(async () => api.duplicateExercise('monday', api.target('monday', 0)))
  await confirm()
  expect(api.draft.weeklyPlan.monday).toHaveLength(2)
  expect(api.draft.weeklyPlan.monday.every(entry => entry.notes === prescription.notes)).toBe(true)
})
it('removal confirmation cannot mutate another account after scope switches', async () => {
  await chooseRemoval()
  await act(async () => useStore.getState().activateLocalScope('22222222-2222-4222-8222-222222222222'))
  await confirm()
  expect(useStore.getState().S.professionalProgramDrafts).toEqual({})
})
