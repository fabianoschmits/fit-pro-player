import { useMemo, useState } from 'react'
import { Button, Section, TextField } from './ui.jsx'
import { DAYS, normalizeWeeklyPlan, validateWeeklyPlan } from '../lib/professional-program.js'
import ExerciseGuideAnimation from './ExerciseGuideAnimation.jsx'
import { exerciseName, exerciseSearchText } from '../lib/exercises.js'

const labels = { sunday: 'Domingo', monday: 'Segunda', tuesday: 'Terça', wednesday: 'Quarta', thursday: 'Quinta', friday: 'Sexta', saturday: 'Sábado' }

export default function ProfessionalProgramEditor({ exercises = [], initialPlan = {}, onPublish, onCancel }) {
  const [day, setDay] = useState('monday')
  const [draft, setDraft] = useState(() => normalizeWeeklyPlan(initialPlan))
  const [query, setQuery] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [expandedExerciseId, setExpandedExerciseId] = useState(null)
  const [error, setError] = useState('')
  const current = draft[day] || []
  const available = useMemo(() => exercises.filter(ex => exerciseSearchText(ex).includes(query.toLocaleLowerCase().trim())), [exercises, query])
  const selectedIds = useMemo(() => new Set(current.map(entry => entry.exerciseId)), [current])
  const add = exercise => setDraft(value => selectedIds.has(exercise.id) ? value : ({ ...value, [day]: [...(value[day] || []), { exerciseId: exercise.id, sets: 3, reps: 8, load: 0, rest: 90 }] }))
  const update = (index, key, value) => setDraft(state => ({ ...state, [day]: state[day].map((entry, i) => i === index ? { ...entry, [key]: value } : entry) }))
  const remove = index => setDraft(state => ({ ...state, [day]: state[day].filter((_, i) => i !== index) }))
  const publish = () => {
    const result = validateWeeklyPlan(draft)
    if (!result.ok) { setError(result.error === 'weekly-plan-empty' ? 'Adicione pelo menos um exercício antes de publicar.' : 'Revise os exercícios e os valores informados.'); return }
    setError(''); onPublish(result.value)
  }
  return <div className="professional-program-editor">
    <div className="row between"><div><h3>Editar programa semanal</h3><p className="muted small">Monte uma nova versão; versões enviadas permanecem no histórico.</p></div><Button onClick={onCancel}>Cancelar</Button></div>
    {error && <p role="alert" className="error">{error}</p>}
    <div className="chips" role="tablist" aria-label="Dias do programa">{DAYS.map(item => <button type="button" key={item} className={'chip' + (day === item ? ' on' : '')} aria-selected={day === item} onClick={() => setDay(item)}>{labels[item]}</button>)}</div>
    <Section title={`${labels[day]} · ${current.length} exercício(s)`}>
      {!current.length && <p className="muted">Nenhum exercício neste dia.</p>}
      {current.map((entry, index) => <div className="card" key={`${entry.exerciseId}-${index}`}>
        <strong>{exerciseName(exercises.find(ex => ex.id === entry.exerciseId) || { id: entry.exerciseId, n: entry.exerciseId })}</strong>
        <div className="row-actions program-fields">
          <label>Séries<TextField inputMode="numeric" value={entry.sets} onChange={event => update(index, 'sets', event.target.value)} /></label>
          <label>Reps<TextField inputMode="numeric" value={entry.reps} onChange={event => update(index, 'reps', event.target.value)} /></label>
          <label>Carga<TextField inputMode="decimal" value={entry.load ?? 0} onChange={event => update(index, 'load', event.target.value)} /></label>
          <Button onClick={() => remove(index)}>Remover</Button>
        </div>
      </div>)}
    </Section>
    <Section title="Exercícios do plano">
      <p className="muted">Abra a lista completa para pesquisar e adicionar exercícios a este dia.</p>
      <Button variant="primary" onClick={() => { setPickerOpen(true); setQuery(''); setExpandedExerciseId(null) }}>Adicionar exercício</Button>
    </Section>
    {pickerOpen && <div className="professional-exercise-modal-layer" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setPickerOpen(false) }}>
      <div className="professional-exercise-modal" role="dialog" aria-modal="true" aria-labelledby="professional-exercise-picker-title">
        <div className="row between professional-exercise-modal-header"><div><h3 id="professional-exercise-picker-title">Selecionar exercício</h3><p className="muted small">Todos os exercícios disponíveis para prescrição.</p></div><Button aria-label="Fechar lista de exercícios" onClick={() => setPickerOpen(false)}>Fechar</Button></div>
        <TextField aria-label="Pesquisar exercício" placeholder="Pesquisar por nome, músculo ou equipamento" value={query} onChange={event => setQuery(event.target.value)} />
        <p className="muted small">{available.length} exercício(s) encontrado(s)</p>
        <div className="professional-exercise-picker-list">{available.map(exercise => { const name = exerciseName(exercise); const selected = selectedIds.has(exercise.id); const expanded = expandedExerciseId === exercise.id; return <article className={'card professional-exercise-picker-item' + (selected ? ' is-selected' : '')} key={exercise.id}>
          <div className="row between professional-exercise-picker-main"><div><strong>{name}</strong><small className="muted">{[exercise.bp, exercise.eq].filter(Boolean).join(' · ')}</small></div><div className="row-actions"><Button disabled={selected} onClick={() => add(exercise)}>{selected ? 'Selecionado' : 'Adicionar'}</Button><button type="button" className="exercise-animation-toggle" aria-expanded={expanded} aria-label={`Ver animação de ${name}`} onClick={() => setExpandedExerciseId(expanded ? null : exercise.id)}>⌄</button></div></div>
          {expanded && <div className="professional-exercise-animation"><ExerciseGuideAnimation ex={exercise} playing fallback={<p className="muted small">Animação ainda não disponível para este exercício.</p>} /></div>}
        </article> })}</div>
        {!available.length && <p className="muted">Nenhum exercício corresponde à pesquisa.</p>}
      </div>
    </div>}
    <Button variant="primary" onClick={publish}>Publicar nova versão</Button>
  </div>
}
