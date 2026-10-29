// @vitest-environment happy-dom
import React,{act} from 'react'
import {createRoot} from 'react-dom/client'
import {MemoryRouter,Routes,Route} from 'react-router-dom'
import {beforeEach,afterEach,it,expect,vi} from 'vitest'
const mocks=vi.hoisted(()=>({repo:{programPage:vi.fn(),program:vi.fn(),versions:vi.fn(),deleteProgram:vi.fn(),updateProgram:vi.fn()},pendingConfirm:null}))
vi.mock('../sheets.jsx',()=>({confirmSheet:opts=>{mocks.pendingConfirm=opts}}))
vi.mock('../components/ProfessionalProgramEditor.jsx',()=>({default:()=>null}))
vi.mock('../lib/professional-workflow.js',()=>({createProfessionalWorkflowRepository:()=>mocks.repo,programMuscleRoutine:program=>({ex:Object.values(program.weeklyPlan||{}).flat().map(entry=>({id:entry.exerciseId,sets:entry.sets}))})}))
vi.mock('../components/RoutineMuscleThumb.jsx',()=>({default:({routine})=><span data-testid="routine-thumb" data-exercises={routine.ex.length}/>}))
import ProfessionalPrograms from './ProfessionalPrograms.jsx'
let root,container
beforeEach(()=>{vi.useFakeTimers();globalThis.IS_REACT_ACT_ENVIRONMENT=true;mocks.pendingConfirm=null;mocks.repo.programPage.mockResolvedValue({items:[{id:'p',title:'Iniciante',workoutCount:3,weeklyPlan:{monday:[{exerciseId:'0025',sets:3}]}}],hasMore:false});mocks.repo.program.mockResolvedValue({id:'p',title:'Iniciante',description:'',archived:false});mocks.repo.versions.mockResolvedValue([]);mocks.repo.deleteProgram.mockResolvedValue();mocks.repo.updateProgram.mockResolvedValue();container=document.createElement('div');root=createRoot(container)})
afterEach(async()=>{await act(async()=>root.unmount());vi.useRealTimers();vi.clearAllMocks()})
const render=async(path)=>{await act(async()=>root.render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/professional/programs" element={<ProfessionalPrograms/>}/><Route path="/professional/templates" element={<ProfessionalPrograms/>}/><Route path="/professional/templates/:programId" element={<ProfessionalPrograms/>}/></Routes></MemoryRouter>));await act(async()=>vi.advanceTimersByTimeAsync(200))}
it('redirects old program lists to paginated templates',async()=>{await render('/professional/programs');expect(container.textContent).toContain('Modelos');expect(container.querySelector('a[href="/professional/templates/p"]')).not.toBeNull();expect(mocks.repo.programPage).toHaveBeenCalledWith({search:'',offset:0})})
it('does not show a publish/choose-student wizard',async()=>{await render('/professional/templates');expect(container.textContent).not.toContain('Publicar');expect(container.querySelector('select')).toBeNull()})
it('shows a muscle preview for each published template and a neutral icon for empty models',async()=>{
 await render('/professional/templates')
 expect(container.querySelector('[data-testid="routine-thumb"]')?.getAttribute('data-exercises')).toBe('1')
 mocks.repo.programPage.mockResolvedValueOnce({items:[{id:'empty',title:'Rascunho',workoutCount:0,weeklyPlan:{}}],hasMore:false})
 await act(async()=>root.unmount());root=createRoot(container)
 await render('/professional/templates')
 expect(container.querySelector('[data-testid="routine-thumb"]')).toBeNull()
 expect(container.querySelector('.management-template-icon svg')).not.toBeNull()
})
it('confirms deletion and offers archive when history makes deletion unsafe',async()=>{
 await render('/professional/templates/p')
 await act(async()=>container.querySelector('summary').click())
 const action=[...container.querySelectorAll('button')].find(button=>button.textContent.includes('Excluir modelo'))
 await act(async()=>action.click())
 expect(mocks.pendingConfirm).toMatchObject({title:'Excluir modelo permanentemente?',danger:true})
 mocks.repo.deleteProgram.mockRejectedValueOnce(new Error('professional-program-in-use'))
 await act(async()=>mocks.pendingConfirm.onConfirm())
 expect(container.querySelector('[role="alert"]')?.textContent).toContain('precisa ser arquivado')
 await act(async()=>container.querySelector('[role="alert"] button').click())
 expect(mocks.pendingConfirm).toMatchObject({title:'Arquivar modelo?'})
 await act(async()=>mocks.pendingConfirm.onConfirm())
 expect(mocks.repo.updateProgram).toHaveBeenCalledWith('p',{title:'Iniciante',description:'',archived:true})
})
it('does not offer to archive a model that is already archived',async()=>{
 mocks.repo.program.mockResolvedValueOnce({id:'p',title:'Iniciante',description:'',archived:true})
 await render('/professional/templates/p')
 await act(async()=>container.querySelector('summary').click())
 await act(async()=>[...container.querySelectorAll('button')].find(button=>button.textContent.includes('Excluir modelo')).click())
 mocks.repo.deleteProgram.mockRejectedValueOnce(new Error('professional-program-in-use'))
 await act(async()=>mocks.pendingConfirm.onConfirm())
 expect(container.querySelector('[role="alert"]')?.textContent).toContain('já está arquivado')
 expect(container.querySelector('[role="alert"] button')).toBeNull()
})
