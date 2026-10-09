import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useProgramEditorResource } from '../hooks/useProgramEditorResource.js'
import { useProgramDraft } from '../hooks/useProgramDraft.js'
import { professionalPath, preserveProfessionalIdentity } from '../routes.js'
import ProfessionalLayout from '../components/ProfessionalLayout.jsx'
import ProgramEditorGate from '../components/ProgramEditorGate.jsx'
import WeekDraftSummary from '../components/WeekDraftSummary.jsx'

export default function ProgramWeekPage() {
  const { programId } = useParams()
  const location = useLocation()
  const versionId = new URLSearchParams(location.search).get('version')
  const resource = useProgramEditorResource(programId, versionId)
  return <ProgramEditorGate resource={resource}>
    {resource.data?.program && <Week key={`${resource.accountId}:${programId}:${versionId || 'latest'}`}
      resource={resource} programId={programId} />}
  </ProgramEditorGate>
}

function Week({ resource, programId }) {
  const navigate = useNavigate()
  const location = useLocation()
  const api = useProgramDraft({ accountId: resource.accountId, programId, initialDraft: resource.data.initialDraft })
  const backTo = preserveProfessionalIdentity(professionalPath({ kind: 'program', id: programId }), location.search)
  const publish = async (snapshot, current) => {
    if (!current() || !resource.isCurrent()) throw new Error('context-changed')
    await resource.repo.updateProgramMetadata({
      programId, title: snapshot.title, description: snapshot.description, objective: snapshot.objective,
    })
    if (!current() || !resource.isCurrent()) throw new Error('context-changed')
    return resource.repo.publishProgramDraft({
      programId, weeklyPlan: snapshot.weeklyPlan, workoutTitles: snapshot.workoutTitles,
    })
  }
  return <ProfessionalLayout title={api.draft.title} backTo={backTo}>
    <WeekDraftSummary api={api} programId={programId} search={location.search} state={location.state}
      versionNumber={resource.data.version?.version_number} onPublish={publish}
      onPublished={() => { if (resource.isCurrent()) navigate(backTo, { state: location.state }) }} onCancel={() => navigate(backTo, { state: location.state })} />
  </ProfessionalLayout>
}
