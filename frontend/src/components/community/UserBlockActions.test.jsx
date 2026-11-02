// @vitest-environment happy-dom
import {act} from 'react'
import {createRoot} from 'react-dom/client'
import {afterEach,beforeEach,expect,it,vi} from 'vitest'
import {UserBlockButton,BlockedUsers} from './UserBlockActions.jsx'
let root,container
beforeEach(()=>{globalThis.IS_REACT_ACT_ENVIRONMENT=true;container=document.createElement('div');document.body.append(container);root=createRoot(container)})
afterEach(async()=>{await act(async()=>root.unmount());container.remove()})
it('blocks and unblocks through the server RPC',async()=>{
 const client={rpc:vi.fn().mockImplementation(name=>Promise.resolve({data:name!=='community_has_block',error:null}))}
 await act(async()=>root.render(<UserBlockButton client={client} userId="me" peerId="peer"/>))
 await act(async()=>container.querySelector('button').click())
 expect(client.rpc).toHaveBeenLastCalledWith('community_block_user',{p_peer:'peer'})
 expect(container.textContent).toContain('Desbloquear')
 await act(async()=>container.querySelector('button').click())
 expect(client.rpc).toHaveBeenLastCalledWith('community_unblock_user',{p_peer:'peer'})
})
it('shows server errors and never offers self blocking',async()=>{
 const client={rpc:vi.fn().mockImplementation(name=>Promise.resolve(name==='community_has_block'?{data:false}:{error:Error('denied')}))}
 await act(async()=>root.render(<UserBlockButton client={client} userId="me" peerId="peer"/>))
 await act(async()=>container.querySelector('button').click())
 expect(container.querySelector('[role="alert"]')).not.toBeNull()
 await act(async()=>root.render(<UserBlockButton client={client} userId="me" peerId="me"/>))
 expect(container.querySelector('button')).toBeNull()
})
it('loads an existing server block before enabling unblock',async()=>{
 let resolve
 const client={rpc:vi.fn().mockImplementation(name=>name==='community_has_block'?new Promise(yes=>{resolve=yes}):Promise.resolve({data:true}))}
 await act(async()=>root.render(<UserBlockButton client={client} userId="me" peerId="peer"/>))
 expect(container.querySelector('button').disabled).toBe(true)
 await act(async()=>resolve({data:true}))
 expect(container.querySelector('button').textContent).toBe('Desbloquear')
 await act(async()=>container.querySelector('button').click())
 expect(client.rpc).toHaveBeenLastCalledWith('community_unblock_user',{p_peer:'peer'})
 expect(container.querySelector('button').textContent).toBe('Bloquear')
})
it('ignores stale status and writes when rapidly switching profiles',async()=>{
 const pending={}
 const client={rpc:vi.fn().mockImplementation((name,args)=>new Promise(resolve=>{pending[`${name}:${args.p_peer}`]=resolve}))}
 const show=peerId=>act(async()=>root.render(<UserBlockButton client={client} userId="me" peerId={peerId}/>))
 await show('first');await show('second')
 await act(async()=>pending['community_has_block:first']({data:true}))
 expect(container.querySelector('button').disabled).toBe(true)
 await act(async()=>pending['community_has_block:second']({data:false}))
 act(()=>container.querySelector('button').click())
 await show('third')
 await act(async()=>pending['community_has_block:third']({data:true}))
 await act(async()=>pending['community_block_user:second']({data:true}))
 expect(container.querySelector('button').textContent).toBe('Desbloquear')
 await act(async()=>container.querySelector('button').click())
 expect(client.rpc).toHaveBeenLastCalledWith('community_unblock_user',{p_peer:'third'})
 await act(async()=>pending['community_unblock_user:third']({data:true}))
})
it('loads only own blocks on demand and removes an unblocked row',async()=>{
 const repo={blocks:vi.fn().mockResolvedValue([{blocked_id:'peer'}]),unblock:vi.fn().mockResolvedValue(true)}
 await act(async()=>root.render(<BlockedUsers repo={repo}/>))
 expect(repo.blocks).not.toHaveBeenCalled()
 await act(async()=>container.querySelector('button').click())
 await act(async()=>container.querySelector('li button').click())
 expect(repo.unblock).toHaveBeenCalledWith('peer')
 expect(container.querySelector('li')).toBeNull()
})
