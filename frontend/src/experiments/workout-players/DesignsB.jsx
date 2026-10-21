import {
  ExerciseDemo,
  ExerciseNav,
  MainAction,
  MetricControls,
  PhaseReadout,
  SessionClock,
  SetMarkers,
} from './PlayerParts.jsx';
import './designs-b.css';

const setNumber = (model) => Math.min(model.setIndex + 1, model.exercise.sets);
const exerciseNumber = (model) => String(model.exerciseIndex + 1).padStart(2, '0');

function Haltere({ model, actions }) {
  return (
    <article className="wpl-design wpl-haltere" data-player-design="haltere" data-phase={model.phase} aria-label="Player Haltere">
      <header className="wpl-haltere-topline">
        <span>Seu treino, nas mãos.</span>
        <SessionClock model={model} />
      </header>
      <div className="wpl-haltere-object">
        <div className="wpl-haltere-weight wpl-haltere-weight-top">
          <div className="wpl-haltere-heading">
            <span className="wpl-haltere-sequence">{exerciseNumber(model)} / {String(model.exerciseCount).padStart(2, '0')}</span>
            <h2>{model.exercise.name}</h2>
            <p>{model.exercise.muscle}</p>
          </div>
          <ExerciseDemo model={model} />
        </div>
        <div className="wpl-haltere-grip">
          <div className="wpl-haltere-setline">Série {setNumber(model)} de {model.exercise.sets}</div>
          <PhaseReadout model={model} actions={actions} />
          <SetMarkers model={model} actions={actions} />
        </div>
        <div className="wpl-haltere-weight wpl-haltere-weight-bottom">
          <MetricControls model={model} actions={actions} />
          <MainAction model={model} actions={actions} />
        </div>
      </div>
      <ExerciseNav model={model} actions={actions} />
    </article>
  );
}

function Sprint({ model, actions }) {
  return (
    <article className="wpl-design wpl-sprint" data-player-design="sprint" data-phase={model.phase} aria-label="Player Sprint">
      <header className="wpl-sprint-header">
        <span className="wpl-sprint-lane">{exerciseNumber(model)}<small>/{String(model.exerciseCount).padStart(2, '0')}</small></span>
        <SessionClock model={model} />
      </header>
      <div className="wpl-sprint-heading">
        <p>{model.exercise.muscle}</p>
        <h2>{model.exercise.name}</h2>
      </div>
      <div className="wpl-sprint-track">
        <div className="wpl-sprint-track-lines" aria-hidden="true"><i /><i /><i /></div>
        <ExerciseDemo model={model} />
        <div className="wpl-sprint-position"><span>Série</span><b>{setNumber(model)}</b><span>de {model.exercise.sets}</span></div>
        <PhaseReadout model={model} actions={actions} />
      </div>
      <div className="wpl-sprint-control">
        <SetMarkers model={model} actions={actions} />
        <MetricControls model={model} actions={actions} />
        <MainAction model={model} actions={actions} />
        <ExerciseNav model={model} actions={actions} />
      </div>
    </article>
  );
}

function Foco({ model, actions }) {
  return (
    <article className="wpl-design wpl-foco" data-player-design="foco" data-phase={model.phase} aria-label="Player Foco">
      <header className="wpl-foco-header">
        <span>{model.exerciseIndex + 1} de {model.exerciseCount} exercícios</span>
        <SessionClock model={model} />
      </header>
      <div className="wpl-foco-heading">
        <h2>{model.exercise.name}</h2>
        <p>{model.exercise.muscle}</p>
      </div>
      <div className="wpl-foco-stone">
        <ExerciseDemo model={model} />
        <span className="wpl-foco-series">Série {setNumber(model)} de {model.exercise.sets}</span>
        <PhaseReadout model={model} actions={actions} />
        <SetMarkers model={model} actions={actions} />
      </div>
      <MetricControls model={model} actions={actions} />
      <MainAction model={model} actions={actions} />
      <ExerciseNav model={model} actions={actions} />
    </article>
  );
}

function Cabine({ model, actions }) {
  return (
    <article className="wpl-design wpl-cabine" data-player-design="cabine" data-phase={model.phase} aria-label="Player Cabine">
      <header className="wpl-cabine-header">
        <div className="wpl-cabine-id"><span aria-hidden="true">⌁</span> Treino em curso</div>
        <SessionClock model={model} />
      </header>
      <div className="wpl-cabine-heading">
        <span className="wpl-cabine-exercise-id">{exerciseNumber(model)}</span>
        <div><h2>{model.exercise.name}</h2><p>{model.exercise.muscle}</p></div>
      </div>
      <div className="wpl-cabine-instrument">
        <div className="wpl-cabine-scale" aria-hidden="true"><i /><i /><i /><i /><i /></div>
        <div className="wpl-cabine-screen">
          <div className="wpl-cabine-status"><span>{model.phaseLabel}</span><span>S{setNumber(model)} / {model.exercise.sets}</span></div>
          <ExerciseDemo model={model} />
          <PhaseReadout model={model} actions={actions} />
          <SetMarkers model={model} actions={actions} />
        </div>
        <div className="wpl-cabine-scale" aria-hidden="true"><i /><i /><i /><i /><i /></div>
      </div>
      <div className="wpl-cabine-console">
        <MetricControls model={model} actions={actions} />
        <MainAction model={model} actions={actions} />
      </div>
      <ExerciseNav model={model} actions={actions} />
    </article>
  );
}

function Placar({ model, actions }) {
  return (
    <article className="wpl-design wpl-placar" data-player-design="placar" data-phase={model.phase} aria-label="Player Placar">
      <header className="wpl-placar-header">
        <span className="wpl-placar-wordmark">Cada série conta.</span>
        <SessionClock model={model} />
      </header>
      <div className="wpl-placar-board">
        <div className="wpl-placar-title">
          <span>Exercício {model.exerciseIndex + 1} / {model.exerciseCount}</span>
          <h2>{model.exercise.name}</h2>
          <p>{model.exercise.muscle}</p>
        </div>
        <ExerciseDemo model={model} />
        <div className="wpl-placar-score">
          <PhaseReadout model={model} actions={actions} />
          <div className="wpl-placar-series"><span>Série</span><b>{String(setNumber(model)).padStart(2, '0')}</b><span>de {String(model.exercise.sets).padStart(2, '0')}</span></div>
        </div>
        <div className="wpl-placar-rounds"><span>Seu avanço</span><SetMarkers model={model} actions={actions} /></div>
      </div>
      <MetricControls model={model} actions={actions} />
      <MainAction model={model} actions={actions} />
      <ExerciseNav model={model} actions={actions} />
    </article>
  );
}

export const PLAYER_DESIGNS_B = [
  { id: 'haltere', title: 'Haltere', subtitle: 'Um objeto, todo o controle', idea: 'Dois volumes de peso unidos por uma pega central que concentra a execução.', accent: '#caef60', background: '#292c25', component: Haltere },
  { id: 'sprint', title: 'Sprint', subtitle: 'O ritmo da pista', idea: 'Faixas diagonais, letras inclinadas e uma largada vermelha para cada série.', accent: '#e83e25', background: '#f7f3eb', component: Sprint },
  { id: 'foco', title: 'Foco', subtitle: 'Espaço para o próximo movimento', idea: 'Uma pedra de jade clara, silêncio visual e controles leves em torno de um só objetivo.', accent: '#32765b', background: '#f2f8f1', component: Foco },
  { id: 'cabine', title: 'Cabine', subtitle: 'Cada indicador no seu lugar', idea: 'Um painel azul com moldura angular e instrumentos claros para conduzir o treino.', accent: '#82caff', background: '#132c52', component: Cabine },
  { id: 'placar', title: 'Placar', subtitle: 'Cada série conta', idea: 'Um placar de arena em âmbar transforma números, séries e tempo em protagonistas.', accent: '#ffc064', background: '#2c201a', component: Placar },
];
