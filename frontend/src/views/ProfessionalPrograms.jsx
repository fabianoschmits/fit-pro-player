import Icon from '../components/Icon.jsx'
import Link from '../components/ManagementLink.jsx'
import RoutineMuscleThumb from '../components/RoutineMuscleThumb.jsx'
import { ProfessionalPrescription } from '../components/ProfessionalPrescription.jsx'
import { confirmSheet } from '../sheets.jsx'
import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams, Navigate } from 'react-router-dom'
import { createProfessionalWorkflowRepository, programMuscleRoutine } from '../lib/professional-workflow.js'
import { getBrowserSupabaseClient } from '../lib/supabase-client.js'
import { useStore } from '../store/useStore.js'
import ManagementLayout from '../components/ManagementLayout.jsx'
import ProfessionalProgramEditor from '../components/ProfessionalProgramEditor.jsx'
import { Button, TextField } from '../components/ui.jsx'
export default function ProfessionalPrograms() {
 const location=useLocation(),{programId}=useParams()
 if(location.pathname.startsWith('/professional/programs')) return <Navigate replace to={location.pathname.replace('/professional/programs','/professional/templates')+location.search}/>
 return <Templates key={location.pathname} programId={programId} creating={location.pathname.endsWith('/new')}/>
}
function Templates({programId,creating}) {
 const repo=useMemo(()=>createProfessionalWorkflowRepository({client:getBrowserSupabaseClient()}),[]),nav=useNavigate()
 const body=useStore(s=>s.S.body)
 const [history,setHistory]=useState([])
 const [page,setPage]=useState({items:[]}),[query,setQuery]=useState(''),[offset,setOffset]=useState(0),[program,setProgram]=useState(null),[version,setVersion]=useState(null),[title,setTitle]=useState(''),[error,setError]=useState(''),[loaded,setLoaded]=useState(false)
 useEffect(()=>{let alive=true;const load=async()=>{try{if(programId){const [item,versions]=await Promise.all([repo.program(programId),repo.versions(programId)]);if(alive){setProgram(item);setVersion(versions[0]);setHistory(versions)}}else if(!creating){const next=await repo.programPage({search:query,offset});if(alive)setPage(old=>({...next,items:offset?[...old.items,...next.items]:next.items}))}if(alive)setLoaded(true)}catch{if(alive)setError('Não foi possível carregar os modelos.')}};const timer=setTimeout(load,150);return()=>{alive=false;clearTimeout(timer)}},[repo,programId,creating,query,offset])
 return <ManagementLayout title={program?.title || 'Modelos'} backTo="/professional" action={!programId&&!creating&&<Link className="management-button" to="/professional/templates/new">Novo modelo</Link>}>
 {error&&<p role="alert">{error}</p>}
 {creating?<div className="card"><TextField aria-label="Nome do modelo" value={title} maxLength={160} onChange={e=>setTitle(e.target.value)}/><Button disabled={!title.trim()} onAction={async()=>{const item=await repo.createProgram(null,title);nav(`/professional/templates/${item.id}`)}}>Criar modelo</Button></div>:program?<><details className="card"><summary>Histórico e opções do modelo</summary>
 <Button onAction={async()=>{const result=await repo.duplicateProgram({programId,title:`${program.title} · cópia`});nav(`/professional/templates/${result.program.id}`)}}>Duplicar modelo</Button>
 <Button onClick={()=>confirmSheet({title:program.archived?'Restaurar modelo?':'Arquivar modelo?',message:'Os planos criados como cópias para alunos continuarão independentes.',confirmText:program.archived?'Restaurar':'Arquivar',onConfirm:async()=>{await repo.updateProgram(programId,{title:program.title,description:program.description || '',archived:!program.archived});nav('/professional/templates');return true}})}>{program.archived?'Restaurar modelo':'Arquivar modelo'}</Button>
 {history.map(item=><details key={item.id}><summary>Salvo em {new Date(item.published_at || item.created_at).toLocaleDateString('pt-BR')}</summary><ProfessionalPrescription plan={item.weekly_plan}/></details>)}
 </details>{!program.archived&&<ProfessionalProgramEditor initialPlan={version?.weekly_plan} initialMetadata={{title:program.title,description:program.description || '',workoutTitles:version?.workout_titles || {}}} onCancel={()=>nav('/professional/templates')} onPublish={async(weeklyPlan,metadata,workoutTitles)=>{await repo.updateProgramMetadata({programId,title:metadata.title,description:metadata.description});await repo.publishProgramDraft({programId,weeklyPlan,workoutTitles});return programId}} onPublished={()=>nav('/professional/templates')}/>}</>:programId?loaded?<p>Modelo não encontrado.</p>:<p>Carregando…</p>:<><TextField aria-label="Buscar modelo" placeholder="Buscar modelo" value={query} onChange={e=>{setQuery(e.target.value);setOffset(0)}}/>{page.items.map(item=>{const routine=programMuscleRoutine(item);return <Link className="management-record card" key={item.id} to={`/professional/templates/${item.id}`}><span className="management-template-icon">{routine.ex.length?<RoutineMuscleThumb routine={routine} body={body}/>:<Icon name="clipboard" />}</span><div><strong>{item.title}</strong><p>{item.workoutCount} treinos</p></div><span>›</span></Link>})}{page.hasMore&&<Button onClick={()=>setOffset(page.items.length)}>Carregar mais</Button>}</>}
 </ManagementLayout>
}
