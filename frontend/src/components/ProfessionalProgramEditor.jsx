import { useEffect, useMemo, useState } from 'react'
import { Button, Section, TextArea, TextField } from './ui.jsx'
import Dialog from './Dialog.jsx'
import { DAYS, normalizeWeeklyPlan, validateWeeklyPlan } from '../lib/professional-program.js'
import { useStore } from '../store/useStore.js'
import { t } from '../lib/i18n.js'
import ExerciseGuideAnimation from './ExerciseGuideAnimation.jsx'
import { exerciseName, exerciseSearchText, isCardio } from '../lib/exercises.js'

const labels = { sunday: 'Domingo', monday: 'Segunda', tuesday: 'Terça', wednesday: 'Quarta', thursday: 'Quinta', friday: 'Sexta', saturday: 'Sábado' }

export default function ProfessionalProgramEditor({ exercises = [], initialPlan = {}, initialMetadata, draftKey, onPublish, onSaveMetadata, onCancel }) {
  const [saved] = useState(() => draftKey ? useStore.getState().S.professionalProgramDrafts?.[draftKey] : null)
  const [day, setDay] = useState('monday')
  const [copyTo, setCopyTo] = useState('tuesday')
  const [draft, setDraft] = useState(() => saved?.plan || normalizeWeeklyPlan(initialPlan))
  const [metadata, setMetadata] = useState(() => saved?.metadata || initialMetadata || {})
  const [query, setQuery] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [expandedExerciseId, setExpandedExerciseId] = useState(null)
  const [visibleCount, setVisibleCount] = useState(40)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [draftError, setDraftError] = useState(false)
  const current = draft[day] || []
  useEffect(() => {
    if (!draftKey) return
    try { useStore.getState().update(state => { state.professionalProgramDrafts ||= {}; state.professionalProgramDrafts[draftKey] = { plan: draft, metadata, savedAt: new Date().toISOString() } }); setDraftError(false) }
    catch { setDraftError(true) }
  }, [draft, metadata, draftKey])
  const available = useMemo(() => exercises.filter(ex => exerciseSearchText(ex).includes(query.toLocaleLowerCase().trim())), [exercises, query])
  const selectedIds = useMemo(() => new Set(current.map(entry => entry.exerciseId)), [current])
  const add = exercise => setDraft(value => selectedIds.has(exercise.id) ? value : ({ ...value, [day]: [...(value[day] || []), { exerciseId: exercise.id, sets: 3, reps: 8, load: 0, rest: 90, ...(isCardio(exercise) ? { mode: 'cardio', min: 20, speed: 8 } : {}) }] }))
  const update = (index, key, value) => setDraft(state => ({ ...state, [day]: state[day].map((entry, i) => i === index ? { ...entry, [key]: value } : entry) }))
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
    <div className="row between"><div><h3>{t('Editar programa semanal')}</h3><p className="muted">{t('Monte uma nova versão; versões enviadas permanecem no histórico.')}</p></div><Button disabled={pending} onClick={onCancel}>{t('Cancelar')}</Button></div>
    {saved && <p role="status">{t('Rascunho recuperado.')}</p>}
    {draftKey && <p className="muted small" role="status">{t(draftError ? 'Não foi possível salvar o rascunho neste dispositivo.' : 'Rascunho salvo neste dispositivo.')}</p>}
    {error && <p role="alert" className="error">{error}</p>}
    {initialMetadata && <Section title={t('Dados do programa')}><label>{t('Nome do programa')}<TextField maxLength={160} value={metadata.title || ''} disabled={pending} onChange={event => setMetadata({ ...metadata, title: event.target.value })} /></label><label>{t('Descrição do programa')}<TextArea maxLength={2000} value={metadata.description || ''} disabled={pending} onChange={event => setMetadata({ ...metadata, description: event.target.value })} /></label>{onSaveMetadata && <Button disabled={pending || !metadata.title?.trim()} onClick={saveMetadata}>{t('Salvar dados do programa')}</Button>}</Section>}
    <div className="chips" role="tablist" aria-label={t('Dias do programa')}>{DAYS.map(item => <button type="button" role="tab" key={item} disabled={pending} className={'chip' + (day === item ? ' on' : '')} aria-selected={day === item} onClick={() => setDay(item)}>{t(labels[item])}</button>)}</div>
    <Section title={t('{0} · {1} exercício(s)', t(labels[day]), current.length)}>
      <div className="row-actions"><label>{t('Dia de destino')}<select value={copyTo} disabled={pending} onChange={event => setCopyTo(event.target.value)}>{DAYS.map(item => <option key={item} value={item}>{t(labels[item])}</option>)}</select></label><Button disabled={pending || copyTo === day || !current.length} onClick={() => setDraft(state => ({ ...state, [copyTo]: structuredClone(current) }))}>{t('Copiar dia')}</Button><Button disabled={pending || copyTo === day} onClick={() => setDraft(state => ({ ...state, [copyTo]: state[day] || [], [day]: state[copyTo] || [] }))}>{t('Trocar dias')}</Button></div>
      {!current.length && <p className="muted">{t('Nenhum exercício neste dia.')}</p>}
      {current.map((entry, index) => <article className="card" key={`${entry.exerciseId}-${index}`}>
        <div className="row between"><strong>{exerciseName(exercises.find(ex => ex.id === entry.exerciseId) || { id: entry.exerciseId, n: entry.exerciseId })}</strong><div className="row-actions"><Button aria-label={t('Mover exercício {0} para cima', index + 1)} disabled={pending || index === 0} onClick={() => move(index, -1)}>↑</Button><Button aria-label={t('Mover exercício {0} para baixo', index + 1)} disabled={pending || index === current.length - 1} onClick={() => move(index, 1)}>↓</Button><Button aria-label={t('Duplicar exercício {0}', index + 1)} disabled={pending} onClick={() => editEntries(entries => { entries.splice(index + 1, 0, structuredClone(entry)); return entries })}>{t('Duplicar')}</Button><Button disabled={pending} onClick={() => editEntries(entries => entries.filter((_, i) => i !== index))}>{t('Remover')}</Button></div></div>
        <div className="professional-editor-grid program-fields">
          <label>{t('Tipo de execução')}<select value={entry.mode || 'reps'} disabled={pending} onChange={event => update(index, 'mode', event.target.value)}><option value="reps">{t('Reps')}</option><option value="time">{t('Duração (s)')}</option><option value="cardio">{t('Cardio')}</option></select></label>
          {field(entry, index, 'sets', 'Séries', 3)}
          {entry.mode === 'time' ? field(entry, index, 'sec', 'Duração (s)', 45) : entry.mode === 'cardio' ? <>{field(entry, index, 'min', 'Duração (min)', 20)}{field(entry, index, 'speed', 'Velocidade (km/h)', 8)}</> : field(entry, index, 'reps', 'Reps', 8)}
          {entry.mode !== 'cardio' && <>{field(entry, index, 'load', 'Carga')}<label>{t('Unidade')}<select disabled={pending} value={entry.unit || 'kg'} onChange={event => update(index, 'unit', event.target.value)}><option value="kg">kg</option><option value="lb">lb</option></select></label></>}
          {field(entry, index, 'rest', 'Descanso (s)', 90)}
          <label>{t('Esforço')}<select value={entry.effort || 'none'} disabled={pending} onChange={event => { const kind = event.target.value; update(index, 'effort', kind); if (kind !== 'none') update(index, kind, entry[kind] ?? (kind === 'rpe' ? 7 : 2)) }}><option value="none">{t('Sem esforço prescrito')}</option><option value="rir">RIR</option><option value="rpe">RPE</option></select></label>
          {['rir', 'rpe'].includes(entry.effort) && field(entry, index, entry.effort, entry.effort.toUpperCase(), entry.effort === 'rpe' ? 7 : 2)}
          <label>{t('Grupo de superset')}<TextField value={entry.sg || ''} maxLength={80} disabled={pending} placeholder={t('Mesmo grupo para exercícios em sequência')} onChange={event => update(index, 'sg', event.target.value)} /></label>
        </div>
        <label>{t('Notas')}<TextArea value={entry.notes || ''} maxLength={500} disabled={pending} onChange={event => update(index, 'notes', event.target.value)} /></label>
      </article>)}
      <Button variant="primary" disabled={pending} onClick={() => { setPickerOpen(true); setQuery(''); setVisibleCount(40); setExpandedExerciseId(null) }}>{t('Adicionar exercício')}</Button>
    </Section>
    {pickerOpen && <Dialog title={t('Selecionar exercício')} onClose={() => setPickerOpen(false)} className="professional-exercise-modal">
      <p className="muted">{t('Todos os exercícios disponíveis para prescrição.')}</p>
      <TextField aria-label={t('Pesquisar exercício')} placeholder={t('Pesquisar por nome, músculo ou equipamento')} value={query} onChange={event => { setQuery(event.target.value); setVisibleCount(40) }} />
      <p className="muted small">{t('{0} exercício(s) encontrado(s)', available.length)}</p>
      <div className="professional-exercise-picker-list">{available.slice(0, visibleCount).map(exercise => { const name = exerciseName(exercise); const selected = selectedIds.has(exercise.id); const expanded = expandedExerciseId === exercise.id; return <article className={'card professional-exercise-picker-item' + (selected ? ' is-selected' : '')} key={exercise.id}>
        <div className="row between professional-exercise-picker-main"><div><strong>{name}</strong><small className="muted">{[exercise.bp && t(exercise.bp), exercise.eq && t(exercise.eq)].filter(Boolean).join(' · ')}</small></div><div className="row-actions"><Button disabled={selected} onClick={() => add(exercise)}>{t(selected ? 'Selecionado' : 'Adicionar')}</Button><button type="button" className="exercise-animation-toggle" aria-expanded={expanded} aria-label={t('Ver animação de {0}', name)} onClick={() => setExpandedExerciseId(expanded ? null : exercise.id)}>⌄</button></div></div>
        {expanded && <div className="professional-exercise-animation"><ExerciseGuideAnimation ex={exercise} playing fallback={<p className="muted small">{t('Animação ainda não disponível para este exercício.')}</p>} /></div>}
      </article> })}</div>
      {available.length > visibleCount && <Button onClick={() => setVisibleCount(count => count + 40)}>{t('Carregar mais')}</Button>}
      {!available.length && <p className="muted">{t('Nenhum exercício corresponde à pesquisa.')}</p>}
    </Dialog>}
    <Button variant="primary" disabled={pending} onClick={publish}>{t(pending ? 'Publicando…' : 'Publicar nova versão')}</Button>
  </div>
}
