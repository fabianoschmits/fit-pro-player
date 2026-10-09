import { Link } from 'react-router-dom'
import { t } from '../lib/i18n.js'
import { professionalDate, statusLabel } from '../lib/professional-ux.js'
import { useProfessionalSession } from '../features/professional/hooks/useProfessionalSession.js'
import { useProfessionalResource } from '../features/professional/hooks/useProfessionalResource.js'
import ProfessionalLayout from '../features/professional/components/ProfessionalLayout.jsx'
import SectionHeader from '../features/professional/components/SectionHeader.jsx'
import CompactList from '../features/professional/components/CompactList.jsx'
import StudentRow from '../features/professional/components/StudentRow.jsx'
import EmptyState from '../features/professional/components/EmptyState.jsx'
import Skeleton from '../features/professional/components/Skeleton.jsx'

export default function ProfessionalDashboard() {
  const session = useProfessionalSession()
  const resource = useProfessionalResource({ accountId: session.accountId, resourceKey: 'professional-dashboard', load: () => session.repo.dashboardSummary({ localDate: new Date().toLocaleDateString('en-CA'), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }) })
  const data = resource.data
  return <ProfessionalLayout title={t('Área profissional')} subtitle={t('Gestão dos seus alunos e programas')} action={<Link className="management-button management-button-primary" to="/professional/invites?section=create">{t('Convidar aluno')}</Link>}>
    {!session.accountId && !session.authInitializing && <EmptyState title={t('Entre na sua conta para continuar.')} />}
    {(session.authInitializing || resource.status === 'loading') && !session.authExpired && <Skeleton variant="summary" count={5} label={t('Carregando área profissional…')} />}
    {session.authExpired && <EmptyState title={t('Não foi possível confirmar sua sessão.')} />}
    {resource.error && !data && <EmptyState title={t('Não foi possível carregar a área profissional.')} action={<button onClick={resource.retry}>{t('Tentar novamente')}</button>} />}
    {data && <><nav className="professional-quick-actions" aria-label={t('Ações rápidas')}><Link to="/professional/invites?section=create">{t('Novo aluno')}</Link><Link to="/professional/programs/new">{t('Criar programa')}</Link><Link to="/professional/students">{t('Atribuir treino')}</Link></nav>
      <dl className="professional-metrics"><div><dt>{t('Alunos ativos')}</dt><dd>{data.activeStudents}</dd></div><div><dt>{t('Precisam de atenção')}</dt><dd>{data.attentionStudents}</dd></div><div><dt>{t('Treinos de hoje')}</dt><dd>{data.todayWorkouts}</dd></div><div><dt>{t('Programas ativos')}</dt><dd>{data.activePrograms}</dd></div><div><dt>{t('Convites pendentes')}</dt><dd>{data.pendingInvites}</dd></div></dl>
      <SectionHeader title={t('Hoje')} action={<Link to="/professional/students">{t('Ver alunos')}</Link>} /><CompactList empty={<EmptyState title={t('Nenhum treino previsto para hoje.')} />}>{(data.today || []).map(item => <StudentRow key={`${item.studentUserId}:${item.dayKey}`} student={item} to={`/professional/students/${item.studentUserId}`} />)}</CompactList>
      <SectionHeader title={t('Atividade recente')} /><CompactList empty={<EmptyState title={t('Nenhuma execução recebida ainda.')} />}>{(data.recentActivity || []).map(item => <li className="professional-row" key={item.id}><Link className="professional-row-link" to={`/professional/students/${item.studentUserId}/history/${item.id}`}><span className="professional-row-copy"><strong>{item.displayName || t('Aluno')}</strong><small>{item.programTitle || item.dayKey} · {statusLabel(item.status)}</small><small>{professionalDate(item.startedAt, true)}</small></span><span aria-hidden="true">›</span></Link></li>)}</CompactList></>}
  </ProfessionalLayout>
}
