// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import ProfessionalProgramEditor from './ProfessionalProgramEditor.jsx'
import { useStore, DEF } from '../store/useStore.js'
vi.mock('./Media.jsx', () => ({ default: () => <div data-animation>Animation</div>, Thumb: () => <span /> }))
let root, container
beforeEach(() => { globalThis.IS_REACT_ACT_ENVIRONMENT=true; useStore.setState({S:structuredClone(DEF)}); container=document.createElement('div');document.body.append(container);root=createRoot(container) })
afterEach(async()=>{await act(async()=>root.unmount());container.remove()})
const render=async(props={})=>act(async()=>root.render(<MemoryRouter><ProfessionalProgramEditor initialMetadata={{title:'Força'}} initialPlan={{monday:[{exerciseId:'0001',sets:4,reps:8,load:80,rest:90,rir:2,notes:'Controle'}]}} {...props}/></MemoryRouter>))
it('uses the shared routine editor with collapsed exercise animation and professional options',async()=>{
 await render();await act(async()=>container.querySelector('.plan-routine-list button').click())
 expect(container.querySelector('.routine-builder')).not.toBeNull()
 expect(container.querySelector('[data-animation]')).toBeNull()
 await act(async()=>container.querySelector('.training-exercise-card button').click())
 expect(container.querySelector('[data-animation]')).not.toBeNull()
 expect(container.textContent).toContain('RIR 2');expect(container.textContent).toContain('Controle')
 expect(container.textContent).toContain('Mais opções')
 await act(async()=>container.querySelector('.training-exercise-card button').click())
 expect(container.querySelector('[data-animation]')).toBeNull()
})
it('publishes a template using its unchanged immutable prescription',async()=>{
 const publish=vi.fn().mockResolvedValue('template'),done=vi.fn();await render({onPublish:publish,onPublished:done})
 await act(async()=>[...container.querySelectorAll('button')].find(x=>x.textContent==='Salvar modelo').click())
 expect(publish).toHaveBeenCalledWith(expect.objectContaining({monday:[expect.objectContaining({sets:4,reps:8,load:80,rir:2,notes:'Controle'})]}),expect.objectContaining({title:'Força'}),expect.any(Object))
 expect(done).toHaveBeenCalledWith('template')
})
it('retains the draft on a failed save',async()=>{
 await render({onPublish:vi.fn().mockRejectedValue(new Error('offline'))})
 await act(async()=>[...container.querySelectorAll('button')].find(x=>x.textContent==='Salvar modelo').click())
 expect(container.querySelector('[role="alert"]').textContent).toContain('Não foi possível salvar')
 expect(container.querySelector('.plan-routine-list button')).not.toBeNull()
})
