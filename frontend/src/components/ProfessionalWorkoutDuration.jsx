import { useRef } from 'react'
import { estimateWorkoutDuration, fitWorkoutToMinutes, getPreferredWorkoutMinutes } from '../lib/workout-duration.js'
import { exOr, exerciseName } from '../lib/exercises.js'
import { useUI } from '../store/useUI.js'
import { ActionGroup, Button } from './ui.jsx'

/** Local preview only; applying changes the individual student's editable draft. */
export default function ProfessionalWorkoutDuration({ routine, studentProfile = undefined, context = {}, onApply = undefined }) {
  const current = useRef(routine)
  current.current = routine
  const preferred = getPreferredWorkoutMinutes(studentProfile)
  const seconds = estimateWorkoutDuration(routine.ex || [], context)
  const preview = () => {
    const source = routine
    const result = fitWorkoutToMinutes(source.ex || [], preferred, context)
    const selected = new Set(result.selectedIndices)
    useUI.getState().openSheet(close => <section className="fpp-panel-flow" aria-label="Prévia da adequação ao tempo do aluno">
      <h2>Adequar ao tempo do aluno</h2>
      <p>{routine.name} · {selected.size} de {source.ex.length} exercícios · duração estimada: {Math.ceil(result.estimatedSeconds / 60)} min</p>
      <p className="small dim">Confira a seleção. A confirmação modifica somente este rascunho. Use Salvar e Enviar para compartilhar as mudanças com o aluno.</p>
      <ol>{source.ex.map((entry, index) => <li key={index}>{exerciseName(exOr(entry.id))} · {selected.has(index) ? 'Manter' : 'Retirar do rascunho'}</li>)}</ol>
      <ActionGroup layout="equal">
        <Button onClick={close}>Cancelar</Button>
        <Button variant="primary" disabled={!selected.size} onClick={() => {
          // A preview must never overwrite edits made after it opened.
          if (current.current !== source) { close(); useUI.getState().toast('O rascunho mudou. Abra novamente a prévia.'); return }
          onApply?.(source.ex.filter((_, index) => selected.has(index)))
          close()
        }}>Confirmar adequação</Button>
      </ActionGroup>
    </section>)
  }
  return <div className="fpp-panel-flow professional-workout-duration">
    <p className="small" style={studentProfile && seconds > preferred * 60 ? { color: 'var(--red)' } : undefined}>{routine.name} — duração estimada: {Math.ceil(seconds / 60)} min</p>
    {studentProfile && <p className="small dim">Tempo habitual do aluno: {preferred} min</p>}
    {studentProfile && onApply && routine.ex?.length > 0 && <Button size="sm" variant="plain" onClick={preview}>Adequar ao tempo do aluno</Button>}
  </div>
}
