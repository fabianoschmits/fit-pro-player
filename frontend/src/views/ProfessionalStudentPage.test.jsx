// @vitest-environment happy-dom
import React,{act} from 'react'
import {createRoot} from 'react-dom/client'
import {MemoryRouter,Routes,Route} from 'react-router-dom'
import {beforeEach,afterEach,it,expect,vi} from 'vitest'
const mocks=vi.hoisted(()=>({repo:{clientDetail:vi.fn(),studentNote:vi.fn(),studentPlanDraft:vi.fn(),executionPage:vi.fn()}}))
vi.mock('../auth/AuthProvider.jsx',()=>({useAuth:()=>({user:{id:'pro'}})}))
vi.mock('../lib/professional-workflow.js',()=>({createProfessionalWorkflowRepository:()=>mocks.repo}))
import ProfessionalStudentPage from './ProfessionalStudentPage.jsx'
import {useUI} from '../store/useUI.js'
let root,container
beforeEach(()=>{globalThis.IS_REACT_ACT_ENVIRONMENT=true;mocks.repo.clientDetail.mockResolvedValue({displayName:'Ana',assignments:[],executions:[]});mocks.repo.studentNote.mockResolvedValue({body:'Privado'});mocks.repo.studentPlanDraft.mockResolvedValue(null);container=document.createElement('div');root=createRoot(container)})
afterEach(async()=>{await act(async()=>root.unmount());vi.clearAllMocks()})
const render=()=>act(async()=>root.render(<MemoryRouter initialEntries={['/professional/students/s']}><Routes><Route path="/professional/students/:studentId" element={<ProfessionalStudentPage/>}/></Routes></MemoryRouter>))
it('opens the linked student and leads directly to their plan',async()=>{await render();expect(container.textContent).toContain('Ana');expect(container.querySelector('a[href="/professional/students/s/plan"]')).not.toBeNull();expect(container.querySelector('select')).toBeNull();expect(mocks.repo.clientDetail).toHaveBeenCalledWith('s')})
it('shows current body data and opens the full profile with dated history',async()=>{
 mocks.repo.clientDetail.mockResolvedValueOnce({displayName:'Ana',profile:{heightCm:170,birthDate:'1990-01-01',goal:'build_muscle',experience:'beginner'},weightHistory:[{id:'w',measured_on:'2026-10-20',weight_kg:68.5}],measurements:[],assignments:[],executions:[]})
 await render()
 expect(container.textContent).toContain('1,70 m')
 expect(container.textContent).toContain('68,5 kg')
 await act(async()=>container.querySelector('button[aria-label="Ver perfil completo de Ana"]').click())
 const sheet=useUI.getState().sheets.at(-1)
 expect(sheet).toBeDefined()
 await act(async()=>root.render(sheet.render(()=>{})))
 expect(container.textContent).toContain('Ganhar massa muscular')
 expect(container.textContent).toContain('Histórico de peso')
 expect(container.textContent).toContain('20 de out. de 2026')
 useUI.setState({sheets:[]})
})
it('keeps absent profile data explicit and shows empty histories',async()=>{
 await render()
 expect(container.textContent).toContain('Não informado')
 await act(async()=>container.querySelector('button[aria-haspopup="dialog"]').click())
 const sheet=useUI.getState().sheets.at(-1)
 await act(async()=>root.render(sheet.render(()=>{})))
 expect(container.textContent).toContain('Nenhum peso registrado.')
 expect(container.textContent).toContain('Nenhuma medida registrada.')
 useUI.setState({sheets:[]})
})
it('indicates unsent changes and keeps notes separate',async()=>{mocks.repo.studentPlanDraft.mockResolvedValueOnce({title:'ABC',revision:2,sent_revision:1});await render();expect(container.textContent).toContain('Alterações não enviadas');expect(container.querySelector('textarea').value).toBe('Privado')})
it('does not show student data after a forbidden read',async()=>{mocks.repo.clientDetail.mockRejectedValueOnce(new Error('42501'));await render();expect(container.querySelector('[role="alert"]')).not.toBeNull();expect(container.querySelector('textarea')).toBeNull()})
it('opens private notes through the profile navigation without losing the loaded draft',async()=>{
 await render()
 const link=container.querySelector('a[href="/professional/students/s?section=notes"]')
 expect(link).not.toBeNull()
 await act(async()=>link.dispatchEvent(new MouseEvent('click',{bubbles:true,button:0})))
 const notes=container.querySelector('textarea').closest('details')
 expect(notes.hidden).toBe(false)
 expect(notes.open).toBe(true)
 expect(container.querySelector('textarea').value).toBe('Privado')
})
