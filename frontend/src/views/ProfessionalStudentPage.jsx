import Link from '../components/ManagementLink.jsx'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { createProfessionalWorkflowRepository } from '../lib/professional-workflow.js'
import { getBrowserSupabaseClient } from '../lib/supabase-client.js'
import ManagementLayout from '../components/ManagementLayout.jsx'
import ProfessionalStudentIdentity from '../components/ProfessionalStudentIdentity.jsx'
import { ProfessionalSessionDetail, professionalDayLabel } from '../components/ProfessionalPrescription.jsx'
import { Button, TextArea } from '../components/ui.jsx'
import { confirmSheet } from '../sheets.jsx'
import { professionalDate } from '../lib/professional-ux.js'
import { useAuth } from '../auth/AuthProvider.jsx'
import useManagementNavVisibility from '../components/useManagementNavVisibility.js'
import { professionalExecutionExercises } from '../lib/professional-execution-display.js'
export default function ProfessionalStudentPage() {
 const {studentId}=useParams(),{user}=useAuth()
 return <StudentProfile key={`${user?.id}:${studentId}`} studentId={studentId} professionalId={user?.id}/>
}
function StudentProfile({studentId,professionalId}) {
 const [params] = useSearchParams()
 const section = ['summary','training','history','notes','relationship'].includes(params.get('section')) ? params.get('section') : 'summary'
 const repo=useMemo(()=>createProfessionalWorkflowRepository({client:getBrowserSupabaseClient()}),[])
 const [data,setData]=useState(null),[error,setError]=useState(''),[reload,setReload]=useState(0)
 const [notes,setNotes]=useState([]),[noteDraft,setNoteDraft]=useState(''),[noteLoading,setNoteLoading]=useState(true),[noteSaving,setNoteSaving]=useState(false),[noteError,setNoteError]=useState(''),[noteRetry,setNoteRetry]=useState(0)
 const [historyPage,setHistoryPage]=useState({items:[],total:0,offset:0,hasMore:false}),[historyLoading,setHistoryLoading]=useState(true),[historyLoadingMore,setHistoryLoadingMore]=useState(false),[historyError,setHistoryError]=useState(''),[historyRetry,setHistoryRetry]=useState(0)
 const noteSubmitting=useRef(false)
 const sectionNavRef = useManagementNavVisibility(data)
 useEffect(()=>{let alive=true;Promise.all([repo.clientDetail(studentId),repo.studentPlanDraft(studentId)]).then(([detail,draft])=>{if(alive){setData({...detail,draft});setError('')}}).catch(()=>{if(alive)setError('Não foi possível carregar este aluno.')});return()=>{alive=false}},[repo,studentId,reload])
 useEffect(()=>{let alive=true;setNoteLoading(true);setNoteError('');repo.studentNotes(studentId).then(value=>{if(alive)setNotes(value)}).catch(()=>{if(alive)setNoteError('Não foi possível carregar as anotações privadas.')}).finally(()=>{if(alive)setNoteLoading(false)});return()=>{alive=false}},[repo,studentId,noteRetry])
 useEffect(()=>{let alive=true;setHistoryLoading(true);setHistoryError('');repo.executionPage({studentId}).then(page=>{if(alive)setHistoryPage(page)}).catch(()=>{if(alive)setHistoryError('Não foi possível carregar o histórico de treinos.')}).finally(()=>{if(alive)setHistoryLoading(false)});return()=>{alive=false}},[repo,studentId,historyRetry])
 const loadMoreHistory=async()=>{if(historyLoadingMore||!historyPage.hasMore)return;setHistoryLoadingMore(true);setHistoryError('');try{const next=await repo.executionPage({studentId,offset:historyPage.items.length});setHistoryPage(current=>({...next,items:[...current.items,...next.items]}))}catch{setHistoryError('Não foi possível carregar o histórico de treinos.')}finally{setHistoryLoadingMore(false)}}
 const addNote=async()=>{if(noteSubmitting.current||!noteDraft.trim())return;noteSubmitting.current=true;setNoteSaving(true);setNoteError('');try{const saved=await repo.addStudentNote({studentId,body:noteDraft});setNotes(current=>[saved,...current]);setNoteDraft('')}catch{setNoteError('Não foi possível salvar a anotação.')}finally{noteSubmitting.current=false;setNoteSaving(false)}}
 const plan=data?.assignments?.find(item=>item.status==='active')
 return <ManagementLayout title="Perfil do aluno" backTo="/professional/students">
 {error&&<p role="alert">{error}<Button onClick={()=>setReload(x=>x+1)}>Tentar novamente</Button></p>}
 {data&&<><ProfessionalStudentIdentity data={data}/>
 <nav ref={sectionNavRef} className="management-section-nav" aria-label="Seções do aluno">{[['summary','Resumo'],['training','Plano'],['history','Histórico'],['notes','Anotações'],['relationship','Vínculo']].map(([value,label])=><Link key={value} to={`?section=${value}`} aria-current={section===value?'page':undefined}>{label}</Link>)}</nav>
 <section className="card" hidden={!['summary','training'].includes(section)}><h2>Plano atual</h2><h3>{data.draft?.title || plan?.program_title || 'Nenhum plano criado'}</h3><p>{data.draft && data.draft.revision!==data.draft.sent_revision ? 'Alterações não enviadas' : plan ? `Plano enviado em ${professionalDate(plan.created_at)}` : 'Crie o primeiro plano para este aluno.'}</p><Link className="management-button management-button-primary" to={`/professional/students/${studentId}/plan`}>{data.draft || plan ? 'Gerenciar plano' : `Criar plano para ${data.displayName || 'aluno'}`}</Link></section>
 <section className="card professional-execution-history" hidden={!['summary','history'].includes(section)}><h2>Histórico de treinos</h2>
 {historyLoading&&<p role="status">Carregando histórico de treinos…</p>}
 {historyError&&<p role="alert">{historyError}<Button aria-label={historyPage.items.length?'Tentar carregar mais treinos':'Tentar carregar histórico'} onAction={historyPage.items.length?loadMoreHistory:()=>setHistoryRetry(value=>value+1)}>Tentar novamente</Button></p>}
 {!historyLoading&&!historyError&&!historyPage.items.length&&<p>Nenhum treino registrado.</p>}
 {historyPage.items.map(item=>{const payload=item.payload||{},snapshot=item.prescriptionSnapshot||{},exercises=professionalExecutionExercises(item),title=payload.workoutName||payload.workoutTitle||snapshot.workoutTitle||professionalDayLabel(item.dayKey),status=item.status==='completed'?'Concluído':item.status==='abandoned'?'Interrompido':'Em andamento';return <details className="professional-execution-card" key={item.id}><summary><span className="professional-execution-card-date">{professionalDate(item.startedAt)}<span className={`professional-execution-status is-${item.status}`}>{status}</span></span><strong>{title}</strong><span className="professional-execution-card-exercises">{exercises.length?exercises.join(' · '):'Exercícios não informados'}</span></summary><ProfessionalSessionDetail execution={{...item,prescription_snapshot:item.prescriptionSnapshot}}/></details>})}
 {historyPage.hasMore&&!historyError&&<Button aria-label="Carregar mais treinos" disabled={historyLoadingMore} onAction={loadMoreHistory}>{historyLoadingMore?'Carregando…':'Carregar mais treinos'}</Button>}
 </section>
 <section className="card professional-private-notes" hidden={section!=='notes'}><h2>Anotações privadas</h2>
 {noteError&&<p role="alert">{noteError}<Button aria-label="Tentar carregar anotações" onClick={()=>setNoteRetry(value=>value+1)}>Tentar novamente</Button></p>}
 {noteLoading&&<p role="status">Carregando anotações…</p>}
 <TextArea aria-label="Nova anotação privada" maxLength={2000} value={noteDraft} onChange={e=>setNoteDraft(e.target.value)}/>
 <Button aria-label="Enviar anotação privada" disabled={noteSaving||!noteDraft.trim()} onAction={addNote}>{noteSaving?'Enviando…':'Enviar anotação privada'}</Button>
 <div className="professional-private-note-list">{notes.map(item=><article className="professional-private-note" key={item.id}><p>{item.body}</p><time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'})}</time></article>)}</div>
 </section>
 <section className="card" hidden={section!=='relationship'}><h2>Vínculo</h2><p>Aluno vinculado à sua conta.</p><Button onClick={()=>confirmSheet({title:'Encerrar vínculo?',message:'O histórico do aluno será preservado.',confirmText:'Encerrar vínculo',danger:true,onConfirm:async()=>{const relations=await repo.relationships(studentId);const relation=relations.find(r=>r.student_user_id===studentId&&r.professional_user_id===professionalId&&r.status==='active');if(!relation)return false;await repo.revokeRelationship(relation.id);setReload(x=>x+1);return true}})}>Encerrar vínculo</Button></section>
 </>}
 </ManagementLayout>
}
