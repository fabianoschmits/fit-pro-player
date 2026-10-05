import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { HashRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { useStore } from './store/useStore.js'
import { useAuth } from './auth/AuthProvider.jsx'
import { openAuthSheet } from './components/AuthSheet.jsx'
import { useUI } from './store/useUI.js'
import { bindUI } from './components/ui.jsx'
import { ACCENTS } from './lib/format.js'
import { DEFAULT_LANG, setLang, useLang, t } from './lib/i18n.js'
import { setNav, nav } from './lib/nav.js'
import { initBackButton } from './lib/back.js'
import { useWakeLock } from './lib/wakelock.js'
import Icon from './components/Icon.jsx'
import TabBar from './components/TabBar.jsx'
import PageTransition from './components/PageTransition.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import Modals from './components/Modals.jsx'
import Toast from './components/Toast.jsx'
import AvatarImage from './components/AvatarImage.jsx'
import { ageFromBirthDate, currentProfileWeight, heightText, weightText } from './lib/profile.js'
import { getBrowserSupabaseClient } from './lib/supabase-client.js'
import RestTimer from './components/RestTimer.jsx'
import Landing from './views/Landing.jsx'
import { createProfessionalWorkflowRepository } from './lib/professional-workflow.js'
import { assignedPlanToState, clearAssignedProgramFromState } from './lib/assigned-program.js'
import { flushProfessionalEvents } from './lib/professional-events.js'
import { startNotificationCoordinator, syncNotificationPreferences, syncNotificationVisibility, reconnectNotifications, refreshNotificationReadiness, hasBackgroundNotifications, useNotificationStatus } from './lib/notification-client.js'
import { createForegroundNotificationScheduler } from './lib/foreground-notification-scheduler.js'
import { createNativePushAdapter } from './lib/native-push.js'
import { MOBILE } from './lib/mobile.js'
import { Capacitor } from '@capacitor/core'
import { cancelNativeTimer, scheduleNativeTimer } from './lib/native-timer-notifications.js'
import { normalizeNotificationPreferences } from './lib/notification-preferences.js'
const loadHome = () => import('./views/Home.jsx')
const loadPlan = () => import('./views/Plan.jsx')
const loadRoutineEdit = () => import('./views/RoutineEdit.jsx')
const loadWorkout = () => import('./views/Workout.jsx')
const loadStats = () => import('./views/Stats.jsx')
const loadHistory = () => import('./views/History.jsx')
const loadLibrary = () => import('./views/Library.jsx')
const loadSettings = () => import('./views/Settings.jsx')
const loadMore = () => import('./views/More.jsx')
const loadBodyProgress = () => import('./views/BodyProgress.jsx')
const loadProfessionalProfile = () => import('./views/ProfessionalProfile.jsx')
const loadProfessionalDashboard = () => import('./views/ProfessionalDashboard.jsx')
const loadProfessionalInvites = () => import('./views/ProfessionalInvites.jsx')
const loadInviteLanding = () => import('./views/InviteLanding.jsx')
const loadProfessionalStudents = () => import('./views/ProfessionalStudents.jsx')
const loadProfessionalStudentPage = () => import('./views/ProfessionalStudentPage.jsx')
const loadProfessionalPrograms = () => import('./views/ProfessionalPrograms.jsx')
const loadStudentProfessionals = () => import('./views/StudentProfessionals.jsx')
const loadSheets = () => import('./sheets.jsx')

const Home = lazy(loadHome)
const Plan = lazy(loadPlan)
const RoutineEdit = lazy(loadRoutineEdit)
const Workout = lazy(loadWorkout)
const Stats = lazy(loadStats)
const History = lazy(loadHistory)
const Library = lazy(loadLibrary)
const Settings = lazy(loadSettings)
const More = lazy(loadMore)
const BodyProgress = lazy(loadBodyProgress)
const ProfessionalProfile = lazy(loadProfessionalProfile)
const ProfessionalDashboard = lazy(loadProfessionalDashboard)
const ProfessionalInvites = lazy(loadProfessionalInvites)
const InviteLanding = lazy(loadInviteLanding)
const ProfessionalStudents = lazy(loadProfessionalStudents)
const ProfessionalStudentPage = lazy(loadProfessionalStudentPage)
const ProfessionalPrograms = lazy(loadProfessionalPrograms)
const StudentProfessionals = lazy(loadStudentProfessionals)

// Once the PWA shell is installed, warm its core routes while the browser is idle. Requests
// pass through the service worker and become available offline without delaying first paint.
export const preloadCoreRoutes = () => Promise.allSettled([
  loadHome(), loadPlan(), loadRoutineEdit(), loadWorkout(), loadStats(), loadHistory(),
  loadLibrary(), loadSettings(), loadMore(), loadBodyProgress(), loadProfessionalDashboard(), loadProfessionalInvites(), loadInviteLanding(), loadProfessionalStudents(), loadProfessionalStudentPage(), loadProfessionalPrograms(), loadStudentProfessionals(), loadSheets(),
])

const startFlow = (...args) => loadSheets().then(module => module.startFlow(...args))

bindUI(useUI)   // lets the shared controls open sheets without importing the store at module scope

const PROFILE_MOTIVATION_MESSAGES = [
  'Build consistency, one workout at a time.',
  'Train at your own pace.',
  'Keep showing up.',
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

export function ProfileHeader({ S, preview }) {
  const [messageIndex, setMessageIndex] = useState(0)
  const reduceMotion = useReducedMotion()
  const profile = preview ? { ...S.profile, ...preview } : S.profile
  const goalProgressPercent = weightGoalProgressPercent(S)
  const progress = goalProgressPercent == null ? 0 : goalProgressPercent
  const currentWeight = currentProfileWeight(S)
  const age = ageFromBirthDate(profile?.birthDate)
  const facts = [
    t('{0} years', age ?? '--'),
    `${heightText(profile?.heightCm) || '--'} m`,
    `${currentWeight ? weightText(currentWeight) : '--'} ${S.unit}`,
  ]
  useEffect(() => {
    if (S.motivationTone !== 'rotating' || reduceMotion) return
    const interval = window.setInterval(() => {
      setMessageIndex(index => {
        if (PROFILE_MOTIVATION_MESSAGES.length < 2) return index
        let next = index
        while (next === index) next = Math.floor(Math.random() * PROFILE_MOTIVATION_MESSAGES.length)
        return next
      })
    }, 7000)
    return () => window.clearInterval(interval)
  }, [S.motivationTone, reduceMotion])
  if (!S.onboardingDone || !profile?.name) return null
  return <header className="profile-hero" aria-label={profile.name}>
    <div className="profile-hero-avatar" aria-hidden="true">
      <AnimatePresence mode="sync">
        <motion.span
          key={profile.avatarId}
          className="profile-hero-avatar-enter"
          initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: -14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.26, ease: [0.2, 0.8, 0.2, 1] }}
        >
          <AvatarImage avatarId={profile.avatarId} />
        </motion.span>
      </AnimatePresence>
    </div>
    <div className="profile-hero-content">
      <div className="profile-hero-copy">
        <strong className="profile-hero-name">{profile.name}</strong>
        {S.motivationTone !== 'off' && <div className="profile-hero-message-stage">
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={messageIndex}
              className="profile-hero-message"
              initial={reduceMotion ? { opacity: 1 } : { x: 6, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={reduceMotion ? { opacity: 0 } : { x: -3, opacity: 0 }}
              transition={reduceMotion ? { duration: 0 } : { duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
            >
              {t(PROFILE_MOTIVATION_MESSAGES[S.motivationTone === 'rotating' ? messageIndex : 0])}
            </motion.span>
          </AnimatePresence>
        </div>}
      </div>
      <div className="profile-hero-facts">{facts.join(' · ')}</div>
      <div className="profile-hero-goal">
        <div className="profile-hero-goal-head" aria-hidden="true">
          <span>{t('Weight goal')}</span>
          <strong>{goalProgressPercent == null ? '--' : `${goalProgressPercent}%`}</strong>
        </div>
        <div
          className="profile-hero-progress"
          role="progressbar"
          aria-label={t('Weight goal')}
          aria-valuemin="0"
          aria-valuemax="100"
          aria-valuenow={goalProgressPercent == null ? undefined : goalProgressPercent}
          aria-valuetext={goalProgressPercent == null ? '--' : `${goalProgressPercent}%`}
        >
          <motion.span
            initial={false}
            animate={{ scaleX: progress / 100 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}
          />
        </div>
      </div>
    </div>
  </header>
}

function Shell() {
  const navigate = useNavigate()
  const loc = useLocation()
  const auth = useAuth()
  const recoveryShown = useRef(false)
  const boot = useStore(s => s.boot)
  const { S, ready } = useStore()
  const profilePreview = useUI(s => s.profilePreview)
  const isGuest = useStore(s => s.isGuest())
  const appEntered = useStore(s => s.isAppEntered ? s.isAppEntered() : s.isGuest())
  const authenticated = auth.status === 'authenticated'
  const authed = (authenticated || isGuest) && appEntered
  const profileEditorOpen = loc.pathname === '/plan' && new URLSearchParams(loc.search).get('profile') === 'edit'
  const showProfileHeader = loc.pathname === '/home' || profileEditorOpen
  const invitePath = loc.pathname.startsWith('/invite/')
  const inviteAcceptedPath = new URLSearchParams(loc.search).get('invite') === 'accepted'
  const inviteAuthenticated = invitePath && authenticated && ready
  const pendingInviteCode = loc.pathname.match(/^\/invite\/([^/]+)/)?.[1] || ''
  const langV = useLang()   // re-renders the whole shell when the language (pack) changes
  useEffect(() => { setNav(navigate) }, [navigate])
  useEffect(() => {
    if (pendingInviteCode) sessionStorage.setItem('fpp-pending-invite', pendingInviteCode)
  }, [pendingInviteCode])
  useEffect(() => {
    if (!ready || !authenticated || !appEntered || loc.pathname.startsWith('/invite/')) return
    const pending = sessionStorage.getItem('fpp-pending-invite')
    if (pending) navigate(`/invite/${encodeURIComponent(pending)}`, { replace: true })
  }, [ready, authenticated, appEntered, loc.pathname, navigate])
  useEffect(() => {
    if (auth.status === 'initializing') return
    const result = boot({ supabaseUserId: auth.status === 'authenticated' ? auth.user?.id || null : null })
    let disposed = false
    const token = useStore.getState().getScopeToken?.()
    const currentScope = () => !disposed && (!token || useStore.getState().isScopeCurrent?.(token))
    if (auth.status === 'authenticated') Promise.resolve(result).then(() => { if (currentScope()) useStore.getState?.().enterApp?.() })
    return () => { disposed = true }
  }, [auth.status, auth.user?.id, boot])
  useEffect(() => {
    if (auth.status !== 'authenticated' || !auth.user?.id || !ready || !appEntered) return undefined
    let disposed = false
    const token = useStore.getState().getScopeToken?.()
    const currentScope = () => !disposed && (!token || useStore.getState().isScopeCurrent?.(token))
    const client = getBrowserSupabaseClient()
    if (!client) return undefined
    const repository = createProfessionalWorkflowRepository({ client })
    Promise.all([repository.professionalRole(auth.user.id), repository.assignedPrograms(auth.user.id)]).then(async ([isProfessional, assignments]) => {
      if (!currentScope() || isProfessional) return
      const latest = assignments[0]
      if (!latest) {
        const current = useStore.getState().S
        if (current.assignedProgram) useStore.getState().replaceState(clearAssignedProgramFromState({ ...current }))
        return
      }
      const version = await repository.version(latest.version_id)
      if (!currentScope() || !version) return
      const current = useStore.getState().S
      if (current.assignedProgram?.versionId !== version.id || current.assignedProgram?.assignmentId !== latest.id) useStore.getState().replaceState(assignedPlanToState({ ...current }, version, latest))
    }).catch(() => {})
    return () => { disposed = true }
  }, [auth.status, auth.user?.id, ready, appEntered])
  useEffect(() => {
    if (auth.status !== 'authenticated' || !auth.user?.id || !ready || !appEntered) return undefined
    const client = getBrowserSupabaseClient()
    if (!client) return undefined
    const sync = () => {
      const state = useStore.getState()
      if (state.getActiveLocalScope?.().userId !== auth.user.id) return
      void state.syncAccount?.(client)
      void flushProfessionalEvents({ client, store: useStore, userId: auth.user.id })
    }
    const timer = window.setTimeout(sync, 900)
    window.addEventListener('online', sync)
    return () => { window.clearTimeout(timer); window.removeEventListener('online', sync) }
  }, [auth.status, auth.user?.id, ready, appEntered, S])
  useEffect(() => {
    if (!ready || !authed) return undefined
    const userId = authenticated ? auth.user?.id : null
    const getState = () => useStore.getState().S
    const messages = {
      workout_reminder: 'Your planned workout is coming up.',
      weight_reminder: 'Time to record your weight.', measurement_reminder: 'Time to record your body measurements.',
      program_updated: 'Your training plan has an update.', program_removed: 'Your training plan has an update.',
      relationship_accepted: 'Your professional connection has an update.', relationship_ended: 'Your professional connection has an update.',
      student_workout_completed: 'A student recorded a workout update.', student_workout_abandoned: 'A student recorded a workout update.',
      verification_changed: 'Your professional verification has an update.',
    }
    const notify = kind => { if (messages[kind]) useUI.getState().toast(t(messages[kind])) }
    const nativePush = MOBILE && Capacitor.getPlatform() === 'android' && Capacitor.isNativePlatform() ? createNativePushAdapter({
      expectedOwnerId: userId, notify, navigate: nav, onToken: () => { void reconnectNotifications() }, onVisibility: () => { void syncNotificationVisibility(); local.sync() },
    }) : null
    const environment = nativePush ? { document: { get hidden() { return !nativePush.active || document.hidden }, get visibilityState() { return nativePush.active ? document.visibilityState : 'hidden' } },
      navigator, storage: localStorage, crypto, now: Date.now, nativePush } : undefined
    const disposeCoordinator = startNotificationCoordinator({ client: userId ? getBrowserSupabaseClient() : null, userId, getState, notify, ...(environment ? { environment } : {}) })
    const local = createForegroundNotificationScheduler({ scope: userId || 'guest', getState, backgroundEnabled: hasBackgroundNotifications, notify,
      ...(environment ? { environment: { document: environment.document, localStorage, Date, setTimeout, clearTimeout } } : {}) })
    const unsubscribeStore = useStore.subscribe((state, previous) => {
      if (state.S !== previous.S) {
        syncNotificationPreferences(); local.sync()
        if (MOBILE) {
          const prefs = normalizeNotificationPreferences(state.S.notifications, state.S.reminder)
          const previousPrefs = normalizeNotificationPreferences(previous.S.notifications, previous.S.reminder)
          const ui = useUI.getState()
          for (const [kind, field, deadline] of [['rest','rest',ui.timer?.endsAt || (ui.work?.phase === 'rest' ? ui.work.restEndsAt : null)],['timed_set','timedSet',ui.work?.phase === 'work' ? ui.work.endsAt : null]]) {
            if (prefs[field] === previousPrefs[field]) continue
            if (!prefs[field]) void cancelNativeTimer(kind)
            else if (deadline > Date.now()) void scheduleNativeTimer(kind, deadline, { interactive: false, enabled: true, sound: state.S.sound })
          }
        }
      }
    })
    const unsubscribeStatus = useNotificationStatus.subscribe(() => local.sync())
    const visibility = () => { void syncNotificationVisibility(); local.sync() }
    const online = () => { void reconnectNotifications(); refreshNotificationReadiness(); local.sync() }
    const workerChanged = () => refreshNotificationReadiness()
    document.addEventListener('visibilitychange', visibility)
    window.addEventListener('online', online)
    navigator.serviceWorker?.addEventListener('controllerchange', workerChanged)
    local.sync()
    return () => {
      useUI.getState().stopRest(false); useUI.getState().stopWork(); useUI.getState().stopManualSet()
      unsubscribeStore(); unsubscribeStatus(); local.dispose(); disposeCoordinator(); nativePush?.dispose()
      document.removeEventListener('visibilitychange', visibility); window.removeEventListener('online', online)
      navigator.serviceWorker?.removeEventListener('controllerchange', workerChanged)
    }
  }, [auth.user?.id, authenticated, authed, ready])
  useEffect(() => {
    if (auth.recovery !== 'required') {
      recoveryShown.current = false
      return
    }
    if (recoveryShown.current) return
    recoveryShown.current = true
    openAuthSheet('reset_password')
  }, [auth.recovery])
  useEffect(() => { applyPrefs(S.theme, S.accent) }, [S.theme, S.accent])
  useEffect(() => { setLang(S.lang || DEFAULT_LANG) }, [S.lang])
  useEffect(() => { document.documentElement.lang = (S.lang || DEFAULT_LANG) === 'pt' ? 'pt-BR' : (S.lang || DEFAULT_LANG) }, [langV, S.lang])
  // every tab/route change starts at the top of the page
  useEffect(() => { window.scrollTo(0, 0) }, [loc.pathname])
  // First entry is a single, resumable setup inside Plan. Until it is complete, other routes
  // cannot accidentally surface an empty dashboard or the retired Home overlay.
  useEffect(() => {
    if (ready && !appEntered && !invitePath && loc.pathname !== '/') {
      navigate('/', { replace: true })
      return
    }
    if (ready && authed && !invitePath && !inviteAcceptedPath && !S.onboardingDone && loc.pathname !== '/plan') navigate('/plan', { replace: true })
  }, [S.onboardingDone, appEntered, authed, inviteAcceptedPath, invitePath, loc.pathname, navigate, ready])
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
          {!(authed || inviteAuthenticated) ? <Suspense fallback={<RouteFallback />}><Landing invitePath={invitePath} /></Suspense> : (
            <>{showProfileHeader && <ProfileHeader S={S} preview={profilePreview} />}<Suspense fallback={<RouteFallback />}><Routes>
                <Route path="/home" element={<Home />} />
                <Route path="/plan" element={<Plan />} />
                <Route path="/plan/r/:id" element={<RoutineEdit />} />
                <Route path="/workout" element={<Workout />} />
                <Route path="/stats" element={<Stats />} />
                <Route path="/body-progress" element={<BodyProgress />} />
                <Route path="/professional-profile" element={<ProfessionalProfile />} />
                <Route path="/professional/profile" element={<ProfessionalProfile />} />
                <Route path="/professional/profile/edit" element={<ProfessionalProfile />} />
                <Route path="/professional" element={<ProfessionalDashboard />} />
                <Route path="/professional/invites" element={<ProfessionalInvites />} />
                <Route path="/professional/students" element={<ProfessionalStudents />} />
                <Route path="/professional/students/:studentId" element={<ProfessionalStudentPage />} />
                <Route path="/professional/programs" element={<ProfessionalPrograms />} />
                <Route path="/invite/:code" element={<InviteLanding />} />
                <Route path="/connect" element={<Navigate to="/student/professionals" replace />} />
                <Route path="/student/professionals" element={<StudentProfessionals />} />
                <Route path="/history" element={<History />} />
                <Route path="/library" element={<Library />} />
                <Route path="/more" element={<More />} />
                <Route path="/settings" element={<Settings />} />
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
  // Android system back — sheet, then page, then press-again-to-exit (see lib/back.js)
  useEffect(() => {
    let stop = null, gone = false
    initBackButton().then(fn => { if (gone) fn(); else stop = fn })
    return () => { gone = true; stop?.() }
  }, [])
  return <HashRouter><Shell /></HashRouter>
}
