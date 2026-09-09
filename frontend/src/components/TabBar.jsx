import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion'
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

const SPRING = { type: 'spring', stiffness: 300, damping: 30 }
const PILL_SPRING = {
  type: 'spring',
  stiffness: 400,
  damping: 25,
  mass: 1,
  layout: { type: 'spring', stiffness: 350, damping: 25 },
}

function isActive(cur, k) {
  if (k === 'more') return cur === 'more' || cur === 'history' || cur === 'settings'
  if (k === 'start') return cur === 'workout'
  return cur === k
}

function TabItem({ featured, active, visible, icon, label, recording, onClick, tabKey, tabRef }) {
  if (featured) {
    return (
      <button
        type="button"
        ref={tabRef}
        data-tab-key={tabKey}
        className={'tab-item tab-item--start' + (active ? ' on' : '') + (recording ? ' rec' : '') + (!visible ? ' compact' : '')}
        onClick={onClick}
        aria-label={label}
        aria-current={active ? 'page' : undefined}
      >
        <div className="tab-start-wrap">
          <span className="tab-start-cir">
            <Icon name={icon} className="tab-icn" />
          </span>
        </div>
        <motion.span
          className="tab-label"
          initial={false}
          animate={{
            opacity: visible ? 1 : 0,
            height: visible ? 'auto' : 0,
            marginTop: visible ? 2 : 0,
          }}
          transition={SPRING}
        >
          {label}
        </motion.span>
      </button>
    )
  }

  return (
    <button
      type="button"
      ref={tabRef}
      data-tab-key={tabKey}
      className={'tab-item' + (active ? ' on' : '') + (!visible ? ' compact' : '')}
      onClick={onClick}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
    >
      <div className={'tab-icon-slot' + (visible ? '' : ' tall')}>
        <motion.div
          className="tab-lift"
          animate={{ y: active && visible ? -18 : 0 }}
          transition={SPRING}
        >
          <AnimatePresence>
            {active && (
              <motion.span
                layoutId="active-pill"
                className="tab-active-pill"
                initial={{ opacity: 0, scaleX: 1.5, scaleY: 0.6 }}
                animate={{ opacity: 1, scaleX: 1, scaleY: 1 }}
                exit={{ opacity: 0, scaleX: 0.5, scaleY: 1.5 }}
                transition={PILL_SPRING}
              />
            )}
          </AnimatePresence>
          <motion.span
            className="tab-icn-wrap"
            animate={{ color: active ? 'var(--on-acc)' : 'var(--label-3)' }}
            transition={{ duration: 0.2 }}
          >
            <Icon name={icon} className={'tab-icn' + (active ? ' tab-icn--on' : '')} />
          </motion.span>
        </motion.div>
      </div>
      <motion.span
        className="tab-label"
        initial={false}
        animate={{
          opacity: visible ? 1 : 0,
          height: visible ? 'auto' : 0,
          scale: active ? 1.05 : 1,
          marginTop: visible ? 2 : 0,
        }}
        transition={SPRING}
      >
        {label}
      </motion.span>
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
  const tabRefs = useRef(new Map())
  const [dragTab, setDragTab] = useState(null)

  useEffect(() => {
    const row = rowRef.current
    if (!row) return
    let pointerId = null
    let moved = false
    const nearest = x => {
      let found = null, distance = Infinity
      for (const [key, el] of tabRefs.current) {
        const rect = el.getBoundingClientRect()
        const d = Math.abs(x - (rect.left + rect.width / 2))
        if (d < distance) { distance = d; found = key }
      }
      return found
    }
    const down = event => {
      if (event.pointerType === 'mouse' && event.button !== 0) return
      if (!event.target.closest('.tab-item')) return
      pointerId = event.pointerId; row._startX = event.clientX; moved = false
    }
    const move = event => {
      if (pointerId !== event.pointerId) return
      if (!moved && Math.abs(event.clientX - row._startX) < 8) return
      moved = true
      row._startX ??= event.clientX
      if (!row.hasPointerCapture(event.pointerId)) row.setPointerCapture(event.pointerId)
      event.preventDefault()
      setDragTab(nearest(event.clientX))
    }
    const end = event => {
      if (pointerId !== event.pointerId) return
      const target = moved ? nearest(event.clientX) : null
      pointerId = null; row._startX = null
      if (row.hasPointerCapture(event.pointerId)) row.releasePointerCapture(event.pointerId)
      if (target) row.querySelector(`[data-tab-key="${target}"]`)?.click()
      setDragTab(null)
    }
    row.addEventListener('pointerdown', down)
    row.addEventListener('pointermove', move, { passive: false })
    row.addEventListener('pointerup', end)
    row.addEventListener('pointercancel', end)
    return () => { row.removeEventListener('pointerdown', down); row.removeEventListener('pointermove', move); row.removeEventListener('pointerup', end); row.removeEventListener('pointercancel', end) }
  }, [])

  const cur = loc.pathname.split('/')[1] || 'home'

  if ((!user && !isGuest) || !S.onboardingDone) return null

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
        <LayoutGroup>
          <div ref={rowRef} className="tabbar-row tabbar-row-draggable">
            {TABS.map(tab => {
              const active = dragTab ? dragTab === tab.k : isActive(cur, tab.k)
              const icon = typeof tab.icon === 'function' ? tab.icon(S) : tab.icon
              const label = tab.label(S)
              return (
                <TabItem
                key={tab.k}
                tabKey={tab.k}
                tabRef={element => { if (element) tabRefs.current.set(tab.k, element); else tabRefs.current.delete(tab.k) }}
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
        </LayoutGroup>
      </nav>
    </div>
  )
}
