import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider.jsx'
import { useStore } from '../store/useStore.js'
import { getBrowserSupabaseClient } from '../lib/supabase-client.js'
import { createProfessionalWorkflowRepository } from '../lib/professional-workflow.js'
import { weeklyPlanToWorkspace, workspaceToWeeklyPlan } from '../lib/training-workspace.js'
import { validateWeeklyPlan } from '../lib/professional-program.js'
import { RoutineEditor } from './RoutineEdit.jsx'
import TrainingPlanWorkspace from '../components/training/TrainingPlanWorkspace.jsx'
import ManagementLayout from '../components/ManagementLayout.jsx'
import { Button, TextField } from '../components/ui.jsx'
import { confirmSheet } from '../sheets.jsx'
export default function ProfessionalStudentPlan() {
 const { studentId, routineId } = useParams(), { user } = useAuth()
 return <StudentPlan key={`${user?.id}:${studentId}`} studentId={studentId} routineId={routineId} />
}
function StudentPlan({ studentId, routineId }) {
 const nav = useNavigate(), prefs = useStore(s => s.S)
 const repo = useMemo(() => createProfessionalWorkflowRepository({ client: getBrowserSupabaseClient() }), [])
 const [loading, setLoading] = useState(true)
 const [draft, setDraft] = useState(null), [state, setState] = useState(null), [title, setTitle] = useState('Plano de treino'), [student, setStudent] = useState(null), [error, setError] = useState(''), [busy, setBusy] = useState(false), [dirty, setDirty] = useState(false), [templates, setTemplates] = useState(null)
 const alive = useRef(true), pending = useRef(false)
 const base = `/professional/students/${studentId}/plan`
 useEffect(() => { alive.current = true; Promise.all([repo.studentPlanDraft(studentId), repo.clientDetail(studentId)]).then(([value, person]) => { if (!alive.current) return; setLoading(false); setStudent(person); setDraft(value); if (value) { setTitle(value.title); setState(value.workspace) } }).catch(() => { if (alive.current) { setLoading(false); setError('Não foi possível carregar o plano.') } }); return () => { alive.current = false } }, [repo, studentId])
 const update = fn => { setState(old => { const next = structuredClone(old); fn(next); return next }); setDirty(true) }
 const save = async () => {
   if (pending.current) throw new Error('pending')
   pending.current = true; setBusy(true); setError('')
   try { const value = await repo.savePlanDraft(studentId, title, state, draft?.revision || 0); if (alive.current) { setDraft(value); setDirty(false) }; return value }
   catch (e) { if (alive.current) setError(e.code === '40001' ? 'O plano mudou em outro dispositivo. Reabra antes de salvar.' : 'Não foi possível salvar o rascunho.'); throw e }
   finally { pending.current = false; if (alive.current) setBusy(false) }
 }
 const send = () => {
   if (!validateWeeklyPlan(workspaceToWeeklyPlan(state).weeklyPlan).ok) { setError('Adicione exercícios e organize os dias antes de enviar.'); return }
   confirmSheet({ title: draft?.sent_revision ? `Atualizar plano enviado para ${student?.displayName || 'aluno'}?` : `Enviar plano para ${student?.displayName || 'aluno'}?`, message: `${state.routines.length} treinos · ${Object.keys(state.week).length} dias na semana. A nova versão será aplicada automaticamente nas próximas execuções e o aluno verá o que mudou.`, confirmText: draft?.sent_revision ? 'Enviar atualização' : 'Enviar plano', onConfirm: async () => {
     try { const saved = dirty || !draft ? await save() : draft; setBusy(true); await repo.sendPlan(studentId, saved.revision); if (alive.current) setDraft({ ...saved, sent_revision: saved.revision }); return true }
     catch { if (alive.current) setError('Não foi possível enviar o plano. Tente novamente.'); return false }
     finally { if (alive.current) setBusy(false) }
   } })
 }
 const create = workspace => { setState(workspace || weeklyPlanToWorkspace()); setDirty(true) }
 const chooseTemplate = async item => { try { const versions = await repo.versions(item.id); if (!alive.current) return; const version = versions[0]; create(weeklyPlanToWorkspace(version?.weekly_plan, version?.workout_titles)); setTitle(item.title); setTemplates(null) } catch { setError('Não foi possível abrir este modelo.') } }
 if (routineId && state) return <fieldset disabled={busy} style={{ display: 'contents' }}><RoutineEditor mode="professional" state={{ ...prefs, ...state, onboardingDone: true }} onUpdate={update} routineId={routineId} basePath={base} onSave={save} /></fieldset>
 return <ManagementLayout title="Plano de treino" subtitle={student?.displayName || 'Aluno'} backTo={`/professional/students/${studentId}`}>
   {error && <p role="alert">{error}</p>}
   {loading ? <p role="status">Carregando plano…</p> : !student ? <p>Aluno indisponível.</p> : !state ? <div className="card"><h2>Criar plano</h2><Button onClick={() => create()}>Criar do zero</Button><Button onAction={async () => { const page = await repo.programPage({ archived: false }); if (alive.current) setTemplates(page) }}>Usar um modelo</Button>{templates?.items.map(item => <Button key={item.id} onClick={() => chooseTemplate(item)}>{item.title}</Button>)}</div> : <>
     <TextField aria-label="Nome do plano" maxLength={160} value={title} onChange={e => { setTitle(e.target.value); setDirty(true) }} />
     <div className="card management-plan-status" data-pending={dirty || draft?.sent_revision !== draft?.revision} role="status"><strong>{dirty || draft?.sent_revision !== draft?.revision ? 'Alterações não enviadas' : 'Plano enviado ao aluno'}</strong>{draft && !dirty && <p>Rascunho salvo · {new Date(draft.updated_at).toLocaleString('pt-BR')}</p>}</div>
     <TrainingPlanWorkspace state={{ ...prefs, ...state }} onOpen={id => nav(`${base}/r/${id}`)} onAdd={() => { const id = crypto.randomUUID(); update(next => { next.routines.push({ id, name: `Treino ${String.fromCharCode(65 + next.routines.length)}`, ex: [] }) }); nav(`${base}/r/${id}`) }} />
     <div className="row management-plan-actions"><Button feedback="persistence" disabled={busy || !title.trim()} onAction={save}>Salvar para depois</Button><Button variant="primary" disabled={busy || !title.trim()} onClick={send}>{draft?.sent_revision ? 'Enviar atualização' : 'Enviar ao aluno'}</Button></div>
   </>}
 </ManagementLayout>
}
