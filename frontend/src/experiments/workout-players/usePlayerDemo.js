import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { beep } from '../../lib/sound.js'
import { createDemoSession, demoReducer, getDemoModel } from './session.js'

export default function usePlayerDemo() {
  const [state, dispatch] = useReducer(demoReducer, undefined, createDemoSession)
  const [sound, setSound] = useState(false)
  const previousPhase = useRef(state.phase)
  useEffect(() => {
    if (state.startedAt === null || state.phase === 'complete') return
    const interval = setInterval(() => dispatch({ type: 'TICK', now: Date.now() }), 250)
    return () => clearInterval(interval)
  }, [state.startedAt, state.phase])
  useEffect(() => {
    if (previousPhase.current !== state.phase && (state.phase === 'active' || (previousPhase.current === 'rest' && state.phase === 'ready') || state.phase === 'exerciseDone')) beep(sound, state.phase === 'active' ? 1040 : 780, 0.16)
    previousPhase.current = state.phase
  }, [state.phase, sound])
  const actions = useMemo(() => {
    const send = (type, extra = {}) => dispatch({ type, now: Date.now(), ...extra })
    return { primary: () => send('PRIMARY'), adjust: (field, delta) => send('ADJUST', { field, delta }), chooseExercise: index => send('CHOOSE_EXERCISE', { index }), reset: () => send('RESET'), setPhase: phase => send('SET_PHASE', { phase }) }
  }, [])
  return { model: getDemoModel(state), actions, sound, toggleSound: () => { beep(!sound, 880, 0.12); setSound(!sound) } }
}
