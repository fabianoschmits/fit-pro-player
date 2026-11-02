import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider.jsx'
import { getBrowserSupabaseClient } from '../lib/supabase-client.js'
import { createCommunityModerationRepository, COMMUNITY_REASON_LABELS } from '../lib/community-moderation.js'
import { useDialogFocus } from '../lib/dialog-focus.js'
import './community-access.css'

const keyFor = userId => `fpp_community_access_v1:${userId}`
const activeAt = value => !!value && (!value.endsAt || Date.parse(value.endsAt) > Date.now())
function cachedRestriction(userId) {
 if (!userId) return null
 try {
  const value=JSON.parse(localStorage.getItem(keyFor(userId)) || 'null')
  if (!value || typeof value.id!=='string' || !/^[0-9a-f-]{36}$/i.test(value.id)
   || (value.endsAt!==null && !Number.isFinite(Date.parse(value.endsAt)))) return null
  return activeAt(value)?{id:value.id,endsAt:value.endsAt}:null
 } catch { return null }
}
function storeRestriction(userId, restriction) {
 try {
  if(restriction) localStorage.setItem(keyFor(userId),JSON.stringify({id:restriction.id,endsAt:restriction.ends_at || null}))
  else localStorage.removeItem(keyFor(userId))
 }catch{ /* Backend remains authoritative if this optional offline marker cannot be written. */ }
}
const AccessContext=createContext({blocked:false,checking:false,scopeId:null,refresh:()=>Promise.resolve()})
export const useCommunityAccess=()=>useContext(AccessContext)

export function CommunityAccessProvider({children=undefined}) {
 const auth=useAuth()
 const userId=auth.status==='authenticated'?auth.user?.id:null
 const repo=useMemo(()=>createCommunityModerationRepository(getBrowserSupabaseClient()),[])
 const [snapshot,setSnapshot]=useState({userId:null,restriction:null,marker:null,checked:false})
 const [clock,setClock]=useState(0)
 const scope=useRef(null)
 const refreshRef=useRef(null)
 const refreshCurrent=useCallback(()=>refreshRef.current?.() || Promise.resolve(),[])
 const matches=snapshot.userId===userId
 const marker=matches?snapshot.marker:cachedRestriction(userId)
 const restriction=matches?snapshot.restriction:null
 const blocked=!!userId && activeAt(marker)
 const checking=!!userId && navigator.onLine!==false && (!matches || !snapshot.checked)
 useEffect(()=>{
  if(!userId){setSnapshot({userId:null,restriction:null,marker:null,checked:true});return}
  const token={alive:true,inFlight:null,sequence:0};scope.current=token
  setSnapshot({userId,restriction:null,marker:cachedRestriction(userId),checked:false})
  const refresh=()=>{
   if(!token.alive || navigator.onLine===false)return Promise.resolve()
   if(token.inFlight)return token.inFlight
   const sequence=++token.sequence
   token.inFlight=repo.accessStatus().then(result=>{
    if(!token.alive || sequence!==token.sequence)return
    const row=result?.active || null
    storeRestriction(userId,row)
    setSnapshot({userId,restriction:row,marker:row?{id:row.id,endsAt:row.ends_at || null}:null,checked:true})
   }).catch(()=>{if(token.alive)setSnapshot(previous=>previous.userId===userId?{...previous,checked:true}:previous)})
    .finally(()=>{token.inFlight=null})
   return token.inFlight
  }
  refreshRef.current=refresh
  void refresh()
  const visible=()=>{if(document.visibilityState==='visible')void refresh()}
  const storage=event=>{if(event.key===keyFor(userId)){setSnapshot(previous=>previous.userId===userId?{...previous,marker:cachedRestriction(userId)}:previous);void refresh()}}
  window.addEventListener('online',refresh);window.addEventListener('focus',refresh);window.addEventListener('storage',storage)
  document.addEventListener('visibilitychange',visible)
  return ()=>{token.alive=false;if(scope.current===token)refreshRef.current=null;window.removeEventListener('online',refresh);window.removeEventListener('focus',refresh);window.removeEventListener('storage',storage);document.removeEventListener('visibilitychange',visible)}
 },[userId,repo])
 useEffect(()=>{
  if(!marker?.endsAt)return
  const remaining=Date.parse(marker.endsAt)-Date.now()
  if(remaining<=0)return
  const timeout=window.setTimeout(()=>setClock(value=>value+1),Math.min(remaining+30,2147483647))
  return ()=>window.clearTimeout(timeout)
 },[marker,clock])
 const acknowledge=useCallback(async()=>{
  if(!restriction || !userId)return
  const token=scope.current
  await repo.acknowledge(restriction.id)
  if(token?.alive && scope.current===token){
   token.sequence++
   setSnapshot(previous=>previous.userId===userId&&previous.restriction?.id===restriction.id
    ?{...previous,restriction:{...previous.restriction,acknowledged_at:new Date().toISOString()}}:previous)
  }
 },[restriction,userId,repo])
 return <AccessContext.Provider value={{blocked,checking,scopeId:userId,refresh:refreshCurrent}}>{children}{blocked&&restriction&&!restriction.acknowledged_at&&<RestrictionNotice key={`${userId}:${restriction.id}`} restriction={restriction} acknowledge={acknowledge}/>}</AccessContext.Provider>
}

export function CommunityAccessGate({children=undefined}) {
 const {blocked,checking,scopeId,refresh}=useCommunityAccess()
 const {pathname}=useLocation()
 const [entry,setEntry]=useState({pathname:null,scopeId:null})
 useEffect(()=>{let live=true;void refresh().finally(()=>{if(live)setEntry({pathname,scopeId})});return()=>{live=false}},[refresh,pathname,scopeId])
 if(blocked)return <Navigate to="/home" replace/>
 if(checking || entry.pathname!==pathname || entry.scopeId!==scopeId)return <p role="status">Verificando acesso à Comunidade…</p>
 return children
}
function RestrictionNotice({restriction,acknowledge}) {
 const dialog=useRef(null)
 const [busy,setBusy]=useState(false),[error,setError]=useState('')
 useDialogFocus(dialog,{locked:true,titleId:'community-restriction-title'})
 const accept=async()=>{if(busy)return;setBusy(true);setError('');try{await acknowledge()}catch{setError('Não foi possível confirmar. Verifique sua conexão e tente novamente.')}finally{setBusy(false)}}
 return <div className="community-restriction-overlay"><section ref={dialog} className="community-restriction-dialog" role="dialog" aria-modal="true" aria-labelledby="community-restriction-title">
  <h2 id="community-restriction-title">Seu acesso à Comunidade foi restringido</h2>
  <p><strong>Motivo:</strong> {COMMUNITY_REASON_LABELS[restriction.reason] || 'Violação das regras da Comunidade'}</p>
  {restriction.admin_message&&<p className="community-restriction-message">{restriction.admin_message}</p>}
  <p>{restriction.restriction_type==='permanent'?'Restrição permanente.':`Restrição temporária. Liberação em ${new Date(restriction.ends_at).toLocaleString('pt-BR')}.`}</p>
  <p>Treinos e as demais áreas do aplicativo continuam disponíveis.</p>
  {error&&<p role="alert">{error}</p>}
  <button type="button" className="btn" disabled={busy} onClick={accept}>{busy?'Confirmando…':'Entendi'}</button>
 </section></div>
}
