import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { HashRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'
import { bindUI } from './components/ui.jsx'
import { ACCENTS } from './lib/format.js'
import { DEFAULT_LANG, setLang, useLang, t } from './lib/i18n.js'
import { setNav } from './lib/nav.js'
import { initBackButton } from './lib/back.js'
import { useWakeLock } from './lib/wakelock.js'
import { startFlow } from './sheets.jsx'
import Icon from './components/Icon.jsx'
import TabBar from './components/TabBar.jsx'
import PageTransition from './components/PageTransition.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import Modals from './components/Modals.jsx'
import Toast from './components/Toast.jsx'
import AvatarImage from './components/AvatarImage.jsx'
import { currentProfileWeight } from './lib/profile.js'
import RestTimer from './components/RestTimer.jsx'
import Landing from './views/Landing.jsx'
import Home from './views/Home.jsx'
import Plan from './views/Plan.jsx'
import RoutineEdit from './views/RoutineEdit.jsx'
import Workout from './views/Workout.jsx'
import Stats from './views/Stats.jsx'
import History from './views/History.jsx'
import Library from './views/Library.jsx'
import Settings from './views/Settings.jsx'
import Admin from './views/Admin.jsx'
import More from './views/More.jsx'

bindUI(useUI)   // lets the shared controls open sheets without importing the store at module scope

const PROFILE_MOTIVATION_MESSAGES = [
  'Um treino por vez.',
  'Hoje conta muito.',
  'Continue firme.',
  'Seu ritmo vale.',
  'Voce esta evoluindo.',
  'Mais uma vitoria.',
  'Forca no processo.',
  'Constancia vence.',
  'Siga aparecendo.',
  'Treino feito pesa.',
  'Pequenos passos.',
  'A meta esta viva.',
  'Foco no proximo.',
  'Seu corpo responde.',
  'Nao quebra a sequencia.',
  'Cada serie soma.',
  'Energia em acao.',
  'Vai no seu tempo.',
  'Hoje tem progresso.',
  'Voce chegou ate aqui.',
]

function weightGoalRemainingPercent(S) {
  const current = currentProfileWeight(S)
  const target = Number(S.targetW) || null
  if (!(current > 0) || !(target > 0)) return null
  const first = (S.bodyweight || []).reduce((earliest, entry) => {
    if (!entry || !(entry.w > 0)) return earliest
    if (!earliest) return entry
    if (String(entry.d || '') < String(earliest.d || '')) return entry
    if (String(entry.d || '') === String(earliest.d || '') && (entry.t || 0) < (earliest.t || 0)) return entry
    return earliest
  }, null)?.w
  const start = first > 0 ? first : current
  const total = Math.abs(start - target)
  if (!total) return current === target ? 0 : null
  const remaining = Math.min(1, Math.max(0, Math.abs(current - target) / total))
  return Math.round(remaining * 100)
}

function applyPrefs(theme, accent) {
  const de = document.documentElement
  de.dataset.theme = theme === 'light' ? 'light' : 'dark'
  de.dataset.accent = ACCENTS[accent] ? accent : 'lime'
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.content = de.dataset.theme === 'light' ? '#eef2f6' : '#000000'
}

function ProfileHeader({ S }) {
  const [messageIndex, setMessageIndex] = useState(0)
  const reduceMotion = useReducedMotion()
  const remainingPercent = weightGoalRemainingPercent(S)
  const progress = remainingPercent == null ? 0 : 100 - remainingPercent
  useEffect(() => {
    const interval = window.setInterval(() => {
      setMessageIndex(index => {
        if (PROFILE_MOTIVATION_MESSAGES.length < 2) return index
        let next = index
        while (next === index) next = Math.floor(Math.random() * PROFILE_MOTIVATION_MESSAGES.length)
        return next
      })
    }, 7000)
    return () => window.clearInterval(interval)
  }, [])
  if (!S.onboardingDone || !S.profile?.name) return null
  return <div className="card plan-profile-card app-plan-profile-header" aria-label={S.profile.name}>
    <span className="plan-profile-avatar" aria-hidden="true"><AvatarImage avatarId={S.profile.avatarId} /></span>
    <span className="grow app-profile-copy">
      <strong>{S.profile.name}</strong>
      <span className="profile-message-stage" aria-live="polite">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.small
            key={messageIndex}
            className="profile-message"
            initial={reduceMotion ? { opacity: 1 } : { x: 28, opacity: 0, filter: 'blur(4px)' }}
            animate={reduceMotion ? { opacity: 1 } : { x: 0, opacity: 1, filter: 'blur(0px)' }}
            exit={reduceMotion ? { opacity: 0 } : { x: -28, opacity: 0, filter: 'blur(4px)' }}
            transition={reduceMotion ? { duration: 0 } : { type: 'spring', duration: 0.48, bounce: 0 }}
          >
            {PROFILE_MOTIVATION_MESSAGES[messageIndex]}
          </motion.small>
        </AnimatePresence>
      </span>
    </span>
    <span className="profile-goal-wrap" aria-label={remainingPercent == null ? t('Goal') : `${remainingPercent}%`}>
      <span className="profile-goal-ring" style={{ '--profile-goal-progress': `${progress}%` }}>
        <Icon name="scale" />
      </span>
      <span className="profile-goal-percent">{remainingPercent == null ? '--%' : `${remainingPercent}%`}</span>
    </span>
  </div>
}

function Shell() {
  const navigate = useNavigate()
  const loc = useLocation()
  const { S, user, ready } = useStore()
  const isGuest = useStore(s => s.isGuest())
  const authed = user || isGuest
  const langV = useLang()   // re-renders the whole shell when the language (pack) changes
  useEffect(() => { setNav(navigate) }, [navigate])
  useEffect(() => { applyPrefs(S.theme, S.accent) }, [S.theme, S.accent])
  useEffect(() => { setLang(S.lang || DEFAULT_LANG) }, [S.lang])
  useEffect(() => { document.documentElement.lang = (S.lang || DEFAULT_LANG) === 'pt' ? 'pt-BR' : (S.lang || DEFAULT_LANG) }, [langV, S.lang])
  // every tab/route change starts at the top of the page
  useEffect(() => { window.scrollTo(0, 0) }, [loc.pathname])
  // First entry is a single, resumable setup inside Plan. Until it is complete, other routes
  // cannot accidentally surface an empty dashboard or the retired Home overlay.
  useEffect(() => {
    if (ready && authed && !S.onboardingDone && loc.pathname !== '/plan') navigate('/plan', { replace: true })
  }, [S.onboardingDone, authed, loc.pathname, navigate, ready])
  // bound to the workout, not to the route — checking Stats mid-session keeps the screen on
  useWakeLock(!!S.active && S.keepAwake !== false)

  if (!ready && !authed) return (
    <div id="app">
      <div className="boot-loading">
        <Icon name="dumbbell" />
        <span className="muted small">{t('Loading…')}</span>
      </div>
    </div>
  )

  return (
    <>
      {/* keyed on the route: a view that throws is contained, and switching tabs
          re-mounts the boundary, so the tab bar is always a way out */}
      <PageTransition>
        <ErrorBoundary>
          {!authed ? <Landing /> : (
            <><ProfileHeader S={S} /><Routes>
              <Route path="/home" element={<Home />} />
              <Route path="/plan" element={<Plan />} />
              <Route path="/plan/r/:id" element={<RoutineEdit />} />
              <Route path="/workout" element={<Workout />} />
              <Route path="/stats" element={<Stats />} />
              <Route path="/history" element={<History />} />
              <Route path="/library" element={<Library />} />
              <Route path="/more" element={<More />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/admin" element={user?.admin ? <Admin /> : <Navigate to="/home" replace />} />
              <Route path="*" element={<Navigate to="/home" replace />} />
            </Routes></>
          )}
        </ErrorBoundary>
      </PageTransition>
      <TabBar onStart={startFlow} />
      <RestTimer />
      <Modals />
      <Toast />
    </>
  )
}

export default function App() {
  const boot = useStore(s => s.boot)
  useEffect(() => { boot() }, [boot])
  // Android system back — sheet, then page, then press-again-to-exit (see lib/back.js)
  useEffect(() => {
    let stop = null, gone = false
    initBackButton().then(fn => { if (gone) fn(); else stop = fn })
    return () => { gone = true; stop?.() }
  }, [])
  return <HashRouter><Shell /></HashRouter>
}
