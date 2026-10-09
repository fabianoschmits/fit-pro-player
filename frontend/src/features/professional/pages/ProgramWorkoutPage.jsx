import { useLocation, useParams, Link } from 'react-router-dom'
import { t } from '../../../lib/i18n.js'
import { useProgramEditorResource } from '../hooks/useProgramEditorResource.js'
import { useProgramDraft, WEEK_DAYS, DAY_LABELS } from '../hooks/useProgramDraft.js'
import { professionalPath, preserveProfessionalIdentity } from '../routes.js'
import ProfessionalLayout from '../components/ProfessionalLayout.jsx'
import EmptyState from '../components/EmptyState.jsx'
import ProgramEditorGate from '../components/ProgramEditorGate.jsx'
import WorkoutDraftEditor from '../components/WorkoutDraftEditor.jsx'

export default function ProgramWorkoutPage() {
  const { programId, day } = useParams()
  const location = useLocation()
  if (!WEEK_DAYS.includes(day)) {
    const backTo = preserveProfessionalIdentity(professionalPath({ kind: 'programEdit', id: programId }), location.search)
    return <ProfessionalLayout title={t('Treino')} backTo={backTo}>
      <EmptyState title={t('Treino não encontrado.')}
        action={<Link to={backTo}>{t('Montar semana')}</Link>} />
    </ProfessionalLayout>
  }
  return <ValidWorkout key={`${programId}:${day}:${location.search}`} programId={programId} day={day}
    versionId={new URLSearchParams(location.search).get('version')} />
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
    <WorkoutDraftEditor api={api} day={day} backTo={backTo} />
  </ProfessionalLayout>
}
