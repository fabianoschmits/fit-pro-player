// @vitest-environment happy-dom
import React,{act} from 'react'
import {createRoot} from 'react-dom/client'
import {MemoryRouter,Routes,Route} from 'react-router-dom'
import {beforeEach,afterEach,it,expect,vi} from 'vitest'
const mocks=vi.hoisted(()=>({repo:{programPage:vi.fn(),program:vi.fn(),versions:vi.fn()}}))
vi.mock('../lib/professional-workflow.js',()=>({createProfessionalWorkflowRepository:()=>mocks.repo}))
import ProfessionalPrograms from './ProfessionalPrograms.jsx'
let root,container
beforeEach(()=>{vi.useFakeTimers();globalThis.IS_REACT_ACT_ENVIRONMENT=true;mocks.repo.programPage.mockResolvedValue({items:[{id:'p',title:'Iniciante',workoutCount:3}],hasMore:false});container=document.createElement('div');root=createRoot(container)})
afterEach(async()=>{await act(async()=>root.unmount());vi.useRealTimers();vi.clearAllMocks()})
const render=async(path)=>{await act(async()=>root.render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/professional/programs" element={<ProfessionalPrograms/>}/><Route path="/professional/templates" element={<ProfessionalPrograms/>}/></Routes></MemoryRouter>));await act(async()=>vi.advanceTimersByTimeAsync(200))}
it('redirects old program lists to paginated templates',async()=>{await render('/professional/programs');expect(container.textContent).toContain('Modelos');expect(container.querySelector('a[href="/professional/templates/p"]')).not.toBeNull();expect(mocks.repo.programPage).toHaveBeenCalledWith({search:'',offset:0})})
it('does not show a publish/choose-student wizard',async()=>{await render('/professional/templates');expect(container.textContent).not.toContain('Publicar');expect(container.querySelector('select')).toBeNull()})
