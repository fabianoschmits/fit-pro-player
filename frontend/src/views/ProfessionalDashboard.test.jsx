// @vitest-environment happy-dom
import React,{act} from 'react'
import {createRoot} from 'react-dom/client'
import {MemoryRouter} from 'react-router-dom'
import {beforeEach,afterEach,it,expect,vi} from 'vitest'
const mocks=vi.hoisted(()=>({user:{id:'pro'},repo:{dashboardSummary:vi.fn(),studentPage:vi.fn()}}))
vi.mock('../auth/AuthProvider.jsx',()=>({useAuth:()=>({user:mocks.user})}))
vi.mock('../lib/professional-workflow.js',()=>({createProfessionalWorkflowRepository:()=>mocks.repo}))
import ProfessionalDashboard from './ProfessionalDashboard.jsx'
let root,container
beforeEach(()=>{globalThis.IS_REACT_ACT_ENVIRONMENT=true;mocks.repo.dashboardSummary.mockResolvedValue({activeStudents:24,todayWorkouts:8,attentionStudents:3,today:[{studentUserId:'s',displayName:'Ana',workoutTitle:'A'}]});mocks.repo.studentPage.mockResolvedValue({items:[]});container=document.createElement('div');root=createRoot(container)})
afterEach(async()=>{await act(async()=>root.unmount());vi.clearAllMocks()})
it('renders server counts and scoped student cards with no publication workflow',async()=>{await act(async()=>root.render(<MemoryRouter><ProfessionalDashboard/></MemoryRouter>));expect(container.textContent).toContain('24');expect(container.textContent).toContain('8');expect(container.querySelector('a[href="/professional/students/s"]')).not.toBeNull();expect(mocks.repo.studentPage).toHaveBeenCalledWith({status:'attention',limit:10});expect(container.textContent).not.toContain('Publicar')})
it('ignores a response from the previous account',async()=>{let resolve;mocks.repo.dashboardSummary.mockReturnValueOnce(new Promise(r=>resolve=r));await act(async()=>root.render(<MemoryRouter><ProfessionalDashboard/></MemoryRouter>));mocks.user={id:'other'};await act(async()=>root.render(<MemoryRouter><ProfessionalDashboard/></MemoryRouter>));await act(async()=>resolve({activeStudents:999,today:[]}));expect(container.textContent).not.toContain('999')})
