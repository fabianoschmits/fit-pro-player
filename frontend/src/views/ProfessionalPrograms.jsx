import { appErrorMessage } from '../lib/app-errors.js'
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
import { ActionGroup, Button, TextField } from '../components/ui.jsx'
import { ManagementPanel } from '../components/ManagementUI.jsx'
export default function ProfessionalPrograms() {
 const location=useLocation(),{programId}=useParams()
 if(location.pathname.startsWith('/professional/programs')) return <Navigate replace to={location.pathname.replace('/professional/programs','/professional/templates')+location.search}/>
 return <Templates key={location.pathname} programId={programId} creating={location.pathname.endsWith('/new')}/>
}
function Templates({programId,creating}) {
 const repo=useMemo(()=>createProfessionalWorkflowRepository({client:getBrowserSupabaseClient()}),[]),nav=useNavigate()
 const body=useStore(s=>s.S.body)
 const [history,setHistory]=useState([])
 const [page,setPage]=useState({items:[],hasMore:false}),[query,setQuery]=useState(''),[offset,setOffset]=useState(0),[program,setProgram]=useState(null),[version,setVersion]=useState(null),[title,setTitle]=useState(''),[error,setError]=useState(''),[loaded,setLoaded]=useState(false),[deleteError,setDeleteError]=useState(''),[deleteBlocked,setDeleteBlocked]=useState(false)
 const archiveProgram=()=>confirmSheet({title:program.archived?'Restaurar modelo?':'Arquivar modelo?',message:'Os planos criados como cópias para alunos continuarão independentes.',confirmText:program.archived?'Restaurar':'Arquivar',onConfirm:async()=>{await repo.updateProgram(programId,{title:program.title,description:program.description || '',archived:!program.archived});nav('/professional/templates');return true}})
 const requestDelete=()=>confirmSheet({title:'Excluir modelo permanentemente?',message:'Esta ação não pode ser desfeita. Modelos atribuídos ou com histórico serão preservados e poderão ser arquivados.',confirmText:'Excluir modelo',danger:true,onConfirm:async()=>{try{await repo.deleteProgram(programId);nav('/professional/templates')}catch(cause){const blocked=cause?.message==='professional-program-in-use';setDeleteBlocked(blocked);setDeleteError(blocked?(program.archived?'Este modelo já está arquivado; o histórico permanece preservado.':'Este modelo já foi usado por um aluno e precisa ser arquivado para preservar o histórico.'):appErrorMessage(cause, 'Não foi possível excluir o modelo. Tente novamente.'))}return true}})
 useEffect(()=>{let alive=true;const load=async()=>{try{if(programId){const [item,versions]=await Promise.all([repo.program(programId),repo.versions(programId)]);if(alive){setProgram(item);setVersion(versions[0]);setHistory(versions)}}else if(!creating){const next=await repo.programPage({search:query,offset});if(alive)setPage(old=>({...next,items:offset?[...old.items,...next.items]:next.items}))}if(alive)setLoaded(true)}catch (failure){if(alive)setError(appErrorMessage(failure, 'Não foi possível carregar os modelos.'))}};const timer=setTimeout(load,150);return()=>{alive=false;clearTimeout(timer)}},[repo,programId,creating,query,offset])
 return <ManagementLayout title={program?.title || 'Modelos'} backTo="/professional" action={!programId&&!creating&&<Link className="management-button" to="/professional/templates/new">Novo modelo</Link>}>
 {error&&<p role="alert" className="fpp-inline-notice" data-tone="error">{error}</p>}
 {creating?<ManagementPanel title="Novo modelo" description="Monte um modelo reutilizável para os seus alunos." className="fpp-panel-flow"><label className="fpp-form-field" htmlFor="professional-model-title"><span>Nome do modelo</span><TextField id="professional-model-title" value={title} maxLength={160} onChange={e=>setTitle(e.target.value)}/></label><ActionGroup><Button variant="primary" disabled={!title.trim()} onAction={async()=>{const item=await repo.createProgram(null,title);nav(`/professional/templates/${item.id}`)}}>Criar modelo</Button></ActionGroup></ManagementPanel>:program?<>{deleteError&&<div className="management-delete-warning" role="alert"><p>{deleteError}</p>{deleteBlocked&&!program.archived&&<Button onAction={archiveProgram}>Arquivar modelo</Button>}</div>}<details className="card fpp-details-flow fpp-screen-model-options"><summary>Histórico e opções do modelo</summary>
 <div className="fpp-details-body"><ActionGroup>
 <Button onAction={async()=>{const result=await repo.duplicateProgram({programId,title:`${program.title} · cópia`});nav(`/professional/templates/${result.program.id}`)}}>Duplicar modelo</Button>
 <Button onClick={archiveProgram}>{program.archived?'Restaurar modelo':'Arquivar modelo'}</Button>
 <Button variant="danger" onClick={requestDelete}>Excluir modelo</Button>
 </ActionGroup><div className="fpp-history-list">{history.map(item=><details key={item.id}><summary>Salvo em {new Date(item.published_at || item.created_at).toLocaleDateString('pt-BR')}</summary><ProfessionalPrescription plan={item.weekly_plan}/></details>)}</div></div>
 </details>{!program.archived&&<ProfessionalProgramEditor initialPlan={version?.weekly_plan} initialMetadata={{title:program.title,description:program.description || '',workoutTitles:version?.workout_titles || {}}} onCancel={()=>nav('/professional/templates')} onPublish={async(weeklyPlan,metadata,workoutTitles)=>{await repo.updateProgramMetadata({programId,title:metadata.title,description:metadata.description});await repo.publishProgramDraft({programId,weeklyPlan,workoutTitles});return programId}} onPublished={()=>nav('/professional/templates')}/>}</>:programId?loaded?<p>Modelo não encontrado.</p>:<p>Carregando…</p>:<><TextField aria-label="Buscar modelo" placeholder="Buscar modelo" value={query} onChange={e=>{setQuery(e.target.value);setOffset(0)}}/>{page.items.map(item=>{const routine=programMuscleRoutine(item);return <Link className="management-record card" key={item.id} to={`/professional/templates/${item.id}`}><span className="management-template-icon">{routine.ex.length?<RoutineMuscleThumb routine={routine} body={body}/>:<Icon name="clipboard" />}</span><div><strong>{item.title}</strong><p>{item.workoutCount} treinos</p></div><span>›</span></Link>})}{page.hasMore&&<Button onClick={()=>setOffset(page.items.length)}>Carregar mais</Button>}</>}
 </ManagementLayout>
}
