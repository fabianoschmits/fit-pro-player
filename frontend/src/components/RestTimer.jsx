import { useEffect } from 'react'
import { useUI } from '../store/useUI.js'
import { useStore } from '../store/useStore.js'
import { exOr, exerciseName } from '../lib/exercises.js'
import { t } from '../lib/i18n.js'
import { Button } from './ui.jsx'

const clock = sec => Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0')

// One bar, two meanings: the rest countdown between sets, and the work countdown during a
// timed set (issue #16). They are mutually exclusive by construction — startWork() stops any
// running rest — so the bar can never have to show both, and a work set gets its own colour
// plus a "Done" that logs the time actually held.
export default function RestTimer() {
  const timer = useUI(s => s.timer)
  const active = useStore(s => s.S.active)
  const { addRest, stopRest } = useUI()
  const on = timer
  // Timed holds use the inline overlay below the exercise animation; only classic rest
  // between rep sets keeps the floating bar above the tab menu.
  useEffect(() => {
    document.body.classList.toggle('resting', !!on)
    return () => document.body.classList.remove('resting')
  }, [!!on])
  if (!on) return null
  const pct = (on.left / on.total) * 100
  let upcoming = null
  if (active?.entries?.length) {
    const current = Math.min(active.cur || 0, active.entries.length - 1)
    for (let offset = 0; offset < active.entries.length; offset++) {
      const entryIndex = (current + offset) % active.entries.length
      const entry = active.entries[entryIndex]
      const setIndex = entry.sets.findIndex(set => !set.done)
      if (setIndex >= 0) { upcoming = { entry, setIndex }; break }
    }
  }

  return (
    <div id="timer" className="rest">
      <div className="head">
        <div className="rest-label">{t('Rest')}{upcoming && <span>{exerciseName(exOr(upcoming.entry.id))} · {t('Sets')} {upcoming.setIndex + 1}</span>}</div>
        <div className="t">{clock(timer.left)}</div>
        <div className="bar"><i style={{ '--progress': pct / 100 }} /></div>
      </div>
      <div className="acts">
        <Button size="sm" icon="minus" aria-label={`${t('Decrease')} 15s`} onClick={() => addRest(-15)}>15s</Button>
        <Button size="sm" icon="plus" aria-label={`${t('Increase')} 15s`} onClick={() => addRest(15)}>15s</Button>
        <Button size="sm" variant="primary" className="skip" onClick={stopRest}>{t('Skip')}</Button>
      </div>
    </div>
  )
}
