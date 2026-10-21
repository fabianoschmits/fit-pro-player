import { useState } from 'react'
import Icon from '../../components/Icon.jsx'
import ConsoleShell from '../../features/console/ConsoleLayout.jsx'
import { AccessGate, useConsoleAccess } from '../../features/console/ConsoleAccess.jsx'
import { PLAYER_DESIGNS_A } from './DesignsA.jsx'
import { PLAYER_DESIGNS_B } from './DesignsB.jsx'
import { DEMO_EXERCISES } from './session.js'
import usePlayerDemo from './usePlayerDemo.js'
import './workout-players.css'

const designs = [...PLAYER_DESIGNS_A, ...PLAYER_DESIGNS_B]
const stages = [ ['ready', 'Preparação'], ['countdown', 'Aviso de início'], ['active', 'Execução'], ['rest', 'Descanso'], ['exerciseDone', 'Fim do exercício'], ['complete', 'Resumo do treino'] ]
const guide = {
  pullup: 'Segure a barra com firmeza. Suba com controle, aproxime o peito da barra e desça sem soltar o corpo.',
  row: 'Apoie os pés e mantenha o tronco estável. Puxe em direção ao abdômen e retorne com controle.',
  hold: 'Apoie as mãos ao lado do corpo. Sustente as pernas à frente, mantenha o tronco estável e respire durante a sustentação.',
}

export function PlayerLab() {
  const [selected, setSelected] = useState(designs[0].id)
  const { model, actions, sound, toggleSound } = usePlayerDemo()
  const design = designs.find(item => item.id === selected) || designs[0]
  const Design = design.component
  const stageLabel = stages.find(([id]) => id === model.phase)?.[1]
  return <div className="wpl-page">
    <header className="wpl-page-head"><div><span className="wpl-eyebrow">Fit Pro Player / Explorações</span><h1 className="cx-page-title">Players de treino</h1><p className="cx-page-sub">Dez formas de viver o treino. Escolha uma e percorra cada etapa.</p></div><span className="wpl-edition">10<small>conceitos interativos</small></span></header>
    <div className="wpl-demo-note"><Icon name="shield" /><span>Sessão de demonstração. Experimente à vontade: seus treinos reais não são alterados.</span></div>
    <section className="wpl-catalogue" aria-label="Escolha um player">
      {designs.map((item, index) => <button key={item.id} type="button" className="wpl-choice" data-player-choice={item.id} aria-label={`Experimentar ${item.title}`} aria-pressed={selected === item.id} onClick={() => setSelected(item.id)} style={{ '--choice-accent': item.accent, '--choice-bg': item.background }}>
        <span className={`wpl-choice-art wpl-mini-${item.id}`} aria-hidden="true"><i /><i /><i /></span><span className="wpl-choice-copy"><small>{String(index + 1).padStart(2, '0')}</small><strong>{item.title}</strong></span><span className="wpl-choice-check" aria-hidden="true">{selected === item.id && <Icon name="check" />}</span>
      </button>)}
    </section>
    <div className="wpl-workbench">
      <section className="wpl-preview-column" aria-label={`Demonstração ${design.title}`}>
        <div className="wpl-preview-caption"><div><span>{String(designs.indexOf(design) + 1).padStart(2, '0')}</span><h2>{design.title}</h2></div><span>{stageLabel}</span></div>
        <div className="wpl-preview" style={{ '--preview-background': design.background }}><div className="wpl-player-mount"><Design model={model} actions={actions} /></div></div>
        <div className="wpl-design-note"><strong>{design.subtitle}</strong><p>{design.idea}</p></div>
      </section>
      <aside className="wpl-test-controls" aria-label="Controles da demonstração">
        <section className="wpl-control-section"><div className="wpl-section-label"><Icon name="play" /><h2>Teste o fluxo completo</h2></div><p>Use os controles do player para iniciar, executar e registrar cada série. O descanso termina sozinho ou pode ser pulado.</p><div className="wpl-notice" role="status" aria-live="polite" aria-atomic="true"><span className={`wpl-status-dot is-${model.phase}`} /><div><strong>{model.phaseTitle}</strong><span>{model.phaseHint}</span></div></div><button type="button" className="wpl-sound-toggle" aria-pressed={sound} onClick={toggleSound}><Icon name={sound ? 'bell' : 'bellSlash'} /><span>Avisos sonoros <b>{sound ? 'ativados' : 'desativados'}</b></span><span className={`wpl-toggle-track${sound ? ' is-on' : ''}`} aria-hidden="true"><i /></span></button></section>
        <section className="wpl-control-section"><h2>Ir direto a uma etapa</h2><p>Os atalhos montam uma cena de teste. Trocar de visual mantém a etapa atual.</p><div className="wpl-stage-grid">{stages.map(([id, label]) => <button type="button" key={id} data-stage={id} aria-pressed={model.phase === id} onClick={() => actions.setPhase(id)}>{label}</button>)}</div></section>
        <section className="wpl-control-section"><div className="wpl-section-heading"><h2>Treino de demonstração</h2><span>{model.completedTotal}/{model.total} séries</span></div><div className="wpl-session-progress" role="progressbar" aria-label="Séries concluídas" aria-valuemin={0} aria-valuemax={model.total} aria-valuenow={model.completedTotal}><i style={{ width: `${model.progress * 100}%` }} /></div><ol className="wpl-exercise-list">{DEMO_EXERCISES.map((exercise, index) => <li key={exercise.id}><button type="button" aria-current={model.exerciseIndex === index ? 'step' : undefined} disabled={['countdown', 'active', 'rest', 'complete'].includes(model.phase)} onClick={() => actions.chooseExercise(index)}><span>{String(index + 1).padStart(2, '0')}</span><div><strong>{exercise.name}</strong><small>{exercise.sets} séries · {exercise.reps} {exercise.unit}{exercise.load !== null ? ` · ${exercise.load} kg` : ' · peso corporal'}</small></div><Icon name={model.results.filter(item => item.exerciseId === exercise.id).length >= exercise.sets ? 'check' : 'chevronRight'} /></button></li>)}</ol><details className="wpl-guide"><summary>Como executar {model.exercise.name.toLowerCase()}</summary><p>{guide[model.exercise.id]}</p></details></section>
        <section className="wpl-control-section wpl-history" data-player-history><div className="wpl-section-heading"><h2>Séries registradas</h2><span>{model.results.length}</span></div>{model.results.length ? <ol>{model.results.map(result => <li key={`${result.exerciseId}-${result.setNumber}`}><Icon name="check" /><div><strong>{result.name} <small>· Série {result.setNumber}</small></strong><span>{result.reps} {result.unit}{result.load !== null ? ` · ${result.load} kg` : ''} · RIR {result.rir}</span></div></li>)}</ol> : <p>Conclua uma série no player para ver o registro aqui.</p>}</section>
        <button type="button" data-player-reset className="wpl-reset" onClick={actions.reset}><Icon name="history" />Reiniciar demonstração</button>
      </aside>
    </div>
  </div>
}

export default function WorkoutPlayers() {
  const { userId, allowed } = useConsoleAccess()
  return <AccessGate allowed={allowed}><ConsoleShell userId={userId} allowed={allowed} back="/console/laboratory" backLabel="Laboratório de testes"><div className="cx-page-body"><PlayerLab /></div></ConsoleShell></AccessGate>
}
