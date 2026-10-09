// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { it, expect, vi } from 'vitest'
import ExercisePickerSheet from './ExercisePickerSheet.jsx'

it('picker_search_expand_multi_add_limit_50', async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  const node = document.createElement('div'); document.body.append(node)
  const root = createRoot(node), add = vi.fn()
  const exercises = [{ id: '9998', n: 'Remada', bp: 'back', eq: 'cable' }, { id: '9999', n: 'Agachamento', bp: 'legs', eq: 'barbell' }]
  const render = async prescriptions => act(async () => root.render(<ExercisePickerSheet open exercises={exercises} prescriptions={prescriptions} onAdd={add} onClose={() => {}} />))
  await render([])
  expect(document.querySelector('select[aria-label="Filtrar por músculo"]')).toBeTruthy()
  const arrows = document.querySelectorAll('.professional-picker-preview-button')
  await act(async () => arrows[0].click())
  await act(async () => arrows[1].click())
  expect(document.querySelectorAll('.professional-exercise-animation')).toHaveLength(1)
  const search = document.querySelector('input[aria-label="Pesquisar exercício"]')
  await act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(search, 'Remada')
    search.dispatchEvent(new Event('input', { bubbles: true }))
  })
  expect(document.querySelector('[role="dialog"]').textContent).not.toContain('Agachamento')
  expect(document.querySelector('[role="dialog"]').textContent).toContain('Remada')
  await act(async () => [...document.querySelectorAll('[role="dialog"] button')].find(b => b.textContent === 'Adicionar').click())
  expect(add).toHaveBeenCalledWith(exercises[0])
  expect(document.querySelector('[role="dialog"]')).toBeTruthy()
  await render(Array.from({ length: 50 }, () => ({ exerciseId: '9997' })))
  expect([...document.querySelectorAll('[role="dialog"] button')].filter(b => b.textContent === 'Adicionar').every(b => b.disabled)).toBe(true)
  await act(async () => root.unmount()); node.remove()
})
