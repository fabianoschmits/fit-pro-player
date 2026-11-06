import { useState } from 'react'
import WorkoutMinutesSelector from './WorkoutMinutesSelector.jsx'
import { Button } from './ui.jsx'
import { isValidWorkoutMinutes } from '../lib/profile.js'

export default function WorkoutDurationSheet({ preferredMinutes, onConfirm, close }) {
  const [minutes, setMinutes] = useState(preferredMinutes)
  return <>
    <h3>Quanto tempo vai treinar hoje?</h3>
    <p className="muted small">Seu tempo habitual: {preferredMinutes} minutos</p>
    <WorkoutMinutesSelector value={minutes} onChange={setMinutes} preferredMinutes={preferredMinutes} />
    <Button variant="primary" disabled={!isValidWorkoutMinutes(minutes)} onClick={() => { close(); onConfirm(Number(minutes)) }}>Confirmar duração</Button>
  </>
}
