import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider.jsx'
import { getBrowserSupabaseClient } from '../lib/supabase-client.js'
import { createProfessionalWorkflowRepository } from '../lib/professional-workflow.js'
import { Button, Section } from '../components/ui.jsx'
import AppHeader from '../components/AppHeader.jsx'
import ProfessionalWorkspaceNav from '../components/ProfessionalWorkspaceNav.jsx'

export default function ProfessionalDashboard() {
  const auth = useAuth(); const repo = useMemo(() => createProfessionalWorkflowRepository({ client: getBrowserSupabaseClient() }), [])
  const [data, setData] = useState({ clients: [], invites: [], programs: [], executions: [] }); const [busy, setBusy] = useState(true); const [error, setError] = useState(''); const [professional, setProfessional] = useState(false)
  const refresh = async () => { setBusy(true); setError(''); try { const [clients, invites, programs, executions] = await Promise.all([repo.clientSummaries(), repo.invites(), repo.programs(), repo.executions()]); setData({ clients, invites, programs, executions }) } catch { setError('Não foi possível carregar a área profissional.') } finally { setBusy(false) } }
  useEffect(() => { if (!auth.user?.id) return; repo.professionalRole(auth.user.id).then(role => { setProfessional(role); if (role) refresh() }).catch(() => setProfessional(false)) }, [auth.user?.id])
  if (auth.status !== 'authenticated' || !professional) return <div className="narrow"><Section><p>Esta área está disponível apenas para contas profissionais.</p></Section></div>
  const pendingInvites = data.invites.filter(item => item.status === 'pending').length; const withoutProgram = data.clients.filter(item => !item.programId && !item.programTitle).length
  return <div className="narrow professional-dashboard"><AppHeader title="Área profissional" subtitle="Uma visão rápida do seu trabalho" /><ProfessionalWorkspaceNav />{error && <p role="alert" className="error">{error} <button className="link" onClick={refresh}>Tentar novamente</button></p>}{busy ? <p role="status">Carregando área profissional…</p> : <>
    <Section title="Visão geral"><div className="dashboard-stats"><div className="card"><strong>{data.clients.length}</strong><span>alunos ativos</span></div><div className="card"><strong>{pendingInvites}</strong><span>convites pendentes</span></div><div className="card"><strong>{withoutProgram}</strong><span>sem programa</span></div><div className="card"><strong>{data.programs.length}</strong><span>programas</span></div></div></Section>
    <Section title="Ações rápidas"><div className="row-actions"><Link className="btn primary" to="/professional/invites">Convidar aluno</Link><Link className="btn" to="/professional/programs">Criar programa</Link><Link className="btn" to="/professional/students">Ver alunos</Link></div></Section>
    <Section title="Alunos que precisam de atenção">{data.clients.length ? <div className="professional-student-list">{data.clients.slice(0, 5).map(client => <Link className="card professional-student-card" to={`/professional/students/${client.studentUserId}`} key={client.studentUserId}><strong>{client.displayName || 'Aluno'}</strong><span className="muted small">{client.programTitle || 'Sem programa ativo'}{client.lastExecutionStatus ? ` · ${client.lastExecutionStatus}` : ''}</span></Link>)}</div> : <><p className="muted">Você ainda não possui alunos ativos.</p><Button onClick={() => window.location.hash = '#/professional/invites'}>Convidar primeiro aluno</Button></>}</Section>
    <Section title="Atividade recente">{data.executions.length ? data.executions.slice(0, 5).map(item => <div className="card history-row" key={item.id}><strong>{item.day_key}</strong><span className="muted small">{item.status} · {String(item.started_at || '').slice(0, 16).replace('T', ' ')}</span></div>) : <p className="muted">Nenhuma execução recebida ainda.</p>}</Section>
  </>}</div>
}
