const KINDS = new Set(['workout_reminder','weight_reminder','measurement_reminder','program_updated','program_removed','relationship_accepted','relationship_ended','student_workout_completed','student_workout_abandoned','verification_changed'])
const ROUTES = new Set(['/home','/plan','/workout','/body-progress','/professional/profile','/professional','/professional/students','/professional/programs','/student/professionals','/settings'])
const permission = value => value === 'granted' || value === 'denied' ? value : 'default'
const safeRoute = href => {
  const route = typeof href === 'string' && href.startsWith('/#/') ? href.slice(2) : '/home'
  return ROUTES.has(route) || /^\/(?:professional\/students|plan\/r)\/[A-Za-z0-9_-]{1,128}$/.test(route) ? route : '/home'
}

// Native tokens, installation proof and receipts are never part of exported app state.
export function createNativePushAdapter({ loadPlugin = async () => (await import('@capacitor/push-notifications')).PushNotifications,
  loadApp = async () => (await import('@capacitor/app')).App, storage = globalThis.localStorage,
  crypto = globalThis.crypto, expectedOwnerId = null, notify = () => {}, navigate = () => {}, onToken = () => {}, onVisibility = () => {}, now = Date.now } = {}) {
  const tokenKey='fpp_native_push_token_v1', proofKey='fpp_native_push_proof_v1', contextKey='fpp_native_push_context_v1'
  let plugin, setup, disposed=false, pending=null, active=true, cachedToken=null, context=null, seen=[], proof
  const handles=[]
  try { cachedToken=storage?.getItem(tokenKey);proof=storage?.getItem(proofKey);const stored=JSON.parse(storage?.getItem(contextKey)||'null');context=stored?.context?.ownerId===expectedOwnerId?stored.context:null;seen=context?stored?.seen||[]:[] } catch { /* rebuild device metadata */ }
  if (!proof) {
    const bytes=crypto.getRandomValues(new Uint8Array(32));proof=btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'')
    try { storage?.setItem(proofKey,proof) } catch { /* token remains only in memory */ }
  }
  const persistContext=()=>{try{storage?.setItem(contextKey,JSON.stringify({context,seen:seen.slice(-100)}))}catch{/* memory still guards delivery */}}
  const valid=data=>!disposed&&expectedOwnerId&&context?.ownerId===expectedOwnerId&&context.enabled&&data?.ownerId===context.ownerId&&data.deviceKey===context.deviceKey&&KINDS.has(data.kind)
    &&typeof data.id==='string'&&data.id.length<=256&&typeof data.expiresAt==='string'&&Date.parse(data.expiresAt)>now()
  const subscription=()=>cachedToken?{toJSON:()=>({type:'fcm',token:cachedToken,installationProof:proof}),unsubscribe:async()=>{
    await plugin.unregister();cachedToken=null;try{storage?.removeItem(tokenKey)}catch{/* metadata already disabled */}return true
  }}:null
  const ready=async()=>{
    if(disposed)throw new Error('native-push-disposed')
    if(!setup)setup=(async()=>{
      plugin=await loadPlugin()
      const add=async(kind,fn)=>{const handle=await plugin.addListener(kind,fn);if(disposed)await handle.remove();else handles.push(handle)}
      await add('registration',event=>{
        if(disposed||typeof event?.value!=='string'||!/^[A-Za-z0-9_:-]{40,4096}$/.test(event.value))return
        const previous=cachedToken;cachedToken=event.value;try{storage?.setItem(tokenKey,cachedToken)}catch{/* memory token usable */}
        pending?.resolve(subscription());if(previous&&previous!==cachedToken)onToken()
      })
      await add('registrationError',()=>pending?.reject(new Error('native-push-registration-failed')))
      await add('pushNotificationReceived',event=>{
        const data=event.data;if(!active||!valid(data))return
        seen=seen.filter(receipt=>receipt.expiresAt>now());if(seen.some(receipt=>receipt.id===data.id))return
        seen.push({id:data.id,expiresAt:Date.parse(data.expiresAt)});persistContext();notify(data.kind)
      })
      await add('pushNotificationActionPerformed',event=>{
        const data=event.notification?.data;if(valid(data))navigate(safeRoute(data.href))
      })
      const app=await loadApp().catch(()=>null)
      if(app){
        const state=await app.getState?.();if(state)active=state.isActive
        const handle=await app.addListener('appStateChange',state=>{active=state.isActive;onVisibility()})
        if(disposed)await handle.remove();else handles.push(handle)
      }
      if(disposed)throw new Error('native-push-disposed')
    })()
    await setup
  }
  const subscribe=async()=>{
    await ready();if(pending)return pending.promise
    let resolve,reject
    const promise=new Promise((yes,no)=>{resolve=yes;reject=no})
    void promise.catch(()=>{}) // register() can reject before the token promise is awaited.
    const timeout=setTimeout(()=>reject(new Error('native-push-timeout')),10000)
    pending={promise,resolve,reject}
    try { await plugin.register();return await promise } finally {clearTimeout(timeout);pending=null}
  }
  return {
    get active(){return active},
    async checkPermission(){await ready();return permission((await plugin.checkPermissions()).receive)},
    async requestPermission(){await ready();return permission((await plugin.requestPermissions()).receive)},
    async registration(){await ready();return{pushManager:{getSubscription:async()=>subscription(),subscribe},active:null}},
    async refresh(){await subscribe()},
    async writeContext(next){
      if(disposed||!next?.ownerId||next.ownerId!==expectedOwnerId||!next.deviceKey||typeof next.enabled!=='boolean')return false
      if(!next.enabled&&context&&(context.ownerId!==next.ownerId||context.deviceKey!==next.deviceKey))return false
      context={ownerId:next.ownerId,deviceKey:next.deviceKey,enabled:next.enabled};persistContext();return true
    },
    dispose(){disposed=true;pending?.reject(new Error('native-push-disposed'));for(const handle of handles)void handle.remove()},
  }
}
