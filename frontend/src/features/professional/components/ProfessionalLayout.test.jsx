// @vitest-environment happy-dom
import React, { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, useNavigate } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import ProfessionalLayout from './ProfessionalLayout.jsx'
import ContextActions from './ContextActions.jsx'
import StudentRow from './StudentRow.jsx'
import FilterChips from './FilterChips.jsx'
import SearchBar from './SearchBar.jsx'
import ProgramRow from './ProgramRow.jsx'
import Dialog from '../../../components/Dialog.jsx'
const state = vi.hoisted(() => ({ S: { active: { id: 'personal-session' } }, generation: 0,
  getScopeToken: () => state.generation, isScopeCurrent: token => token === state.generation }))
vi.mock('../../../store/useStore.js', () => ({ useStore: Object.assign(selector => selector(state), { getState: () => state }) }))
let root, container
beforeEach(() => { globalThis.IS_REACT_ACT_ENVIRONMENT = true; container = document.createElement('div'); document.body.append(container); root = createRoot(container) })
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.restoreAllMocks() })
const render = (child, route = '/professional/students') => act(async () => root.render(<MemoryRouter initialEntries={[route]}>{child}</MemoryRouter>))
it('only_one_navigation_in_professional_routes with four complete destinations and personal workout resume', async () => {
  await render(<ProfessionalLayout title="Alunos">Conteúdo</ProfessionalLayout>)
  expect(container.querySelectorAll('nav')).toHaveLength(1)
  expect([...container.querySelectorAll('nav a')].map(a => a.textContent)).toEqual(['Gestão', 'Alunos', 'Programas', 'Convites'])
  expect(container.querySelector('a[href="/workout"]').textContent).toBe('Retomar treino')
  expect(container.querySelector('#tabbar')).toBeNull()
})
it('provides profile, catalogue and personal home through the contextual menu', async () => {
  await render(<ProfessionalLayout title="Gestão" />)
  await act(async () => container.querySelector('[aria-haspopup="dialog"]').click())
  expect(document.querySelector('[role="dialog"]').textContent).toContain('Perfil')
  expect(document.querySelector('[role="dialog"]').textContent).toContain('Exercícios')
  expect(document.querySelector('[role="dialog"]').textContent).toContain('Voltar ao FPP')
})
function pendingBack() {
  const previous = history.state
  let deliver
  const back = vi.spyOn(history, 'back').mockImplementation(() => {
    deliver = () => { history.replaceState(previous, ''); window.dispatchEvent(new PopStateEvent('popstate', { state: previous })) }
  })
  return { back, flush: () => act(async () => deliver?.()) }
}
it('sheet_returns_focus_and_back_once after the asynchronous popstate handoff', async () => {
  const select = vi.fn(), traversal = pendingBack()
  await render(<ContextActions label="Ações do programa" items={[{ id: 'edit', label: 'Editar', onSelect: select }]} />)
  const trigger = container.querySelector('button'); trigger.focus()
  await act(async () => trigger.click())
  await act(async () => [...document.querySelectorAll('[role="dialog"] button')].find(button => button.textContent === 'Editar').click())
  expect(select).not.toHaveBeenCalled()
  expect(document.querySelector('[role="dialog"]')).toBeNull()
  expect(document.activeElement).toBe(trigger)
  expect(traversal.back).toHaveBeenCalledOnce()
  expect(trigger.getAttribute('aria-disabled')).toBe('true')
  await traversal.flush()
  expect(select).toHaveBeenCalledOnce()
  expect(trigger.getAttribute('aria-disabled')).toBe('false')
})
it('action to confirmation waits for popstate and keeps the next Dialog open', async () => {
  const traversal = pendingBack()
  function Flow() {
    const [confirmation, setConfirmation] = useState(false)
    return <><ContextActions label="Ações" items={[{id:'delete',label:'Excluir',onSelect:() => setConfirmation(true)}]} />{confirmation && <Dialog title="Confirmar" onClose={() => setConfirmation(false)}>Confirmação</Dialog>}</>
  }
  await render(<Flow />)
  await act(async () => container.querySelector('button').click())
  await act(async () => document.querySelector('.professional-context-items button').click())
  expect(document.querySelector('[role="dialog"]')).toBeNull()
  await traversal.flush()
  expect(document.querySelector('[role="dialog"]').textContent).toContain('Confirmar')
  expect(document.body.style.overflow).toBe('hidden')
})
it('the optional Dialog close completion ignores StrictMode trial cleanup', async () => {
  const completed = vi.fn(), traversal = pendingBack()
  await act(async () => root.render(<React.StrictMode><MemoryRouter><Dialog title="Confirmar" onClose={() => {}} onAfterClose={completed}>Conteúdo</Dialog></MemoryRouter></React.StrictMode>))
  expect(completed).not.toHaveBeenCalled()
  await render(null)
  expect(completed).not.toHaveBeenCalled()
  await traversal.flush()
  expect(completed).toHaveBeenCalledOnce()
})
it('ignores immediate reopening until the old history entry is consumed', async () => {
  const traversal = pendingBack()
  await render(<ContextActions label="Ações" />)
  const trigger = container.querySelector('button')
  await act(async () => trigger.click())
  await act(async () => document.querySelector('.dialog-close').click())
  await act(async () => trigger.click())
  expect(document.querySelector('[role="dialog"]')).toBeNull()
  await traversal.flush()
  await act(async () => trigger.click())
  expect(document.querySelector('[role="dialog"]')).not.toBeNull()
})
for (const change of ['account', 'route', 'unmount']) it(`cancels a pending selected action after ${change} changes`, async () => {
  const traversal = pendingBack(), select = vi.fn()
  let navigate
  function Flow() { navigate = useNavigate(); return <ContextActions label="Ações" items={[{id:'edit',label:'Editar',onSelect:select}]} /> }
  await render(<Flow />)
  await act(async () => container.querySelector('button').click())
  await act(async () => document.querySelector('.professional-context-items button').click())
  if (change === 'account') state.generation++
  if (change === 'route') await act(async () => navigate('/professional/programs'))
  if (change === 'unmount') await render(null)
  await traversal.flush()
  expect(select).not.toHaveBeenCalled()
})
for (const route of ['/professional/profile', '/professional-profile', '/professional/exercises']) it(`disables the current contextual destination at ${route}`, async () => {
  await render(<ProfessionalLayout title="Perfil" />, route)
  await act(async () => container.querySelector('[aria-haspopup="dialog"]').click())
  const label = route === '/professional/exercises' ? 'Exercícios' : 'Perfil'
  expect([...document.querySelectorAll('.professional-context-items button')].find(button => button.textContent === label).disabled).toBe(true)
})
it('avatar_uses_authorized_asset_or_initials and never an arbitrary photograph URL', async () => {
  await render(<ul><StudentRow student={{displayName:'Ana Silva',avatarRef:'https://photos.example/ana.jpg'}} to="/professional/students/ana" /></ul>)
  expect(container.querySelector('img')).toBeNull()
  expect(container.querySelector('.professional-avatar').textContent).toBe('AS')
  await render(<ul><StudentRow student={{displayName:'Ana Silva',avatarRef:'avatar-27'}} to="/professional/students/ana" /></ul>)
  expect(container.querySelector('img').getAttribute('src')).toContain('avatar-27')
})
it('long_labels_wrap_without_scroll keeps complete filter and identity labels', async () => {
  const label = 'Alunos com acompanhamento individual de força e condicionamento'
  await render(<ProfessionalLayout title={label}><FilterChips value="all" options={[{value:'all',label}]} onChange={() => {}} /><ul><StudentRow student={{displayName:label}} to="/professional/students/ana" /></ul></ProfessionalLayout>)
  expect(container.querySelector('.professional-filter-chips button').textContent).toBe(label)
  expect(container.querySelector('.professional-row-copy strong').textContent).toBe(label)
})
it('keeps actual program counts and dates and accessible secondary actions', async () => {
  const action = vi.fn()
  await render(<ul><ProgramRow program={{id:'p',title:'Força',workoutCount:0,studentCount:2,lastChangedAt:'2026-10-09T12:00:00Z'}} to="/professional/programs/p" onAction={action} /></ul>)
  expect(container.textContent).toContain('0 treinos')
  expect(container.textContent).toContain('2 alunos')
  expect(container.querySelector('time').dateTime).toBe('2026-10-09T12:00:00Z')
  await act(async () => container.querySelector('button').click())
  expect(action).toHaveBeenCalledWith(expect.objectContaining({id:'p'}))
})
it('clears search and selects wrapping filters through controlled callbacks', async () => {
  const change = vi.fn()
  await render(<><SearchBar label="Buscar alunos" value="Ana" onChange={change} /><FilterChips value="all" options={[{value:'all',label:'Todos'},{value:'attention',label:'Atenção'}]} onChange={change} /></>)
  expect(container.querySelector('label').htmlFor).toBe(container.querySelector('input').id)
  await act(async () => container.querySelector('.professional-search button').click())
  expect(change).toHaveBeenCalledWith('')
  await act(async () => container.querySelectorAll('.professional-filter-chips button')[1].click())
  expect(change).toHaveBeenCalledWith('attention')
})
it('releases bottom navigation space when the visual viewport shrinks for a keyboard', async () => {
  const viewport = new EventTarget(); viewport.height = 300
  vi.stubGlobal('visualViewport', viewport)
  await render(<ProfessionalLayout title="Editar"><SearchBar value="" onChange={() => {}} label="Buscar" /></ProfessionalLayout>)
  container.querySelector('input').focus()
  viewport.dispatchEvent(new Event('resize'))
  expect(container.querySelector('.professional-native').dataset.keyboard).toBe('true')
  container.querySelector('input').blur()
  expect(container.querySelector('.professional-native').dataset.keyboard).toBe('false')
  vi.unstubAllGlobals()
})
