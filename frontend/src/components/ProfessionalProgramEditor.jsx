import { useEffect, useMemo, useState } from 'react'
import { Button, Section, TextArea, TextField } from './ui.jsx'
import Dialog from './Dialog.jsx'
import { DAYS, normalizeWeeklyPlan, validateWeeklyPlan } from '../lib/professional-program.js'
import { useStore } from '../store/useStore.js'
import { t } from '../lib/i18n.js'
import ProfessionalExercisePicker from './ProfessionalExercisePicker.jsx'
import { exerciseName, isCardio } from '../lib/exercises.js'

const labels = { sunday: 'Domingo', monday: 'Segunda', tuesday: 'Terça', wednesday: 'Quarta', thursday: 'Quinta', friday: 'Sexta', saturday: 'Sábado' }

const modeDefaults = entry => ({ ...entry, rest: entry.rest ?? 90,
  ...(entry.mode === 'time' ? { sec: entry.sec ?? 45 } : {}),
  ...(entry.mode === 'cardio' ? { min: entry.min ?? 20, speed: entry.speed ?? 8 } : {}),
})
const editorPlan = plan => Object.fromEntries(Object.entries(plan).map(([day, entries]) => [day, entries.map(modeDefaults)]))

export default function ProfessionalProgramEditor({ exercises = [], initialPlan = {}, initialMetadata, draftKey, onPublish, onSaveMetadata, onCancel }) {
  const [saved] = useState(() => draftKey ? useStore.getState().S.professionalProgramDrafts?.[draftKey] : null)
  const [day, setDay] = useState('monday')
  const [copyTo, setCopyTo] = useState('tuesday')
  const [draft, setDraft] = useState(() => editorPlan(saved?.plan || normalizeWeeklyPlan(initialPlan)))
  const [metadata, setMetadata] = useState(() => saved?.metadata || initialMetadata || {})
  const [pickerOpen, setPickerOpen] = useState(false)
  const [copyConfirmation, setCopyConfirmation] = useState(null)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [draftError, setDraftError] = useState(false)
  const current = draft[day] || []
  useEffect(() => {
    if (!draftKey) return
    try { useStore.getState().update(state => { state.professionalProgramDrafts ||= {}; state.professionalProgramDrafts[draftKey] = { plan: draft, metadata, savedAt: new Date().toISOString() } }); setDraftError(false) }
    catch { setDraftError(true) }
  }, [draft, metadata, draftKey])
  const selectedIds = useMemo(() => new Set(current.map(entry => entry.exerciseId)), [current])
  const add = exercise => setDraft(value => ((value[day] || []).length >= 50 || (value[day] || []).some(entry => entry.exerciseId === exercise.id)) ? value : ({ ...value, [day]: [...(value[day] || []), { exerciseId: exercise.id, sets: 3, reps: 8, load: 0, rest: 90, ...(isCardio(exercise) ? { mode: 'cardio', min: 20, speed: 8 } : {}) }] }))
  const copyDay = () => {
    if (draft[copyTo]?.length) setCopyConfirmation({ source: day, target: copyTo })
    else setDraft(state => ({ ...state, [copyTo]: structuredClone(state[day] || []) }))
  }
  const update = (index, key, value) => setDraft(state => ({ ...state, [day]: state[day].map((entry, i) => i === index ? { ...entry, [key]: value } : entry) }))
  const changeMode = (index, mode) => editEntries(entries => entries.map((entry, i) => i === index ? modeDefaults({ ...entry, mode }) : entry))
  const changeEffort = (index, effort) => editEntries(entries => entries.map((entry, i) => {
    if (i !== index) return entry
    const next = { ...entry, effort }
    delete next.rir; delete next.rpe
    if (effort === 'rir' || effort === 'rpe') next[effort] = entry[effort] ?? (effort === 'rpe' ? 7 : 2)
    return next
  }))
  const editEntries = fn => setDraft(state => ({ ...state, [day]: fn([...(state[day] || [])]) }))
  const move = (index, delta) => editEntries(entries => { const other = index + delta; [entries[index], entries[other]] = [entries[other], entries[index]]; return entries })
  const publish = async () => {
    if (pending) return
    const result = validateWeeklyPlan(draft)
    if (!result.ok) { setError(t(result.error === 'weekly-plan-empty' ? 'Adicione pelo menos um exercício antes de publicar.' : 'Revise os exercícios e os valores informados.')); return }
    if (initialMetadata && !metadata.title?.trim()) { setError(t('Informe o nome do programa.')); return }
    setError(''); setPending(true)
    try {
      if (initialMetadata) await onPublish(result.value, metadata)
      else await onPublish(result.value)
      if (draftKey) useStore.getState().update(state => { delete state.professionalProgramDrafts?.[draftKey] })
    } catch { setError(t('Não foi possível publicar. Seu rascunho foi mantido; tente novamente.')) }
    finally { setPending(false) }
  }
  const field = (entry, index, key, label, fallback = 0) => <label>{t(label)}<TextField type="number" step="any" min="0" value={entry[key] ?? fallback} disabled={pending} onChange={event => update(index, key, event.target.value)} /></label>
  const saveMetadata = async () => {
    if (pending || !metadata.title?.trim()) return
    setPending(true); setError('')
    try { await onSaveMetadata(metadata) }
    catch { setError(t('Não foi possível salvar os dados. Seu rascunho foi mantido.')) }
    finally { setPending(false) }
  }
  return <div className="professional-program-editor">
    <div className="row between"><div><h3>{t('Montar semana')}</h3><p className="muted small">{t('Escolha o dia, adicione exercícios e ajuste a prescrição. Depois publique e envie ao aluno.')}</p></div><Button disabled={pending} onClick={onCancel}>{t('Cancelar')}</Button></div>
    {saved && <p role="status">{t('Rascunho recuperado.')}</p>}
    {draftKey && <p className="muted small" role="status">{t(draftError ? 'Não foi possível salvar o rascunho neste dispositivo.' : 'Rascunho salvo neste dispositivo.')}</p>}
    {error && <p role="alert" className="error">{error}</p>}
    {initialMetadata && <Section title={t('Dados do programa')}><label>{t('Nome do programa')}<TextField maxLength={160} value={metadata.title || ''} disabled={pending} onChange={event => setMetadata({ ...metadata, title: event.target.value })} /></label><label>{t('Descrição do programa')}<TextArea maxLength={2000} value={metadata.description || ''} disabled={pending} onChange={event => setMetadata({ ...metadata, description: event.target.value })} /></label>{onSaveMetadata && <Button disabled={pending || !metadata.title?.trim()} onClick={saveMetadata}>{t('Salvar dados do programa')}</Button>}</Section>}
    <div className="chips" role="tablist" aria-label={t('Dias do programa')}>{DAYS.map(item => <button type="button" role="tab" key={item} disabled={pending} className={'chip' + (day === item ? ' on' : '')} aria-selected={day === item} onClick={() => setDay(item)}>{t(labels[item])}<span className="professional-day-count">{draft[item]?.length || 0}</span></button>)}</div>
    <Section title={t('{0} · {1} exercício(s)', t(labels[day]), current.length)}>
      <div className="row-actions"><label>{t('Dia de destino')}<select value={copyTo} disabled={pending} onChange={event => setCopyTo(event.target.value)}>{DAYS.map(item => <option key={item} value={item}>{t(labels[item])}</option>)}</select></label><Button disabled={pending || copyTo === day || !current.length} onClick={copyDay}>{t('Copiar dia')}</Button><Button disabled={pending || copyTo === day} onClick={() => setDraft(state => ({ ...state, [copyTo]: state[day] || [], [day]: state[copyTo] || [] }))}>{t('Trocar dias')}</Button></div>
      {!current.length && <p className="muted">{t('Nenhum exercício neste dia.')}</p>}
      {current.map((entry, index) => <article className="card professional-prescription-editor" key={`${entry.exerciseId}-${index}`}>
        <div className="row between professional-prescription-heading"><strong><span className="professional-exercise-order">{index + 1}.</span> {exerciseName(exercises.find(ex => ex.id === entry.exerciseId) || { id: entry.exerciseId, n: entry.exerciseId })}</strong><div className="row-actions"><Button aria-label={t('Mover exercício {0} para cima', index + 1)} disabled={pending || index === 0} onClick={() => move(index, -1)}>↑</Button><Button aria-label={t('Mover exercício {0} para baixo', index + 1)} disabled={pending || index === current.length - 1} onClick={() => move(index, 1)}>↓</Button><Button aria-label={t('Duplicar exercício {0}', index + 1)} disabled={pending || current.length >= 50} onClick={() => editEntries(entries => { entries.splice(index + 1, 0, structuredClone(entry)); return entries })}>{t('Duplicar')}</Button><Button disabled={pending} onClick={() => editEntries(entries => entries.filter((_, i) => i !== index))}>{t('Remover')}</Button></div></div>
        <div className="professional-editor-grid program-fields">
          <label>{t('Tipo de execução')}<select value={entry.mode || 'reps'} disabled={pending} onChange={event => changeMode(index, event.target.value)}><option value="reps">{t('Reps')}</option><option value="time">{t('Duração (s)')}</option><option value="cardio">{t('Cardio')}</option></select></label>
          {field(entry, index, 'sets', 'Séries', 3)}
          {entry.mode === 'time' ? field(entry, index, 'sec', 'Duração (s)', 45) : entry.mode === 'cardio' ? <>{field(entry, index, 'min', 'Duração (min)', 20)}{field(entry, index, 'speed', 'Velocidade (km/h)', 8)}</> : field(entry, index, 'reps', 'Reps', 8)}
          {entry.mode !== 'cardio' && <>{field(entry, index, 'load', 'Carga')}<label>{t('Unidade')}<select disabled={pending} value={entry.unit || 'kg'} onChange={event => update(index, 'unit', event.target.value)}><option value="kg">kg</option><option value="lb">lb</option></select></label></>}
          {field(entry, index, 'rest', 'Descanso (s)', 90)}
        </div>
        <details className="professional-prescription-advanced"><summary>{t('Opções avançadas')}</summary><div className="professional-editor-grid program-fields">
          <label>{t('Esforço')}<select value={entry.effort || 'none'} disabled={pending} onChange={event => changeEffort(index, event.target.value)}><option value="none">{t('Sem esforço prescrito')}</option><option value="rir">RIR</option><option value="rpe">RPE</option></select></label>
          {['rir', 'rpe'].includes(entry.effort) && field(entry, index, entry.effort, entry.effort.toUpperCase(), entry.effort === 'rpe' ? 7 : 2)}
          <label>{t('Grupo de superset')}<TextField value={entry.sg || ''} maxLength={80} disabled={pending} placeholder={t('Mesmo grupo para exercícios em sequência')} onChange={event => update(index, 'sg', event.target.value)} /></label>
          <label>{t('Notas')}<TextArea value={entry.notes || ''} maxLength={500} disabled={pending} onChange={event => update(index, 'notes', event.target.value)} /></label>
        </div></details>
      </article>)}
      <Button variant="primary" disabled={pending} onClick={() => setPickerOpen(true)}>{t('Adicionar exercício')}</Button>
    </Section>
    {pickerOpen && <ProfessionalExercisePicker exercises={exercises} selectedIds={selectedIds} exerciseCount={current.length} dayLabel={t(labels[day])} onAdd={add} onClose={() => setPickerOpen(false)} />}
    {copyConfirmation && <Dialog title={t('Substituir exercícios do dia?')} onClose={() => setCopyConfirmation(null)}>
      <p>{t('Os exercícios de {0} serão substituídos pelos de {1}.', t(labels[copyConfirmation.target]), t(labels[copyConfirmation.source]))}</p>
      <div className="row-actions"><Button variant="primary" onClick={() => { setDraft(state => ({ ...state, [copyConfirmation.target]: structuredClone(state[copyConfirmation.source] || []) })); setCopyConfirmation(null) }}>{t('Substituir dia')}</Button><Button onClick={() => setCopyConfirmation(null)}>{t('Cancelar')}</Button></div>
    </Dialog>}
    <p className="muted small">{t('Publicar salva uma versão do programa. O envio ao aluno é feito no próximo passo.')}</p>
    <Button variant="primary" disabled={pending} onClick={publish}>{t(pending ? 'Publicando…' : 'Publicar nova versão')}</Button>
  </div>
}
