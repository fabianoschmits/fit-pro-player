import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider.jsx'
import { getBrowserSupabaseClient } from '../lib/supabase-client.js'
import { createProfessionalWorkflowRepository } from '../lib/professional-workflow.js'
import { PROFESSIONAL_EXERCISES } from '../lib/exercises.js'
import { Button, Section, TextArea, TextField } from '../components/ui.jsx'
import AppHeader from '../components/AppHeader.jsx'
import ProfessionalWorkspaceNav from '../components/ProfessionalWorkspaceNav.jsx'
import ProfessionalProgramEditor from '../components/ProfessionalProgramEditor.jsx'

export default function ProfessionalPrograms() {
  const auth = useAuth(); const navigate = useNavigate(); const repo = useMemo(() => createProfessionalWorkflowRepository({ client: getBrowserSupabaseClient() }), [])
  const [programs, setPrograms] = useState([]); const [versions, setVersions] = useState({}); const [editor, setEditor] = useState(null); const [form, setForm] = useState({ title: '', description: '' }); const [busy, setBusy] = useState(true); const [error, setError] = useState(''); const [message, setMessage] = useState('')
  const refresh = async () => { setBusy(true); try { const nextPrograms = await repo.programs(); const pairs = await Promise.all(nextPrograms.map(async program => [program.id, await repo.versions(program.id)])); setPrograms(nextPrograms); setVersions(Object.fromEntries(pairs)) } catch { setError('Não foi possível carregar os programas.') } finally { setBusy(false) } }
  useEffect(() => { if (auth.user?.id) refresh() }, [auth.user?.id])
  const create = async () => { if (!form.title.trim()) return; try { await repo.createProgram(auth.user.id, form.title, form.description); setForm({ title: '', description: '' }); setMessage('Programa criado.'); await refresh() } catch { setError('Não foi possível criar o programa.') } }
  const publish = async (programId, plan) => { try { await repo.publishProgramVersion(programId, plan); setEditor(null); setMessage('Nova versão publicada.'); await refresh() } catch { setError('Não foi possível publicar a versão. Revise os exercícios.') } }
  return <div className="narrow professional-page"><AppHeader title="Programas" subtitle="Prescrições e versões reutilizáveis" backTo="/professional" /><ProfessionalWorkspaceNav />{error && <p role="alert" className="error">{error}</p>}{message && <p role="status">{message}</p>}{busy ? <p role="status">Carregando programas…</p> : editor ? <ProfessionalProgramEditor exercises={PROFESSIONAL_EXERCISES} initialPlan={editor.initialPlan} onCancel={() => setEditor(null)} onPublish={plan => publish(editor.program.id, plan)} /> : <>
    <Section title="Novo programa"><TextField aria-label="Nome do programa" placeholder="Nome do programa" value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} /><TextArea aria-label="Descrição do programa" placeholder="Descrição opcional" value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} /><Button variant="primary" onClick={create}>Criar programa</Button></Section>
    <Section title={`Programas (${programs.length})`}>{programs.length ? <div className="professional-program-list">{programs.map(program => { const list = versions[program.id] || []; const latest = list[0]; return <article className="card professional-program-card" key={program.id}><div><strong>{program.title}</strong><small className="muted">{program.description || 'Sem descrição'}</small></div><div className="row between"><span className="muted small">{list.length ? `Versão ${latest.version_number} · ${list.length} versão(ões)` : 'Sem versão publicada'}</span><div className="row-actions"><Button onClick={() => setEditor({ program, initialPlan: latest?.weekly_plan || {} })}>{latest ? 'Criar nova versão' : 'Editar programa'}</Button>{latest && <Button onClick={() => navigate('/professional/students')}>Enviar para aluno</Button>}</div></div></article> })}</div> : <p className="muted">Crie seu primeiro programa semanal.</p>}</Section>
  </>}</div>
}
