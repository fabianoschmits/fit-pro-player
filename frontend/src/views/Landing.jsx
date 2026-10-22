import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { useStore } from '../store/useStore.js'
import { useAuth } from '../auth/AuthProvider.jsx'
import { DEMO, STANDALONE } from '../lib/demo.js'
import { EXIDX, exerciseName } from '../lib/exercises.js'
import { t } from '../lib/i18n.js'
import ExerciseGuideAnimation from '../components/ExerciseGuideAnimation.jsx'
import BodyMap from '../components/BodyMap.jsx'
import LineChart from '../components/LineChart.jsx'
import Icon from '../components/Icon.jsx'
import { Button } from '../components/ui.jsx'
import { openAuthSheet } from '../components/AuthSheet.jsx'
import '../landing.css'

const DAY = 86400000
const SHOWCASE_EXERCISE = EXIDX['0025'] || Object.values(EXIDX)[0]
const BRAND_LOGO = '/brand-logo.png'

const BALANCE_LOAD = {
  chest: 18, 'upper-back': 17, deltoids: 14, biceps: 9, triceps: 11,
  abs: 10, obliques: 7, gluteal: 16, quadriceps: 19, hamstring: 14, calves: 8,
}
const FATIGUE_LOAD = {
  chest: .68, 'upper-back': .28, deltoids: .55, biceps: .22, triceps: .62,
  abs: .18, obliques: .12, gluteal: .34, quadriceps: .47, hamstring: .30, calves: .08,
}
const STRENGTH_LOAD = {
  chest: .98, 'upper-back': .92, deltoids: .88, biceps: .91, triceps: .95,
  abs: .84, obliques: .78, gluteal: .94, quadriceps: 1, hamstring: .90, calves: .82,
}
const FATIGUE_LEVELS = [
  { at: 0, level: 0 }, { at: .15, level: 1 }, { at: .25, level: 2 },
  { at: .4, level: 3 }, { at: .55, level: 4, exclusive: true },
]
const STRENGTH_LEVELS = [
  { at: .5, level: 0 }, { at: .625, level: 1 }, { at: .75, level: 2 },
  { at: .875, level: 3 }, { at: 1, level: 4 },
]

const STAT_VIEWS = [
  { id: 'balance', label: 'Equilíbrio', load: BALANCE_LOAD },
  {
    id: 'fatigue', label: 'Fadiga', load: FATIGUE_LOAD,
    thresholds: FATIGUE_LEVELS, className: 'hm-fatigue',
  },
  {
    id: 'strength', label: 'Força', load: STRENGTH_LOAD,
    thresholds: STRENGTH_LEVELS, className: 'hm-strength',
  },
]

export function buildWeightPreviewPoints(now = Date.now()) {
  const weights = [82.4, 82.1, 81.9, 81.6, 81.3, 80.9, 80.7, 80.3, 79.8]
  return weights.map((weight, index) => {
    const timestamp = now - (weights.length - 1 - index) * 3.75 * DAY
    return {
      t: timestamp,
      d: new Date(timestamp).toISOString().slice(0, 10),
      y: weight,
      m: index === weights.length - 1 ? 1 : .38,
    }
  })
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setReduced(query.matches)
    sync()
    query.addEventListener?.('change', sync)
    return () => query.removeEventListener?.('change', sync)
  }, [])
  return reduced
}

function HomePreview() {
  const points = useMemo(() => buildWeightPreviewPoints(), [])
  const week = [
    ['S', '7', 'done'],
    ['T', '8', 'plan'],
    ['Q', '9', 'done'],
    ['Q', '10', ''],
    ['S', '11', 'plan'],
    ['S', '12', ''],
    ['D', '13', 'today'],
  ]

  return (
    <div className="landing-device" aria-label="Prévia da tela inicial do aplicativo">
      <div className="landing-device-chrome"><span /><span /><span /></div>
      <div className="landing-home">
        <header className="landing-home-title">
          <h3>Hoje</h3>
          <span>domingo, 13 de setembro</span>
        </header>

        <section className="landing-home-now">
          <span className="landing-home-kicker">Plano de hoje</span>
          <strong>Push</strong>
          <div className="landing-home-meta">
            <b>6 exercícios</b>
            <span>Peito</span>
            <span>Ombros</span>
            <span>Tríceps</span>
          </div>
          <div className="landing-home-cta">Começar Push</div>
        </section>

        <section className="landing-home-week">
          <div className="landing-home-section-head">
            <strong>Esta semana</strong>
            <span>2 / 4 · 3 semanas</span>
          </div>
          <div className="landing-home-strip">
            {week.map(([day, date, state], index) => (
              <span key={`${day}-${date}-${index}`} className={state ? `is-${state}` : undefined}>
                <small>{day}</small>
                <b>{date}</b>
                <i />
              </span>
            ))}
          </div>
        </section>

        <section className="landing-home-weight">
          <div className="landing-home-section-head">
            <strong>Peso corporal</strong>
            <span>13 set</span>
          </div>
          <div className="landing-home-weight-reading">
            <strong>79,8</strong>
            <span>kg</span>
            <em><Icon name="arrowDown" /> 0,5 kg</em>
          </div>
          <div className="chart landing-home-chart">
            <LineChart points={points} h={88} unit="kg" goal={79.5} />
          </div>
        </section>
      </div>
    </div>
  )
}

function WorkoutPreview({ playing }) {
  const exercise = SHOWCASE_EXERCISE
  if (!exercise) return null

  return (
    <div className="landing-device" aria-label="Prévia de um treino em andamento">
      <div className="landing-device-chrome"><span /><span /><span /></div>
      <div className="landing-workout">
        <div className="landing-workout-bar">
          <div>
            <strong>Push</strong>
            <span>8/24 séries</span>
          </div>
          <span className="landing-workout-clock">24:18</span>
        </div>

        <div className="landing-workout-media">
          <ExerciseGuideAnimation ex={exercise} playing={playing} />
          <div className="landing-workout-exercise">
            <strong>{exerciseName(exercise)}</strong>
            <span>Exercício 3 de 5</span>
          </div>
        </div>

        <div className="landing-workout-sets">
          <div className="landing-workout-set-head">
            <span>Série</span><span>Peso</span><span>Reps</span><span />
          </div>
          {[['1', '60', '10', true], ['2', '62,5', '10', true], ['3', '62,5', '8', false]].map(([n, w, r, done]) => (
            <div className={'landing-workout-set' + (done ? ' is-done' : ' is-current')} key={n}>
              <span>{n}</span>
              <strong>{w}</strong>
              <strong>{r}</strong>
              <i>{done ? <Icon name="check" /> : null}</i>
            </div>
          ))}
        </div>

        <div className="landing-workout-rest">
          <Icon name="timer" />
          <div><small>Descanso</small><b>01:18</b></div>
        </div>
      </div>
    </div>
  )
}

function StatsPreview() {
  const [active, setActive] = useState(0)
  const tabs = useRef([])

  const selectTab = index => {
    const next = (index + STAT_VIEWS.length) % STAT_VIEWS.length
    setActive(next)
    tabs.current[next]?.focus()
  }

  const onTabKeyDown = (event, index) => {
    if (event.key === 'ArrowRight') selectTab(index + 1)
    else if (event.key === 'ArrowLeft') selectTab(index - 1)
    else if (event.key === 'Home') selectTab(0)
    else if (event.key === 'End') selectTab(STAT_VIEWS.length - 1)
    else return
    event.preventDefault()
  }

  const view = STAT_VIEWS[active]
  return (
    <div className="landing-device landing-device--wide" aria-label="Prévia da análise corporal">
      <div className="landing-device-chrome"><span /><span /><span /></div>
      <div className="landing-stats">
        <div className="landing-stat-tabs" role="tablist" aria-label="Visualizações de estatísticas">
          {STAT_VIEWS.map((item, index) => (
            <button
              key={item.id}
              ref={element => { tabs.current[index] = element }}
              role="tab"
              id={`landing-tab-${item.id}`}
              aria-controls={`landing-panel-${item.id}`}
              aria-selected={index === active}
              tabIndex={index === active ? 0 : -1}
              className={index === active ? 'is-active' : ''}
              onKeyDown={event => onTabKeyDown(event, index)}
              onClick={() => setActive(index)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div
          className={'landing-stat-stage ' + (view.className || '')}
          key={view.id}
          role="tabpanel"
          id={`landing-panel-${view.id}`}
          aria-labelledby={`landing-tab-${view.id}`}
        >
          <BodyMap load={view.load} thresholds={view.thresholds} body="male" decorative />
        </div>
      </div>
    </div>
  )
}

export default function Landing({ invitePath = false }) {
  const auth = useAuth()
  const enterApp = useStore(s => s.enterApp || s.setGuest)
  const canGuest = true
  const reduced = useReducedMotion()
  const localEntry = STANDALONE || DEMO

  useEffect(() => {
    document.body.classList.add('landing-mode')
    return () => document.body.classList.remove('landing-mode')
  }, [])

  const [guestBusy, setGuestBusy] = useState(false)
  const enterLocal = () => enterApp(true)
  const enter = async () => {
    if (!auth.configured || localEntry || auth.status === 'authenticated') {
      enterLocal()
      return
    }
    setGuestBusy(true)
    try {
      const result = await auth.signInAnonymously?.()
      if (result?.kind === 'error') enterLocal()
      else enterLocal()
    } catch {
      enterLocal()
    } finally {
      setGuestBusy(false)
    }
  }
  const entryUnavailable = (auth.configured ? false : !localEntry && !canGuest) || guestBusy
  const primaryAction = auth.status === 'authenticated'
    ? enterLocal
    : auth.configured
      ? () => openAuthSheet('entry')
      : enter
  const primaryLabel = auth.status === 'authenticated'
    ? 'Entrar no app'
    : auth.configured
      ? 'Entrar ou criar conta'
      : localEntry
        ? (DEMO ? 'Abrir demonstração' : 'Começar agora')
        : 'Usar neste dispositivo'

  return (
    <main className="landing-page">
      {invitePath && (
        <div className="landing-invite-banner" role="status">
          <strong>Você recebeu um convite profissional.</strong>
          <span>Crie sua conta ou entre para aceitar o vínculo.</span>
          <Button variant="primary" onClick={() => openAuthSheet('sign_up')}>Criar conta e ver convite</Button>
        </div>
      )}

      <header className="landing-nav-shell">
        <div className="landing-nav">
          <a className="landing-nav-brand" href="#top" aria-label="Fit Pro Player — início">
            <img src={BRAND_LOGO} alt="" />
            <span>Fit Pro Player</span>
          </a>
          <button
            className="landing-nav-cta landing-nav-cta--accent"
            disabled={entryUnavailable}
            onClick={primaryAction}
          >
            {localEntry ? 'Abrir aplicativo' : 'Entrar'}
          </button>
        </div>
      </header>

      <section className="landing-hero" id="top">
        <motion.div
          className="landing-hero-copy"
          initial={reduced ? false : { opacity: 0, y: 12 }}
          animate={reduced ? undefined : { opacity: 1, y: 0 }}
          transition={reduced ? { duration: 0 } : { type: 'spring', duration: .65, bounce: 0 }}
        >
          <img className="landing-hero-logo" src={BRAND_LOGO} alt="Fit Pro Player" fetchPriority="high" />
          <h1>Planeje o treino. Registre a carga. Veja a evolução.</h1>
          <p>Rotina semanal, execução guiada e leitura corporal no mesmo app.</p>
          <div className="landing-actions">
            <Button variant="primary" icon="figureStrength" disabled={entryUnavailable} onClick={primaryAction}>
              {primaryLabel}
            </Button>
            <a className="landing-secondary-action" href="#treino">Ver o app</a>
          </div>
          {!localEntry && (
            <div className="landing-account-actions">
              {auth.configured && <button onClick={() => openAuthSheet('entry')}>{t('Protect your training')}</button>}
              {canGuest && <button onClick={enter}>Continuar sem conta</button>}
            </div>
          )}
        </motion.div>
        <div className="landing-hero-visual">
          <HomePreview />
        </div>
      </section>

      <section className="landing-section" id="treino">
        <div className="landing-section-copy">
          <h2>Treino em andamento</h2>
          <p>Séries, carga, descanso e animação do exercício na mesma tela.</p>
        </div>
        <WorkoutPreview playing={!reduced} />
      </section>

      <section className="landing-section landing-section--stats" id="estatisticas">
        <div className="landing-section-copy">
          <h2>Análise corporal</h2>
          <p>Equilíbrio, fadiga e força para decidir o próximo treino.</p>
        </div>
        <StatsPreview />
      </section>

      <footer className="landing-footer">
        <a className="landing-footer-brand" href="#top">
          <img src={BRAND_LOGO} alt="" />
          <span>Fit Pro Player</span>
        </a>
        <nav aria-label="Documentos legais">
          <a href="#/privacy">Privacidade</a>
          <a href="#/terms">Termos</a>
          <a href="#/data-rights">Direitos dos titulares</a>
        </nav>
      </footer>
    </main>
  )
}
