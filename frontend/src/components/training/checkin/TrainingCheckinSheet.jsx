import { useMemo, useState } from 'react'
import { t } from '../../../lib/i18n.js'
import { detectTrainingChanges, orderedCheckinReasons } from '../../../lib/training-checkin.js'
import { CHECKIN_NOTE_LIMIT } from '../../../lib/training-checkin-data.js'
import { checkinFor, saveTrainingCheckin, useTrainingCheckins } from '../../../lib/training-checkin-state.js'
import { Button } from '../../ui.jsx'
import TrainingCheckinReasons from './TrainingCheckinReasons.jsx'
import '../../../training-checkin.css'
export default function TrainingCheckinSheet({ workoutId, ownerScope, close, onReturn = undefined }) {
 const { records, workouts, scopeKey } = useTrainingCheckins()
 const workout = workouts.find(item => item.id === workoutId), saved = checkinFor(records, workoutId)
 const [selected, setSelected] = useState(saved?.status === 'answered' ? saved.reasons : [])
 const [note, setNote] = useState(saved?.status === 'answered' ? saved.note : '')
 const [focused, setFocused] = useState(false), [confirmRemoval, setConfirmRemoval] = useState(false), [error, setError] = useState(false)
 const detection = useMemo(() => detectTrainingChanges(workout), [workout])
 if (!workout || scopeKey !== ownerScope) return null
 const finish = status => {
  try {
   saveTrainingCheckin(workoutId, { status, reasons: selected, note }, ownerScope)
   close(); onReturn?.()
  } catch { setError(true) }
 }
 const description = !detection.eligible || detection.changes.completedSets === detection.changes.plannedSets ? t('You changed the planned exercises.')
  : detection.changes.addedSets > 0 ? t('You completed more sets than planned.') : t('You completed {0} of {1} planned sets.', detection.changes.completedSets, detection.changes.plannedSets)
 return <form className="training-checkin-sheet" data-training-checkin onSubmit={event => { event.preventDefault(); finish('answered') }}>
  <h3>{t('How was your workout?')}</h3>
  {detection.eligible && detection.triggers.length > 0 && <><p>{description}</p><div className="training-checkin-totals"><span>{t('Planned')}<strong>{detection.changes.plannedSets}</strong></span><span>{t('Realizado')}<strong>{detection.changes.completedSets}</strong></span></div></>}
  <TrainingCheckinReasons reasons={orderedCheckinReasons(detection, workout.comparison?.flexApplied)} selected={selected} onToggle={reason => setSelected(value => value.includes(reason) ? value.filter(item => item !== reason) : [...value, reason])} />
  {selected.includes('pain_or_discomfort') && <p className="training-checkin-notice" role="status">{t('Respect your limits. If discomfort persists, consider seeking professional guidance.')}</p>}
  <label className="training-checkin-note">{t('Add an optional note')}<textarea maxLength={CHECKIN_NOTE_LIMIT} rows={3} value={note} onChange={event => setNote(event.target.value)} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} /></label>
  {focused && <small className="dim">{new Intl.NumberFormat().format(note.length)} / {CHECKIN_NOTE_LIMIT}</small>}
  <p className="small dim">{t('Only you can see this response.')}</p>
  {error && <p role="alert">{t('Could not save the response. Please try again.')}</p>}
  <Button type="submit" variant="primary" disabled={!selected.length && !note.trim()}>{t('Save response')}</Button>
  <Button variant="ghost" onClick={() => saved?.status === 'answered' ? (close(), onReturn?.()) : finish('dismissed')}>{t('Not now')}</Button>
  {saved?.status === 'answered' && (!confirmRemoval ? <Button variant="ghost" onClick={() => setConfirmRemoval(true)}>{t('Remove response')}</Button> : <div className="training-checkin-notice" role="group" aria-label={t('Remove this response?')}><p>{t('Remove this response?')}</p><Button variant="danger" onClick={() => finish('removed')}>{t('Confirm')}</Button><Button variant="ghost" onClick={() => setConfirmRemoval(false)}>{t('Cancel')}</Button></div>)}
 </form>
}
