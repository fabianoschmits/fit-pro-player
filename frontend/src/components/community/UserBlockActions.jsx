import {useMemo,useState} from 'react'
import {createMessageRepository} from '../../lib/direct-messages.js'
export function UserBlockButton({client,userId,peerId}) {
 const repo=useMemo(()=>createMessageRepository(client),[client])
 const [blocked,setBlocked]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('')
 if(!userId || peerId===userId)return null
 const act=async()=>{
  if(busy)return
  setBusy(true);setError('')
  try{await (blocked?repo.unblock(peerId):repo.block(peerId));setBlocked(!blocked)}
  catch{setError('Não foi possível atualizar o bloqueio. Tente novamente.')}
  finally{setBusy(false)}
 }
 return <><button type="button" disabled={busy} onClick={act}>{blocked?'Desbloquear':'Bloquear'}</button>{error&&<span role="alert">{error}</span>}</>
}
export function BlockedUsers({repo}) {
 const [rows,setRows]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false)
 const load=async()=>{if(busy)return;setBusy(true);setError('');try{const result=await repo.blocks();setRows(Array.isArray(result)?result:[])}catch{setError('Não foi possível carregar os bloqueados.')}finally{setBusy(false)}}
 const unblock=async peer=>{if(busy)return;setBusy(true);try{await repo.unblock(peer);setRows(previous=>previous.filter(row=>row.blocked_id!==peer))}catch{setError('Não foi possível desbloquear o usuário.')}finally{setBusy(false)}}
 return <div><button type="button" disabled={busy} onClick={()=>rows?setRows(null):void load()}>Usuários bloqueados</button>{rows&&<ul>{rows.map(row=><li key={row.blocked_id}><a href={`/#/community/user/${row.blocked_id}`}>{row.blocked_id}</a><button type="button" disabled={busy} onClick={()=>void unblock(row.blocked_id)}>Desbloquear</button></li>)}</ul>}{error&&<p role="alert">{error}</p>}</div>
}
