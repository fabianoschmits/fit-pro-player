import { appErrorMessage } from '../../lib/app-errors.js'
import {useEffect,useMemo,useRef,useState} from 'react'
import {createMessageRepository} from '../../lib/direct-messages.js'
export function UserBlockButton({client,userId,peerId}) {
 const repo=useMemo(()=>createMessageRepository(client),[client])
 const generation=useRef(null)
 const [reload,setReload]=useState(0)
 const [state,setState]=useState({repo:null,userId:null,peerId:null,blocked:null,busy:false,error:''})
 const matches=state.repo===repo && state.userId===userId && state.peerId===peerId
 const blocked=matches?state.blocked:null
 const busy=!matches || state.busy
 useEffect(()=>{
  const ticket={cancelled:false}
  generation.current=ticket
  const scope={repo,userId,peerId}
  setState({...scope,blocked:null,busy:true,error:''})
  if(userId && peerId && peerId!==userId) {
   void repo.hasBlock(peerId).then(value=>{
    if(generation.current===ticket&&!ticket.cancelled) setState({...scope,blocked:value===true,busy:false,error:''})
   }).catch(()=>{
    if(generation.current===ticket&&!ticket.cancelled) setState({...scope,blocked:null,busy:false,error:'Não foi possível carregar o bloqueio. Tente novamente.'})
   })
  }
  return ()=>{ticket.cancelled=true}
 },[repo,userId,peerId,reload])
 if(!userId || !peerId || peerId===userId)return null
 const act=async()=>{
  if(busy)return
  if(blocked===null){setReload(value=>value+1);return}
  const ticket=generation.current
  setState(previous=>({...previous,busy:true,error:''}))
  try{
   await (blocked?repo.unblock(peerId):repo.block(peerId))
   if(generation.current===ticket&&!ticket.cancelled)setState({repo,userId,peerId,blocked:!blocked,busy:false,error:''})
  }catch{
   if(generation.current===ticket&&!ticket.cancelled)setState(previous=>({...previous,busy:false,error:'Não foi possível atualizar o bloqueio. Tente novamente.'}))
  }
 }
 return <><button type="button" disabled={busy} aria-busy={busy} onClick={act}>{blocked===null?(matches&&state.error?'Tentar novamente':'…'):blocked?'Desbloquear':'Bloquear'}</button>{matches&&state.error&&<span role="alert">{state.error}</span>}</>
}
export function BlockedUsers({repo}) {
 const [rows,setRows]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false)
 const load=async()=>{if(busy)return;setBusy(true);setError('');try{const result=await repo.blocks();setRows(Array.isArray(result)?result:[])}catch (failure){setError(appErrorMessage(failure, 'Não foi possível carregar os bloqueados.'))}finally{setBusy(false)}}
 const unblock=async peer=>{if(busy)return;setBusy(true);try{await repo.unblock(peer);setRows(previous=>previous.filter(row=>row.blocked_id!==peer))}catch (failure){setError(appErrorMessage(failure, 'Não foi possível desbloquear o usuário.'))}finally{setBusy(false)}}
 return <div><button type="button" disabled={busy} onClick={()=>rows?setRows(null):void load()}>Usuários bloqueados</button>{rows&&<ul>{rows.map(row=><li key={row.blocked_id}><a href={`/#/community/user/${row.blocked_id}`}>{row.blocked_id}</a><button type="button" disabled={busy} onClick={()=>void unblock(row.blocked_id)}>Desbloquear</button></li>)}</ul>}{error&&<p role="alert">{error}</p>}</div>
}
