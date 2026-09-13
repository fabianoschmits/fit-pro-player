import { lazy, Suspense, useEffect, useState } from 'react'
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
import Icon from './components/Icon.jsx'
import TabBar from './components/TabBar.jsx'
import PageTransition from './components/PageTransition.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import Modals from './components/Modals.jsx'
import Toast from './components/Toast.jsx'
import AvatarImage from './components/AvatarImage.jsx'
import progressDumbbell from './assets/progress-dumbbell.png'
import { ageFromBirthDate, currentProfileWeight, heightText, weightText } from './lib/profile.js'
import RestTimer from './components/RestTimer.jsx'
const loadLanding = () => import('./views/Landing.jsx')
const loadHome = () => import('./views/Home.jsx')
const loadPlan = () => import('./views/Plan.jsx')
const loadRoutineEdit = () => import('./views/RoutineEdit.jsx')
const loadWorkout = () => import('./views/Workout.jsx')
const loadStats = () => import('./views/Stats.jsx')
const loadHistory = () => import('./views/History.jsx')
const loadLibrary = () => import('./views/Library.jsx')
const loadSettings = () => import('./views/Settings.jsx')
const loadAdmin = () => import('./views/Admin.jsx')
const loadMore = () => import('./views/More.jsx')
const loadSheets = () => import('./sheets.jsx')

const Landing = lazy(loadLanding)
const Home = lazy(loadHome)
const Plan = lazy(loadPlan)
const RoutineEdit = lazy(loadRoutineEdit)
const Workout = lazy(loadWorkout)
const Stats = lazy(loadStats)
const History = lazy(loadHistory)
const Library = lazy(loadLibrary)
const Settings = lazy(loadSettings)
const Admin = lazy(loadAdmin)
const More = lazy(loadMore)

// Once the PWA shell is installed, warm its core routes while the browser is idle. Requests
// pass through the service worker and become available offline without delaying first paint.
export const preloadCoreRoutes = () => Promise.allSettled([
  loadHome(), loadPlan(), loadRoutineEdit(), loadWorkout(), loadStats(), loadHistory(),
  loadLibrary(), loadSettings(), loadMore(), loadSheets(),
])

const startFlow = (...args) => loadSheets().then(module => module.startFlow(...args))

bindUI(useUI)   // lets the shared controls open sheets without importing the store at module scope

const PROFILE_MOTIVATION_MESSAGES = [
  'Birlll!',
  'Aqui é bodybuilder!',
  'O pai tá on.',
  'Receba!',
  'É os guri!',
  'Mete marcha.',
  'Só vai, pai.',
  'Tá pago.',
  'Bora, filho!',
  'Sem caô.',
  'Respeita o pai.',
  'A tropa tá forte.',
  'Hoje é sem desculpa.',
  'O shape vem, confia.',
  'Farmando músculo.',
  'Modo monstro: ON.',
  'Só progresso.',
  'Vai dar bom.',
  'É dentro.',
  'Tá maluco!',
  'Amassa esse treino.',
  'Zerou a preguiça.',
  'Cria do leg day.',
  'Shape inexplicável.',
  'Hoje tem!',
  'Fé no processo.',
  'Não tem como, pai.',
  'Marcha no treino.',
  'O monstro acordou.',
  'Só os cria treinam.',
  'Projeto monstro.',
  'Hoje dói, amanhã posa.',
  'Menos papo, mais carga.',
  'Treina e confia.',
  'O sofá não dá shape.',
  'Sofrendo e evoluindo.',
  'Sem suor, sem história.',
  'Tá leve? Aumenta.',
  'Não foge do leg day.',
  'O shape não vem por Wi-Fi.',
  'Só mais uma… confia.',
  'Treino pago, treino feito.',
  'Levanta e vai.',
  'Build de monstro carregando…',
  'Buff de força ativado.',
  'NPC não treina perna.',
  'Hoje o frango evolui.',
  'Foco no shape, não na fofoca.',
  'Desistir não queima calorias.',
  'Treina agora, reclama depois.',
]

function weightGoalProgressPercent(S) {
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
  if (!total) return current === target ? 100 : 0
  const progress = target > start
    ? (current - start) / total
    : (start - current) / total
  return Math.round(Math.min(1, Math.max(0, progress)) * 100)
}

function applyPrefs(theme, accent) {
  const de = document.documentElement
  de.dataset.theme = theme === 'light' ? 'light' : 'dark'
  de.dataset.accent = ACCENTS[accent] ? accent : 'lime'
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.content = de.dataset.theme === 'light' ? '#eef2f6' : '#000000'
}

function RouteFallback() {
  return <div className="route-loading" role="status"><Icon name="dumbbell" /><span className="sr-only">{t('Loading…')}</span></div>
}

function ProfileHeader({ S, preview }) {
  const [messageIndex, setMessageIndex] = useState(0)
  const reduceMotion = useReducedMotion()
  const profile = preview ? { ...S.profile, ...preview } : S.profile
  const goalProgressPercent = weightGoalProgressPercent(S)
  const progress = goalProgressPercent == null ? 0 : goalProgressPercent
  const currentWeight = currentProfileWeight(S)
  const age = ageFromBirthDate(profile?.birthDate)
  const stats = [
    { icon: 'calendar', value: t('{0} years', age ?? '--') },
    { icon: 'figureStrength', value: `${heightText(profile?.heightCm) || '--'} m` },
    { icon: 'scale', value: `${currentWeight ? weightText(currentWeight) : '--'} ${S.unit}` },
  ]
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
  if (!S.onboardingDone || !profile?.name) return null
  return <div className="plan-profile-card app-plan-profile-header" aria-label={profile.name}>
    <span className="profile-card-glow" aria-hidden="true" />
    <span className="plan-profile-avatar" aria-hidden="true">
      <AnimatePresence mode="sync" initial={false}>
        <motion.span
          key={profile.avatarId}
          className="profile-avatar-drop"
          initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: -34, scale: 1.03, rotate: -2, filter: 'blur(3px)' }}
          animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: [0, 8, -3, 0], scale: [1, 1.025, 0.995, 1], rotate: [0, -1.8, 1.2, 0], filter: 'blur(0px)' }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 0, scale: 0.995, filter: 'blur(3px)' }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.58, times: [0, 0.46, 0.72, 1], ease: [0.2, 0.8, 0.2, 1] }}
        >
          <AvatarImage avatarId={profile.avatarId} />
          <span className="profile-avatar-dust left" />
          <span className="profile-avatar-dust right" />
        </motion.span>
      </AnimatePresence>
    </span>
    <span className="grow app-profile-copy">
      <strong>{profile.name}</strong>
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
    <span className="profile-goal-wrap" aria-label={goalProgressPercent == null ? t('Goal') : `${goalProgressPercent}%`}>
      <span className="profile-goal-ring" style={{ '--profile-goal-progress': `${progress}%` }}>
        <img className="profile-goal-icon" src={progressDumbbell} alt="" />
        <span className="profile-goal-percent">{goalProgressPercent == null ? '--' : `${goalProgressPercent}%`}</span>
      </span>
    </span>
    <span className="profile-stat-stack">
      {stats.map((stat, index) => (
        <span className="profile-stat" key={index}>
          <Icon name={stat.icon} />
          <b>{stat.value}</b>
        </span>
      ))}
    </span>
  </div>
}

function Shell() {
  const navigate = useNavigate()
  const loc = useLocation()
  const { S, user, ready } = useStore()
  const profilePreview = useUI(s => s.profilePreview)
  const isGuest = useStore(s => s.isGuest())
  const authed = user || isGuest
  const profileEditorOpen = loc.pathname === '/plan' && new URLSearchParams(loc.search).get('profile') === 'edit'
  const showProfileHeader = loc.pathname === '/home' || profileEditorOpen
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
          {!authed ? <Suspense fallback={<RouteFallback />}><Landing /></Suspense> : (
            <>{showProfileHeader && <ProfileHeader S={S} preview={profilePreview} />}<Suspense fallback={<RouteFallback />}><Routes>
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
              </Routes></Suspense></>
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
