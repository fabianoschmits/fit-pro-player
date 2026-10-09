import { useCallback, useMemo } from 'react'
import { Link, Navigate, useLocation, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider.jsx'
import { getBrowserSupabaseClient } from '../lib/supabase-client.js'
import { createProfessionalWorkflowRepository } from '../lib/professional-workflow.js'
import { t } from '../lib/i18n.js'
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
import Skeleton from '../features/professional/components/Skeleton.jsx'

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
  const load = useCallback(async current => {
    if (!ready) return null
    // A concurrent reconciliation may invalidate this read without leaving the page.
    // Fetch a fresh snapshot then, rather than rendering an obsolete program or a blank
    // summary. The request hook bounds retries by its lifetime and timeout generation.
    while (current()) {
      const token = useStore.getState().getAssignedProgramReadToken()
      if (token.scope.kind !== 'account' || token.scope.userId !== userId) return null
      const ownsRead = () => useStore.getState().isAssignedProgramReadCurrent(token, userId)
      const [professionals, assignments, overview] = await Promise.all([repo.studentProfessionals(), repo.assignedPrograms(userId), repo.studentOverview()])
      if (!current()) return null
      if (!ownsRead()) continue
      const active = assignments.filter(item => item.status === 'active' && item.student_user_id === userId && professionals.some(person => person.professionalId === item.professional_user_id)).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0]
      const version = active ? await repo.version(active.version_id) : null
      if (!current()) return null
      if (!ownsRead()) continue
      const state = useStore.getState().S
      if (!active || version?.id === active.version_id) useStore.getState().invalidateAssignedProgramReads(token)
      if (version && version.id === active?.version_id && (state.assignedProgram?.versionId !== version.id || state.assignedProgram?.assignmentId !== active.id)) useStore.getState().replaceState(assignedPlanToState({ ...state }, version, active))
      else if (!active && state.assignedProgram) useStore.getState().replaceState(clearAssignedProgramFromState({ ...state }))
      const scopedOverview = active && overview?.assignment?.id === active.id && overview?.version?.id === active.version_id && overview?.professional?.id === active.professional_user_id && professionals.some(person => person.professionalId === active.professional_user_id) ? overview : {}
      return { professionals, active, overview: scopedOverview }
    }
    return null
  }, [repo, userId, ready])
  const { data, busy, error, refresh } = useStudentManagementRequest(load, 'Não foi possível carregar seus profissionais.')
  const start = item => {
    const state = useStore.getState().S
    if (!data?.active || data.active.status !== 'active' || data.overview.assignment?.id !== data.active.id || state.assignedProgram?.assignmentId !== data.active.id || state.assignedProgram?.versionId !== data.active.version_id) return
    const day = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 }[item.day]
    const routineId = state.week?.[day]
    const routine = state.routines?.find(entry => entry.id === routineId && entry.assignmentId === data.active.id)
    if (routine) startFlow(routineId)
  }
  return <ManagementLayout audience="student" className="student-professionals-page" title={t('Meus profissionais')} subtitle={t('Pessoas que acompanham seu treino')} backTo="/more" action={<Link className="management-button management-button-primary" to="/student/professionals/add">{t('Adicionar profissional')}</Link>}>
    {error && <p role="alert" className="management-error">{error} <Button onClick={refresh}>{t('Tentar novamente')}</Button></p>}
    {busy ? <Skeleton variant="rows" label={t('Carregando…')} /> : data && <>
      <ManagementPanel title={t('Profissionais vinculados ({0})', data.professionals.length)}>{data.professionals.length ? <div className="management-person-list">{data.professionals.map(person => <Link className="management-person-link" to={`/student/professionals/${person.professionalId}`} key={person.professionalId}>
        <ManagementAvatar name={person.professionalName} /><div><h3>{person.professionalName}</h3>{person.specialties?.length > 0 && <p className="muted">{person.specialties.join(' · ')}</p>}<p>{person.activeProgramTitle || t('Sem programa ativo')}</p><small className="muted">{t('Desde {0}', professionalDate(person.linkedAt))}</small></div><ManagementStatus tone="success">{t('Vínculo ativo')}</ManagementStatus>
      </Link>)}</div> : <ManagementEmpty title={t('Você ainda não possui profissionais vinculados.')} description={t('Use o convite recebido para começar o acompanhamento.')} action={<Link className="management-button" to="/student/professionals/add">{t('Adicionar profissional')}</Link>} />}</ManagementPanel>
      <ManagementPanel title={t('Materiais recebidos')} description={t('Consulte programas e prescrições de cada profissional.')} action={<Link className="management-button" to="/student/professionals/materials">{t('Ver materiais')}</Link>} />
      {data.overview.program ? <StudentProgramOverview overview={data.overview} onStart={start} managementCompact trainingTo={`/student/professionals/${data.active.professional_user_id}/training`} /> : <ManagementPanel title={t('Programa profissional')}><p className="muted">{t('Você ainda não recebeu um programa ativo.')}</p></ManagementPanel>}
    </>}
  </ManagementLayout>
}
