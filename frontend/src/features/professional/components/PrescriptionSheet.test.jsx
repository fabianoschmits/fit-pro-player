// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, afterEach, it, expect, vi } from 'vitest'
import PrescriptionSheet from './PrescriptionSheet.jsx'
let node, root
beforeEach(() => { globalThis.IS_REACT_ACT_ENVIRONMENT = true; node = document.createElement('div'); document.body.append(node); root = createRoot(node) })
afterEach(async () => { await act(async () => root.unmount()); node.remove() })
it.each([{ mode: 'cardio', min: 30, speed: 7 }, { mode: 'time', sec: 120 }])('quick_edit_preserves_cardio_time_effort_and_notes %o', async extra => {
 const save = vi.fn(); const entry = { exerciseId: '9997', sets: 3, reps: 8, load: 25, rest: 75, unit: 'lb', effort: 'rir', rir: 2, sg: 'A', notes: 'Controle', ...extra }
 await act(async () => root.render(<PrescriptionSheet open prescription={entry} onSave={save} onClose={() => {}} />))
 expect(document.querySelector('details').open).toBe(false)
 await act(async () => document.querySelector('[role="dialog"] .primary').click())
 expect(save).toHaveBeenCalledWith(entry)
})
it('mode and effort defaults are real published values', async () => { const save = vi.fn(); await act(async () => root.render(<PrescriptionSheet open prescription={{ exerciseId: '9997', sets: 3, reps: 8, effort: 'rir', rir: 2 }} onSave={save} onClose={() => {}} />)); const change = async (label, value) => act(async () => { const el = [...document.querySelectorAll('label')].find(el => el.textContent.startsWith(label)).querySelector('select'); el.value = value; el.dispatchEvent(new Event('change', { bubbles: true })) }); await change('Tipo de execução', 'time'); await change('Esforço', 'none'); await act(async () => document.querySelector('[role="dialog"] .primary').click()); expect(save.mock.calls[0][0]).toEqual(expect.objectContaining({ sec: 45, rest: 90 })); expect(save.mock.calls[0][0].rir).toBeUndefined() })
