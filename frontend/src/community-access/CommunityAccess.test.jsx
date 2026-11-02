// @vitest-environment happy-dom
import {act} from 'react'
import {createRoot} from 'react-dom/client'
import {MemoryRouter,Route,Routes,useLocation,useNavigate} from 'react-router-dom'
import {afterEach,beforeEach,expect,it,vi} from 'vitest'
const mocks=vi.hoisted(()=>({auth:{status:'authenticated',user:{id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'}},client:null,state:{}}))
vi.mock('../auth/AuthProvider.jsx',()=>({useAuth:()=>mocks.auth}))
vi.mock('../lib/supabase-client.js',()=>({getBrowserSupabaseClient:()=>mocks.client}))
vi.mock('../store/useStore.js',()=>({useStore:selector=>selector(mocks.state)}))
vi.mock('../lib/professional-workflow.js',()=>({createProfessionalWorkflowRepository:()=>({professionalRole:async()=>false})}))
vi.mock('../lib/console.js',()=>({createConsoleRepository:()=>({adminRole:async()=>false})}))
vi.mock('../sheets.jsx',()=>({confirmSheet:()=>{}}))
import {CommunityAccessProvider,CommunityAccessGate,useCommunityAccess} from './CommunityAccess.jsx'
import TabBar from '../components/TabBar.jsx'
const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',ID='cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const NOW=Date.parse('2026-11-10T12:00:00Z')
const key=id=>`fpp_community_access_v1:${id}`
let root,container,rpc
const row=(overrides={})=>({id:ID,restriction_type:'temporary',reason:'harassment',admin_message:'Respeite os demais participantes.',starts_at:new Date(NOW-1000).toISOString(),ends_at:new Date(NOW+86400000).toISOString(),acknowledged_at:null,...overrides})
const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done});return{promise,resolve}}
function Probe(){const access=useCommunityAccess(),location=useLocation(),navigate=useNavigate();return <><output data-blocked={String(access.blocked)}>{location.pathname}</output><button onClick={()=>navigate('/community/messages/peer')}>Abrir mensagens</button></>}
function Harness({path='/home',nav=false}){return <MemoryRouter initialEntries={[path]}><CommunityAccessProvider><Probe/>{nav&&<TabBar onStart={()=>{}}/>}<Routes><Route path="/community/*" element={<CommunityAccessGate><p>Conteúdo social autorizado</p></CommunityAccessGate>}/><Route path="/home" element={<p>Treinos normais</p>}/></Routes></CommunityAccessProvider></MemoryRouter>}
const render=(props={})=>act(async()=>root.render(<Harness {...props}/>))
const fire=type=>act(async()=>window.dispatchEvent(new Event(type)))
const statusCalls=()=>rpc.mock.calls.filter(([name])=>name==='community_access_status')
beforeEach(()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;vi.useFakeTimers();vi.setSystemTime(NOW);localStorage.clear()
 Object.defineProperty(navigator,'onLine',{configurable:true,value:true})
 Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'})
 window.matchMedia=vi.fn(()=>({matches:true,addEventListener:vi.fn(),removeEventListener:vi.fn()}))
 mocks.auth={status:'authenticated',user:{id:A}}
 mocks.state={S:{onboardingDone:true,active:null,routines:[],week:{},dayPlan:{}},isGuest:()=>false}
 rpc=vi.fn(async()=>({data:{active:null},error:null}));mocks.client={rpc}
 container=document.createElement('div');document.body.append(container);root=createRoot(container)
})
afterEach(async()=>{await act(async()=>root.unmount());container.remove();vi.useRealTimers();vi.restoreAllMocks()})
it('does not poll any authenticated user after login, including after several minutes',async()=>{
 await render();expect(statusCalls()).toHaveLength(1)
 await act(async()=>vi.advanceTimersByTimeAsync(185000))
 expect(statusCalls()).toHaveLength(1)
})
it('shows the correct reason, public message and temporary release date',async()=>{
 rpc.mockResolvedValue({data:{active:row()},error:null});await render()
 expect(container.querySelector('[role="dialog"]')).not.toBeNull()
 expect(container.textContent).toContain('Assédio ou discurso de ódio')
 expect(container.textContent).toContain('Respeite os demais participantes.')
 expect(container.textContent).toContain('11/11/2026')
 expect(container.textContent).toContain('Treinos normais')
 expect(JSON.parse(localStorage.getItem(key(A)))).toEqual({id:ID,endsAt:row().ends_at})
})
it('identifies permanent restrictions without inventing a release date',async()=>{
 rpc.mockResolvedValue({data:{active:row({restriction_type:'permanent',ends_at:null})},error:null});await render()
 expect(container.textContent).toContain('Restrição permanente.')
 expect(container.textContent).not.toContain('Liberação em')
})
it('acknowledges only the alert and does not unlock the community',async()=>{
 rpc.mockImplementation(async name=>({data:name==='community_access_status'?{active:row()}:null,error:null}));await render()
 await act(async()=>[...container.querySelectorAll('button')].find(button=>button.textContent==='Entendi').click())
 expect(rpc).toHaveBeenCalledWith('community_acknowledge_restriction',{p_id:ID})
 expect(container.querySelector('[role="dialog"]')).toBeNull()
 expect(container.querySelector('output').dataset.blocked).toBe('true')
 expect(JSON.parse(localStorage.getItem(key(A)))).toEqual({id:ID,endsAt:row().ends_at})
})
it.each(['/community','/community/profile','/community/user/peer','/community/messages','/community/messages/peer'])('redirects restricted route %s without mounting its content',async path=>{
 rpc.mockResolvedValue({data:{active:row({acknowledged_at:new Date(NOW).toISOString()})},error:null})
 await render({path});expect(container.querySelector('output').textContent).toBe('/home')
 expect(container.textContent).not.toContain('Conteúdo social autorizado')
})
it('does not offer Community in TabBar when access is restricted',async()=>{
 rpc.mockResolvedValue({data:{active:row({acknowledged_at:'2026-11-10T12:00:00Z'})},error:null});await render({nav:true})
 expect(container.querySelector('[aria-label="Comunidade"]')).toBeNull()
 expect([...container.querySelectorAll('button')].some(button=>button.textContent==='Conta')).toBe(true)
})
it('keeps an account-specific offline marker effective across a direct route reload',async()=>{
 localStorage.setItem(key(A),JSON.stringify({id:ID,endsAt:null}));Object.defineProperty(navigator,'onLine',{configurable:true,value:false})
 await render({path:'/community'});expect(statusCalls()).toHaveLength(0)
 expect(container.querySelector('output').textContent).toBe('/home')
 expect(container.querySelector('output').dataset.blocked).toBe('true')
})
it('never lets the marker of A block user B',async()=>{
 localStorage.setItem(key(A),JSON.stringify({id:ID,endsAt:null}));await render()
 mocks.auth={status:'authenticated',user:{id:B}};await render({path:'/community'})
 expect(container.querySelector('output').dataset.blocked).toBe('false')
 expect(localStorage.getItem(key(B))).toBeNull()
})
it('ignores a slow response from a previous account',async()=>{
 const pending=deferred();rpc.mockImplementationOnce(()=>pending.promise)
 await render();mocks.auth={status:'authenticated',user:{id:B}};await render()
 await act(async()=>pending.resolve({data:{active:row()},error:null}))
 expect(container.querySelector('output').dataset.blocked).toBe('false')
 expect(localStorage.getItem(key(A))).toBeNull()
})
it('expires a temporary restriction locally without another network request',async()=>{
 rpc.mockResolvedValue({data:{active:row({ends_at:new Date(NOW+2000).toISOString()})},error:null});await render()
 expect(container.querySelector('output').dataset.blocked).toBe('true')
 const count=statusCalls().length
 await act(async()=>vi.advanceTimersByTimeAsync(2100))
 expect(container.querySelector('output').dataset.blocked).toBe('false')
 expect(statusCalls()).toHaveLength(count)
})
it('coalesces reconnect, focus and visibility events while a request is pending',async()=>{
 Object.defineProperty(navigator,'onLine',{configurable:true,value:false});localStorage.setItem(key(A),JSON.stringify({id:ID,endsAt:null}));await render()
 const pending=deferred();rpc.mockImplementationOnce(()=>pending.promise)
 Object.defineProperty(navigator,'onLine',{configurable:true,value:true})
 await act(async()=>{window.dispatchEvent(new Event('online'));window.dispatchEvent(new Event('focus'));document.dispatchEvent(new Event('visibilitychange'))})
 expect(statusCalls()).toHaveLength(1)
 await act(async()=>pending.resolve({data:{active:null},error:null}))
 expect(container.querySelector('output').dataset.blocked).toBe('false')
 expect(localStorage.getItem(key(A))).toBeNull()
})
it('does not release a cached restriction after a temporary network failure',async()=>{
 localStorage.setItem(key(A),JSON.stringify({id:ID,endsAt:null}));rpc.mockRejectedValue(Error('network offline'))
 await render();await fire('focus')
 expect(container.querySelector('output').dataset.blocked).toBe('true')
 expect(JSON.parse(localStorage.getItem(key(A)))).toEqual({id:ID,endsAt:null})
})
it('refreshes only for relevant account storage changes and for entry into a social route',async()=>{
 await render();const initial=statusCalls().length
 await act(async()=>window.dispatchEvent(new StorageEvent('storage',{key:key(B)})))
 expect(statusCalls()).toHaveLength(initial)
 await act(async()=>window.dispatchEvent(new StorageEvent('storage',{key:key(A)})))
 expect(statusCalls()).toHaveLength(initial+1)
 await act(async()=>container.querySelector('button').click())
 expect(statusCalls()).toHaveLength(initial+2)
 expect(container.textContent).toContain('Conteúdo social autorizado')
})
it('refreshes on each completed focus and visible event without a timer',async()=>{
 await render();await fire('focus')
 Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'})
 await act(async()=>document.dispatchEvent(new Event('visibilitychange')))
 expect(statusCalls()).toHaveLength(2)
 Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'})
 await act(async()=>document.dispatchEvent(new Event('visibilitychange')))
 expect(statusCalls()).toHaveLength(3)
})
