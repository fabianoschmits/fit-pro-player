import Icon from '../../components/Icon.jsx'
import './player-parts.css'
export { default as ExerciseDemo } from './ExerciseDemo.jsx'

export function ExerciseArt({ model, className = '' }) {
  const kind = model.exercise.id
  return <svg className={`wpl-art ${className}`} viewBox="0 0 180 140" fill="none" aria-label={`Ilustração de ${model.exercise.name}`} role="img">
    <g stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
      {kind === 'pullup' ? <><path d="M24 120V19h132v101M21 19h138" opacity=".3" /><circle cx="90" cy="48" r="10" /><path d="M76 65h28l-2 32H78l-2-32ZM76 67 58 52V21M104 67l18-15V21M80 97l-3 30M100 97l3 30M77 127h-7M103 127h7" /><path d="m80 77 10 7 10-7M90 84v13" opacity=".5" /></> : kind === 'row' ? <><path d="M22 112h135M30 108V29h24M31 46h17" opacity=".3" /><circle cx="105" cy="41" r="10" /><path d="m99 56-9 33 26 8 20 25M89 89l-21 15-22 14M100 61 78 72l-22-4M56 62v12M34 68h21M78 92h35v14H78" /></> : <><path d="M21 121h139" opacity=".3" /><circle cx="47" cy="77" r="10" /><path d="m59 86 49 13 37 16M69 89l-8 25H37M61 114v6M109 99l22 17h19" /><path d="m63 87 13-7 34 11" opacity=".5" /></>}
    </g>
  </svg>
}

export function SessionClock({ model, className = '' }) {
  return <div className={`wpl-clock ${className}`}><span><Icon name="clock" /><span>Treino <b>{model.elapsedLabel}</b></span></span>{model.phase === 'active' && <span>Série <b>{model.setElapsedLabel}</b></span>}</div>
}

export function SetMarkers({ model, className = '' }) {
  return <div className={`wpl-sets ${className}`} aria-label={`${model.completedSets} de ${model.totalSets} séries concluídas`}>
    {Array.from({ length: model.totalSets }, (_, index) => <span key={index} className={index < model.completedSets ? 'is-done' : index === model.setIndex && model.phase !== 'complete' ? 'is-current' : ''} aria-label={`Série ${index + 1}${index < model.completedSets ? ' concluída' : index === model.setIndex ? ' atual' : ''}`} aria-current={index === model.setIndex && index >= model.completedSets ? 'step' : undefined}>{index < model.completedSets ? <Icon name="check" /> : index + 1}</span>)}
  </div>
}

export function PhaseReadout({ model, className = '' }) {
  return <div className={`wpl-readout ${className}`}><p className="wpl-readout__title">{model.phaseTitle}</p><div className="wpl-readout__number"><strong className="wpl-readout__value">{model.displayValue}</strong><span className="wpl-readout__unit">{model.displayUnit}</span></div><p className="wpl-readout__hint">{model.phaseHint}</p></div>
}

function Stepper({ field, label, speech, value, unit, step = 1, min, max, actions }) {
  return <div className="wpl-stepper"><span className="wpl-stepper__label">{label}</span><div className="wpl-stepper__controls"><button type="button" aria-label={`Diminuir ${speech}`} disabled={value <= min} onClick={() => actions.adjust(field, -step)}><Icon name="minus" /></button><output data-player-load={field === 'load' ? '' : undefined} aria-label={label}>{value}<small>{unit}</small></output><button type="button" aria-label={`Aumentar ${speech}`} disabled={value >= max} onClick={() => actions.adjust(field, step)}><Icon name="plus" /></button></div></div>
}

export function MetricControls({ model, actions, className = '' }) {
  if (model.phase === 'rest') return <div className={`wpl-metrics ${className}`}><Stepper field="rest" label="Ajustar descanso em 15 s" speech="descanso" value={model.remaining} unit="s" step={15} min={0} max={300} actions={actions} /></div>
  if (!['ready', 'active'].includes(model.phase)) return null
  return <div className={`wpl-metrics ${className}`}>
    <Stepper field="reps" label={model.exercise.mode === 'time' ? 'Duração' : 'Repetições'} speech={model.exercise.mode === 'time' ? 'duração' : 'repetições'} value={model.reps} unit={model.exercise.unit} min={1} max={model.exercise.mode === 'time' ? 600 : 100} actions={actions} />
    {model.load !== null && <Stepper field="load" label="Carga" speech="carga" value={model.load} unit="kg" step={2.5} min={0} max={500} actions={actions} />}
    <Stepper field="rir" label="Reps em reserva" speech="RIR" value={model.rir} unit="RIR" min={0} max={5} actions={actions} />
  </div>
}

export function MainAction({ model, actions, className = '' }) {
  return <button type="button" className={`wpl-action ${className}`} onClick={actions.primary}><Icon name={model.actionIcon} /><span>{model.actionLabel}</span></button>
}

export function ExerciseNav({ model, actions, className = '' }) {
  const locked = ['countdown', 'active', 'rest', 'complete'].includes(model.phase)
  return <nav className={`wpl-exercise-nav ${className}`} aria-label="Trocar exercício"><button type="button" aria-label="Exercício anterior" disabled={locked || model.exerciseIndex === 0} onClick={() => actions.chooseExercise(model.exerciseIndex - 1)}><Icon name="chevronLeft" /></button><span>Exercício <b>{model.exerciseIndex + 1} / {model.exerciseCount}</b></span><button type="button" aria-label="Exercício seguinte" disabled={locked || model.exerciseIndex === model.exerciseCount - 1} onClick={() => actions.chooseExercise(model.exerciseIndex + 1)}><Icon name="chevronRight" /></button></nav>
}
