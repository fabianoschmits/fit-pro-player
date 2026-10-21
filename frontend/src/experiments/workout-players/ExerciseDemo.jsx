import { useEffect, useState } from 'react'
import ExerciseGuideAnimation from '../../components/ExerciseGuideAnimation.jsx'
import Icon from '../../components/Icon.jsx'
import { exOr } from '../../lib/exercises.js'

export default function ExerciseDemo({ model, className = '' }) {
  const [override, setOverride] = useState(null)
  const playing = override ?? model.phase === 'active'
  useEffect(() => { setOverride(null) }, [model.exercise.id, model.phase])
  const exercise = exOr(model.exercise.guideId)
  return <figure className={`wpl-exercise-demo ${className}`} data-playing={playing} aria-label={`Demonstração de ${model.exercise.name}`}>
    <ExerciseGuideAnimation ex={exercise} playing={playing} fallback={<p className="wpl-demo-unavailable" role="alert">Não foi possível carregar a demonstração.</p>} />
    <figcaption><span>Como executar</span><button type="button" aria-label={playing ? 'Pausar demonstração' : 'Reproduzir demonstração'} onClick={() => setOverride(!playing)}><Icon name={playing ? 'pause' : 'play'} /><span>{playing ? 'Pausar' : 'Ver movimento'}</span></button></figcaption>
  </figure>
}
