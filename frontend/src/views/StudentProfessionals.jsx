import { useCallback, useMemo } from 'react'
import { Link, Navigate, useLocation, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider.jsx'
import { getBrowserSupabaseClient } from '../lib/supabase-client.js'
import { createProfessionalWorkflowRepository } from '../lib/professional-workflow.js'
import { t } from '../lib/i18n.js'
import { FppSkeleton } from '../components/FppFeedback.jsx'
import { professionalDate } from '../lib/professional-ux.js'
import { assignedPlanToState, clearAssignedProgramFromState } from '../lib/assigned-program.js'
import { useStore } from '../store/useStore.js'
import { startFlow } from '../sheets.jsx'
import { Button } from '../components/ui.jsx'
import ManagementLayout from '../components/ManagementLayout.jsx'
import { ManagementPanel, ManagementEmpty, ManagementAvatar, ManagementStatus } from '../components/ManagementUI.jsx'
import StudentProgramOverview from '../components/StudentProgramOverview.jsx'
import StudentProfessionalInvite from '../components/StudentProfessionalInvite.jsx'
import useStudentManagementRequest from '../components/useStudentManagementRequest.js'

export function StudentConnect() {
  const { search } = useLocation()
  return <Navigate to={`/student/professionals/add${search}`} replace />
}

export default function StudentProfessionals() {
  const auth = useAuth(); const [params] = useSearchParams(); const { pathname, search } = useLocation()
  if (pathname.endsWith('/add')) return <StudentProfessionalInvite />
  if (params.has('code')) return <Navigate to={`/student/professionals/add${search}`} replace />
  return <ProfessionalsOverview key={`${auth.status}:${auth.user?.id}`} />
}

function ProfessionalsOverview() {
  const auth = useAuth(); const userId = auth.user?.id
  const ready = useStore(state => state.ready)
  const repo = useMemo(() => createProfessionalWorkflowRepository({ client: getBrowserSupabaseClient() }), [])
  const load = useCallback(async () => ({ professionals: await repo.studentProfessionals(), overview: {} }), [repo])
  const { data, busy, error, refresh } = useStudentManagementRequest(load, 'Não foi possível carregar seus profissionais.')
  return <ManagementLayout audience="student" className="student-professionals-page" title={t('Meus profissionais')} subtitle={t('Pessoas que acompanham seu treino')} backTo="/more" action={<Link className="management-button management-button-primary" to="/student/professionals/add">{t('Adicionar profissional')}</Link>}>
    {error && <p role="alert" className="management-error">{error} <Button onClick={refresh}>{t('Tentar novamente')}</Button></p>}
    {busy ? <FppSkeleton label={t('Carregando…')} /> : data && <>
      <Link className="management-shortcut" to="/plan">Planos recebidos · Abrir biblioteca</Link>
      <ManagementPanel title={t('Profissionais vinculados ({0})', data.professionals.length)}>{data.professionals.length ? <div className="management-person-list">{data.professionals.map(person => <Link className="management-person-link" to={`/student/professionals/${person.professionalId}`} key={person.professionalId}>
        <ManagementAvatar name={person.professionalName} /><div><h3>{person.professionalName}</h3>{person.specialties?.length > 0 && <p className="muted">{person.specialties.join(' · ')}</p>}<p>{person.receivedCount || 0} planos recebidos</p><small className="muted">{t('Desde {0}', professionalDate(person.linkedAt))}</small></div><ManagementStatus tone="success">{t('Vínculo ativo')}</ManagementStatus>
      </Link>)}</div> : <ManagementEmpty title={t('Você ainda não possui profissionais vinculados.')} description={t('Use o convite recebido para começar o acompanhamento.')} action={<Link className="management-button" to="/student/professionals/add">{t('Adicionar profissional')}</Link>} />}</ManagementPanel>
      <Link className="management-shortcut" aria-label={t('Ver materiais')} to="/student/professionals/materials"><span><strong>{t('Ver materiais')}</strong><small>{t('Programas e prescrições dos seus profissionais')}</small></span><span aria-hidden="true">›</span></Link>
    </>}
  </ManagementLayout>
}
