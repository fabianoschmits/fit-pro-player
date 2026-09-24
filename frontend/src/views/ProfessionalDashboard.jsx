import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth/AuthProvider.jsx'
import { getBrowserSupabaseClient } from '../lib/supabase-client.js'
import { createProfessionalWorkflowRepository } from '../lib/professional-workflow.js'
import { EXDB } from '../lib/exercises.js'
import { Button, Section, TextArea, TextField } from '../components/ui.jsx'
import AppHeader from '../components/AppHeader.jsx'
import ProfessionalProgramEditor from '../components/ProfessionalProgramEditor.jsx'
import ProfessionalClientDetail from '../components/ProfessionalClientDetail.jsx'
import ProfessionalWorkspaceNav from '../components/ProfessionalWorkspaceNav.jsx'

const TABS = ['overview', 'clients', 'programs', 'invites']
const TAB_LABELS = { overview: 'Visão geral', clients: 'Clientes', programs: 'Programas', invites: 'Convites e atividade' }

export default function ProfessionalDashboard() {
  const auth = useAuth()
  const repo = useMemo(() => createProfessionalWorkflowRepository({ client: getBrowserSupabaseClient() }), [])
  const [data, setData] = useState({ clients: [], invites: [], programs: [], versions: {}, executions: [] })
  const [selectedClientId, setSelectedClientId] = useState('')
  const [detail, setDetail] = useState(null)
  const [tab, setTab] = useState('overview')
  const [editor, setEditor] = useState(null)
  const [form, setForm] = useState({ title: '', description: '' })
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const [professional, setProfessional] = useState(false)

  const refresh = async () => {
    setBusy(true); setError('')
    try {
      const [clients, invites, programs, executions] = await Promise.all([repo.clientSummaries(), repo.invites(), repo.programs(), repo.executions()])
      const versionPairs = await Promise.all(programs.map(async program => [program.id, await repo.versions(program.id)]))
      setData({ clients, invites, programs, versions: Object.fromEntries(versionPairs), executions })
      if (selectedClientId) setDetail(await repo.clientDetail(selectedClientId))
    } catch { setError('Não foi possível carregar a área profissional.') } finally { setBusy(false) }
  }

  useEffect(() => {
    if (!auth.user?.id) return undefined
    let active = true
    repo.professionalRole(auth.user.id).then(role => { if (active) { setProfessional(role); if (role) refresh() } }).catch(() => { if (active) setProfessional(false) })
    return () => { active = false }
  }, [auth.user?.id])

  const selectClient = async client => {
    setSelectedClientId(client.studentUserId); setTab('clients'); setError('')
    try { setDetail(await repo.clientDetail(client.studentUserId)) } catch { setError('Não foi possível carregar o histórico deste cliente.') }
  }
  const createProgram = async () => {
    if (!form.title.trim()) return
    try { await repo.createProgram(auth.user.id, form.title, form.description); setForm({ title: '', description: '' }); refresh() } catch { setError('Não foi possível criar o programa.') }
  }
  const publish = async (programId, plan) => {
    try { await repo.publishProgramVersion(programId, plan); setEditor(null); refresh() } catch { setError('Não foi possível publicar a versão. Revise os exercícios.') }
  }
  const assign = async (versionId, programId) => {
    if (!selectedClientId) { setError('Selecione um cliente antes de enviar o programa.'); setTab('clients'); return }
    try { await repo.assignProgramVersion({ programId, versionId, studentUserId: selectedClientId }); setError(''); refresh(); if (detail) setDetail(await repo.clientDetail(selectedClientId)) } catch { setError('Não foi possível enviar o programa para este cliente.') }
  }
  const createInvite = async kind => { try { await repo.createInvite(kind); refresh() } catch { setError('Não foi possível gerar o convite.') } }

  if (auth.status !== 'authenticated' || !professional) return <div className="narrow"><Section><p>Esta área está disponível apenas para contas profissionais.</p></Section></div>
  return <div className="narrow professional-dashboard">
    <AppHeader title="Área profissional" subtitle="Clientes, programas e acompanhamento" />
    <ProfessionalWorkspaceNav />
    {error && <p role="alert" className="error">{error}</p>}
    {busy ? <p role="status">Carregando…</p> : <>
      <div className="seg" role="tablist" aria-label="Área profissional">
        {TABS.map(item => <button type="button" key={item} role="tab" aria-selected={tab === item} className={tab === item ? 'on' : ''} onClick={() => setTab(item)}>{TAB_LABELS[item]}</button>)}
      </div>
      {tab === 'overview' && <>
        <Section title="Resumo"><div className="dashboard-stats"><div className="card"><strong>{data.clients.length}</strong><span>clientes ativos</span></div><div className="card"><strong>{data.programs.length}</strong><span>programas</span></div><div className="card"><strong>{data.executions.length}</strong><span>execuções recebidas</span></div></div></Section>
        <Section title="Atenção rápida"><p className="muted">Abra um cliente para consultar histórico, programa atual e enviar uma versão específica.</p><Button onClick={() => setTab('clients')}>Ver clientes</Button></Section>
      </>}
      {tab === 'clients' && <>
        <Section title={`Clientes (${data.clients.length})`}><div className="list">{data.clients.map(client => <button type="button" className={'card client-card' + (selectedClientId === client.studentUserId ? ' on' : '')} key={client.studentUserId} onClick={() => selectClient(client)}><strong>{client.displayName}</strong><span className="muted small">{client.programTitle || 'Sem programa ativo'}{client.lastExecutionStatus ? ` · último treino ${client.lastExecutionStatus}` : ''}</span></button>)}{!data.clients.length && <p className="muted">Nenhum cliente ativo. Gere um convite para começar.</p>}</div></Section>
        {detail && <ProfessionalClientDetail client={data.clients.find(client => client.studentUserId === selectedClientId)} detail={detail} versions={data.programs.flatMap(program => (data.versions[program.id] || []).map(version => ({ ...version, program_id: program.id })))} onAssign={versionId => { const version = Object.values(data.versions).flat().find(item => item.id === versionId); return assign(versionId, version?.program_id) }} onClose={() => { setDetail(null); setSelectedClientId('') }} />}
      </>}
      {tab === 'programs' && <>
        {editor ? <ProfessionalProgramEditor exercises={EXDB} initialPlan={editor.initialPlan} onCancel={() => setEditor(null)} onPublish={plan => publish(editor.program.id, plan)} /> : <>
          <Section title="Novo programa"><TextField placeholder="Nome do programa" aria-label="Nome do programa" value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} /><TextArea placeholder="Descrição opcional" aria-label="Descrição do programa" value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} /><Button onClick={createProgram}>Criar programa</Button></Section>
          <Section title={`Programas (${data.programs.length})`}>{data.programs.map(program => { const versions = data.versions[program.id] || []; const latest = versions[0]; return <div className="card" key={program.id}><strong>{program.title}</strong><span className="muted small">{program.description || 'Sem descrição'} · {versions.length} versão(ões)</span><div className="row-actions"><Button onClick={() => setEditor({ program, initialPlan: latest?.weekly_plan || {} })}>{latest ? 'Criar nova versão' : 'Editar programa'}</Button>{latest && <Button onClick={() => assign(latest.id, program.id)}>Enviar para cliente selecionado</Button>}</div></div> })}{!data.programs.length && <p className="muted">Crie seu primeiro programa semanal.</p>}</Section>
        </>}
      </>}
      {tab === 'invites' && <>
        <Section title="Convites"><p className="muted small">Compartilhe um código ou link. O vínculo só é criado após o aceite do usuário.</p><div className="row-actions"><Button onClick={() => createInvite('code')}>Gerar código</Button><Button onClick={() => createInvite('link')}>Gerar link</Button></div>{data.invites.map(item => <div className="card" key={item.id}><strong>{item.code}</strong><span className="muted small">{item.kind === 'link' ? `${location.origin}/#/connect?code=${item.code}` : 'Código de convite'} · {item.status}</span></div>)}</Section>
        <Section title="Atividade recente">{data.executions.length ? data.executions.slice(0, 8).map(item => <div className="card" key={item.id}><strong>{item.day_key}</strong><span className="muted small">{item.status} · {item.student_user_id}</span></div>) : <p className="muted">Nenhuma execução recebida ainda.</p>}</Section>
      </>}
    </>}
  </div>
}
