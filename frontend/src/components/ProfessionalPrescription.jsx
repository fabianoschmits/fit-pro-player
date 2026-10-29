import ExerciseCard from './training/ExerciseCard.jsx'
import { EXIDX, exerciseName } from '../lib/exercises.js'
import { normalizeWeeklyPlan } from '../lib/professional-program.js'
import { t } from '../lib/i18n.js'
import { professionalExecutionDurationMs } from '../lib/professional-execution-display.js'

const dayNames = { sunday: 'Domingo', monday: 'Segunda', tuesday: 'Terça', wednesday: 'Quarta', thursday: 'Quinta', friday: 'Sexta', saturday: 'Sábado' }
export const professionalDayLabel = day => t(dayNames[day] || day || '—')
const nameOf = id => exerciseName(EXIDX[id] || { id, n: id })
const dose = entry => entry.mode === 'cardio' ? `${entry.min ?? '—'} min / ${entry.speed ?? '—'} km/h` : entry.mode === 'time' ? `${entry.sec ?? '—'} s` : `${entry.reps ?? '—'} ${t('Reps')}`

export function ProfessionalPrescription({ plan = {}, entries, unit = 'kg' }) {
  const days = entries ? { session: entries } : normalizeWeeklyPlan(plan)
  return <div className="professional-prescription">{Object.entries(days).map(([day, items]) => <div key={day}>
    {day !== 'session' && <h4>{professionalDayLabel(day)}</h4>}
    {items.map((entry, index) => <ExerciseCard key={`${entry.exerciseId || entry.id}-${index}`} entry={{ ...entry, id: entry.exerciseId || entry.id, weight: entry.load ?? entry.weight ?? 0 }} unit={unit} />)}
  </div>)}</div>
}

export function ProfessionalSessionDetail({ execution }) {
  const payload = execution.payload || {}
  const prescription = payload.prescription || payload.prescribedEntries || execution.prescription_snapshot?.exercises || []
  const actual = payload.entries || []
  const unit = payload.massUnit || payload.unit || 'kg'
  return <div className="professional-session-detail">
    <div><h4>{t('Prescrito')}</h4>{prescription.length ? <ProfessionalPrescription entries={prescription} unit={unit} /> : <p className="muted">{t('Prescrição não disponível nesta execução.')}</p>}</div>
    <div><h4>{t('Realizado')}</h4>{actual.length ? actual.map((entry, index) => {
      const sets = entry.sets || []; const completed = sets.filter(set => set.done)
      return <div className="professional-prescription-row" key={`${entry.id}-${index}`}><strong>{nameOf(entry.id)}</strong><span>{t('Séries concluídas')}: {completed.length}/{sets.length}</span>
        {completed.map((set, setIndex) => <div key={setIndex}>{t('Série {0}', setIndex + 1)}: {set.min != null ? `${set.min} min / ${set.speed ?? '—'} km/h` : set.sec != null ? `${set.sec} s / ${set.w ?? 0} ${unit}` : `${set.w ?? 0} ${unit} × ${set.r ?? 0}`}{set.rir != null ? ` / RIR ${set.rir}` : ''}{set.rpe != null ? ` / RPE ${set.rpe}` : ''}{set.warmup ? ` / ${t('Warm-up')}` : ''}</div>)}
        {entry.replacedFrom && <span>{t('Substituiu {0}', nameOf(entry.replacedFrom))}</span>}
      </div>
    }) : <p className="muted">{t('Nenhuma série realizada recebida.')}</p>}</div>
    {professionalExecutionDurationMs(execution) != null && <p className="muted">{t('Duração realizada (min)')}: {Math.round(professionalExecutionDurationMs(execution) / 60000)}</p>}
  </div>
}
