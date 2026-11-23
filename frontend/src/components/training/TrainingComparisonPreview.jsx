import { useNavigate } from 'react-router-dom'
import { t } from '../../lib/i18n.js'
import { fmtDate } from '../../lib/format.js'
import Icon from '../Icon.jsx'
import { Button } from '../ui.jsx'
import '../../training-comparison.css'

// Keep this entry point free of the comparison engine and body geometry: Home
// only needs the destination; the detailed screen owns those lazy dependencies.
export const trainingComparisonHref = id => '/progress/training-map' + (id == null ? '' : `?session=${encodeURIComponent(id)}`)
export const trainingSessionsByRecent = workouts => [...(workouts || [])].sort((left, right) => String(right.d || '').localeCompare(String(left.d || '')) || Number(right.end || right.start || 0) - Number(left.end || left.start || 0))

export default function TrainingComparisonPreview({ workout = null }) {
  const navigate = useNavigate()
  const saved = workout?.comparison
  const hasSnapshot = saved?.version === 1 && ['personal', 'professional', 'repeat', 'freestyle'].includes(saved.origin) && Array.isArray(saved.planned)
  const context = !workout ? 'Conclua seu primeiro treino para visualizar seu mapa muscular.'
    : !hasSnapshot ? 'O planejamento original não foi registrado neste treino.'
      : saved.origin === 'freestyle' ? 'Treino livre, sem referência planejada.'
        : 'Veja o planejamento, os ajustes e os músculos trabalhados.'
  return <section className="card tc-preview" aria-label={t('Mapa do treino')}>
    <div className="tc-preview-copy">
      <h2>{t('Mapa do treino')}</h2>
      <p>{t('Compare o planejado com o que você realizou.')}</p>
      <p className="tc-preview-context">{t(context)}</p>
      {workout && <div className="tc-preview-session"><Icon name="dumbbell" /><span>{workout.name}</span><time dateTime={workout.d}>{fmtDate(workout.d)}</time></div>}
    </div>
    <Button variant="ghost" trailingIcon="chevronRight" onClick={() => navigate(workout ? trainingComparisonHref(workout.id) : '/workout')}>{t(workout ? 'Ver comparativo' : 'Começar treino')}</Button>
  </section>
}
