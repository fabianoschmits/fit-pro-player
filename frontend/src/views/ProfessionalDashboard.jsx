import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider.jsx'
import { getBrowserSupabaseClient } from '../lib/supabase-client.js'
import { createProfessionalWorkflowRepository } from '../lib/professional-workflow.js'
import { attentionReasons, professionalDate, statusLabel } from '../lib/professional-ux.js'
import { professionalDayLabel } from '../components/ProfessionalPrescription.jsx'
import { t } from '../lib/i18n.js'
import ManagementLayout from '../components/ManagementLayout.jsx'
import { ManagementPanel, ManagementEmpty, ManagementAvatar, ManagementStatus } from '../components/ManagementUI.jsx'

export default function ProfessionalDashboard() {
  const auth = useAuth()
  return <DashboardWorkspace key={auth.user?.id || 'anonymous'} userId={auth.user?.id} />
}
function DashboardWorkspace({ userId }) {
  const repo = useMemo(() => createProfessionalWorkflowRepository({ client: getBrowserSupabaseClient() }), [])
  const mounted = useRef(true)
  const [data, setData] = useState({ clients: [], invites: [], programs: [], executions: [] }); const [busy, setBusy] = useState(Boolean(userId)); const [error, setError] = useState(''); const [professional, setProfessional] = useState(false)
  const refresh = async () => {
    setBusy(true); setError('')
    try {
      const role = await repo.professionalRole(userId); if (!mounted.current) return
      setProfessional(role)
      if (!role) return
      const [clients, invites, programs, executions] = await Promise.all([repo.clientSummaries(), repo.invites(), repo.programs(), repo.executions()])
      if (mounted.current) setData({ clients, invites, programs, executions })
    } catch { if (mounted.current) setError(t('Não foi possível carregar a área profissional.')) }
    finally { if (mounted.current) setBusy(false) }
  }
  useEffect(() => { mounted.current = true; if (userId) refresh(); return () => { mounted.current = false } }, [userId])
  const pendingInvites = data.invites.filter(item => item.status === 'pending').length
  const attention = data.clients.map(client => ({ ...client, reasons: attentionReasons(client) })).filter(client => client.reasons.length)
  return <ManagementLayout className="professional-page professional-dashboard" title={t('Área profissional')} subtitle={t('Acompanhe seus alunos e organize os próximos treinos.')} action={professional && <Link className="management-button management-button-primary" to="/professional/invites?section=create">{t('Convidar aluno')}</Link>}>
    {error && <p role="alert" className="management-error">{error} <button className="link" onClick={refresh}>{t('Tentar novamente')}</button></p>}
    {busy ? <p role="status">{t('Carregando área profissional…')}</p> : !professional ? error ? null : <ManagementEmpty title={t('Esta área está disponível apenas para contas profissionais.')} /> : <>
      <div className="management-overview"><Link to="/professional/students"><strong>{data.clients.length}</strong><span>{t('alunos ativos')}</span></Link><Link to="/professional/invites"><strong>{pendingInvites}</strong><span>{t('convites pendentes')}</span></Link><Link to="/professional/programs"><strong>{data.programs.filter(item => !item.archived).length}</strong><span>{t('programas disponíveis')}</span></Link></div>
      <ManagementPanel title={t('Alunos que precisam de atenção')} description={t('Sem programa, último treino abandonado ou 7 dias sem treinar. Treinos abertos há mais de 24 horas também aparecem aqui.')} action={<ManagementStatus tone={attention.length ? 'warning' : 'neutral'}>{attention.length}</ManagementStatus>}>
        {attention.length ? <div className="management-record-list">{attention.slice(0, 10).map(client => <Link className="management-record" to={`/professional/students/${client.studentUserId}`} key={client.studentUserId}><ManagementAvatar name={client.displayName} /><div><strong>{client.displayName || t('Aluno')}</strong><p>{client.reasons.map(reason => t(reason)).join(' · ')}</p></div><span aria-hidden="true">›</span></Link>)}</div> : <ManagementEmpty title={t(data.clients.length ? 'Nenhuma pendência identificada.' : 'Você ainda não possui alunos ativos.')} action={!data.clients.length && <Link className="management-button" to="/professional/invites?section=create">{t('Convidar primeiro aluno')}</Link>} />}
        {attention.length > 10 && <Link className="management-button" to="/professional/students">{t('Ver todos os alunos')}</Link>}
      </ManagementPanel>
      <div className="management-dashboard-columns"><ManagementPanel title={t('Atividade recente')}>
        {data.executions.length ? <div className="management-activity-list">{data.executions.slice(0, 5).map(item => { const student = item.student_user_id ? data.clients.find(client => client.studentUserId === item.student_user_id) : null; return <article key={item.id}><div><strong>{professionalDayLabel(item.day_key)}</strong>{student && <Link to={`/professional/students/${student.studentUserId}?section=history`}>{student.displayName}</Link>}</div><p>{statusLabel(item.status)}</p><time className="muted small">{professionalDate(item.started_at, true)}</time></article> })}</div> : <p className="muted">{t('Nenhuma execução recebida ainda.')}</p>}
      </ManagementPanel><ManagementPanel title={t('Preparar próximos treinos')} description={t('Prescrições e versões reutilizáveis')}><div className="management-action-stack"><Link className="management-button" to="/professional/programs/new">{t('Criar programa')}</Link><Link className="management-button" to="/professional/programs">{t('Abrir programas')}</Link><Link className="management-button" to="/professional/students">{t('Ver alunos')}</Link></div></ManagementPanel></div>
    </>}
  </ManagementLayout>
}
