import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider.jsx'
import { getBrowserSupabaseClient } from '../lib/supabase-client.js'
import { createProfessionalWorkflowRepository } from '../lib/professional-workflow.js'
import { attentionReasons, professionalDate, statusLabel } from '../lib/professional-ux.js'
import { t } from '../lib/i18n.js'
import { Button, Section } from '../components/ui.jsx'
import AppHeader from '../components/AppHeader.jsx'
import ProfessionalWorkspaceNav from '../components/ProfessionalWorkspaceNav.jsx'

export default function ProfessionalDashboard() {
  const auth = useAuth(); const repo = useMemo(() => createProfessionalWorkflowRepository({ client: getBrowserSupabaseClient() }), [])
  const [data, setData] = useState({ clients: [], invites: [], programs: [], executions: [] }); const [busy, setBusy] = useState(true); const [error, setError] = useState(''); const [professional, setProfessional] = useState(false)
  const refresh = async () => { setBusy(true); setError(''); try { const [clients, invites, programs, executions] = await Promise.all([repo.clientSummaries(), repo.invites(), repo.programs(), repo.executions()]); setData({ clients, invites, programs, executions }) } catch { setError(t('Não foi possível carregar a área profissional.')) } finally { setBusy(false) } }
  useEffect(() => { if (!auth.user?.id) return; repo.professionalRole(auth.user.id).then(role => { setProfessional(role); if (role) refresh() }).catch(() => setProfessional(false)) }, [auth.user?.id])
  if (auth.status !== 'authenticated' || !professional) return <div className="narrow"><Section><p>{t("Esta área está disponível apenas para contas profissionais.")}</p></Section></div>
  const pendingInvites = data.invites.filter(item => item.status === 'pending').length; const withoutProgram = data.clients.filter(item => !item.programId && !item.programTitle).length
  const attention = data.clients.map(client => ({ ...client, reasons: attentionReasons(client) })).filter(client => client.reasons.length)
  return <div className="narrow professional-dashboard"><AppHeader title={t("Área profissional")} subtitle={t("Uma visão rápida do seu trabalho")} /><ProfessionalWorkspaceNav />{error && <p role="alert" className="error">{error} <button className="link" onClick={refresh}>{t("Tentar novamente")}</button></p>}{busy ? <p role="status">{t("Carregando área profissional…")}</p> : <>
    <Section title={t("Visão geral")}><div className="dashboard-stats"><div className="card"><strong>{data.clients.length}</strong><span>{t("alunos ativos")}</span></div><div className="card"><strong>{pendingInvites}</strong><span>{t("convites pendentes")}</span></div><div className="card"><strong>{withoutProgram}</strong><span>{t("sem programa")}</span></div><div className="card"><strong>{data.programs.length}</strong><span>{t("programas")}</span></div></div></Section>
    <Section title={t("Ações rápidas")}><div className="row-actions"><Link className="btn primary" to="/professional/invites">{t("Convidar aluno")}</Link><Link className="btn" to="/professional/programs">{t("Criar programa")}</Link><Link className="btn" to="/professional/students">{t("Ver alunos")}</Link></div></Section>
    <Section title={t("Alunos que precisam de atenção")}><p className="muted small">{t('Sem programa, último treino abandonado ou 7 dias sem treinar. Treinos abertos há mais de 24 horas também aparecem aqui.')}</p>{attention.length ? <div className="professional-student-list">{attention.slice(0, 10).map(client => <Link className="card professional-student-card" to={`/professional/students/${client.studentUserId}`} key={client.studentUserId}><strong>{client.displayName || t('Aluno')}</strong><span className="muted small">{client.reasons.map(reason => t(reason)).join(' · ')}</span></Link>)}</div> : data.clients.length ? <p className="muted">{t('Nenhuma pendência identificada.')}</p> : <><p className="muted">{t("Você ainda não possui alunos ativos.")}</p><Button onClick={() => window.location.hash = '#/professional/invites'}>{t("Convidar primeiro aluno")}</Button></>}{attention.length > 10 && <Link to="/professional/students">{t('Ver todos os alunos')}</Link>}</Section>
    <Section title={t("Atividade recente")}>{data.executions.length ? data.executions.slice(0, 5).map(item => <div className="card history-row" key={item.id}><strong>{t(item.day_key)}</strong><span className="muted small">{statusLabel(item.status)} · {professionalDate(item.started_at, true)}</span></div>) : <p className="muted">{t("Nenhuma execução recebida ainda.")}</p>}</Section>
  </>}</div>
}
