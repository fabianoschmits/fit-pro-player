import { useMemo } from 'react'
import { t } from '../../../lib/i18n.js'
import { detectTrainingChanges, checkinReasonLabel } from '../../../lib/training-checkin.js'
import { checkinFor, useTrainingCheckins, openTrainingCheckin, saveTrainingCheckin } from '../../../lib/training-checkin-state.js'
import { Button } from '../../ui.jsx'
import '../../../training-checkin.css'
export default function TrainingCheckinSummary({ workoutId, mode = 'context', closeCurrent = undefined, onReturn = undefined }) {
 const { records, workouts, scopeKey } = useTrainingCheckins()
 const workout = workouts.find(item => item.id === workoutId), checkIn = checkinFor(records, workoutId)
 const detection = useMemo(() => detectTrainingChanges(workout ? { ...workout, checkIn } : null), [workout, checkIn])
 if (!workout || (mode === 'finish' && !detection.shouldPrompt && checkIn?.status !== 'answered') || (mode === 'context' && !detection.triggers.length && checkIn?.status !== 'answered')) return null
 const answered = checkIn?.status === 'answered'
 const open = () => openTrainingCheckin(workoutId, closeCurrent, onReturn)
 if (mode === 'history') return <button type="button" className="training-checkin-history" onClick={open}>{t('Workout context')}<span>{t(answered ? 'Edit response' : 'Add context')}</span></button>
 return <section className="training-checkin-summary" data-training-checkin-summary>
  <h3>{t(mode === 'finish' && !answered ? 'How was your workout?' : 'Workout context')}</h3>
  {answered ? <><div className="training-checkin-tags">{checkIn.reasons.map(reason => <span key={reason}>{t(checkinReasonLabel(reason))}</span>)}</div>{checkIn.note && <p className="training-checkin-observation">{checkIn.note}</p>}</> : <p>{t(mode === 'finish' ? 'Your workout had some changes from the plan.' : 'Would you like to record what motivated the changes?')}</p>}
  <Button variant="ghost" onClick={open}>{t(answered ? 'Edit response' : 'Tell us the reason')}</Button>
  {mode === 'finish' && !answered && <Button variant="ghost" onClick={() => saveTrainingCheckin(workoutId, { status: 'dismissed' }, scopeKey)}>{t('Not now')}</Button>}
 </section>
}
