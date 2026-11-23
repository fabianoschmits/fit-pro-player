import { useState } from 'react'
import BodyMap from '../BodyMap.jsx'
import { Segmented } from '../ui.jsx'
import { dateLocale, t } from '../../lib/i18n.js'
import { MUSCLE_NAME } from '../../lib/muscles.js'

const STAGES = [{ value: 'planned', label: 'Original' }, { value: 'adjusted', label: 'Ajustado' }, { value: 'actual', label: 'Realizado' }]
const STATES = { unreferenced: 'Sem referência', below: 'Abaixo da referência', matched: 'Na referência', above: 'Acima da referência' }
const EXPLANATIONS = {
  unreferenced: 'Este músculo não tem uma referência planejada para comparação.',
  below: 'Foram realizadas menos séries ponderadas para este músculo do que na referência ajustada.',
  matched: 'As séries ponderadas realizadas correspondem à referência ajustada.',
  above: 'Foram realizadas mais séries ponderadas para este músculo do que na referência ajustada.',
}
const valueText = value => value == null ? '—' : Number(value).toLocaleString(dateLocale(), { maximumFractionDigits: 2 })

export default function TrainingComparisonBodyMap({ comparison, body }) {
  const [stage, setStage] = useState('actual')
  const [view, setView] = useState('front')
  const [selected, setSelected] = useState(null)
  const stages = STAGES.filter(item => comparison.loads[item.value] != null)
  const activeStage = stages.some(item => item.value === stage) ? stage : 'actual'
  const muscle = comparison.muscles.find(item => item.id === selected)
  return <section className="tc-map-workspace" aria-label={t('Séries ponderadas por músculo')}>
    <div className="tc-map-controls">
      {stages.length > 1 && <div className="tc-stage-switch" role="group" aria-label={t('Etapa do treino')}><Segmented value={activeStage} onChange={setStage} options={stages.map(item => ({ ...item, label: t(item.label) }))} /></div>}
      <div className="tc-view-switch" role="group" aria-label={t('Vista do corpo')}><Segmented value={view} onChange={setView} options={[{ value: 'front', label: t('Frente') }, { value: 'back', label: t('Costas') }]} /></div>
    </div>
    <div className="tc-maps" data-map-count={stages.length}>
      {stages.map(item => <div key={item.value} className={'tc-map-panel' + (activeStage === item.value ? ' is-active' : '')} aria-label={t(item.label)}>
        <h2>{t(item.label)}</h2>
        <BodyMap className="tappable tc-bodymap" load={comparison.loads[item.value]} thresholds={comparison.thresholds} body={body} view={view} selected={selected} onMuscle={id => setSelected(previous => previous === id ? null : id)} />
      </div>)}
    </div>
    <div className="tc-map-legend">
      <strong>{t('Estimativa por séries ponderadas')}</strong>
      <div className="tc-numeric-legend"><span><i className="hm-c l0" aria-hidden="true" />0</span>{comparison.thresholds.map(rule => <span key={rule.level}><i className={'hm-c l' + rule.level} aria-hidden="true" />{rule.exclusive ? '> ' : '≥ '}{valueText(rule.at)}</span>)}</div>
      <p>{t('As cores usam a mesma escala nas três etapas. Séries ponderadas estimam a participação de cada músculo nos exercícios.')}</p>
    </div>
    <div className="tc-muscle-detail" aria-live="polite" aria-atomic="true">
      {muscle ? <>
        <div className="tc-muscle-heading"><h3>{t(MUSCLE_NAME[muscle.id] || muscle.label)}</h3><span>{t(STATES[muscle.state])}</span></div>
        <dl>{STAGES.map(item => <div key={item.value}><dt>{t(item.label)}</dt><dd>{valueText(muscle[item.value])}</dd></div>)}</dl>
        <p className="tc-muscle-explanation">{t(EXPLANATIONS[muscle.state])}</p>
      </> : <p>{t('Toque em um músculo para comparar os valores.')}</p>}
    </div>
  </section>
}
