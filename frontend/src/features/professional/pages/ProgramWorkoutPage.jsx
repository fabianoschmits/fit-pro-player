import { useLocation, useParams, Link } from 'react-router-dom'
import { t } from '../../../lib/i18n.js'
import { useProgramEditorResource } from '../hooks/useProgramEditorResource.js'
import { useProgramDraft, WEEK_DAYS, DAY_LABELS } from '../hooks/useProgramDraft.js'
import { professionalPath, preserveProfessionalIdentity } from '../routes.js'
import ProfessionalLayout from '../components/ProfessionalLayout.jsx'
import EmptyState from '../components/EmptyState.jsx'
import ProgramEditorGate from '../components/ProgramEditorGate.jsx'
import WorkoutDraftEditor from '../components/WorkoutDraftEditor.jsx'
import ProgramResourceGate from '../components/ProgramResourceGate.jsx'
import ResourceNotice from '../components/ResourceNotice.jsx'
import { ProfessionalPrescription } from '../../../components/ProfessionalPrescription.jsx'

export default function ProgramWorkoutPage({ readOnly = false }) {
  const { programId, day } = useParams()
  const location = useLocation()
  if (!WEEK_DAYS.includes(day)) {
    const backTo = preserveProfessionalIdentity(professionalPath({ kind: readOnly ? 'program' : 'programEdit', id: programId }), location.search)
    return <ProfessionalLayout title={t('Treino')} backTo={backTo}>
      <EmptyState title={t('Treino não encontrado.')}
        action={<Link to={backTo}>{t('Montar semana')}</Link>} />
    </ProfessionalLayout>
  }
  if (readOnly) return <PublishedWorkout key={`${programId}:${day}:${location.search}`} programId={programId} day={day} />
  return <ValidWorkout key={`${programId}:${day}:${location.search}`} programId={programId} day={day}
    versionId={new URLSearchParams(location.search).get('version')} />
}

function PublishedWorkout({ programId, day }) {
  const location = useLocation()
  const versionId = new URLSearchParams(location.search).get('version')
  const resource = useProgramEditorResource(programId, versionId)
  const backTo = preserveProfessionalIdentity(professionalPath({ kind: versionId ? 'programVersion' : 'program', id: programId, versionId }), location.search)
  const version = resource.data?.version
  return <ProgramResourceGate resource={resource}>{resource.data?.program && <ProfessionalLayout
    title={version?.workout_titles?.[day] || t(DAY_LABELS[day])} subtitle={`${resource.data.program.title}${version ? ` · ${t('Versão {0}', version.version_number)}` : ''}`} backTo={backTo}>
    <ResourceNotice resource={resource} />
    {version?.weekly_plan?.[day]?.length ? <ProfessionalPrescription entries={version.weekly_plan[day]} /> : <EmptyState title={t('Rest')} />}
  </ProfessionalLayout>}</ProgramResourceGate>
}

function ValidWorkout({ programId, day, versionId }) {
  const resource = useProgramEditorResource(programId, versionId)
  return <ProgramEditorGate resource={resource}>
    {resource.data?.program && <Workout key={`${resource.accountId}:${programId}:${day}`}
      resource={resource} programId={programId} day={day} />}
  </ProgramEditorGate>
}

function Workout({ resource, programId, day }) {
  const location = useLocation()
  const api = useProgramDraft({ accountId: resource.accountId, programId, initialDraft: resource.data.initialDraft })
  const backTo = preserveProfessionalIdentity(professionalPath({ kind: 'programEdit', id: programId }), location.search)
  return <ProfessionalLayout title={t(DAY_LABELS[day])} subtitle={api.draft.title} backTo={backTo}>
    <WorkoutDraftEditor api={api} day={day} backTo={backTo} backState={location.state} />
  </ProfessionalLayout>
}
