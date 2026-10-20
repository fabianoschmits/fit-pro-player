import React from 'react'
import './tabbar-morphs.css'

/**
 * Pure visual identity resolver based on the item and the state at that point in time.
 * This guarantees snapshots captured before a workout starts remain 'start',
 * and snapshots captured after a workout starts are 'resume'.
 */
export function getVisualId(item, stateSnapshot) {
  if (!item) return null
  if (item.k === 'start' || item.k === 'workout') {
    return stateSnapshot?.active ? 'resume' : 'start'
  }
  return item.k
}

/* 1. START <-> RESUME */
function MorphStartResume({ isReversed }) {
  return (
    <svg className={`icn morph-svg ${isReversed ? 'morph-reversed' : 'morph-direct'}`} viewBox="0 0 24 24" aria-hidden="true">
      {/* Dumbbell plates and bar stay stable */}
      <g className="morph-group">
        <rect x="5.3" y="6.5" width="3.3" height="11" rx="1.3" />
        <path d="M3.2 9.2v5.6" />
        <rect x="15.4" y="6.5" width="3.3" height="11" rx="1.3" />
        <path d="M20.8 9.2v5.6" />
        <path d="M8.6 12h.8M14.9 12h.5" />
      </g>
      {/* Play indicator fades/pops in or out */}
      <path
        className={`morph-group ${isReversed ? 'morph-from' : 'morph-to'} morph-solid`}
        d="m10.7 9.3 3.6 2.7-3.6 2.7Z"
      />
    </svg>
  )
}

/* 2. RESUME / DUMBBELL <-> LIST (LIBRARY) */
function MorphDumbbellToList({ isReversed }) {
  return (
    <svg className={`icn morph-svg ${isReversed ? 'morph-reversed' : 'morph-direct'}`} viewBox="0 0 24 24" aria-hidden="true">
      <g className="morph-group morph-from">
        <g className="morph-dumbbell-plates">
          <rect x="5.3" y="6.5" width="3.3" height="11" rx="1.3" />
          <rect x="15.4" y="6.5" width="3.3" height="11" rx="1.3" />
        </g>
        <path className="morph-dumbbell-bar" d="M8.6 12h6.8" />
      </g>
      <g className="morph-group morph-to">
        <path d="M8.4 6.6h11.2M8.4 12h11.2M8.4 17.4h11.2M4.6 6.6h.01M4.6 12h.01M4.6 17.4h.01" />
      </g>
    </svg>
  )
}

/* 3. CHART (STATS) <-> HISTORY */
function MorphChartToHistory({ isReversed }) {
  return (
    <svg className={`icn morph-svg ${isReversed ? 'morph-reversed' : 'morph-direct'}`} viewBox="0 0 24 24" aria-hidden="true">
      <g className="morph-group morph-from morph-chart-bars">
        <path d="M4.5 20.2V13M9.5 20.2V6.4M14.5 20.2v-5.1M19.5 20.2V9.6" />
      </g>
      <g className="morph-group morph-to">
        <path d="M4.5 12.2a7.6 7.6 0 1 0 2.5-5.6" />
        <path d="M4.1 4.4v4.3h4.3" />
        <path d="M12 8.3v4.2l3.1 1.9" />
      </g>
    </svg>
  )
}

/* 4. PLAN (CALENDAR) <-> STATS (CHART) */
function MorphPlanToChart({ isReversed }) {
  return (
    <svg className={`icn morph-svg ${isReversed ? 'morph-reversed' : 'morph-direct'}`} viewBox="0 0 24 24" aria-hidden="true">
      <g className="morph-group morph-from">
        <rect x="3.4" y="5.2" width="17.2" height="15.4" rx="3.2" />
        <path d="M8.2 3.4v3.4M15.8 3.4v3.4M3.4 10.2h17.2" />
      </g>
      <g className="morph-group morph-to">
        <path d="M4.5 20.2V13M9.5 20.2V6.4M14.5 20.2v-5.1M19.5 20.2V9.6" />
      </g>
    </svg>
  )
}

/* 5. PROFESSIONAL (CLIPBOARD) <-> STUDENTS (PERSON_CIRCLE) */
function MorphClipboardToPerson({ isReversed }) {
  return (
    <svg className={`icn morph-svg ${isReversed ? 'morph-reversed' : 'morph-direct'}`} viewBox="0 0 24 24" aria-hidden="true">
      <g className="morph-group morph-from">
        <rect x="5.4" y="4.8" width="13.2" height="15.8" rx="2.6" />
        <path d="M9 4.8a1.6 1.6 0 0 1 1.6-1.6h2.8A1.6 1.6 0 0 1 15 4.8v1.4H9Z" />
        <path d="M9.2 11.6h5.6M9.2 15.2h4" />
      </g>
      <g className="morph-group morph-to">
        <circle cx="12" cy="12" r="8.4" />
        <circle cx="12" cy="10" r="2.9" />
        <path d="M6.6 18.4a5.8 5.8 0 0 1 10.8 0" />
      </g>
    </svg>
  )
}

export const ICON_MORPH_REGISTRY = [
  {
    id: 'start-resume',
    from: 'start',
    to: 'resume',
    reverse: true,
    render: MorphStartResume,
  },
  {
    id: 'resume-library',
    from: 'resume',
    to: 'library',
    reverse: true,
    render: MorphDumbbellToList,
  },
  {
    id: 'stats-history',
    from: 'stats',
    to: 'history',
    reverse: true,
    render: MorphChartToHistory,
  },
  {
    id: 'plan-stats',
    from: 'plan',
    to: 'stats',
    reverse: true,
    render: MorphPlanToChart,
  },
  {
    id: 'professional-students',
    from: 'prof-overview',
    to: 'prof-students',
    reverse: true,
    render: MorphClipboardToPerson,
  },
]

/**
 * Searches the registry for a matching morph between previous and current visual IDs.
 * Returns { id, Component, isReversed } or null.
 */
export function findIconMorph(previousVisualId, currentVisualId) {
  if (!previousVisualId || !currentVisualId || previousVisualId === currentVisualId) {
    return null
  }

  for (const morph of ICON_MORPH_REGISTRY) {
    if (morph.from === previousVisualId && morph.to === currentVisualId) {
      return { id: morph.id, Component: morph.render, isReversed: false }
    }
    if (morph.reverse && morph.from === currentVisualId && morph.to === previousVisualId) {
      return { id: morph.id, Component: morph.render, isReversed: true }
    }
  }

  return null
}
