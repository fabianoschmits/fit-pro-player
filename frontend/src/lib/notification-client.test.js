// @vitest-environment happy-dom
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
import { createNotificationCoordinator } from './notification-client.js'

let state, calls, storage, environment, subscription, client
const userId='11111111-1111-4111-8111-111111111111'
const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve()}
beforeEach(()=>{
  vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-04T12:00:00Z'))
  state={notifications:{rest:true,timedSet:true,professional:true},routines:[],week:{},dayPlan:{},workouts:[],bodyweight:[],bodyMeasurements:[]}
  calls=[];storage=new Map()
  subscription={endpoint:'https://web.push.apple.com/Qtest',keys:{p256dh:'key',auth:'auth'},toJSON(){return {endpoint:this.endpoint,keys:this.keys}},unsubscribe:vi.fn().mockResolvedValue(true)}
  environment={document, navigator:{onLine:true,serviceWorker:{getRegistration:vi.fn().mockResolvedValue({pushManager:{getSubscription:vi.fn().mockResolvedValue(subscription),subscribe:vi.fn().mockResolvedValue(subscription)},active:{postMessage:vi.fn()}})}}, Notification:{permission:'granted',requestPermission:vi.fn().mockResolvedValue('granted')},storage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},crypto:{randomUUID:()=> '22222222-2222-4222-8222-222222222222'},now:()=>Date.now()}
  Object.defineProperty(document,'hidden',{configurable:true,value:false});Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'})
  client={rpc:vi.fn(async(name,args)=>{calls.push([name,args]);return {data:name==='notification_config'?{ready:true,vapidPublicKey:'BA'.repeat(44)}:name==='register_notification_device'?{id:'device'}:name==='set_notification_presence'?[]:true,error:null}})}
  environment.checkWorkerSupport=async()=>true;environment.writeWorkerContext=async()=>true
})
afterEach(()=>{vi.clearAllTimers();vi.useRealTimers()})
function coordinator(extra={}) {const c=createNotificationCoordinator({client,userId,getState:()=>state,environment,notify:vi.fn(),...extra});expect(c).not.toBeNull();return c}

describe('notification coordinator',()=>{
  it('does not register, heartbeat or enqueue jobs before explicit consent',async()=>{
    const c=coordinator();await c.initialize();await flush();await vi.advanceTimersByTimeAsync(60000)
    expect(c.status().enabled).toBe(false);expect(calls.map(x=>x[0])).toEqual(['notification_config']);c.dispose()
  })
  it('does not synchronize local timer preferences or series changes to the background server',async()=>{
    const c=coordinator();await c.initialize();expect(await c.enable()).toBe(true);calls.length=0
    state.notifications.rest=false;state.notifications.timedSet=false;state.active={d:'2026-10-04',entries:[{sets:[{w:70,done:true}]}]};c.sync();await vi.advanceTimersByTimeAsync(501)
    expect(calls).toHaveLength(0);c.dispose()
  })
  it('does not poll or renew foreground presence while hidden',async()=>{
    const c=coordinator();await c.initialize();await c.enable();calls.length=0
    Object.defineProperty(document,'hidden',{configurable:true,value:true});Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'})
    await c.visibilityChanged();await vi.advanceTimersByTimeAsync(120000)
    expect(calls.filter(x=>x[0]==='set_notification_presence')).toHaveLength(1);expect(calls[0][1].p_foreground).toBe(false);c.dispose()
  })
  it('does not attach registration responses to an account after disposal',async()=>{
    let resolve;client.rpc=vi.fn(async name=>name==='notification_config'?{data:{ready:true,vapidPublicKey:'BA'.repeat(44)}}:new Promise(r=>{resolve=r}))
    const c=coordinator();await c.initialize();const pending=c.enable();await flush();c.dispose();resolve({data:{id:'device'}});await pending
    expect(c.status().enabled).toBe(false)
  })
  it('shows each professional event locally and consumes it without another push',async()=>{
    const notify=vi.fn();const events=[{id:'33333333-3333-4333-8333-333333333333',kind:'program_updated',createdAt:new Date().toISOString(),href:'/student/professionals'}]
    client.rpc=vi.fn(async(name,args)=>{calls.push([name,args]);return {data:name==='notification_config'?{ready:true,vapidPublicKey:'BA'.repeat(44)}:name==='register_notification_device'?{id:'device'}:name==='set_notification_presence'?events:true}})
    const c=coordinator({notify});await c.initialize();await c.enable();await c.visibilityChanged();await flush()
    expect(notify).toHaveBeenCalledTimes(1);expect(calls.some(([name,args])=>name==='consume_notification_events'&&args.p_event_ids[0]===events[0].id)).toBe(true);c.dispose()
  })
  it('reactivates the device server-side after disabling even if the browser reuses a subscription',async()=>{
    const c=coordinator();await c.initialize();await c.enable();await c.disable();calls.length=0
    expect(await c.enable()).toBe(true)
    expect(calls.filter(x=>x[0]==='register_notification_device')).toHaveLength(1);c.dispose()
  })
  it('stops presence requests when every important category is disabled',async()=>{
    const c=coordinator();await c.initialize();await c.enable();state.notifications.professional=false;c.sync();await vi.advanceTimersByTimeAsync(501);calls.length=0
    await vi.advanceTimersByTimeAsync(120000);expect(calls).toHaveLength(0);c.dispose()
  })
  it('orders disabling after an in-flight registration to avoid re-enabling the device remotely',async()=>{
    let resolveRegistration
    const original=client.rpc
    client.rpc=vi.fn(async(name,args)=>name==='register_notification_device'?new Promise(resolve=>{calls.push([name,args]);resolveRegistration=resolve}):original(name,args))
    const c=coordinator();await c.initialize();const enabling=c.enable();await flush();const disabling=c.disable();await flush()
    expect(calls.some(x=>x[0]==='disable_notification_device')).toBe(false)
    resolveRegistration({data:{id:'device'}});await Promise.all([enabling,disabling]);expect(c.status().enabled).toBe(false)
    expect(calls.map(x=>x[0]).at(-1)).toBe('disable_notification_device');c.dispose()
  })
  it('does not reactivate after subscription discovery resolves behind a disable operation',async()=>{
    storage.set(`fpp_push_device_v1:${userId}`,JSON.stringify({deviceKey:'22222222-2222-4222-8222-222222222222',enabled:true}))
    let resolveSubscription
    const reg=await environment.navigator.serviceWorker.getRegistration();reg.pushManager.getSubscription=vi.fn(()=>new Promise(r=>{resolveSubscription=r}))
    const c=coordinator();const init=c.initialize();await flush()
    // Disabling performs its own subscription lookup too; let that lookup finish immediately.
    reg.pushManager.getSubscription=vi.fn().mockResolvedValue(null);await c.disable();resolveSubscription(subscription);await init
    expect(c.status().enabled).toBe(false);expect(calls.filter(x=>x[0]==='register_notification_device')).toHaveLength(0);c.dispose()
  })
  it('refreshes background registration when reconnecting',async()=>{
    const c=coordinator();await c.initialize();await c.enable();calls.length=0
    await c.reconnect();await flush()
    const names=calls.map(x=>x[0]);expect(names.indexOf('register_notification_device')).toBeGreaterThanOrEqual(0)
    expect(names).not.toContain('save_notification_timer');c.dispose()
  })
  it('does not register before the active worker can persist the owner context',async()=>{
    environment.writeWorkerContext=async()=>false
    const c=coordinator();await c.initialize();expect(await c.enable()).toBe(false)
    expect(calls.filter(x=>x[0]==='register_notification_device')).toHaveLength(0);c.dispose()
  })
  it('refreshes browser permission after the user changes device settings',async()=>{
    environment.Notification.permission='denied';const c=coordinator();await c.initialize();expect(c.status().permission).toBe('denied')
    environment.Notification.permission='granted';await c.visibilityChanged();expect(c.status().permission).toBe('granted');expect(await c.enable()).toBe(true);c.dispose()
  })
  it('keeps the unconfigured Android transport inactive without requesting permission or an FCM token',async()=>{
    const subscribe=vi.fn(), requestPermission=vi.fn()
    environment.nativePush={registration:async()=>({pushManager:{getSubscription:async()=>null,subscribe}}),checkPermission:async()=> 'default',requestPermission,writeContext:async()=>true}
    const c=coordinator();await c.initialize()
    expect(c.status()).toMatchObject({native:true,ready:false,enabled:false})
    expect(await c.enable()).toBe(false);expect(subscribe).not.toHaveBeenCalled();expect(requestPermission).not.toHaveBeenCalled()
    expect(calls.map(x=>x[0])).toEqual(['notification_config']);c.dispose()
  })
  it('registers a configured Android device with its installation proof instead of a browser VAPID subscription',async()=>{
    const nativeSubscription={type:'fcm',token:'token-for-native-installation',installationProof:'proof-for-installation',unsubscribe:vi.fn()}
    const subscribe=vi.fn().mockResolvedValue(nativeSubscription)
    environment.nativePush={registration:async()=>({pushManager:{getSubscription:async()=>null,subscribe}}),checkPermission:async()=> 'default',requestPermission:async()=> 'granted',writeContext:async()=>true}
    const original=client.rpc
    client.rpc=vi.fn(async(name,args)=>name==='notification_config'?{data:{ready:true,nativeReady:true}}:original(name,args))
    const c=coordinator();await c.initialize();expect(await c.enable()).toBe(true)
    expect(subscribe).toHaveBeenCalledWith(undefined)
    expect(calls.find(([name])=>name==='register_notification_device')[1].p_subscription).toBe(nativeSubscription)
    expect(environment.Notification.requestPermission).not.toHaveBeenCalled();c.dispose()
  })
  it('does not unsubscribe the shared device after an old account disable resolves behind account disposal',async()=>{
    const c=coordinator();await c.initialize();await c.enable()
    let finishDisable;const original=client.rpc
    client.rpc=vi.fn((name,args)=>name==='disable_notification_device'?new Promise(resolve=>{finishDisable=resolve}):original(name,args))
    const disabling=c.disable();await flush();c.dispose();finishDisable({data:true});await disabling
    expect(subscription.unsubscribe).not.toHaveBeenCalled()
  })
})
