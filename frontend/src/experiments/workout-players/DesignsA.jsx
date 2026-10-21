import {
  ExerciseDemo, SetMarkers, MetricControls, MainAction,
  PhaseReadout, ExerciseNav, SessionClock,
} from './PlayerParts.jsx'
import './designs-a.css'

function SetCaption({ model }) {
  return <span>Série <strong>{Math.min(model.setIndex + 1, model.exercise.sets)}</strong> / {model.exercise.sets}</span>
}

function OrbitRing({ model }) {
  const count = model.exercise.sets
  const circumference = 2 * Math.PI * 132
  const segment = circumference / count
  const isRest = model.phase === 'rest'
  const restProgress = Math.max(0, Math.min(1, model.remaining / (model.restDuration || 1)))
  return (
    <svg className="wpl-orbita__ring" viewBox="0 0 300 300" aria-hidden="true">
      <circle className="wpl-orbita__inner-ring" cx="150" cy="150" r="117" />
      {Array.from({ length: count }, (_, index) => (
        <circle key={index} cx="150" cy="150" r="132"
          className={`wpl-orbita__segment${index < model.completedSets ? ' is-done' : ''}${index === model.setIndex ? ' is-current' : ''}`}
          strokeDasharray={`${segment - 13} ${circumference - segment + 13}`}
          strokeDashoffset={-index * segment} transform="rotate(-87 150 150)" />
      ))}
      {isRest && <circle className="wpl-orbita__rest-ring" cx="150" cy="150" r="117"
        strokeDasharray={`${2 * Math.PI * 117 * restProgress} ${2 * Math.PI * 117}`}
        transform="rotate(-90 150 150)" />}
    </svg>
  )
}

function Orbita({ model, actions }) {
  const parts = { model, actions }
  return (
    <article className="wpl-design wpl-orbita" data-player-design="orbita" data-phase={model.phase}>
      <header className="wpl-orbita__header">
        <span className="wpl-orbita__session">Treino em órbita</span>
        <SessionClock model={model} />
      </header>
      <div className="wpl-orbita__exercise">
        <p>{model.exercise.muscle}</p>
        <h2>{model.exercise.name}</h2>
      </div>
      <ExerciseDemo model={model} className="wpl-orbita__demo" />
      <div className="wpl-orbita__dial">
        <OrbitRing model={model} />
        <PhaseReadout {...parts} />
      </div>
      <div className="wpl-orbita__series"><SetCaption model={model} /><SetMarkers {...parts} /></div>
      <MetricControls {...parts} />
      <MainAction {...parts} />
      <ExerciseNav {...parts} />
    </article>
  )
}

function Console({ model, actions }) {
  const parts = { model, actions }
  return (
    <article className="wpl-design wpl-console" data-player-design="console" data-phase={model.phase}>
      <header className="wpl-console__top">
        <span className="wpl-console__identity"><span aria-hidden="true" />Controle de treino</span>
        <span className="wpl-console__vents" aria-hidden="true"><i /><i /><i /><i /><i /></span>
      </header>
      <div className="wpl-console__screen">
        <div className="wpl-console__screen-top"><SetCaption model={model} /><SessionClock model={model} /></div>
        <h2>{model.exercise.name}</h2>
        <p className="wpl-console__muscle">{model.exercise.muscle}</p>
        <ExerciseDemo model={model} className="wpl-console__demo" />
        <PhaseReadout {...parts} />
        <SetMarkers {...parts} />
      </div>
      <div className="wpl-console__controls">
        <MetricControls {...parts} />
        <div className="wpl-console__trigger"><MainAction {...parts} /></div>
        <ExerciseNav {...parts} />
      </div>
      <footer className="wpl-console__footer"><span aria-hidden="true">＋</span><span>Seu ritmo. Seu controle.</span><span aria-hidden="true">＋</span></footer>
    </article>
  )
}

function Cartaz({ model, actions }) {
  const parts = { model, actions }
  return (
    <article className="wpl-design wpl-cartaz" data-player-design="cartaz" data-phase={model.phase}>
      <header className="wpl-cartaz__header"><span>Treino de hoje</span><SessionClock model={model} /></header>
      <div className="wpl-cartaz__headline">
        <span className="wpl-cartaz__number" aria-hidden="true">{String(model.exerciseIndex + 1).padStart(2, '0')}</span>
        <h2>{model.exercise.name}</h2>
      </div>
      <div className="wpl-cartaz__byline"><span>{model.exercise.muscle}</span><SetCaption model={model} /></div>
      <ExerciseDemo model={model} className="wpl-cartaz__demo" />
      <div className="wpl-cartaz__readout"><PhaseReadout {...parts} /></div>
      <SetMarkers {...parts} />
      <MetricControls {...parts} />
      <MainAction {...parts} />
      <ExerciseNav {...parts} />
    </article>
  )
}

function Percurso({ model, actions }) {
  const parts = { model, actions }
  return (
    <article className="wpl-design wpl-percurso" data-player-design="percurso" data-phase={model.phase}>
      <header className="wpl-percurso__header"><span>Um passo de cada vez</span><SessionClock model={model} /></header>
      <div className="wpl-percurso__body">
        <ol className="wpl-percurso__rail" aria-label="Percurso das séries">
          {Array.from({ length: model.exercise.sets }, (_, index) => (
            <li key={index} className={index < model.completedSets ? 'is-done' : index === model.setIndex ? 'is-current' : ''}
              aria-current={index === model.setIndex ? 'step' : undefined}>
              <span>{index < model.completedSets ? '✓' : index + 1}</span>
              <small>{index < model.completedSets ? 'Feita' : index === model.setIndex ? 'Agora' : 'Depois'}</small>
            </li>
          ))}
        </ol>
        <div className="wpl-percurso__content">
          <p className="wpl-percurso__muscle">{model.exercise.muscle}</p>
          <h2>{model.exercise.name}</h2>
          <div className="wpl-percurso__position"><SetCaption model={model} /></div>
          <ExerciseDemo model={model} className="wpl-percurso__demo" />
          <PhaseReadout {...parts} />
          <SetMarkers {...parts} />
          <MetricControls {...parts} />
        </div>
      </div>
      <MainAction {...parts} />
      <ExerciseNav {...parts} />
    </article>
  )
}

function Deck({ model, actions }) {
  const parts = { model, actions }
  return (
    <article className="wpl-design wpl-deck" data-player-design="deck" data-phase={model.phase}>
      <header className="wpl-deck__header"><span>Seu treino, uma carta por vez</span><SessionClock model={model} /></header>
      <div className="wpl-deck__stack">
        <div className="wpl-deck__back wpl-deck__back--far" aria-hidden="true" />
        <div className="wpl-deck__back wpl-deck__back--near" aria-hidden="true" />
        <section className="wpl-deck__card">
          <div className="wpl-deck__card-top"><span>{model.exercise.muscle}</span><span>{model.exerciseIndex + 1} / {model.exerciseCount}</span></div>
          <ExerciseDemo model={model} className="wpl-deck__demo" />
          <h2>{model.exercise.name}</h2>
          <div className="wpl-deck__set"><SetCaption model={model} /><SetMarkers {...parts} /></div>
          <PhaseReadout {...parts} />
        </section>
      </div>
      <MetricControls {...parts} />
      <MainAction {...parts} />
      <ExerciseNav {...parts} />
    </article>
  )
}

export const PLAYER_DESIGNS_A = [
  { id: 'orbita', title: 'Órbita', subtitle: 'O ritmo no centro', idea: 'As séries desenham uma órbita. No descanso, o anel acompanha cada segundo.', accent: '#73e2e1', background: '#102d39', component: Orbita },
  { id: 'console', title: 'Console', subtitle: 'Controle na mão', idea: 'Um instrumento de treino: visor integrado, ajustes táteis e um comando central.', accent: '#d5eb90', background: '#303638', component: Console },
  { id: 'cartaz', title: 'Cartaz', subtitle: 'O exercício em voz alta', idea: 'Tipografia de cartaz esportivo, papel branco e uma faixa vermelha que marca a ação.', accent: '#db342b', background: '#ffffff', component: Cartaz },
  { id: 'percurso', title: 'Percurso', subtitle: 'Uma série de cada vez', idea: 'Uma rota vertical torna visível o caminho entre a primeira e a última série.', accent: '#285bce', background: '#f0f5fc', component: Percurso },
  { id: 'deck', title: 'Deck', subtitle: 'Um treino em cartas', idea: 'Cada exercício ocupa uma carta. A pilha dá contexto e mantém a próxima ação próxima.', accent: '#783749', background: '#e9c5b9', component: Deck },
]
