import { useCallback, useLayoutEffect, useRef, useState } from 'react'
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
  { k: 'start', icon: S => S.active ? 'play' : 'dumbbell', action: true, featured: true, label: S => startTabShortLabel(S) },
  { k: 'stats', icon: 'chart', to: '/stats', label: () => t('Stats') },
  { k: 'library', icon: 'list', to: '/library', label: () => t('Exercises') },
  { k: 'more', icon: 'more', to: '/more', label: () => t('More') },
]

function isActive(cur, k) {
  if (k === 'more') return cur === 'more' || cur === 'history' || cur === 'settings'
  if (k === 'start') return cur === 'workout'
  return cur === k
}

function TabItem({ tabRef, featured, active, visible, icon, label, recording, onClick }) {
  if (featured) {
    return (
      <button
        type="button"
        ref={tabRef}
        className={'tab-item tab-item--start' + (active ? ' on' : '') + (recording ? ' rec' : '') + (!visible ? ' compact' : '')}
        onClick={onClick}
        aria-label={label}
        aria-current={active ? 'page' : undefined}
      >
        <div className="tab-start-wrap" data-tab-anchor>
          <span className="tab-start-cir">
            <Icon name={icon} className="tab-icn" />
          </span>
        </div>
        <span className="tab-label">{label}</span>
      </button>
    )
  }

  return (
    <button
      type="button"
      ref={tabRef}
      className={'tab-item' + (active ? ' on' : '') + (!visible ? ' compact' : '')}
      onClick={onClick}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
    >
      <div className="tab-icon-slot" data-tab-anchor>
        <div className={'tab-lift' + (active && visible ? ' up' : '')}>
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
  const rowRef = useRef(null)
  const tabRefs = useRef({})
  const prevActive = useRef(null)
  const [pill, setPill] = useState({ x: 0, ready: false, hide: false, pop: false })

  const cur = loc.pathname.split('/')[1] || 'home'
  const activeKey = TABS.find(t => isActive(cur, t.k))?.k

  const updatePill = useCallback(() => {
    const row = rowRef.current
    const el = activeKey ? tabRefs.current[activeKey] : null
    if (!row || !el || activeKey === 'start') {
      setPill(p => ({ ...p, hide: true }))
      return
    }
    const anchor = el.querySelector('[data-tab-anchor]')
    if (!anchor) return
    const rowRect = row.getBoundingClientRect()
    const anchorRect = anchor.getBoundingClientRect()
    const x = anchorRect.left - rowRect.left + anchorRect.width / 2 - 24
    const pop = prevActive.current != null && prevActive.current !== activeKey
    prevActive.current = activeKey
    setPill({ x, ready: true, hide: false, pop })
    if (pop) {
      requestAnimationFrame(() => {
        setPill(p => ({ ...p, pop: false }))
      })
    }
  }, [activeKey])

  useLayoutEffect(() => {
    updatePill()
    const row = rowRef.current
    if (!row || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => updatePill())
    ro.observe(row)
    return () => ro.disconnect()
  }, [updatePill, isVisible, loc.pathname])

  useLayoutEffect(() => {
    window.addEventListener('resize', updatePill)
    return () => window.removeEventListener('resize', updatePill)
  }, [updatePill])

  if (!user && !isGuest) return null

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
        <div className="tabbar-row" ref={rowRef}>
          <div
            className={'tab-pill-track' + (pill.ready ? ' ready' : '') + (pill.pop ? ' pop' : '')}
            style={{ transform: `translateX(${pill.x}px)`, opacity: pill.hide ? 0 : undefined }}
            aria-hidden="true"
          >
            <span className="tab-pill-inner" />
          </div>
          {TABS.map(tab => {
            const active = isActive(cur, tab.k)
            const icon = typeof tab.icon === 'function' ? tab.icon(S) : tab.icon
            const label = tab.label(S)
            return (
              <TabItem
                key={tab.k}
                tabRef={el => { tabRefs.current[tab.k] = el }}
                featured={!!tab.featured}
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
