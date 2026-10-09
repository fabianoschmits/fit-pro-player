import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { t } from '../../../lib/i18n.js'
import { PROFESSIONAL_EXERCISES } from '../../../lib/exercises.js'
import ProfessionalExercisePicker from '../../../components/ProfessionalExercisePicker.jsx'
import ProfessionalLayout from '../components/ProfessionalLayout.jsx'
import EmptyState from '../components/EmptyState.jsx'
import ProgramResourceGate from '../components/ProgramResourceGate.jsx'
import { useProgramEditorResource } from '../hooks/useProgramEditorResource.js'
import { useProgramDraft, WEEK_DAYS, DAY_LABELS } from '../hooks/useProgramDraft.js'
import { professionalPath } from '../routes.js'

export default function ProfessionalExercisesPage() {
  const [params] = useSearchParams(), programId = params.get('program'), day = params.get('day')
  return <ProfessionalLayout title={t('Exercícios')} subtitle={t('Catálogo para prescrição')}>
    {programId && WEEK_DAYS.includes(day) ? <ContextualCatalog programId={programId} day={day} /> : <EmptyState title={t('Escolha um programa e um dia')} description={t('Abra o editor do treino e use Adicionar exercício para montar a prescrição.')} action={<Link className="management-button" to="/professional/programs">{t('Abrir programas')}</Link>} />}
  </ProfessionalLayout>
}
function ContextualCatalog({ programId, day }) {
  const navigate = useNavigate(), resource = useProgramEditorResource(programId), [open, setOpen] = useState(true)
  return <ProgramResourceGate resource={resource}>{resource.data && <Catalog resource={resource} programId={programId} day={day} open={open} setOpen={setOpen} navigate={navigate} />}</ProgramResourceGate>
}
function Catalog({ resource, programId, day, open, setOpen, navigate }) {
  const { program, version } = resource.data
  const draft = useProgramDraft({ accountId: resource.accountId, programId, initialDraft: { title: program.title, description: program.description || '', objective: program.objective || '', weeklyPlan: version?.weekly_plan || {}, workoutTitles: version?.workout_titles || {} } })
  const back = professionalPath({ kind: 'programWorkoutEdit', id: programId, day })
  return <>{open && <ProfessionalExercisePicker exercises={PROFESSIONAL_EXERCISES} selectedIds={new Set((draft.draft.weeklyPlan[day] || []).map(item => item.exerciseId))} exerciseCount={(draft.draft.weeklyPlan[day] || []).length} dayLabel={t(DAY_LABELS[day])} onAdd={exercise => draft.addExercise(day, exercise)} onClose={() => setOpen(false)} onAfterClose={() => navigate(back)} />}<EmptyState title={t('Catálogo de exercícios')} action={<button onClick={() => setOpen(true)}>{t('Abrir catálogo')}</button>} /></>
}
