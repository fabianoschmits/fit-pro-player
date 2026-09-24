import { useMemo, useState } from 'react'
import { Button, Section, TextField } from './ui.jsx'
import { DAYS, normalizeWeeklyPlan, validateWeeklyPlan } from '../lib/professional-program.js'

const labels = { sunday: 'Domingo', monday: 'Segunda', tuesday: 'Terça', wednesday: 'Quarta', thursday: 'Quinta', friday: 'Sexta', saturday: 'Sábado' }

export default function ProfessionalProgramEditor({ exercises = [], initialPlan = {}, onPublish, onCancel }) {
  const [day, setDay] = useState('monday')
  const [draft, setDraft] = useState(() => normalizeWeeklyPlan(initialPlan))
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  const current = draft[day] || []
  const available = useMemo(() => exercises.filter(ex => `${ex.n || ex.name || ''} ${ex.id}`.toLowerCase().includes(query.toLowerCase().trim())).slice(0, 12), [exercises, query])
  const add = exercise => setDraft(value => ({ ...value, [day]: [...(value[day] || []), { exerciseId: exercise.id, sets: 3, reps: 8, load: 0, rest: 90 }] }))
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
        <strong>{exercises.find(ex => ex.id === entry.exerciseId)?.n || entry.exerciseId}</strong>
        <div className="row-actions program-fields">
          <label>Séries<TextField inputMode="numeric" value={entry.sets} onChange={event => update(index, 'sets', event.target.value)} /></label>
          <label>Reps<TextField inputMode="numeric" value={entry.reps} onChange={event => update(index, 'reps', event.target.value)} /></label>
          <label>Carga<TextField inputMode="decimal" value={entry.load ?? 0} onChange={event => update(index, 'load', event.target.value)} /></label>
          <Button onClick={() => remove(index)}>Remover</Button>
        </div>
      </div>)}
    </Section>
    <Section title="Adicionar exercício">
      <TextField aria-label="Buscar exercício" placeholder="Buscar exercício" value={query} onChange={event => setQuery(event.target.value)} />
      <div className="list">{available.map(exercise => <div className="card row between" key={exercise.id}><span>{exercise.n || exercise.name || exercise.id}</span><Button onClick={() => add(exercise)}>Adicionar {exercise.n || exercise.name || exercise.id}</Button></div>)}</div>
    </Section>
    <Button variant="primary" onClick={publish}>Publicar nova versão</Button>
  </div>
}
