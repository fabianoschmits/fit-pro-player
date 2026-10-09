import { useMemo, useState } from 'react'
import Dialog from './Dialog.jsx'
import { Button, SearchField } from './ui.jsx'
import Icon from './Icon.jsx'
import { Thumb } from './Media.jsx'
import ExerciseGuideAnimation from './ExerciseGuideAnimation.jsx'
import { exerciseName, exerciseSearchText } from '../lib/exercises.js'
import { exerciseGuideAsset } from '../lib/exercise-guide-assets.js'
import { sentenceCase } from '../lib/format.js'
import { t } from '../lib/i18n.js'

export default function ProfessionalExercisePicker({ exercises, selectedIds, exerciseCount, dayLabel, onAdd, onClose, onAfterClose }) {
  const [query, setQuery] = useState('')
  const [muscle, setMuscle] = useState('')
  const [equipment, setEquipment] = useState('')
  const [expanded, setExpanded] = useState(null)
  const [count, setCount] = useState(40)
  const muscles = useMemo(() => [...new Set(exercises.map(ex => ex.bp).filter(Boolean))], [exercises])
  const base = useMemo(() => exercises.filter(ex => (!muscle || ex.bp === muscle) && exerciseSearchText(ex).includes(query.toLocaleLowerCase().trim())), [exercises, muscle, query])
  const equipments = [...new Set(base.map(ex => ex.eq).filter(Boolean))]
  const activeEquipment = equipments.includes(equipment) ? equipment : ''
  const available = activeEquipment ? base.filter(ex => ex.eq === activeEquipment) : base
  const resetList = () => { setCount(40); setExpanded(null) }
  return <Dialog title={t('Selecionar exercício')} onClose={onClose} onAfterClose={onAfterClose} className="professional-exercise-modal professional-editor-sheet">
    <div className="professional-picker-tools">
      <p className="muted small">{dayLabel} · {t('Use a seta para ver a animação e Adicionar para incluir no dia.')}</p>
      <SearchField type="search" inputMode="search" aria-label={t('Pesquisar exercício')} placeholder={t('Pesquisar por nome, músculo ou equipamento')} value={query} onChange={event => { setQuery(event.target.value); setEquipment(''); resetList() }} onClear={() => { setQuery(''); setEquipment(''); resetList() }} />
      <div className="professional-picker-filters">
        <select aria-label={t('Filtrar por músculo')} value={muscle} onChange={event => { setMuscle(event.target.value); setEquipment(''); resetList() }}><option value="">{t('All')}</option>{muscles.map(value => <option key={value} value={value}>{sentenceCase(t(value))}</option>)}</select>
        <select aria-label={t('Filtrar por equipamento')} value={activeEquipment} onChange={event => { setEquipment(event.target.value); resetList() }}><option value="">{t('Any equipment')}</option>{equipments.map(value => <option key={value} value={value}>{sentenceCase(t(value))}</option>)}</select>
      </div>
      <p className="muted small" role="status">{t('{0} exercício(s) encontrado(s)', available.length)}</p>
    </div>
    <div className="list professional-picker-results">{available.slice(0, count).map(exercise => {
      const name = exerciseName(exercise), selected = selectedIds.has(exercise.id), open = expanded === exercise.id
      const previewId = `professional-preview-${exercise.id}`
      return <article className={'professional-picker-row' + (selected ? ' is-selected' : '')} key={exercise.id}>
        <div className="professional-picker-line">
          <Thumb ex={exercise} />
          <div className="professional-picker-name"><strong>{name}</strong><small>{[exercise.tg || exercise.bp, exercise.eq].filter(Boolean).map(value => sentenceCase(t(value))).join(' · ')}</small></div>
          <button type="button" className="professional-picker-preview-button" aria-expanded={open} aria-controls={open ? previewId : undefined} aria-label={t('Ver animação de {0}', name)} onClick={() => setExpanded(open ? null : exercise.id)}><Icon name={open ? 'chevronUp' : 'chevronDown'} /></button>
          <Button size="sm" variant={selected ? 'plain' : 'tinted'} disabled={selected || exerciseCount >= 50} onClick={() => onAdd(exercise)}>{t(selected ? 'Selecionado' : 'Adicionar')}</Button>
        </div>
        {open && <div id={previewId} className="professional-exercise-animation">{exerciseGuideAsset(exercise) ? <ExerciseGuideAnimation ex={exercise} playing fallback={<p className="muted small">{t('Animação ainda não disponível para este exercício.')}</p>} /> : <p className="muted small">{t('Animação ainda não disponível para este exercício.')}</p>}</div>}
      </article>
    })}{!available.length && <p className="empty">{t('Nenhum exercício corresponde à pesquisa.')}</p>}{available.length > count && <Button onClick={() => setCount(value => value + 40)}>{t('Carregar mais')}</Button>}</div>
    <footer className="professional-picker-footer"><span className="muted small">{t('{0} exercício(s) no dia', exerciseCount)}</span><Button variant="primary" onClick={onClose}>{t('Done')}</Button></footer>
  </Dialog>
}
