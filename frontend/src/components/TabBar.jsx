import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { useAuth } from '../auth/AuthProvider.jsx'
import { effectiveRoutine } from '../lib/history.js'
import { todayISO } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import { startTabShortLabel } from '../lib/ux.js'
import { getBrowserSupabaseClient } from '../lib/supabase-client.js'
import { createProfessionalWorkflowRepository } from '../lib/professional-workflow.js'
import { createConsoleRepository } from '../lib/console.js'
import { confirmSheet } from '../sheets.jsx'
import Icon from './Icon.jsx'
import NavigationIcon from './NavigationIcon.jsx'
import { useFppActivation } from './useFppActivation.js'

const NAVIGATION_LAYOUT_KEY = 'fpp_navigation_layout_v1'
const PIVOT_WIDTH = 56
const MENU_HEIGHT = 52
const MAX_ARM_WIDTH = 320

const MAIN = [
  { k: 'home', icon: 'house', to: '/home', label: () => t('Home') },
  { k: 'plan', icon: 'calendar', to: '/plan', label: () => t('Plan') },
  { k: 'start', icon: 'dumbbell', action: true, label: s => startTabShortLabel(s) },
  { k: 'stats', icon: 'chart', to: '/stats', label: () => t('Stats') },
]
const activeMain = path => {
  const root = path.split('/')[1] || 'home'
  return root === 'body-progress' ? 'stats' : root === 'workout' ? 'start' : MAIN.some(x => x.k === root) ? root : null
}

function MainButton({ item, active, state, visible, entryKey, onSelect }) {
  const trigger = useFppActivation({ onActivate: onSelect })
  const [activation, setActivation] = useState(0)
  const select = event => {
    if (!event.defaultPrevented && !trigger.pressed) setActivation(value => value + 1)
    trigger.run(event)
  }
  return <button type="button" data-tab-key={item.k}
    className={'corner-nav-tab' + (item.action ? ' corner-nav-tab--start' : '') + (active ? ' is-active' : '')}
    onClick={select} aria-current={active ? 'page' : undefined}>
    <span className="corner-nav-icon"><NavigationIcon name={item.k} resume={Boolean(state.active)} active={active} visible={visible} activation={activation} entryKey={entryKey} /></span><span>{item.label(state)}</span>
  </button>
}

// Keep a moved menu reachable, including after rotating or resizing the screen.
function constrainPosition(point, height) {
  const margin = window.innerWidth >= 768 ? 16 : 0
  const bottom = Math.max(0, window.innerHeight - height - margin)
  return {
    x: Math.max(margin, Math.min(point.x, window.innerWidth - PIVOT_WIDTH - margin)),
    y: Math.max(Math.min(160, bottom), Math.min(point.y, bottom)),
  }
}

function readNavigationLayout() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(NAVIGATION_LAYOUT_KEY) || 'null')
    const point = saved?.position
    return {
      open: saved?.open === true,
      position: Number.isFinite(point?.x) && Number.isFinite(point?.y) ? constrainPosition(point, MENU_HEIGHT) : null,
    }
  } catch { return { open: false, position: null } }
}

export default function TabBar({ onStart }) {
  const nav = useNavigate(), loc = useLocation()
  const S = useStore(s => s.S), isGuest = useStore(s => s.isGuest()), auth = useAuth()
  const account = auth.status === 'authenticated' ? auth.user : null
  const [layout, setLayout] = useState(readNavigationLayout)
  const { open, position } = layout
  const setOpen = value => setLayout(current => ({ ...current, open: typeof value === 'function' ? value(current.open) : value }))
  const setPosition = value => setLayout(current => {
    const next = typeof value === 'function' ? value(current.position) : value
    return next === current.position ? current : { ...current, position: next }
  })
  const [moreOpen, setMoreOpen] = useState(false)
  const [professional, setProfessional] = useState(false), [consoleAccess, setConsoleAccess] = useState(false)
  const [moveReady, setMoveReady] = useState(false)
  const [iconActivation, setIconActivation] = useState(0)
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth)
  const rootRef = useRef(null), toggleRef = useRef(null), moreTrigger = useRef(null), firstMore = useRef(null)
  const drag = useRef(null), ignoreClickUntil = useRef(0)
  const free = position !== null

  // Only the bottom bar's layout survives an app restart; More stays transient.
  useEffect(() => {
    try { window.localStorage.setItem(NAVIGATION_LAYOUT_KEY, JSON.stringify({ open, position })) } catch {}
  }, [open, position])

  useEffect(() => {
    let alive = true
    setProfessional(false)
    setConsoleAccess(false)
    if (account?.id) {
      const client = getBrowserSupabaseClient()
      createProfessionalWorkflowRepository({ client }).professionalRole(account.id).then(v => alive && setProfessional(v)).catch(() => {})
      createConsoleRepository({ client }).adminRole(account.id).then(v => alive && setConsoleAccess(v)).catch(() => {})
    }
    return () => { alive = false }
  }, [account?.id])

  useEffect(() => {
    if (!moreOpen) return
    firstMore.current?.focus()
    const close = event => {
      if (event.key === 'Escape') {
        setMoreOpen(false)
        moreTrigger.current?.focus()
      } else if (event.type === 'pointerdown' && !rootRef.current?.contains(event.target)) setMoreOpen(false)
    }
    document.addEventListener('keydown', close)
    document.addEventListener('pointerdown', close)
    return () => {
      document.removeEventListener('keydown', close)
      document.removeEventListener('pointerdown', close)
    }
  }, [moreOpen])

  useEffect(() => {
    const fit = () => {
      setViewportWidth(window.innerWidth)
      setPosition(point => point && constrainPosition(point, MENU_HEIGHT))
    }
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [])

  if (!((auth.status === 'authenticated' || isGuest) && S.onboardingDone)) return null

  const start = () => {
    if (S.active) return nav('/workout')
    if (!S.routines.length) return nav('/plan')
    const routine = effectiveRoutine(S, todayISO())
    if (routine?.ex.length) return onStart(routine.id)
    nav('/workout')
  }
  const go = to => { setMoreOpen(false); nav(to) }
  const signOut = () => confirmSheet({
    title: 'Sair da conta?', message: 'Sua sessão será encerrada neste dispositivo.', confirmText: 'Sair', danger: true,
    onConfirm: async () => {
      const result = await auth.signOut()
      if (result?.kind && result.kind !== 'success') throw new Error('sign_out_failed')
      nav('/')
      return true
    },
  })

  const beginDrag = event => {
    if (event.button > 0 || event.isPrimary === false) return
    const rect = rootRef.current.getBoundingClientRect()
    drag.current = { x: event.clientX, y: event.clientY, left: rect.left, top: rect.top, moved: false }
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }
  const moveDrag = event => {
    const origin = drag.current
    if (!origin) return
    const dx = event.clientX - origin.x, dy = event.clientY - origin.y
    if (!origin.moved && Math.hypot(dx, dy) < 6) return
    origin.moved = true
    event.preventDefault()
    setMoreOpen(false)
    setPosition(constrainPosition({ x: origin.left + dx, y: origin.top + dy }, MENU_HEIGHT))
  }
  const endDrag = () => {
    if (drag.current?.moved) { ignoreClickUntil.current = Date.now() + 300; setMoveReady(false) }
    drag.current = null
  }
  const toggleMenu = () => {
    if (Date.now() < ignoreClickUntil.current) return
    setIconActivation(value => value + 1)
    setOpen(value => !value)
    setMoreOpen(false)
  }
  const moveMenu = () => {
    if (free) setPosition(null)
    else setMoveReady(true)
    setMoreOpen(false)
    toggleRef.current?.focus()
  }
  const groups = [
    ['Geral', [
      { icon: 'person', title: 'Dados pessoais', sub: 'Seus dados e informações', to: '/personal-data' },
      { icon: 'gear', title: t('Settings'), sub: t('Language, units, backup & preferences'), to: '/settings' },
      ...(consoleAccess ? [{ icon: 'gear', title: 'Central da plataforma', sub: 'Operação da plataforma', to: '/console' }] : []),
    ]],
    ['Treino', [
      { icon: 'list', title: t('Exercises'), sub: 'Catálogo completo', to: '/library' },
      { icon: 'history', title: t('History'), sub: t('All your past workouts'), to: '/history' },
      { icon: 'chartLine', title: 'Evolução corporal', sub: 'Medidas semanais e evolução do corpo', to: '/body-progress' },
    ]],
    ...((account || professional) ? [['Profissional', [
      ...(account ? [{ icon: 'personCircle', title: 'Meus profissionais', sub: 'Programas e prescrições', to: '/student/professionals' }] : []),
      { icon: 'clipboard', title: professional ? 'Área profissional' : 'Tornar-se profissional', sub: professional ? 'Alunos, convites e programas' : t('Create your profile to coach students'), to: professional ? '/professional' : '/professional/profile' },
    ]]] : []),
    ['Sobre', [
      { icon: 'info', title: 'Ajuda e suporte', sub: 'Dúvidas, críticas e sugestões', to: '/support' },
      { icon: 'info', title: 'Sobre o Fit Pro Player', sub: 'Informações do aplicativo', to: '/privacy' },
      { icon: 'shield', title: 'Termos e privacidade', sub: 'Privacidade, cookies e direitos LGPD', to: '/privacy-settings' },
      ...(account ? [{ icon: 'signOut', title: 'Sair da conta', sub: 'Encerrar a sessão neste dispositivo', action: signOut }] : []),
      { icon: 'expand', title: free ? 'Prender menu ao rodapé' : 'Mover menu livremente', sub: free ? 'Volta para a posição padrão' : 'Arraste o pivô para posicionar', action: moveMenu, dragToggle: true },
    ]],
  ]
  const current = activeMain(loc.pathname)
  const secondary = groups.flatMap(([, links]) => links).find(item => item.to === loc.pathname)
  const currentItem = MAIN.find(item => item.k === current) || (secondary && { ...secondary, label: () => secondary.title }) || MAIN[0]
  // Expand toward the side with room, preserving the pivot's chosen location.
  const opensLeft = free && position.x > (viewportWidth - PIVOT_WIDTH) / 2
  const armSpace = free ? (opensLeft ? position.x : viewportWidth - position.x - PIVOT_WIDTH) : 0
  const panelWidth = Math.min(320, viewportWidth - 24)
  const style = position ? {
    left: position.x, top: position.y, bottom: 'auto',
    '--menu-width': `${PIVOT_WIDTH + Math.min(MAX_ARM_WIDTH, armSpace)}px`,
    '--more-space': `${Math.max(0, position.y - 44)}px`,
    '--more-left': `${Math.max(8, Math.min(position.x, viewportWidth - panelWidth - 8)) - position.x}px`,
  } : undefined

  return <div id="tabbar" ref={rootRef} className={'corner-nav' + (open ? ' is-open' : '') + (free ? ' is-free' : '') + (opensLeft ? ' opens-left' : '') + (moveReady ? ' is-move-ready' : '')} style={style}>
    <nav className="corner-nav-rail" aria-label={t('Main navigation')}>
      <button type="button" ref={moreTrigger} className="corner-nav-more-trigger"
        aria-label={moreOpen ? 'Fechar mais opções' : 'Abrir mais opções'} aria-expanded={moreOpen} aria-controls="corner-nav-more"
        tabIndex={open ? undefined : -1} aria-hidden={!open} inert={!open}
        onClick={() => setMoreOpen(value => !value)}><Icon name="chevronUp" /></button>
      <div className="corner-nav-shell">
        <button type="button" ref={toggleRef} className="corner-nav-toggle" aria-expanded={open} aria-controls="corner-nav-main"
          aria-label={`${open ? 'Fechar menu' : 'Abrir menu'}: ${currentItem.label(S)}`}
          onPointerDown={beginDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag} onLostPointerCapture={endDrag} onClick={toggleMenu}>
          <span className="corner-nav-icon">{current
            ? <NavigationIcon name={current} resume={Boolean(S.active)} active activation={iconActivation} />
            : <Icon name={currentItem.icon} />}</span>
          <span className="corner-nav-label">{currentItem.label(S)}</span>
        </button>
        <div id="corner-nav-main" className="corner-nav-main" aria-hidden={!open} inert={!open}>
          {MAIN.map(item => <MainButton key={item.k} item={item} state={S} active={current === item.k} visible={open} entryKey={loc.key} onSelect={() => item.action ? start() : go(item.to)} />)}
        </div>
      </div>
      <div id="corner-nav-more" className={'corner-nav-more' + (moreOpen ? ' is-visible' : '')} role="menu" aria-label={t('Mais opções')} aria-hidden={!moreOpen} inert={!moreOpen}>
        {groups.map(([group, links], groupIndex) => <section key={group}>
          <h2>{group}</h2>
          {links.map((item, index) => <button tabIndex={moreOpen ? undefined : -1}
            ref={groupIndex === 0 && index === 0 ? firstMore : undefined} key={item.title} role="menuitem" type="button"
            className={'corner-nav-more-item' + (item.dragToggle ? ' corner-nav-drag-toggle' : '')}
            onClick={() => item.action ? item.action() : go(item.to)}>
            <Icon name={item.icon} /><span><strong>{item.title}</strong><small>{item.sub}</small></span>
          </button>)}
        </section>)}
      </div>
    </nav>
  </div>
}
