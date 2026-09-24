import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { HashRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { normalizeState, useStore } from './store/useStore.js'
import { useAuth } from './auth/AuthProvider.jsx'
import { openAuthSheet } from './components/AuthSheet.jsx'
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
import { ageFromBirthDate, currentProfileWeight, heightText, weightText } from './lib/profile.js'
import { getBrowserSupabaseClient } from './lib/supabase-client.js'
import { createAccountSyncService, readSyncMetadata, writeSyncMetadata, REMOTE_SYNC_STATE } from './lib/account-sync.js'
import { applyAssociationChoice, canAutoAdoptAnonymous, classifyAssociation } from './lib/account-association.js'
import { ANONYMOUS_SCOPE, resolveLocalScope } from './lib/local-state-scope.js'
import { readScopedState } from './lib/account-cache.js'
import RestTimer from './components/RestTimer.jsx'
import Landing from './views/Landing.jsx'
import { createProfessionalWorkflowRepository } from './lib/professional-workflow.js'
import { assignedPlanToState } from './lib/assigned-program.js'
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
const loadStudentConnections = () => import('./views/StudentConnections.jsx')
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
const StudentConnections = lazy(loadStudentConnections)

// Once the PWA shell is installed, warm its core routes while the browser is idle. Requests
// pass through the service worker and become available offline without delaying first paint.
export const preloadCoreRoutes = () => Promise.allSettled([
  loadHome(), loadPlan(), loadRoutineEdit(), loadWorkout(), loadStats(), loadHistory(),
  loadLibrary(), loadSettings(), loadMore(), loadBodyProgress(), loadProfessionalDashboard(), loadStudentConnections(), loadSheets(),
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
        <div className="profile-hero-message-stage">
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={messageIndex}
              className="profile-hero-message"
              initial={reduceMotion ? { opacity: 1 } : { x: 6, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={reduceMotion ? { opacity: 0 } : { x: -3, opacity: 0 }}
              transition={reduceMotion ? { duration: 0 } : { duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
            >
              {PROFILE_MOTIVATION_MESSAGES[messageIndex]}
            </motion.span>
          </AnimatePresence>
        </div>
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
  const associationShown = useRef(null)
  const associationInFlight = useRef(null)
  const boot = useStore(s => s.boot)
  const { S, ready } = useStore()
  const profilePreview = useUI(s => s.profilePreview)
  const isGuest = useStore(s => s.isGuest())
  const appEntered = useStore(s => s.isAppEntered ? s.isAppEntered() : s.isGuest())
  const authenticated = auth.status === 'authenticated'
  const authed = (authenticated || isGuest) && appEntered
  const profileEditorOpen = loc.pathname === '/plan' && new URLSearchParams(loc.search).get('profile') === 'edit'
  const showProfileHeader = loc.pathname === '/home' || profileEditorOpen
  const langV = useLang()   // re-renders the whole shell when the language (pack) changes
  useEffect(() => { setNav(navigate) }, [navigate])
  useEffect(() => {
    if (auth.status === 'initializing') return
    boot({ supabaseUserId: auth.status === 'authenticated' ? auth.user?.id || null : null })
  }, [auth.status, boot])
  useEffect(() => {
    if (auth.status !== 'authenticated' || !auth.user?.id || !ready || associationShown.current === auth.user.id || associationInFlight.current === auth.user.id) return
    const client = getBrowserSupabaseClient()
    if (!client) return
    let disposed = false
    associationInFlight.current = auth.user.id
    const accountScope = resolveLocalScope(auth.user.id)
    const service = createAccountSyncService({ client, scope: accountScope })
    const accountState = useStore.getState().S
    const anonymousState = readScopedState(ANONYMOUS_SCOPE, localStorage, accountState).state
    const settleAutomatically = async remoteSnapshot => {
      const metadata = readSyncMetadata(accountScope)
      const localIsNewer = metadata.dirty || metadata.revision > (remoteSnapshot?.revision || 0)
      if (localIsNewer) {
        const uploaded = await service.uploadSnapshot({ state: accountState, expectedRevision: remoteSnapshot?.revision || 0 })
        if (uploaded.state === REMOTE_SYNC_STATE.IN_SYNC) {
          if (hasAnonymousData) useStore.getState().clearAnonymousState()
          return
        }
        // A second device won the race. The newest confirmed cloud revision is the
        // deterministic winner; the user can still force a copy from Settings.
      }
      if (remoteSnapshot?.payload) {
        useStore.getState().replaceState(normalizeState(remoteSnapshot.payload), false)
        writeSyncMetadata(accountScope, { revision: remoteSnapshot.revision, dirty: false })
        if (hasAnonymousData) useStore.getState().clearAnonymousState()
      }
    }
    const hasAnonymousData = Boolean(anonymousState?.onboardingDone || anonymousState?.active || anonymousState?.profile?.name || anonymousState?.workouts?.length || anonymousState?.bodyweight?.length || anonymousState?.bodyMeasurements?.length || anonymousState?.customEx?.length || anonymousState?.customEx?.length)
    service.fetchRemoteSnapshot().then(async result => {
      if (disposed || result.state === 'ERROR' || result.state === 'OFFLINE') return
      const decision = classifyAssociation({ anonymousState, accountState, remoteSnapshot: result.snapshot, accountRevision: readSyncMetadata(accountScope).revision })
      if (canAutoAdoptAnonymous({ anonymousState, accountState, remoteSnapshot: result.snapshot })) {
        const applied = applyAssociationChoice('use-device', { anonymousState, accountState, remoteSnapshot: result.snapshot })
        const next = normalizeState(applied.state)
        useStore.getState().replaceState(next, false)
        return service.uploadSnapshot({ state: next, expectedRevision: applied.expectedRevision }).then(async uploaded => {
          if (uploaded.state === REMOTE_SYNC_STATE.IN_SYNC) {
            useStore.getState().clearAnonymousState()
            associationShown.current = auth.user.id
            return
          }
          if (uploaded.state === REMOTE_SYNC_STATE.CONFLICT) await settleAutomatically(result.snapshot)
          else if (uploaded.state !== REMOTE_SYNC_STATE.IN_SYNC) throw new Error('Não foi possível associar os dados do dispositivo agora.')
        })
      }
      if (!decision.requiresDecision) { associationShown.current = auth.user.id; return }
      // Account reconnects are non-interactive. The last confirmed state wins:
      // local dirty state is uploaded, otherwise the newer cloud revision is restored.
      await settleAutomatically(result.snapshot)
      associationShown.current = auth.user.id
    }).catch(() => {}).finally(() => {
      if (associationInFlight.current === auth.user.id) associationInFlight.current = null
    })
    return () => { disposed = true; if (associationInFlight.current === auth.user.id) associationInFlight.current = null }
  }, [auth.status, auth.user?.id, ready])
  useEffect(() => {
    if (auth.status !== 'authenticated' || !auth.user?.id || !ready) return undefined
    let disposed = false
    const client = getBrowserSupabaseClient()
    if (!client) return undefined
    const repository = createProfessionalWorkflowRepository({ client })
    Promise.all([repository.professionalRole(auth.user.id), repository.assignedPrograms(auth.user.id)]).then(async ([isProfessional, assignments]) => {
      if (disposed || isProfessional) return
      const latest = assignments[0]
      if (!latest) return
      const version = await repository.version(latest.version_id)
      if (disposed || !version) return
      const current = useStore.getState().S
      if (current.assignedProgram?.versionId !== version.id) useStore.getState().replaceState(assignedPlanToState({ ...current }, version, latest))
    }).catch(() => {})
    return () => { disposed = true }
  }, [auth.status, auth.user?.id, ready])
  useEffect(() => {
    if (auth.status !== 'authenticated' || !auth.user?.id || !ready || associationShown.current !== auth.user.id) return undefined
    const client = getBrowserSupabaseClient()
    if (!client) return undefined
    let disposed = false
    const timer = window.setTimeout(async () => {
      const scope = resolveLocalScope(auth.user.id)
      const service = createAccountSyncService({ client, scope })
      const result = await service.sync({ state: S })
      if (disposed) return
      if (result.state === REMOTE_SYNC_STATE.REMOTE_ABSENT) {
        await service.uploadSnapshot({ state: S, expectedRevision: 0 })
      } else if (result.state === REMOTE_SYNC_STATE.REMOTE_AHEAD && result.snapshot) {
        useStore.getState().replaceState(normalizeState(result.snapshot.payload), false)
        writeSyncMetadata(scope, { revision: result.snapshot.revision, dirty: false })
      } else if (result.state === REMOTE_SYNC_STATE.LOCAL_AHEAD) {
        const uploaded = await service.uploadSnapshot({ state: S, expectedRevision: result.snapshot.revision })
        if (uploaded.state === REMOTE_SYNC_STATE.CONFLICT && result.snapshot) {
          useStore.getState().replaceState(normalizeState(result.snapshot.payload), false)
          writeSyncMetadata(scope, { revision: result.snapshot.revision, dirty: false })
        }
      }
    }, 900)
    return () => { disposed = true; window.clearTimeout(timer) }
  }, [auth.status, auth.user?.id, ready, S])
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
    if (ready && !appEntered && loc.pathname !== '/') {
      navigate('/', { replace: true })
      return
    }
    if (ready && authed && !S.onboardingDone && loc.pathname !== '/plan') navigate('/plan', { replace: true })
  }, [S.onboardingDone, appEntered, authed, loc.pathname, navigate, ready])
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
                <Route path="/body-progress" element={<BodyProgress />} />
                <Route path="/professional-profile" element={<ProfessionalProfile />} />
                <Route path="/professional" element={<ProfessionalDashboard />} />
                <Route path="/connect" element={<StudentConnections />} />
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
