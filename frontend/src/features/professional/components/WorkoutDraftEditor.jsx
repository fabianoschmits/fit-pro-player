import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import Dialog from '../../../components/Dialog.jsx'
import { TextField, Button } from '../../../components/ui.jsx'
import ExerciseGuideAnimation from '../../../components/ExerciseGuideAnimation.jsx'
import { exerciseGuideAsset } from '../../../lib/exercise-guide-assets.js'
import { PROFESSIONAL_EXERCISES, exerciseName } from '../../../lib/exercises.js'
import { t } from '../../../lib/i18n.js'
import { WEEK_DAYS, DAY_LABELS } from '../hooks/useProgramDraft.js'
import CompactList from './CompactList.jsx'
import EmptyState from './EmptyState.jsx'
import BottomActionBar from './BottomActionBar.jsx'
import ExercisePrescriptionRow from './ExercisePrescriptionRow.jsx'
import PrescriptionSheet from './PrescriptionSheet.jsx'
import ExercisePickerSheet from './ExercisePickerSheet.jsx'
import ContextActions from './ContextActions.jsx'

export default function WorkoutDraftEditor({ api, day, backTo, backState, onDone, exercises = PROFESSIONAL_EXERCISES }) {
  const [sheet, setSheet] = useState(null)
  const [closing, setClosing] = useState(false)
  const [destination, setDestination] = useState(WEEK_DAYS.find(item => item !== day))
  const [expanded, setExpanded] = useState(null)
  const lock = useRef(false)
  const entries = api.draft.weeklyPlan[day] || []
  const locked = Boolean(sheet || closing)

  const close = () => {
    lock.current = true
    setClosing(true)
    setSheet(null)
  }
  const afterClose = () => {
    lock.current = false
    if (api.isCurrent()) setClosing(false)
  }
  const open = next => {
    if (!lock.current && !sheet && api.isCurrent() && (!next.target || api.isTargetCurrent(day, next.target))) {
      setSheet(next)
    }
  }
  const copy = () => {
    const token = api.publicationToken()
    if (api.copyDay(day, destination) === 'confirmation-required') {
      open({ kind: 'copy', source: day, destination, token })
    }
  }

  return <div className="professional-workout-editor">
    <label>
      {t('Nome do treino')}
      <TextField maxLength={80} value={api.draft.workoutTitles[day] || ''} disabled={locked}
        onChange={event => api.setWorkoutTitle(day, event.target.value)} />
    </label>
    <div className="professional-day-tools">
      <label>
        {t('Dia de destino')}
        <select disabled={locked} value={destination} onChange={event => setDestination(event.target.value)}>
          {WEEK_DAYS.filter(item => item !== day).map(item =>
            <option key={item} value={item}>{t(DAY_LABELS[item])}</option>)}
        </select>
      </label>
      <ContextActions label={t('Opções do dia')} items={[
        { id: 'copy', label: t('Copiar dia'), disabled: locked || !entries.length, onSelect: copy },
        { id: 'swap', label: t('Trocar dias'), disabled: locked, onSelect: () => { api.swapDays(day, destination); setExpanded(null) } },
      ]} />
    </div>
    <CompactList empty={<EmptyState title={t('Nenhum exercício neste dia.')} />}>
      {entries.map((entry, index) => {
        const target = api.target(day, index)
        const exercise = exercises.find(ex => ex.id === entry.exerciseId)
        const action = type => {
          if (lock.current || sheet || !api.isTargetCurrent(day, target)) return
          if (type === 'remove') {
            open({ kind: 'remove', target, name: exerciseName(exercise || { id: entry.exerciseId, n: entry.exerciseId }) })
            return
          }
          const operations = {
            up: () => api.moveExercise(day, target, -1),
            down: () => api.moveExercise(day, target, 1),
            duplicate: () => api.duplicateExercise(day, target),
          }
          operations[type]?.()
          setExpanded(null)
        }
        const preview = expanded === index && (
          exerciseGuideAsset(exercise || { id: entry.exerciseId })
            ? <ExerciseGuideAnimation ex={exercise} playing />
            : <p className="muted small">{t('Animação ainda não disponível para este exercício.')}</p>
        )
        return <ExercisePrescriptionRow key={`${entry.exerciseId}-${index}`} prescription={entry}
          index={index} count={entries.length} exercise={exercise} disabled={locked}
          onEdit={() => open({ kind: 'prescription', prescription: entry, target })}
          onAction={action} onPreview={() => setExpanded(expanded === index ? null : index)}
          expanded={expanded === index} preview={preview} />
      })}
    </CompactList>
    {(api.dirty || api.persistenceError) && <p className="muted small" role="status">
      {t(api.persistenceError ? 'Não foi possível salvar o rascunho neste dispositivo.' : 'Rascunho salvo neste dispositivo.')}
    </p>}
    <BottomActionBar>
      <Button variant="primary" disabled={entries.length >= 50} aria-disabled={locked}
        onClick={() => open({ kind: 'picker' })}>{t('Adicionar exercício')}</Button>
      {backTo
        ? <Link className="management-button" to={backTo} state={backState}>{t('Concluir treino')}</Link>
        : <Button disabled={locked} onClick={onDone}>{t('Concluir treino')}</Button>}
    </BottomActionBar>
    <PrescriptionSheet open={sheet?.kind === 'prescription'} prescription={sheet?.prescription}
      onSave={value => { api.updateExercise(day, sheet.target, value); close() }}
      onClose={close} onAfterClose={afterClose} />
    <ExercisePickerSheet open={sheet?.kind === 'picker'} exercises={exercises} prescriptions={entries}
      dayLabel={t(DAY_LABELS[day])} onAdd={exercise => api.addExercise(day, exercise)}
      onClose={close} onAfterClose={afterClose} />
    {sheet?.kind === 'copy' && <Dialog title={t('Substituir exercícios do dia?')}
      onClose={close} onAfterClose={afterClose} className="professional-editor-sheet">
      <p>{t('Os exercícios de {0} serão substituídos pelos de {1}.', t(DAY_LABELS[sheet.destination]), t(DAY_LABELS[day]))}</p>
      <Button onClick={() => {
        if (api.isCurrent() && api.publicationToken().revision === sheet.token.revision) {
          api.copyDay(day, sheet.destination, { overwrite: true })
        }
        close()
      }}>{t('Substituir dia')}</Button>
      <Button onClick={close}>{t('Cancelar')}</Button>
    </Dialog>}
    {sheet?.kind === 'remove' && <Dialog title={t('Remover exercício?')}
      onClose={close} onAfterClose={afterClose} className="professional-editor-sheet">
      <p>{sheet.name}</p>
      <Button variant="danger" onClick={() => {
        api.removeExercise(day, sheet.target)
        setExpanded(null)
        close()
      }}>{t('Confirmar remoção')}</Button>
      <Button onClick={close}>{t('Cancelar')}</Button>
    </Dialog>}
  </div>
}
