import { useId, useState } from 'react'
import Media, { Thumb } from '../Media.jsx'
import { exOr, exerciseName } from '../../lib/exercises.js'
import { exLine } from '../../lib/history.js'
import { t } from '../../lib/i18n.js'
import Icon from '../Icon.jsx'
import { Button, NumberField, TextArea } from '../ui.jsx'
export default function ExerciseCard({ entry, unit = 'kg', onEdit, onChange, children }) {
  const [expanded, setExpanded] = useState(false)
  const id = useId(), ex = exOr(entry.id)
  return <article className="card training-exercise-card">
    <button className="routine-item-main" aria-expanded={expanded} aria-controls={id} onClick={() => setExpanded(value => !value)}>
      <Thumb ex={ex} /><span className="grow"><strong className="tt">{exerciseName(ex)}</strong><span className="ss">{exLine(entry, unit)}{entry.rest != null ? ` · ${entry.rest}s` : ''}</span><span className="ss">{t(ex.tg || ex.bp)}{ex.secondaryMuscles?.length ? ` · ${ex.secondaryMuscles.map(t).join(' · ')}` : ''}</span></span><Icon name={expanded ? 'chevronUp' : 'chevronDown'} />
    </button>
    {expanded && <div id={id} className="training-exercise-details"><Media ex={ex} compact />
      <p>{exLine(entry, unit)}</p>{entry.rest != null && <p>{entry.rest} s · {t('Rest')}</p>}
      {entry.rir != null && <p>RIR {entry.rir}</p>}{entry.rpe != null && <p>RPE {entry.rpe}</p>}{entry.notes && <p>{entry.notes}</p>}
      {onChange && <details><summary>Mais opções</summary>
        <label>Descanso (s)<NumberField value={entry.rest ?? 90} onChange={rest => onChange({ rest: Math.min(3600, rest) })} /></label>
        <label>RIR<NumberField nullable value={entry.rir} onChange={rir => onChange({ rir: rir == null ? null : Math.min(10, rir), rpe: null, effort: 'rir' })} /></label>
        <label>RPE<NumberField nullable value={entry.rpe} onChange={rpe => onChange({ rpe: rpe == null ? null : Math.min(10, rpe), rir: null, effort: 'rpe' })} /></label>
        <label>Orientação<TextArea maxLength={500} value={entry.notes || ''} onChange={e => onChange({ notes: e.target.value })} /></label>
      </details>}
      {onEdit && <Button onClick={onEdit}>{t('Editar exercício')}</Button>}
    </div>}{children}
  </article>
}
