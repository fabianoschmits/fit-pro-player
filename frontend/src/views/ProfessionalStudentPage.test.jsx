// @vitest-environment happy-dom
import React,{act} from 'react'
import {createRoot} from 'react-dom/client'
import {MemoryRouter,Routes,Route} from 'react-router-dom'
import {beforeEach,afterEach,it,expect,vi} from 'vitest'
const mocks=vi.hoisted(()=>({repo:{clientDetail:vi.fn(),studentNote:vi.fn(),studentPlanDraft:vi.fn(),executionPage:vi.fn()}}))
vi.mock('../auth/AuthProvider.jsx',()=>({useAuth:()=>({user:{id:'pro'}})}))
vi.mock('../lib/professional-workflow.js',()=>({createProfessionalWorkflowRepository:()=>mocks.repo}))
import ProfessionalStudentPage from './ProfessionalStudentPage.jsx'
let root,container
beforeEach(()=>{globalThis.IS_REACT_ACT_ENVIRONMENT=true;mocks.repo.clientDetail.mockResolvedValue({displayName:'Ana',assignments:[],executions:[]});mocks.repo.studentNote.mockResolvedValue({body:'Privado'});mocks.repo.studentPlanDraft.mockResolvedValue(null);container=document.createElement('div');root=createRoot(container)})
afterEach(async()=>{await act(async()=>root.unmount());vi.clearAllMocks()})
const render=()=>act(async()=>root.render(<MemoryRouter initialEntries={['/professional/students/s']}><Routes><Route path="/professional/students/:studentId" element={<ProfessionalStudentPage/>}/></Routes></MemoryRouter>))
it('opens the linked student and leads directly to their plan',async()=>{await render();expect(container.textContent).toContain('Ana');expect(container.querySelector('a[href="/professional/students/s/plan"]')).not.toBeNull();expect(container.querySelector('select')).toBeNull();expect(mocks.repo.clientDetail).toHaveBeenCalledWith('s')})
it('indicates unsent changes and keeps notes separate',async()=>{mocks.repo.studentPlanDraft.mockResolvedValueOnce({title:'ABC',revision:2,sent_revision:1});await render();expect(container.textContent).toContain('Alterações não enviadas');expect(container.querySelector('textarea').value).toBe('Privado')})
it('does not show student data after a forbidden read',async()=>{mocks.repo.clientDetail.mockRejectedValueOnce(new Error('42501'));await render();expect(container.querySelector('[role="alert"]')).not.toBeNull();expect(container.querySelector('textarea')).toBeNull()})
