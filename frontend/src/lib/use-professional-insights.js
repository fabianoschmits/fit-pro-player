import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth/AuthProvider.jsx'
import { getBrowserSupabaseClient } from './supabase-client.js'
import { createProfessionalInsightsRepository } from './professional-insights-repository.js'
import { applyInsightState, buildProfessionalInsights } from './professional-insights.js'
import useRelationshipRefresh from '../components/useRelationshipRefresh.js'
export function useProfessionalInsights({studentId=null,offset=0,limit=20}={}) {
 const {user}=useAuth(),owner=user?.id
 const repo=useMemo(()=>createProfessionalInsightsRepository(getBrowserSupabaseClient()),[])
 const [state,setState]=useState(null),[attempt,setAttempt]=useState(0),[online,setOnline]=useState(navigator.onLine!==false)
 const refresh=useCallback(()=>{setState(null);setAttempt(n=>n+1)},[])
 useRelationshipRefresh(refresh)
 useEffect(()=>{
  const changed=()=>{setOnline(navigator.onLine!==false);setState(null);if(navigator.onLine!==false)refresh()}
  const focus=()=>{setState(null);refresh()}
  window.addEventListener('online',changed);window.addEventListener('offline',changed);window.addEventListener('focus',focus)
  return()=>{window.removeEventListener('online',changed);window.removeEventListener('offline',changed);window.removeEventListener('focus',focus)}
 },[refresh])
 const key=owner+':'+studentId+':'+offset+':'+limit+':'+attempt
 useEffect(()=>{
  setState(null)
  if(!owner||!online)return undefined
  let alive=true
  repo.load({studentId,offset,limit}).then(data=>{if(alive)setState({key,data})}).catch(()=>{if(alive)setState({key,error:true})})
  return()=>{alive=false}
 },[key,owner,online,repo,studentId,offset,limit])
 const data=online&&state?.key===key?state.data:null,error=online&&state?.key===key&&state.error
 const alerts=useMemo(()=>data?.items.flatMap(item=>buildProfessionalInsights({...item,now:new Date(),timeZone:item.timeZone||'America/Sao_Paulo'}).map(alert=>({...applyInsightState(alert,item.states?.find(s=>s.type===alert.type)),student:item.student,workouts:item.workouts})))||[],[data])
 const save=async(alert,status,days=null)=>{await repo.save(alert,status,days);refresh()}
 return {data,alerts,error,online,refresh,save,loading:online&&!data&&!error}
}
