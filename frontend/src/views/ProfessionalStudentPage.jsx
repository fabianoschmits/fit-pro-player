import Link from '../components/ManagementLink.jsx'
import { useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { createProfessionalWorkflowRepository } from '../lib/professional-workflow.js'
import { getBrowserSupabaseClient } from '../lib/supabase-client.js'
import ManagementLayout from '../components/ManagementLayout.jsx'
import ProfessionalStudentIdentity from '../components/ProfessionalStudentIdentity.jsx'
import { ProfessionalSessionDetail } from '../components/ProfessionalPrescription.jsx'
import { Button, TextArea } from '../components/ui.jsx'
import { confirmSheet } from '../sheets.jsx'
import { professionalDate } from '../lib/professional-ux.js'
import { useAuth } from '../auth/AuthProvider.jsx'
export default function ProfessionalStudentPage() {
 const {studentId}=useParams(),{user}=useAuth()
 return <StudentProfile key={`${user?.id}:${studentId}`} studentId={studentId} professionalId={user?.id}/>
}
function StudentProfile({studentId,professionalId}) {
 const [params] = useSearchParams()
 const section = ['summary','training','history','notes','relationship'].includes(params.get('section')) ? params.get('section') : 'summary'
 const repo=useMemo(()=>createProfessionalWorkflowRepository({client:getBrowserSupabaseClient()}),[])
 const [data,setData]=useState(null),[note,setNote]=useState(''),[error,setError]=useState(''),[reload,setReload]=useState(0),[history,setHistory]=useState(null)
 useEffect(()=>{let alive=true;Promise.all([repo.clientDetail(studentId),repo.studentNote(studentId),repo.studentPlanDraft(studentId)]).then(([detail,note,draft])=>{if(alive){setData({...detail,draft});setNote(note.body);setError('')}}).catch(()=>{if(alive)setError('Não foi possível carregar este aluno.')});return()=>{alive=false}},[repo,studentId,reload])
 const plan=data?.assignments?.find(item=>item.status==='active')
 return <ManagementLayout title="Perfil do aluno" backTo="/professional/students">
 {error&&<p role="alert">{error}<Button onClick={()=>setReload(x=>x+1)}>Tentar novamente</Button></p>}
 {data&&<><ProfessionalStudentIdentity data={data}/>
 <nav className="management-section-nav" aria-label="Seções do aluno">{[['summary','Resumo'],['training','Plano'],['history','Histórico'],['notes','Anotações'],['relationship','Vínculo']].map(([value,label])=><Link key={value} to={`?section=${value}`} aria-current={section===value?'page':undefined}>{label}</Link>)}</nav>
 <section className="card" hidden={!['summary','training'].includes(section)}><h2>Plano atual</h2><h3>{data.draft?.title || plan?.program_title || 'Nenhum plano criado'}</h3><p>{data.draft && data.draft.revision!==data.draft.sent_revision ? 'Alterações não enviadas' : plan ? `Plano enviado em ${professionalDate(plan.created_at)}` : 'Crie o primeiro plano para este aluno.'}</p><Link className="management-button management-button-primary" to={`/professional/students/${studentId}/plan`}>{data.draft || plan ? 'Gerenciar plano' : `Criar plano para ${data.displayName || 'aluno'}`}</Link></section>
 <section className="card" hidden={!['summary','history'].includes(section)}><h2>Atividade recente</h2>{data.executions?.slice(0,3).map(item=><p key={item.id}>{professionalDate(item.started_at)} · {item.status==='completed'?'Treino concluído':item.status==='abandoned'?'Treino interrompido':'Treino iniciado'}</p>)}<Button onAction={async()=>setHistory(await repo.executionPage({studentId}))}>Histórico</Button>{history?.items.map(item=><details key={item.id}><summary>{professionalDate(item.startedAt)}</summary><ProfessionalSessionDetail execution={{...item,prescription_snapshot:item.prescriptionSnapshot}}/></details>)}{history?.hasMore&&<Button onAction={async()=>{const next=await repo.executionPage({studentId,offset:history.items.length});setHistory({...next,items:[...history.items,...next.items]})}}>Carregar mais</Button>}</section>
 <details className="card" hidden={section!=='notes'} open={section==='notes'}><summary>Anotações privadas</summary><TextArea aria-label="Anotações privadas" maxLength={2000} value={note} onChange={e=>setNote(e.target.value)}/><Button onAction={()=>repo.saveStudentNote({studentId,body:note})} onError={()=>setError('Não foi possível salvar a anotação.')}>Salvar anotação</Button></details>
 <section className="card" hidden={section!=='relationship'}><h2>Vínculo</h2><p>Aluno vinculado à sua conta.</p><Button onClick={()=>confirmSheet({title:'Encerrar vínculo?',message:'O histórico do aluno será preservado.',confirmText:'Encerrar vínculo',danger:true,onConfirm:async()=>{const relations=await repo.relationships(studentId);const relation=relations.find(r=>r.student_user_id===studentId&&r.professional_user_id===professionalId&&r.status==='active');if(!relation)return false;await repo.revokeRelationship(relation.id);setReload(x=>x+1);return true}})}>Encerrar vínculo</Button></section>
 </>}
 </ManagementLayout>
}
