// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { DEF, useStore } from '../../store/useStore.js'
import PlanLibrary from './PlanLibrary.jsx'
import { useUI } from '../../store/useUI.js'
const mocks = vi.hoisted(() => ({ page: vi.fn(), seen: vi.fn(), open: vi.fn(), apply: vi.fn(), confirm: vi.fn() }))
vi.mock('../../auth/AuthProvider.jsx', () => ({ useAuth: () => ({ user: { id: '11111111-1111-4111-8111-111111111111' } }) }))
vi.mock('../../lib/supabase-client.js', () => ({ getBrowserSupabaseClient: () => null }))
vi.mock('../../lib/professional-workflow.js', () => ({ createProfessionalWorkflowRepository: () => ({ applyLibraryPlan: mocks.apply, planLibrary: mocks.page, markLibraryWorkoutSeen: mocks.seen }) }))
vi.mock('../../sheets.jsx', () => ({ confirmSheet: options => mocks.confirm(options) }))

vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }))
const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
const delivery = () => ({ id: 'delivery', available: true, source_type: 'professional', professional_name: 'Ana',
  workout_updates: { monday: 'changed-version' },
  version: { id: 'version', weekly_plan: Object.fromEntries(days.map(day => [day, [{ exerciseId: '0025', sets: 3, reps: 10, load: 20 }]])), workout_titles: Object.fromEntries(days.map(day => [day, day])) } })
function Sheets() {
  const sheets = useUI(s => s.sheets)
  return sheets.map(sheet => <div key={sheet.id}>{sheet.render(() => useUI.getState().closeSheet(sheet.id))}</div>)
}
const render = async () => {
  await act(async () => root.render(<><PlanLibrary /><Sheets /></>))
  await act(async () => { [...container.querySelectorAll('button')].find(button => button.textContent === 'Treino do profissional')?.click() })
}
const appliedPlan = () => ({ routines: [{ id: 'routine', user_id: '11111111-1111-4111-8111-111111111111', title: 'Treino', position: 0, revision: 3, created_at: '2026-10-31', updated_at: '2026-10-31', prescription: { assigned: true, programVersionId: 'version', ex: [{ id: '0043' }] } }], schedule: { user_id: '11111111-1111-4111-8111-111111111111', revision: 3, mode: 'weekly', updated_at: '2026-10-31', schedule: { week: { 1: 'routine' }, libraryId: 'delivery', assignedProgram: { versionId: 'version' } } } })
let root, container
beforeEach(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  mocks.page.mockReset().mockResolvedValue({ items: [delivery()], total: 1 })
  mocks.seen.mockReset().mockResolvedValue(null)
  mocks.open.mockReset()
  mocks.apply.mockReset().mockResolvedValue(appliedPlan())
  useUI.setState({ sheets: [] })
  await useStore.getState().activateLocalScope('11111111-1111-4111-8111-111111111111')
  useStore.setState({ S: { ...structuredClone(DEF), planServerRevision: 2 } })
  container = document.createElement('div'); document.body.append(container); root = createRoot(container)
})
afterEach(() => { act(() => root.unmount()); container.remove() })
it('follows the exact active selection after an external switch while tabs remain preview-only', async () => {
 await act(async () => root.render(<PlanLibrary />))
 const tab = label => [...container.querySelectorAll('button')].find(button => button.textContent === label)
 expect(tab('Meus treinos').getAttribute('aria-pressed')).toBe('true')
 await act(async () => tab('Treino do profissional').click())
 expect(useStore.getState().S.assignedProgram).toBeNull()
 await act(async () => useStore.setState({ S: { ...useStore.getState().S, activeLibraryId: 'delivery', assignedProgram: { versionId: 'version' } } }))
 expect(tab('Treino do profissional').getAttribute('aria-pressed')).toBe('true')
 await act(async () => tab('Meus treinos').click())
 expect(useStore.getState().S.activeLibraryId).toBe('delivery')
 await act(async () => useStore.setState({ S: { ...useStore.getState().S, activeLibraryId: 'personal', assignedProgram: null } }))
 expect(tab('Meus treinos').getAttribute('aria-pressed')).toBe('true')
 await act(async () => useStore.setState({ S: { ...useStore.getState().S, activeLibraryId: 'delivery', assignedProgram: { versionId: 'version' } } }))
 expect(tab('Treino do profissional').getAttribute('aria-pressed')).toBe('true')
 expect(mocks.apply).not.toHaveBeenCalled()
})
it('shows the complete professional week with one application for all seven workouts', async () => {
  await render()
  expect(container.querySelectorAll('.received-workout-card')).toHaveLength(7)
  expect([...container.querySelectorAll('button')].filter(button => button.textContent === 'Usar este plano')).toHaveLength(1)
})
it('marks only changed workouts and acknowledges opening their details', async () => {
  await render()
  expect(container.querySelectorAll('.workout-update-badge')).toHaveLength(1)
  const updated = container.querySelector('.workout-update-badge').closest('button')
  await act(async () => updated.click())
  expect(useUI.getState().sheets).toHaveLength(1)
  expect(mocks.seen).toHaveBeenCalledWith('delivery', 'monday', 'changed-version')
  expect(container.querySelectorAll('.workout-update-badge')).toHaveLength(0)
})
it('keeps the badge if acknowledging the update fails', async () => {
  mocks.seen.mockRejectedValue(new Error('offline'))
  await render()
  await act(async () => container.querySelector('.workout-update-badge').closest('button').click())
  expect(container.querySelectorAll('.workout-update-badge')).toHaveLength(1)
  expect(container.querySelector('[role="alert"]')).not.toBeNull()
})

const applyButton = () => [...container.querySelectorAll('button')].find(button => button.textContent === 'Usar este plano')
it('receives a plan without changing the active week', async () => {
  const before = useStore.getState().S
  await render()
  expect(applyButton()).toBeDefined()
  expect(useStore.getState().S).toBe(before)
})
it('applies only after confirmation and replaces the workspace together', async () => {
  mocks.apply.mockResolvedValue(appliedPlan())
  await render()
  await act(async () => applyButton().click())
  expect(mocks.apply).not.toHaveBeenCalled()
  await act(async () => [...container.querySelectorAll('button')].find(button => button.textContent === 'Aplicar plano').click())
  expect(useStore.getState().S).toMatchObject({ activeLibraryId: 'delivery', assignedProgram: { versionId: 'version' }, week: { 1: 'routine' }, _pendingSync: { plan: false } })
})
it('preserves the workspace and logs the original synchronization error', async () => {
  const original = new Error('revision conflict')
  const log = vi.spyOn(console, 'error').mockImplementation(() => {})
  const retry = vi.spyOn(useStore.getState(), 'retryAccountSync').mockRejectedValue(original)
  const before = useStore.getState().S
  await render()
  await act(async () => applyButton().click())
  await act(async () => [...container.querySelectorAll('button')].find(button => button.textContent === 'Aplicar plano').click())
  expect(useStore.getState().S).toBe(before)
  expect(log).toHaveBeenCalledWith('Plan library operation failed', original)
  expect(container.querySelector('[role="alert"]').textContent).not.toContain('conexão')
  retry.mockRestore(); log.mockRestore()
})
it('allows application after pending personal changes finish synchronizing', async () => {
  useStore.setState({ S: { ...useStore.getState().S, _pendingSync: { plan: true } } })
  const retry = vi.spyOn(useStore.getState(), 'retryAccountSync').mockImplementation(async () => {
    useStore.setState({ S: { ...useStore.getState().S, _pendingSync: { plan: false } } })
  })
  mocks.apply.mockClear()
  await render()
  await act(async () => applyButton().click())
  await act(async () => [...container.querySelectorAll('button')].find(button => button.textContent === 'Aplicar plano').click())
  expect(mocks.apply).toHaveBeenCalledWith('delivery', 2)
  retry.mockRestore()
})

it.each([{ items: [] }, { items: [{ ...delivery(), available: false }] }])('shows no professional controls for absent or unavailable deliveries: %j', async ({ items }) => {
  mocks.page.mockResolvedValue({ items, total: items.length })
  await render()
  expect(container.querySelector('.received-workouts')).toBeNull()
  expect(container.textContent).not.toContain('Treinos recebidos')
  expect(mocks.apply).not.toHaveBeenCalled()
})

it('applies an updated professional week once, including unchanged days, while retaining the old active version until confirmation', async () => {
 const previous=delivery()
 previous.available=false
 const latest={...delivery(),id:'delivery-v2',version:{...delivery().version,id:'version-v2'}}
 mocks.page.mockResolvedValue({items:[latest,previous],total:2})
 useStore.setState({S:{...useStore.getState().S,activeLibraryId:'delivery',assignedProgram:{versionId:'version'},week:{1:'old'}}})
 const result=appliedPlan()
 result.schedule.schedule={week:Object.fromEntries(Array.from({length:7},(_,day)=>[day,`routine-${day}`])),libraryId:'delivery-v2',assignedProgram:{versionId:'version-v2'}}
 result.routines=Array.from({length:7},(_,day)=>({...appliedPlan().routines[0],id:`routine-${day}`,title:`Day ${day}`,prescription:{assigned:true,programVersionId:'version-v2',ex:[{id:'0043'}]}}))
 mocks.apply.mockResolvedValue(result)
 await render()
 expect(container.querySelectorAll('.professional-plan-preview')).toHaveLength(2)
 expect(container.querySelectorAll('.received-workout-card')).toHaveLength(14)
 expect([...container.querySelectorAll('button')].filter(button=>button.textContent==='Em uso')).toHaveLength(1)
 await act(async()=>applyButton().click())
 expect(useStore.getState().S.activeLibraryId).toBe('delivery')
 expect(mocks.apply).not.toHaveBeenCalled()
 await act(async()=>[...container.querySelectorAll('button')].find(button=>button.textContent==='Aplicar plano').click())
 expect(mocks.apply).toHaveBeenCalledExactlyOnceWith('delivery-v2',2)
 expect(Object.keys(useStore.getState().S.week)).toHaveLength(7)
 expect(useStore.getState().S.assignedProgram.versionId).toBe('version-v2')
 expect(useUI.getState().sheets).toHaveLength(0)
})
