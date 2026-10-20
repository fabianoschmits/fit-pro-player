import { useEffect, useRef, useState } from 'react'
import './navigation-icon.css'

function HomeArtwork() {
  return <g className="nav-icon__house">
    <path d="M3.5 10.7 12 3.8l8.5 6.9M5.9 9.4V19a1.4 1.4 0 0 0 1.4 1.4h9.4A1.4 1.4 0 0 0 18.1 19V9.4" />
    <path d="M10 20.4v-5h4v5" />
  </g>
}

function PlanArtwork() {
  return <>
    <g className="nav-icon__calendar-page">
      <rect x="3.4" y="5.2" width="17.2" height="15.4" rx="3.2" />
      <path d="M3.4 10.2h17.2" />
      <path className="nav-icon__calendar-check" d="m8.7 15.2 2.1 2.1 4.5-4.3" />
    </g>
    <path d="M8.2 3.4v3.4M15.8 3.4v3.4" />
  </>
}

function DumbbellArtwork({ resume }) {
  return <g className="nav-icon__dumbbell">
    <path className="nav-icon__grip" d={resume ? 'M8.6 12h.8M14.9 12h.5' : 'M8.6 12h6.8'} />
    <g className="nav-icon__plate nav-icon__plate--left">
      <rect x="5.3" y="6.5" width="3.3" height="11" rx="1.3" />
      <path d="M3.2 9.2v5.6" />
    </g>
    <g className="nav-icon__plate nav-icon__plate--right">
      <rect x="15.4" y="6.5" width="3.3" height="11" rx="1.3" />
      <path d="M20.8 9.2v5.6" />
    </g>
    {resume && <path className="nav-icon__play" d="m10.7 9.3 3.6 2.7-3.6 2.7Z" fill="currentColor" stroke="none" />}
  </g>
}

function StatsArtwork() {
  return <g className="nav-icon__bars">
    <path className="nav-icon__bar nav-icon__bar--one" d="M4.5 20.2V13" />
    <path className="nav-icon__bar nav-icon__bar--two" d="M9.5 20.2V6.4" />
    <path className="nav-icon__bar nav-icon__bar--three" d="M14.5 20.2v-5.1" />
    <path className="nav-icon__bar nav-icon__bar--four" d="M19.5 20.2V9.6" />
  </g>
}

// Only meaningful changes replay the SVG artwork. The button and SVG stay
// mounted, preserving focus, navigation timing and the menu's fixed geometry.
export default function NavigationIcon({ name, resume = false, active = false, visible = true, activation = 0, entryKey }) {
  const [sequence, setSequence] = useState(0)
  const previous = useRef({ name, resume, active, visible, activation, entryKey })
  const clickedEntry = useRef(null)
  useEffect(() => {
    const before = previous.current
    previous.current = { name, resume, active, visible, activation, entryKey }
    const entered = active && (!before.active || !before.visible)
    const changed = before.name !== name || (name === 'start' && before.resume !== resume)
    const clicked = before.activation !== activation
    // Match the click to its next route entry, even on a slow device. A redirect,
    // another destination or closing the menu consumes the pending feedback too.
    const followsClick = before.visible && clickedEntry.current?.key === before.entryKey
      && clickedEntry.current !== null
    if (before.entryKey !== entryKey || entered || !visible) clickedEntry.current = null
    if (clicked && !active && visible) clickedEntry.current = { key: entryKey }
    if (!visible) return
    if ((entered && !followsClick) || changed || clicked) setSequence(value => value + 1)
  }, [name, resume, active, visible, activation, entryKey])

  return <svg className="icn nav-icon" data-nav-icon={name === 'start' && resume ? 'resume' : name}
    viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor"
    strokeWidth="var(--icon-stroke, 1.7)" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true" focusable="false">
    <g key={sequence} className={'nav-icon__motion' + (sequence > 0 ? ' is-playing' : '')}>
      {name === 'home' && <HomeArtwork />}
      {name === 'plan' && <PlanArtwork />}
      {name === 'start' && <DumbbellArtwork resume={resume} />}
      {name === 'stats' && <StatsArtwork />}
    </g>
  </svg>
}
