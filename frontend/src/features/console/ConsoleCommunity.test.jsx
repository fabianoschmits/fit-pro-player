// @vitest-environment happy-dom
import {act} from 'react'
import {createRoot} from 'react-dom/client'
import {MemoryRouter,Routes,Route} from 'react-router-dom'
import {beforeEach,afterEach,it,expect,vi} from 'vitest'
const mocks=vi.hoisted(()=>({moderation:{},accounts:{},support:{}}))
vi.mock('./ConsoleAccess.jsx',()=>({useConsoleAccess:()=>({userId:'admin',allowed:true,repo:mocks.accounts}),AccessGate:({children})=>children}))
vi.mock('./ConsoleLayout.jsx',()=>({default:({children})=>children}))
vi.mock('../../lib/supabase-client.js',()=>({getBrowserSupabaseClient:()=>null}))
vi.mock('../../lib/community-moderation.js',async original=>({...await original(),createCommunityModerationRepository:()=>mocks.moderation}))
vi.mock('../../lib/support.js',()=>({createSupportRepository:()=>mocks.support}))
import ConsoleCommunity from './ConsoleCommunity.jsx'
import {ConsoleUserPage} from './ConsoleUserPage.jsx'
import ConsoleConversation from './ConsoleConversation.jsx'
let root,host
const button=text=>[...host.querySelectorAll('button')].find(node=>node.textContent===text)
const row={id:'restriction',user_id:'reported',display_name:'Pessoa denunciada',status:'active',reason:'spam',admin_message:'Respeite as regras',created_at:'2026-11-01T12:00:00Z',starts_at:'2026-11-01T12:00:00Z',ends_at:'2026-11-02T12:00:00Z'}
beforeEach(()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;host=document.createElement('div');document.body.append(host);root=createRoot(host)
 mocks.moderation={status:vi.fn().mockResolvedValue({active:null,history:[]}),list:vi.fn().mockResolvedValue({items:[row],hasMore:false}),restrict:vi.fn().mockResolvedValue(true),unrestrict:vi.fn().mockResolvedValue(true)}
 mocks.accounts={userDetail:vi.fn().mockResolvedValue({userId:'reported',displayName:'Pessoa denunciada',roles:[]}),userTraining:vi.fn().mockResolvedValue(null),setSuspended:vi.fn()}
 mocks.support={markRead:vi.fn(),adminTicketDetail:vi.fn().mockResolvedValue({ticketId:'report',userId:'reporter',subject:'Denúncia',status:'pending',messages:[],events:[],reportContext:{reportedUserId:'reported',postId:'post',reason:'spam',targetKind:'post'}})}
})
afterEach(async()=>{await act(async()=>root.unmount());host.remove()})
const render=(path,element)=>act(async()=>root.render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/console/community" element={element}/><Route path="/console/users/:userId" element={element}/><Route path="/console/support/:ticketId" element={element}/></Routes></MemoryRouter>))
const change=async(node,value)=>act(async()=>{Object.getOwnPropertyDescriptor(node.tagName==='TEXTAREA'?window.HTMLTextAreaElement.prototype:window.HTMLSelectElement.prototype,'value').set.call(node,value);node.dispatchEvent(new Event(node.tagName==='TEXTAREA'?'input':'change',{bubbles:true}))})
it('lists blocked users and filters the history without exposing a new-block form',async()=>{
 await render('/console/community',<ConsoleCommunity/> )
 expect(host.textContent).toContain('Pessoa denunciada');expect(host.textContent).toContain('Respeite as regras')
 expect(host.querySelector('form')).toBeNull()
 await change(host.querySelectorAll('select')[0],'revoked')
 await change(host.querySelectorAll('select')[1],'24h')
 expect(mocks.moderation.list).toHaveBeenLastCalledWith(expect.objectContaining({status:'revoked',duration:'24h',offset:0}))
 expect(host.querySelector('a[href="/console/users/reported"]')).not.toBeNull()
})
it('applies community restriction from a profile independently of account suspension',async()=>{
 await render('/console/users/reported',<ConsoleUserPage/>)
 expect(button('Suspender conta')).toBeDefined()
 await act(async()=>button('Bloquear da Comunidade').click())
 expect(mocks.moderation.restrict).toHaveBeenCalledWith(expect.objectContaining({userId:'reported',duration:'24h'}))
 expect(mocks.accounts.setSuspended).not.toHaveBeenCalled()
 expect(host.textContent).toContain('Bloqueio da Comunidade aplicado.')
})
it('hides new-block controls on administrator profiles',async()=>{
 mocks.accounts.userDetail.mockResolvedValue({userId:'reported',displayName:'Admin',roles:['admin']})
 await render('/console/users/reported',<ConsoleUserPage/>)
 expect(button('Bloquear da Comunidade')).toBeUndefined()
 expect(host.textContent).toContain('Administradores não podem receber bloqueio')
 expect(mocks.moderation.restrict).not.toHaveBeenCalled()
})
it('moderates the reported user rather than the reporter and preserves the source ticket',async()=>{
 await render('/console/support/report',<ConsoleConversation/>)
 expect(mocks.accounts.userDetail).toHaveBeenCalledWith('reporter')
 expect(mocks.accounts.userDetail).toHaveBeenCalledWith('reported')
 await act(async()=>button('Bloquear da Comunidade').click())
 expect(mocks.moderation.restrict).toHaveBeenCalledWith(expect.objectContaining({userId:'reported',sourceTicketId:'report',reason:'spam'}))
 expect(host.querySelector('a[href="/console/users/reported"]')).not.toBeNull()
})
it('requires a release reason and displays revocation history after release',async()=>{
 mocks.moderation.status.mockResolvedValueOnce({active:row,history:[row]}).mockResolvedValue({active:null,history:[{...row,status:'revoked',revoked_at:'2026-11-02T10:00:00Z',revoke_reason:'Revisão concluída'}]})
 await render('/console/community',<ConsoleCommunity/>)
 await act(async()=>button('Gerenciar / liberar acesso').click())
 expect(button('Liberar acesso à Comunidade').disabled).toBe(true)
 await change(host.querySelectorAll('textarea')[1],'Revisão concluída')
 await act(async()=>host.querySelectorAll('form')[1].dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})))
 expect(mocks.moderation.unrestrict).toHaveBeenCalledWith({userId:'reported',reason:'Revisão concluída',sourceTicketId:null})
 expect(host.textContent).toContain('Sem bloqueio ativo na Comunidade.')
 expect(host.textContent).toContain('Revisão concluída')
})
