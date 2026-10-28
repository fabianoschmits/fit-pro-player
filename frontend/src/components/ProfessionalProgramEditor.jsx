import { useState } from 'react'
import { useStore } from '../store/useStore.js'
import { RoutineEditor } from '../views/RoutineEdit.jsx'
import TrainingPlanWorkspace from './training/TrainingPlanWorkspace.jsx'
import { weeklyPlanToWorkspace, workspaceToWeeklyPlan } from '../lib/training-workspace.js'
import { validateWeeklyPlan } from '../lib/professional-program.js'
import { Button, TextField, TextArea } from './ui.jsx'
export default function ProfessionalProgramEditor({ initialPlan = {}, initialMetadata = {}, onPublish, onPublished, onSaveMetadata, onCancel }) {
 const prefs = useStore(s => s.S)
 const [state, setState] = useState(() => weeklyPlanToWorkspace(initialPlan, initialMetadata.workoutTitles)), [routineId, setRoutineId] = useState(null), [metadata, setMetadata] = useState(initialMetadata), [error, setError] = useState('')
 const update = fn => setState(old => { const next = structuredClone(old); fn(next); return next })
 if (routineId) return <RoutineEditor state={{ ...prefs, ...state }} onUpdate={update} routineId={routineId} mode="professional" onOpen={setRoutineId} onSave={async () => true} onBack={() => setRoutineId(null)} />
 const save = async () => {
   const { weeklyPlan, workoutTitles } = workspaceToWeeklyPlan(state)
   if (!validateWeeklyPlan(weeklyPlan).ok) { setError('Adicione exercícios e organize os dias antes de salvar.'); throw new Error('invalid-plan') }
   const id = await onPublish(weeklyPlan, metadata, workoutTitles)
   onPublished?.(id)
 }
 return <div className="training-plan-workspace">
   <TextField aria-label="Nome do modelo" value={metadata.title || ''} onChange={e => setMetadata({ ...metadata, title: e.target.value })} />
   <details className="card"><summary>Mais opções</summary><TextArea aria-label="Descrição" value={metadata.description || ''} onChange={e => setMetadata({ ...metadata, description: e.target.value })} />{onSaveMetadata && <Button onAction={() => onSaveMetadata(metadata)}>Salvar informações</Button>}</details>
   {error && <p role="alert">{error}</p>}
   <TrainingPlanWorkspace state={{ ...prefs, ...state }} onOpen={setRoutineId} onAdd={() => { const id = crypto.randomUUID(); update(next => next.routines.push({ id, name: `Treino ${String.fromCharCode(65 + next.routines.length)}`, ex: [] })); setRoutineId(id) }} />
   <div className="row"><Button onAction={save} onError={() => setError('Não foi possível salvar o modelo.')} variant="primary">Salvar modelo</Button><Button onClick={onCancel}>Cancelar</Button></div>
 </div>
}
