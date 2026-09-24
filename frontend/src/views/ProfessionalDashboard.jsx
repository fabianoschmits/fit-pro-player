import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth/AuthProvider.jsx'
import { getBrowserSupabaseClient } from '../lib/supabase-client.js'
import { createProfessionalWorkflowRepository } from '../lib/professional-workflow.js'
import { Button, Section, TextField, TextArea } from '../components/ui.jsx'
import AppHeader from '../components/AppHeader.jsx'

export default function ProfessionalDashboard() {
  const auth = useAuth()
  const repo = useMemo(() => createProfessionalWorkflowRepository({ client: getBrowserSupabaseClient() }), [])
  const [data, setData] = useState({ relations: [], invites: [], programs: [], versions: {}, assignments: [], executions: [] })
  const [form, setForm] = useState({ title: '', description: '' })
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const [professional, setProfessional] = useState(false)
  const refresh = async () => {
    setBusy(true); setError('')
    try { const [relations, invites, programs, assignments, executions] = await Promise.all([repo.relationships(auth.user.id), repo.invites(), repo.programs(), repo.assignments(), repo.executions()]); const versionPairs = await Promise.all(programs.map(async program => [program.id, await repo.versions(program.id)])); setData({ relations, invites, programs, versions: Object.fromEntries(versionPairs), assignments, executions }) }
    catch { setError('Não foi possível carregar a área profissional.') } finally { setBusy(false) }
  }
  useEffect(() => { if (auth.user?.id) repo.professionalRole(auth.user.id).then(role => { setProfessional(role); if (role) refresh() }).catch(() => setProfessional(false)) }, [auth.user?.id])
  const createProgram = async () => { if (!form.title.trim()) return; try { await repo.createProgram(auth.user.id, form.title, form.description); setForm({ title: '', description: '' }); refresh() } catch { setError('Não foi possível criar o programa.') } }
  const createInvite = async kind => { try { await repo.createInvite(kind); refresh() } catch { setError('Não foi possível gerar o convite.') } }
  const publish = async program => { try { await repo.publishVersion(program.id, { monday: [{ exerciseId: '1254', sets: 3, reps: 8, rest: 90, notes: '' }] }); refresh() } catch { setError('Não foi possível publicar a versão.') } }
  const assign = async (program, version) => { const student = data.relations.find(item => item.status === 'active')?.student_user_id; if (!student) { setError('Vincule um aluno antes de atribuir o programa.'); return } try { await repo.assign({ programId: program.id, versionId: version.id, professionalUserId: auth.user.id, studentUserId: student }); refresh() } catch { setError('Não foi possível atribuir o programa.') } }
  if (auth.status !== 'authenticated' || !professional) return <div className="narrow"><Section><p>Esta área está disponível apenas para contas profissionais.</p></Section></div>
  return <div className="narrow professional-dashboard"><AppHeader title="Área profissional" subtitle="Alunos, convites e programas" />
    {error && <p role="alert" className="error">{error}</p>}
    {busy ? <p role="status">Carregando…</p> : <>
      <Section title="Convites"><p className="muted small">Gere um código e compartilhe com o aluno. O vínculo só é criado após aceite.</p><div className="row-actions"><Button onClick={() => createInvite('code')}>Gerar código</Button><Button onClick={() => createInvite('link')}>Gerar link</Button></div>{data.invites.map(item => <div className="card" key={item.id}><strong>{item.code}</strong><span className="muted small">{item.kind === 'link' ? `${location.origin}/#/connect?code=${item.code}` : 'Código de convite'}</span></div>)}</Section>
      <Section title={`Meus alunos (${data.relations.filter(r => r.status === 'active').length})`}>{data.relations.filter(r => r.status === 'active').map(r => <div className="card" key={r.id}><strong>{r.student_user_id}</strong><Button onClick={() => repo.revokeRelationship(r.id).then(refresh)}>Desvincular</Button></div>)}{!data.relations.length && <p className="muted">Nenhum aluno vinculado ainda.</p>}</Section>
      <Section title="Novo programa"><TextField placeholder="Nome do programa" aria-label="Nome do programa" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /><TextArea placeholder="Descrição opcional" aria-label="Descrição do programa" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /><Button onClick={createProgram}>Criar programa</Button></Section>
      <Section title={`Programas (${data.programs.length})`}>{data.programs.map(p => { const versions = data.versions[p.id] || []; const latest = versions[0]; return <div className="card" key={p.id}><strong>{p.title}</strong><span className="muted small">{p.description || 'Sem descrição'} · {versions.length} versão(ões)</span><div className="row-actions"><Button onClick={() => publish(p)}>Publicar nova versão</Button>{latest && <Button onClick={() => assign(p, latest)}>Atribuir v{latest.version_number}</Button>}</div></div> })}{!data.programs.length && <p className="muted">Crie seu primeiro programa semanal.</p>}</Section>
      <Section title="Execuções compartilhadas">{data.executions.length ? data.executions.map(item => <div className="card" key={item.id}><strong>{item.day_key}</strong><span className="muted small">{item.status} · {item.student_user_id}</span></div>) : <p className="muted">Nenhuma execução recebida ainda.</p>}</Section>
    </>}
  </div>
}
