import ProfessionalExercisePicker from '../../../components/ProfessionalExercisePicker.jsx'
import { PROFESSIONAL_EXERCISES } from '../../../lib/exercises.js'
export default function ExercisePickerSheet({ open, prescriptions = [], onAdd, onClose, exercises = PROFESSIONAL_EXERCISES, dayLabel, onAfterClose }) {
  return open ? <ProfessionalExercisePicker exercises={exercises} selectedIds={new Set(prescriptions.map(entry => entry.exerciseId))} exerciseCount={prescriptions.length} dayLabel={dayLabel} onAdd={exercise => { if (prescriptions.length < 50) onAdd(exercise) }} onClose={onClose} onAfterClose={onAfterClose} /> : null
}
