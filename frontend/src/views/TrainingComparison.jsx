import TrainingCheckinSummary from '../components/training/checkin/TrainingCheckinSummary.jsx'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { compareTraining, normalizeTrainingComparison } from '../lib/training-comparison.js'
import { fmtDate } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import AppHeader from '../components/AppHeader.jsx'
import { Button } from '../components/ui.jsx'
import Icon from '../components/Icon.jsx'
import TrainingComparisonSummary from '../components/training/TrainingComparisonSummary.jsx'
import TrainingComparisonBodyMap from '../components/training/TrainingComparisonBodyMap.jsx'
import { trainingComparisonHref, trainingSessionsByRecent } from '../components/training/TrainingComparisonPreview.jsx'
import '../training-comparison.css'

const PAGE_SIZE = 8

function SessionPicker({ currentId, onSelect, close }) {
  const workouts = useStore(state => state.S.workouts)
  const [limit, setLimit] = useState(PAGE_SIZE)
  const sessions = useMemo(() => trainingSessionsByRecent(workouts), [workouts])
  return <div className="tc-session-sheet">
    <h3>{t('Escolher treino')}</h3>
    <div className="sect-b">{sessions.slice(0, limit).map(workout => <button type="button" key={workout.id} className="lrow tap" data-session-option aria-current={currentId === workout.id ? 'true' : undefined} onClick={() => { close(); onSelect(workout.id) }}>
      <span className="lrow-m"><span className="lrow-t">{workout.name}</span><time className="lrow-s" dateTime={workout.d}>{fmtDate(workout.d, true)}</time></span>
      {workout.comparison?.origin === 'freestyle' ? <span className="tc-session-badge">{t('Treino livre')}</span> : normalizeTrainingComparison(workout.comparison)?.flexApplied && <span className="tc-session-badge">FPP Flex</span>}
      {currentId === workout.id && <Icon name="check" className="lrow-k" />}
    </button>)}</div>
    {sessions.length > limit && <Button variant="ghost" onClick={() => setLimit(previous => previous + PAGE_SIZE)}>{t('Ver mais treinos')}</Button>}
  </div>
}

export default function TrainingComparison() {
  const workouts = useStore(state => state.S.workouts)
  const body = useStore(state => state.S.body)
  const navigate = useNavigate()
  const [params] = useSearchParams()
  useEffect(() => {
    document.body.classList.add('training-comparison-mode')
    return () => document.body.classList.remove('training-comparison-mode')
  }, [])
  const requested = params.get('session')
  const sessions = useMemo(() => trainingSessionsByRecent(workouts), [workouts])
  // An explicit ID is scoped to the current store. Missing IDs must never turn
  // into another account’s session or silently select a different workout.
  const workout = requested !== null ? sessions.find(item => String(item.id) === requested) : sessions[0]
  const comparison = useMemo(() => workout ? compareTraining(workout) : null, [workout])
  const pickSession = event => {
    // Touch activation in Safari can leave focus on the previous control. Give
    // the dialog a stable return target before its focus boundary is mounted.
    event.currentTarget.focus({ preventScroll: true })
    return useUI.getState().openSheet(close => <SessionPicker currentId={workout?.id} close={close} onSelect={id => navigate(trainingComparisonHref(id))} />)
  }
  const hasHistory = sessions.length > 0

  return <div className="training-comparison-view fpp-ui-view">
    <AppHeader title={t('Planejado × Realizado')} subtitle={t('Veja como o seu treino aconteceu.')} backTo="/progress"
      action={<button type="button" className="iconbtn" aria-label={t('History')} onClick={() => navigate('/progress/history')}><Icon name="history" /></button>} />
    {workout ? <>
      <button type="button" className="tc-session-picker" data-session-picker onClick={pickSession} aria-label={t('Escolher treino')} aria-haspopup="dialog">
        <div><strong>{workout.name}</strong><time dateTime={workout.d}>{fmtDate(workout.d, true)}</time></div><Icon name="chevronDown" />
      </button>
      {!comparison.hasComparison && <p className="tc-notice" role="status">{t('Este treino foi registrado antes do novo comparativo. Você ainda pode visualizar os músculos trabalhados.')}</p>}
      {comparison.origin === 'freestyle' && <p className="tc-notice">{t('Este treino livre não tinha uma referência planejada.')}</p>}
      {comparison.hasComparison && comparison.origin !== 'freestyle' && <p className="tc-context">{t(comparison.hasAdjusted ? 'Ajustado representa o treino disponível quando você começou a executar.' : 'A referência ajustada não está disponível para este treino.')}</p>}
      <TrainingComparisonSummary comparison={comparison} />
      <TrainingCheckinSummary workoutId={workout.id} />
      <TrainingComparisonBodyMap key={workout.id} comparison={comparison} body={body} />
    </> : <section className="tc-empty" role="status">
      <Icon name="dumbbell" />
      <h2>{t(requested !== null ? 'Treino indisponível' : 'Seu primeiro comparativo começa com um treino.')}</h2>
      <p>{t(requested !== null ? 'Este treino não está disponível no histórico desta conta.' : 'Conclua um treino para visualizar os músculos trabalhados.')}</p>
      {hasHistory ? <Button variant="primary" onClick={pickSession}>{t('Escolher treino')}</Button> : <Button variant="primary" onClick={() => navigate('/workout')}>{t('Começar treino')}</Button>}
    </section>}
  </div>
}
