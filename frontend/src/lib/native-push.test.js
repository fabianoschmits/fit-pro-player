// @vitest-environment happy-dom
import { beforeEach,afterEach,it,expect,vi } from 'vitest'
import { createNativePushAdapter } from './native-push.js'
let listeners,plugin,adapter,notify,navigate,tokenChanged
const ownerId='owner-a',deviceKey='device-a',token='a'.repeat(100)
const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve()}
const payload=(extra={})=>({id:'event1',ownerId,deviceKey,kind:'program_updated',expiresAt:new Date(Date.now()+60000).toISOString(),href:'/#/student/professionals',...extra})
const createAdapter=(expectedOwnerId=ownerId)=>createNativePushAdapter({expectedOwnerId,loadPlugin:async()=>plugin,storage:localStorage,crypto,notify,navigate,onToken:tokenChanged,loadApp:async()=>null})
beforeEach(()=>{
  localStorage.clear();listeners=new Map();notify=vi.fn();navigate=vi.fn();tokenChanged=vi.fn()
  plugin={addListener:vi.fn(async(kind,fn)=>{listeners.set(kind,fn);return{remove:vi.fn()}}),checkPermissions:vi.fn().mockResolvedValue({receive:'granted'}),requestPermissions:vi.fn().mockResolvedValue({receive:'granted'}),register:vi.fn().mockResolvedValue(),unregister:vi.fn().mockResolvedValue()}
  adapter=createAdapter()
})
afterEach(()=>adapter?.dispose())
it('sets up receiving without requesting permission or registering before consent',async()=>{await adapter.registration();expect(plugin.requestPermissions).not.toHaveBeenCalled();expect(plugin.register).not.toHaveBeenCalled()})
it('waits for the native token and stores only device metadata outside the backup',async()=>{
  const reg=await adapter.registration();const pending=reg.pushManager.subscribe();await flush();listeners.get('registration')({value:token});const sub=await pending
  expect(sub.toJSON()).toMatchObject({type:'fcm',token});expect(sub.toJSON().installationProof).toHaveLength(43);expect(plugin.register).toHaveBeenCalledOnce()
  await sub.unsubscribe();expect(plugin.unregister).toHaveBeenCalledOnce();expect(await reg.pushManager.getSubscription()).toBeNull()
})
it('accepts owned live important events once and rejects timers/expired/foreign account events',async()=>{
  await adapter.registration();await adapter.writeContext({ownerId,deviceKey,enabled:true})
  const receive=listeners.get('pushNotificationReceived')
  receive({data:payload()});receive({data:payload()});receive({data:payload({id:'other',ownerId:'owner-b'})});receive({data:payload({id:'expired',expiresAt:'2000-01-01T00:00:00Z'})});receive({data:payload({id:'rest',kind:'rest'})})
  expect(notify).toHaveBeenCalledExactlyOnceWith('program_updated')
})
it('validates the current account and a safe route before opening a notification',async()=>{
  await adapter.registration();await adapter.writeContext({ownerId,deviceKey,enabled:true});const action=listeners.get('pushNotificationActionPerformed')
  action({notification:{data:payload({href:'javascript:alert(1)'})}});expect(navigate).toHaveBeenLastCalledWith('/home')
  action({notification:{data:payload({href:'/#/professional/students/123'})}});expect(navigate).toHaveBeenLastCalledWith('/professional/students/123')
  await adapter.writeContext({ownerId,deviceKey,enabled:false});action({notification:{data:payload()}});expect(navigate).toHaveBeenCalledTimes(2)
})
it('an old-account context clear cannot disable the new account',async()=>{
  adapter.dispose();adapter=createAdapter('owner-b')
  await adapter.registration();await adapter.writeContext({ownerId:'owner-b',deviceKey:'device-b',enabled:true});expect(await adapter.writeContext({ownerId,deviceKey,enabled:false})).toBe(false)
  listeners.get('pushNotificationReceived')({data:payload({ownerId:'owner-b',deviceKey:'device-b'})});expect(notify).toHaveBeenCalledOnce()
})
it.each(['owner-b',null])('rejects retained old-owner actions during cold start for authenticated owner %s',async expectedOwnerId=>{
  adapter.dispose()
  localStorage.setItem('fpp_native_push_context_v1',JSON.stringify({context:{ownerId,deviceKey,enabled:true},seen:[]}))
  plugin.addListener.mockImplementation(async(kind,fn)=>{
    listeners.set(kind,fn)
    if(kind==='pushNotificationActionPerformed')fn({notification:{data:payload()}})
    return{remove:vi.fn()}
  })
  adapter=createAdapter(expectedOwnerId)
  await adapter.registration()
  expect(navigate).not.toHaveBeenCalled()
  listeners.get('pushNotificationReceived')({data:payload()})
  expect(notify).not.toHaveBeenCalled()
})
it('opens a retained current-owner action before the coordinator writes context on cold start',async()=>{
  adapter.dispose()
  localStorage.setItem('fpp_native_push_context_v1',JSON.stringify({context:{ownerId,deviceKey,enabled:true},seen:[]}))
  plugin.addListener.mockImplementation(async(kind,fn)=>{
    listeners.set(kind,fn)
    if(kind==='pushNotificationActionPerformed')fn({notification:{data:payload()}})
    return{remove:vi.fn()}
  })
  adapter=createAdapter()
  await adapter.registration()
  expect(navigate).toHaveBeenCalledExactlyOnceWith('/student/professionals')
})
it('rejects a foreign-owner context write without replacing the authenticated owner context',async()=>{
  await adapter.registration();await adapter.writeContext({ownerId,deviceKey,enabled:true})
  expect(await adapter.writeContext({ownerId:'owner-b',deviceKey:'device-b',enabled:true})).toBe(false)
  const action=listeners.get('pushNotificationActionPerformed')
  action({notification:{data:payload({ownerId:'owner-b',deviceKey:'device-b'})}})
  expect(navigate).not.toHaveBeenCalled()
  action({notification:{data:payload()}})
  expect(navigate).toHaveBeenCalledExactlyOnceWith('/student/professionals')
})
