import { useState } from 'react'
import { useStore } from '../store/useStore.js'
import { useProgramDraft } from '../features/professional/hooks/useProgramDraft.js'
import WeekDraftSummary from '../features/professional/components/WeekDraftSummary.jsx'
import WorkoutDraftEditor from '../features/professional/components/WorkoutDraftEditor.jsx'

// Compatibility for the old ProfessionalPrograms edit branch (Task 5 removes it).
// Uses the same compact editor and scoped persistence as the native routed pages.
export default function ProfessionalProgramEditor({ exercises = [], initialPlan = {}, initialMetadata, draftKey, onPublish, onSaveMetadata, onCancel }) {
  const scope = useStore.getState().getScopeToken().scope, [day, setDay] = useState(null)
  const accountId = scope.kind === 'account' ? scope.userId : null
  const programId = draftKey?.startsWith(`${accountId}:`) ? draftKey.slice(accountId.length + 1) : draftKey || 'legacy-editor'
  const api = useProgramDraft({ accountId, programId, initialDraft: { ...initialMetadata, title: initialMetadata?.title || 'Programa', weeklyPlan: initialPlan } })
  const publish = snapshot => initialMetadata ? onPublish(snapshot.weeklyPlan, { title: snapshot.title, description: snapshot.description, objective: snapshot.objective }) : onPublish(snapshot.weeklyPlan)
  return day ? <WorkoutDraftEditor key={day} api={api} day={day} exercises={exercises} onDone={() => setDay(null)} /> : <WeekDraftSummary api={api} programId={programId} onDay={setDay} onPublish={publish} onSaveMetadata={onSaveMetadata} onCancel={onCancel} />
}
