import { useState } from 'react'
import { useStore } from '../store/useStore.js'
import { RoutineEditor } from '../views/RoutineEdit.jsx'
import TrainingPlanWorkspace from './training/TrainingPlanWorkspace.jsx'
import { weeklyPlanToWorkspace, workspaceToWeeklyPlan } from '../lib/training-workspace.js'
import { validateAvailableWeeklyPlan as validateWeeklyPlan } from '../lib/professional-program.js'
import { UNAVAILABLE_EXERCISE_MESSAGE } from '../lib/exercises.js'
import { t } from '../lib/i18n.js'
import { ActionGroup, Button, TextField, TextArea } from './ui.jsx'
/** @param {{initialPlan?: object, initialMetadata?: {title?:string, description?:string, workoutTitles?:object}, onCancel?: (...args: any[])=>any, onPublish?: Function, onSaveMetadata?: (...args: any[])=>any, onPublished?: (...args: any[])=>any}} props */
export default function ProfessionalProgramEditor({ initialPlan = {}, initialMetadata = {}, onPublish, onPublished = undefined, onSaveMetadata = undefined, onCancel = undefined }) {
 const prefs = useStore(s => s.S)
 const [state, setState] = useState(() => weeklyPlanToWorkspace(initialPlan, initialMetadata.workoutTitles)), [routineId, setRoutineId] = useState(null), [metadata, setMetadata] = useState(initialMetadata), [error, setError] = useState('')
 const update = fn => setState(old => { const next = structuredClone(old); fn(next); return next })
 if (routineId) return <RoutineEditor state={{ ...prefs, ...state }} onUpdate={update} routineId={routineId} mode="professional" onOpen={setRoutineId} onSave={async () => true} onBack={() => setRoutineId(null)} />
 const save = async () => {
   setError('')
   const { weeklyPlan, workoutTitles } = workspaceToWeeklyPlan(state)
   const validation = validateWeeklyPlan(weeklyPlan)
   if (!validation.ok) { setError(validation.error === 'weekly-plan-exercise-unavailable' ? t(UNAVAILABLE_EXERCISE_MESSAGE) : 'Adicione exercícios e organize os dias antes de salvar.'); throw new Error(validation.error) }
   const id = await onPublish(weeklyPlan, metadata, workoutTitles)
   onPublished?.(id)
 }
 return <div className="training-plan-workspace">
   <label className="fpp-form-field" htmlFor="model-editor-title"><span>Nome do modelo</span><TextField id="model-editor-title" value={metadata.title || ''} onChange={e => setMetadata({ ...metadata, title: e.target.value })} /></label>
   <details className="card"><summary>Mais opções</summary><div className="fpp-details-body"><label className="fpp-form-field" htmlFor="model-editor-description"><span>Descrição</span><TextArea id="model-editor-description" value={metadata.description || ''} onChange={e => setMetadata({ ...metadata, description: e.target.value })} /></label>{onSaveMetadata && <ActionGroup><Button onAction={() => onSaveMetadata(metadata)}>Salvar informações</Button></ActionGroup>}</div></details>
   {error && <p role="alert">{error}</p>}
   <TrainingPlanWorkspace state={{ ...prefs, ...state }} onOpen={setRoutineId} onAdd={() => { const id = crypto.randomUUID(); update(next => next.routines.push({ id, name: `Treino ${String.fromCharCode(65 + next.routines.length)}`, ex: [] })); setRoutineId(id) }} />
   <ActionGroup layout="equal" className="fpp-editor-actions"><Button onAction={save} onError={() => setError(current => current || 'Não foi possível salvar o modelo.')} variant="primary">Salvar modelo</Button><Button onClick={onCancel}>Cancelar</Button></ActionGroup>
 </div>
}
