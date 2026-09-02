import { useLocation, useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { effectiveRoutine } from '../lib/history.js'
import { todayISO } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import { startTabShortLabel } from '../lib/ux.js'
import { useScrollDirection } from '../hooks/useScrollDirection.js'
import Icon from './Icon.jsx'

const TABS = [
  { k: 'home', icon: 'house', to: '/home', label: () => t('Home') },
  { k: 'plan', icon: 'calendar', to: '/plan', label: () => t('Plan') },
  { k: 'start', icon: S => S.active ? 'play' : 'dumbbell', action: true, label: S => startTabShortLabel(S) },
  { k: 'stats', icon: 'chart', to: '/stats', label: () => t('Stats') },
  { k: 'library', icon: 'list', to: '/library', label: () => t('Exercises') },
  { k: 'more', icon: 'more', to: '/more', label: () => t('More') },
]

function isActive(cur, k) {
  if (k === 'more') return cur === 'more' || cur === 'history' || cur === 'settings'
  if (k === 'start') return cur === 'workout'
  return cur === k
}

function TabItem({ active, visible, icon, label, recording, onClick }) {
  return (
    <button
      type="button"
      className={'tab-item' + (active ? ' on' : '') + (recording ? ' rec' : '') + (!visible ? ' compact' : '')}
      onClick={onClick}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
    >
      <div className="tab-icon-slot">
        <div className={'tab-lift' + (active && visible ? ' up' : '')}>
          {active && <span className="tab-pill" aria-hidden="true" />}
          <Icon name={icon} className="tab-icn" />
        </div>
      </div>
      <span className="tab-label">{label}</span>
    </button>
  )
}

export default function TabBar({ onStart }) {
  const nav = useNavigate()
  const loc = useLocation()
  const S = useStore(s => s.S)
  const user = useStore(s => s.user)
  const isGuest = useStore(s => s.isGuest())
  const isVisible = useScrollDirection()
  if (!user && !isGuest) return null

  const cur = loc.pathname.split('/')[1] || 'home'

  const startWorkout = () => {
    if (S.active) { nav('/workout'); return }
    if (!S.routines.length) { nav('/plan'); return }
    const r = effectiveRoutine(S, todayISO())
    if (r && r.ex.length) { onStart(r.id); return }
    nav('/workout')
  }

  const onTab = tab => {
    if (tab.action) startWorkout()
    else nav(tab.to)
  }

  return (
    <div id="tabbar" className={(isVisible ? '' : 'hidden ') + (!isVisible ? 'compact' : '')}>
      <nav className="tabbar-nav" aria-label={t('Main navigation')}>
        <div className="tabbar-bg" aria-hidden="true" />
        <div className="tabbar-row">
          {TABS.map(tab => {
            const active = isActive(cur, tab.k)
            const icon = typeof tab.icon === 'function' ? tab.icon(S) : tab.icon
            const label = tab.label(S)
            return (
              <TabItem
                key={tab.k}
                active={active}
                visible={isVisible}
                icon={icon}
                label={label}
                recording={tab.k === 'start' && !!S.active}
                onClick={() => onTab(tab)}
              />
            )
          })}
        </div>
      </nav>
    </div>
  )
}
