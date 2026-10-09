import { useState } from 'react'
import Dialog from '../../../components/Dialog.jsx'
import { Button, TextField, TextArea } from '../../../components/ui.jsx'
import { t } from '../../../lib/i18n.js'
import { validateWeeklyPlan } from '../../../lib/professional-program.js'
import { prescriptionDefaults } from '../hooks/useProgramDraft.js'

export default function PrescriptionSheet({ open, prescription, onSave, onClose, onAfterClose }) {
  return open ? <PrescriptionForm key={JSON.stringify(prescription)} prescription={prescription} onSave={onSave} onClose={onClose} onAfterClose={onAfterClose} /> : null
}
function PrescriptionForm({ prescription, onSave, onClose, onAfterClose }) {
  const [value, setValue] = useState(() => prescriptionDefaults(prescription)), [error, setError] = useState('')
  const change = (key, next) => setValue(previous => ({ ...previous, [key]: next }))
  const numeric = (key, label, fallback, max) => <label>{t(label)}<TextField type="number" min={['sets', 'reps'].includes(key) ? 1 : 0} max={max} step={['sets', 'reps'].includes(key) ? 1 : 'any'} value={value[key] ?? fallback} onChange={event => change(key, event.target.value)} /></label>
  const effort = next => setValue(previous => { const result = { ...previous, effort: next }; delete result.rir; delete result.rpe; if (['rir', 'rpe'].includes(next)) result[next] = previous[next] ?? (next === 'rpe' ? 7 : 2); return result })
  const save = () => { if (!validateWeeklyPlan({ monday: [value] }).ok) { setError(t('Revise os exercícios e os valores informados.')); return }; onSave({ ...value, rir: value.rir, rpe: value.rpe }) }
  return <Dialog title={t('Editar prescrição')} onClose={onClose} onAfterClose={onAfterClose} className="professional-prescription-sheet professional-editor-sheet">
    {error && <p role="alert">{error}</p>}
    <div className="professional-editor-grid program-fields">
      <label>{t('Tipo de execução')}<select value={value.mode || 'reps'} onChange={event => setValue(previous => prescriptionDefaults({ ...previous, mode: event.target.value }))}><option value="reps">{t('Reps')}</option><option value="time">{t('Duração (s)')}</option><option value="cardio">{t('Cardio')}</option></select></label>
      {numeric('sets', 'Séries', 3, 50)}
      {value.mode === 'time' ? numeric('sec', 'Duração (s)', 45, 86400) : value.mode === 'cardio' ? <>{numeric('min', 'Duração (min)', 20, 1440)}{numeric('speed', 'Velocidade (km/h)', 8, 100)}</> : numeric('reps', 'Reps', 8, 500)}
      {value.mode !== 'cardio' && <>{numeric('load', 'Carga', 0, 10000)}<label>{t('Unidade')}<select value={value.unit || 'kg'} onChange={event => change('unit', event.target.value)}><option value="kg">kg</option><option value="lb">lb</option></select></label></>}
      {numeric('rest', 'Descanso (s)', 90, 3600)}
    </div>
    <details><summary>{t('Opções avançadas')}</summary><div className="professional-editor-grid program-fields"><label>{t('Esforço')}<select value={value.effort || 'none'} onChange={event => effort(event.target.value)}><option value="none">{t('Sem esforço prescrito')}</option><option value="rir">RIR</option><option value="rpe">RPE</option></select></label>{['rir', 'rpe'].includes(value.effort) && numeric(value.effort, value.effort.toUpperCase(), value.effort === 'rir' ? 2 : 7, 10)}<label>{t('Grupo de superset')}<TextField value={value.sg || ''} maxLength={80} onChange={event => change('sg', event.target.value)} /></label><label>{t('Notas')}<TextArea value={value.notes || ''} maxLength={500} onChange={event => change('notes', event.target.value)} /></label></div></details>
    <Button variant="primary" onClick={save}>{t('Salvar')}</Button>
  </Dialog>
}
