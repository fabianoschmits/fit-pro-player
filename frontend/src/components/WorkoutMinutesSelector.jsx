import { useId, useState } from 'react'
import { isValidWorkoutMinutes } from '../lib/profile.js'
import './WorkoutMinutesSelector.css'

const PRESETS = [20, 30, 40, 45, 60, 75, 90]

/** A shared duration input. Invalid custom text stays in the draft until corrected. */
export default function WorkoutMinutesSelector({ value, onChange, disabled = false, preferredMinutes = undefined }) {
  const inputId = useId()
  const [custom, setCustom] = useState(!PRESETS.includes(value))
  const valid = isValidWorkoutMinutes(value)
  return <div className="workout-minutes-selector">
    <div className="workout-minutes-options" role="group" aria-label="Duração do treino">
      {PRESETS.map(minutes => <button type="button" key={minutes} disabled={disabled} className={!custom && value === minutes ? 'on' : ''} aria-pressed={!custom && value === minutes} onClick={() => { setCustom(false); onChange(minutes) }}>
        {minutes} min{preferredMinutes === minutes && <small>habitual</small>}
      </button>)}
      <button type="button" disabled={disabled} className={custom ? 'on' : ''} aria-pressed={custom} onClick={() => setCustom(true)}>Outro tempo</button>
    </div>
    {custom && <label className="workout-minutes-custom" htmlFor={inputId}>Tempo personalizado (minutos)
      <input id={inputId} className="field" type="number" inputMode="numeric" min="15" max="180" step="5" disabled={disabled} value={value} aria-invalid={!valid} aria-describedby={`${inputId}-help`} onChange={event => {
        const raw = event.target.value
        onChange(raw === '' ? '' : Number(raw))
      }} />
      <small id={`${inputId}-help`}>De 15 a 180 minutos, em intervalos de 5 minutos.</small>
    </label>}
    {!valid && <small className="workout-minutes-error" role="status">Escolha de 15 a 180 minutos, em intervalos de 5.</small>}
  </div>
}
