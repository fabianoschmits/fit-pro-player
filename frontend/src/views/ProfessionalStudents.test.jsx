// @vitest-environment happy-dom
import React,{act} from 'react'
import {createRoot} from 'react-dom/client'
import {MemoryRouter} from 'react-router-dom'
import {beforeEach,afterEach,it,expect,vi} from 'vitest'
const mocks=vi.hoisted(()=>({repo:{studentPage:vi.fn()}}))
vi.mock('../auth/AuthProvider.jsx',()=>({useAuth:()=>({user:{id:'pro'}})}))
vi.mock('../lib/professional-workflow.js',()=>({createProfessionalWorkflowRepository:()=>mocks.repo}))
import ProfessionalStudents from './ProfessionalStudents.jsx'
let root,container
beforeEach(()=>{vi.useFakeTimers();globalThis.IS_REACT_ACT_ENVIRONMENT=true;mocks.repo.studentPage.mockResolvedValue({items:[{studentUserId:'s',displayName:'Ana',currentProgram:{title:'ABC'},attentionReasons:[]}],total:1});container=document.createElement('div');root=createRoot(container)})
afterEach(async()=>{await act(async()=>root.unmount());vi.useRealTimers();vi.clearAllMocks()})
const render=async()=>{await act(async()=>root.render(<MemoryRouter><ProfessionalStudents/></MemoryRouter>));await act(async()=>vi.advanceTimersByTimeAsync(220))}
it('opens the student from a card and sends filters to the server',async()=>{await render();expect(container.querySelector('a[href="/professional/students/s"]')).not.toBeNull();await act(async()=>[...container.querySelectorAll('button')].find(x=>x.textContent==='Sem plano').click());await act(async()=>vi.advanceTimersByTimeAsync(220));expect(mocks.repo.studentPage).toHaveBeenLastCalledWith({search:'',status:'without_program',offset:0})})
it('shows an actionable load error',async()=>{mocks.repo.studentPage.mockRejectedValueOnce(new Error('offline'));await render();expect(container.querySelector('[role="alert"]').textContent).toContain('Tentar novamente')})
