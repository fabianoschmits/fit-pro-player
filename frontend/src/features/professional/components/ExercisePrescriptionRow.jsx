import { Thumb } from '../../../components/Media.jsx'
import { exerciseName } from '../../../lib/exercises.js'
import { t } from '../../../lib/i18n.js'
import ContextActions from './ContextActions.jsx'
export default function ExercisePrescriptionRow({ prescription, index, onEdit, onAction, exercise, count = 0, disabled = false, onPreview, expanded, preview }) {
  const ex = exercise || { id: prescription.exerciseId, n: prescription.exerciseId }
  const dose = prescription.mode === 'cardio' ? `${prescription.sets} × ${prescription.min} min · ${prescription.speed} km/h` : prescription.mode === 'time' ? `${prescription.sets} × ${prescription.sec} s` : `${prescription.sets} × ${prescription.reps}`
  return <li className="professional-prescription-row"><Thumb ex={ex} /><button type="button" aria-disabled={disabled} className="professional-prescription-edit" onClick={() => { if (!disabled) onEdit() }}><strong>{index + 1}. {exerciseName(ex)}</strong><small>{dose}{prescription.mode !== 'cardio' ? ` · ${prescription.load || 0} ${prescription.unit || 'kg'}` : ''} · {t('Descanso (s)')}: {prescription.rest ?? 90}</small>{prescription.notes && <small>{prescription.notes}</small>}</button>{onPreview && <button className="iconbtn" type="button" disabled={disabled} aria-label={t('Ver animação de {0}', exerciseName(ex))} aria-expanded={expanded} onClick={onPreview}>{expanded ? '⌃' : '⌄'}</button>}<ContextActions label={t('Ações do exercício {0}', index + 1)} items={[
    { id: 'up', label: t('Mover exercício {0} para cima', index + 1), disabled: disabled || index === 0, onSelect: () => onAction('up') },
    { id: 'down', label: t('Mover exercício {0} para baixo', index + 1), disabled: disabled || index === count - 1, onSelect: () => onAction('down') },
    { id: 'duplicate', label: t('Duplicar'), disabled: disabled || count >= 50, onSelect: () => onAction('duplicate') },
    { id: 'notes', label: t('Notas'), disabled, onSelect: onEdit },
    { id: 'remove', label: t('Remover'), destructive: true, disabled, onSelect: () => onAction('remove') },
  ]} />{preview && <div className="professional-exercise-animation">{preview}</div>}</li>
}
