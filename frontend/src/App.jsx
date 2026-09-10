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
import progressDumbbell from './assets/progress-dumbbell.png'
import { ageFromBirthDate, currentProfileWeight, heightText, weightText } from './lib/profile.js'
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
  'Birlll!',
  'Aqui e bodybuilder!',
  'O pai ta on.',
  'Receba!',
  'E os guri!',
  'Mete marcha.',
  'So vai, pai.',
  'Ta pago.',
  'Bora, filho!',
  'Sem cao.',
  'Respeita o pai.',
  'A tropa ta forte.',
  'Hoje e sem desculpa.',
  'O shape vem, confia.',
  'Farmando musculo.',
  'Modo monstro: ON.',
  'So progresso.',
  'Vai dar bom.',
  'E dentro.',
  'Ta maluco!',
  'Amassa esse treino.',
  'Zerou a preguica.',
  'Cria do leg day.',
  'Shape inexplicavel.',
  'Hoje tem!',
  'Fe no processo.',
  'Nao tem como, pai.',
  'Marcha no treino.',
  'O monstro acordou.',
  'So os cria treinam.',
  'Projeto monstro.',
  'Hoje doi, amanha posa.',
  'Menos papo, mais carga.',
  'Treina e confia.',
  'O sofa nao da shape.',
  'Sofrendo e evoluindo.',
  'Sem suor, sem historia.',
  'Ta leve? Aumenta.',
  'Nao foge do leg day.',
  'O shape nao vem por Wi-Fi.',
  'So mais uma... confia.',
  'Treino pago, treino feito.',
  'Levanta e vai.',
  'Build de monstro carregando...',
  'Buff de forca ativado.',
  'NPC nao treina perna.',
  'Hoje o frango evolui.',
  'Foco no shape, nao na fofoca.',
  'Desistir nao queima calorias.',
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
  return <div className="card plan-profile-card app-plan-profile-header" aria-label={profile.name}>
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
        <span className="profile-goal-percent">{goalProgressPercent == null ? '--%' : `${goalProgressPercent}%`}</span>
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
            <><ProfileHeader S={S} preview={profilePreview} /><Routes>
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
