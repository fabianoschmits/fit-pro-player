import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { useStore } from '../store/useStore.js'
import { useAuth } from '../auth/AuthProvider.jsx'
import { DEMO, STANDALONE } from '../lib/demo.js'
import { EXIDX, exerciseName, exOr } from '../lib/exercises.js'
import { EXERCISE_SPRITE_POPULARITY_IDS } from '../lib/exercise-guide-assets.js'
import { setLabel } from '../lib/history.js'
import { DAYS, exCount, fmtDate, fmtNum, sentenceCase } from '../lib/format.js'
import { t, dateLocale } from '../lib/i18n.js'
import Media from '../components/Media.jsx'
import BodyMap from '../components/BodyMap.jsx'
import LineChart from '../components/LineChart.jsx'
import Icon from '../components/Icon.jsx'
import { Button } from '../components/ui.jsx'
import { openAuthSheet } from '../components/AuthSheet.jsx'
import '../workout-player.css'
import '../landing.css'

const DAY = 86400000
const BRAND_LOGO = '/brand-logo.png'
const WORKOUT_INTERVAL_MS = 3200
const WEIGHT_INTERVAL_MS = 1600

const SHOWCASE_EXERCISES = EXERCISE_SPRITE_POPULARITY_IDS
  .map(id => EXIDX[id])
  .filter(Boolean)
  .slice(0, 8)

const BALANCE_LOAD = {
  chest: 18, 'upper-back': 17, deltoids: 14, biceps: 9, triceps: 11,
  abs: 10, obliques: 7, gluteal: 16, quadriceps: 19, hamstring: 14, calves: 8,
}

const FIXED_MUSCLE_STATS = [
  { label: 'Costas superior', sets: BALANCE_LOAD['upper-back'] },
  { label: 'Ombros', sets: BALANCE_LOAD.deltoids },
  { label: 'Tríceps', sets: BALANCE_LOAD.triceps },
  { label: 'Bíceps', sets: BALANCE_LOAD.biceps },
]
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
  { id: 'fatigue', label: 'Fadiga', load: FATIGUE_LOAD, thresholds: FATIGUE_LEVELS, className: 'hm-fatigue' },
  { id: 'strength', label: 'Força', load: STRENGTH_LOAD, thresholds: STRENGTH_LEVELS, className: 'hm-strength' },
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

function PhoneFrame({ label, children, tall }) {
  return (
    <div className={'landing-phone' + (tall ? ' is-tall' : '')} aria-label={label}>
      <div className="landing-phone-bezel">
        <div className="landing-phone-status" aria-hidden="true">
          <span>9:41</span>
          <i />
          <span>100%</span>
        </div>
        <div className="landing-phone-screen">{children}</div>
      </div>
    </div>
  )
}

function HomePreview({ reduced }) {
  const points = useMemo(() => buildWeightPreviewPoints(), [])
  const [cursor, setCursor] = useState(0)
  const [manual, setManual] = useState(false)
  const today = new Date()
  const dateLabel = today.toLocaleDateString(dateLocale(), { weekday: 'long', day: 'numeric', month: 'long' })
  const week = [
    { day: 1, date: 7, dot: 'done' },
    { day: 2, date: 8, dot: 'plan' },
    { day: 3, date: 9, dot: 'done' },
    { day: 4, date: 10, dot: '' },
    { day: 5, date: 11, dot: 'plan' },
    { day: 6, date: 12, dot: '' },
    { day: 0, date: 13, dot: '', today: true },
  ]
  const point = points[cursor] || points.at(-1)
  const previous = cursor > 0 ? points[cursor - 1] : null
  const delta = previous ? point.y - previous.y : null

  useEffect(() => {
    if (manual || reduced || points.length < 2) return undefined
    const timer = setInterval(() => {
      setCursor(index => (index + 1) % points.length)
    }, WEIGHT_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [manual, reduced, points.length])

  const selectPoint = next => {
    const index = points.findIndex(item => item.d === next.iso || item.d === next.d || item.t === next.t)
    if (index < 0) return
    setManual(true)
    setCursor(index)
  }

  return (
    <PhoneFrame label="Prévia da tela inicial do aplicativo">
      <div className="narrow home-view landing-screen-clone">
        <div className="hdr home-titlebar">
          <div>
            <h1>{t('Today')}</h1>
            <div className="sub">{dateLabel}</div>
          </div>
        </div>

        <section className="home-now home-now--planned">
          <div className="home-now-top">
            <span className="home-now-kicker">{t("Today's plan")}</span>
          </div>
          <h2>Push</h2>
          <div className="home-now-context home-now-context--wrap">
            <b>{exCount(6)}</b>
            <span>{sentenceCase(t('chest'))}</span>
            <span>{sentenceCase(t('shoulders'))}</span>
            <span>{sentenceCase(t('triceps'))}</span>
          </div>
          <div className="home-now-actions">
            <Button variant="primary" icon="play">{t('Start {0}', 'Push')}</Button>
          </div>
        </section>

        <section className="home-week-block">
          <div className="home-section-head">
            <div>
              <h2>{t('This week')}</h2>
              <span>2 / 4 · {t('{0} week streak', 3)}</span>
            </div>
          </div>
          <div className="week home-week-strip">
            {week.map(item => (
              <button type="button" key={item.date} className={'wday' + (item.today ? ' today' : '')} tabIndex={-1}>
                <span className="lbl">{t(DAYS[item.day])}</span>
                <span className="num">{item.date}</span>
                <span className={'dot' + (item.dot ? ` ${item.dot}` : '')} />
              </button>
            ))}
          </div>
        </section>

        <section className="home-weight-block">
          <div className="home-section-head">
            <div>
              <h2>{t('Body weight')}</h2>
              <span>{fmtDate(point.d, true)}</span>
            </div>
          </div>
          <div className="home-weight-reading">
            <button type="button" tabIndex={-1}>
              <strong>{fmtNum(point.y)}</strong><span>kg</span>
            </button>
            {delta != null && Math.abs(delta) >= 0.05 && (
              <span style={{ color: 'var(--acc)' }}>
                <Icon name={delta > 0 ? 'arrowUp' : 'arrowDown'} />
                {fmtNum(Math.abs(delta))} kg
              </span>
            )}
            <small><Icon name="target" />{fmtNum(Math.abs(point.y - 79.5))} kg</small>
          </div>
          <div
            className="chart home-weight-chart landing-weight-interactive"
            onPointerDown={() => setManual(true)}
          >
            <LineChart
              points={points}
              h={104}
              unit="kg"
              goal={79.5}
              selectedDate={point.d}
              onPointEdit={selectPoint}
            />
          </div>
        </section>
      </div>
    </PhoneFrame>
  )
}

function WorkoutPreview({ reduced }) {
  const exercises = SHOWCASE_EXERCISES.length ? SHOWCASE_EXERCISES : Object.values(EXIDX).slice(0, 4)
  const [index, setIndex] = useState(0)
  const [manual, setManual] = useState(false)
  const exercise = exercises[index] || exOr(Object.keys(EXIDX)[0])
  const loads = [
    { w: 60, r: 10 },
    { w: 70, r: 8 },
    { w: 80, r: 5 },
    { w: 40, r: 12 },
    { w: 25, r: 15 },
    { w: 50, r: 10 },
    { w: 55, r: 8 },
    { w: 35, r: 12 },
  ]
  const load = loads[index % loads.length]
  const entry = {
    id: exercise.id,
    target: { sets: 3, reps: load.r, weight: load.w },
    sets: [
      { w: load.w, r: load.r, done: true },
      { w: load.w + 2.5, r: load.r, done: true },
      { w: load.w + 2.5, r: Math.max(5, load.r - 2), done: false },
    ],
  }
  const current = entry.sets[2]
  const currentLabel = setLabel(entry.id, current, entry.target, 'kg')
  const total = exercises.length

  useEffect(() => {
    if (manual || reduced || total < 2) return undefined
    const timer = setInterval(() => {
      setIndex(value => (value + 1) % total)
    }, WORKOUT_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [manual, reduced, total])

  const go = direction => {
    setManual(true)
    setIndex(value => (value + direction + total) % total)
  }

  return (
    <PhoneFrame label="Prévia de um treino em andamento" tall>
      <div className="narrow active-workout workout-player-page landing-screen-clone landing-workout-interactive">
        <div className="workout-session-bar">
          <div className="hdr workout-session-header">
            <div className="workout-session-title">
              <strong>Push</strong>
              <span>{t('{0} sets', '8/24')}</span>
            </div>
            <span className="wp-session-clock" aria-hidden="true">24:18</span>
          </div>
        </div>

        <section className="wp-exercise-player is-locked" data-exidx={index}>
          <div className="wp-series-status"><span>{t('Sets')}</span><strong>2/3</strong></div>
          <div className="wp-series-track" role="progressbar" aria-label={t('Sets')} aria-valuemin={0} aria-valuemax={3} aria-valuenow={2}>
            <span className="wp-series-segment is-done" />
            <span className="wp-series-segment is-done" />
            <span className="wp-series-segment is-current" />
          </div>

          <div className="wp-media-card">
            <div className="wp-card-clock" aria-hidden="true"><Icon name="clock" /><span>24:18</span></div>
            <div className="wp-exercise-header">
              <h2 className="wp-exercise-title workout-exercise-name">{exerciseName(exercise)}</h2>
              <div className="wp-exercise-target">{currentLabel}</div>
            </div>
            <div className="wp-media"><Media ex={exercise} key={exercise.id} /></div>
            <button
              type="button"
              className="wp-exercise-nav wp-exercise-nav--previous"
              aria-label={t('Previous exercise')}
              disabled={total < 2}
              onClick={() => go(-1)}
            >
              <Icon name="chevronLeft" />
            </button>
            <button
              type="button"
              className="wp-exercise-nav wp-exercise-nav--next"
              aria-label={t('Next exercise')}
              disabled={total < 2}
              onClick={() => go(1)}
            >
              <Icon name="chevronRight" />
            </button>
          </div>

          <div className="wp-exercise-dots" aria-hidden="true">
            {exercises.map((item, dotIndex) => (
              <span key={item.id} className={'wp-exercise-dot' + (dotIndex === index ? ' is-active' : dotIndex < index ? ' is-done' : '')} />
            ))}
          </div>

          <div className="wp-current-set">
            <div className="exercise-input-status">
              <span>{t('Exercise {0} / {1}', index + 1, total)}</span>
            </div>
            <div className="wp-current-controls" data-metrics={2}>
              <div className="wp-metric">
                <span className="wp-metric-label">{t('Weight ({0})', 'kg')}</span>
                <div className="stp w">
                  <button type="button" className="wp-bump-btn" tabIndex={-1} disabled><Icon name="minus" /></button>
                  <span className="val">{fmtNum(current.w)}</span>
                  <button type="button" className="wp-bump-btn" tabIndex={-1} disabled><Icon name="plus" /></button>
                </div>
              </div>
              <div className="wp-metric">
                <span className="wp-metric-label">{t('Reps')}</span>
                <div className="stp r">
                  <button type="button" className="wp-bump-btn" tabIndex={-1} disabled><Icon name="minus" /></button>
                  <span className="val">{fmtNum(current.r)}</span>
                  <button type="button" className="wp-bump-btn" tabIndex={-1} disabled><Icon name="plus" /></button>
                </div>
              </div>
            </div>
          </div>

          <Button variant="primary" intent="quick" icon="play" className="wp-main-action set-start-action" tabIndex={-1}>
            {t('Start set')} 3
          </Button>
          <div className="set-execution-hint">
            <strong><Icon name="play" />{t('Start set')}</strong>
            <span>{t('Tap play to start this set.')}</span>
          </div>
        </section>
      </div>
    </PhoneFrame>
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
    <PhoneFrame label="Prévia da análise corporal">
      <div className="narrow stats-view landing-screen-clone">
        <div className="hdr">
          <div>
            <h1>{t('Stats')}</h1>
            <div className="sub">{t('Last 30 days')}</div>
          </div>
        </div>
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
          className={'stats-bodymap-pane landing-stat-stage ' + (view.className || '')}
          key={view.id}
          role="tabpanel"
          id={`landing-panel-${view.id}`}
          aria-labelledby={`landing-tab-${view.id}`}
        >
          <BodyMap load={view.load} thresholds={view.thresholds} body="male" decorative />
        </div>
        <div className="landing-muscle-stats" aria-label="Séries por grupo muscular">
          {FIXED_MUSCLE_STATS.map(row => (
            <div className="landing-muscle-row" key={row.label}>
              <span>{row.label}</span>
              <strong>{row.sets} {t(row.sets === 1 ? 'set' : 'sets')}</strong>
            </div>
          ))}
        </div>
      </div>
    </PhoneFrame>
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
      <div className="landing-atmosphere" aria-hidden="true" />

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
            {localEntry ? 'Abrir' : 'Entrar'}
          </button>
        </div>
      </header>

      <div className="landing-stage" id="top">
        <motion.section
          className="landing-hero"
          initial={reduced ? false : { opacity: 0, y: 18 }}
          animate={reduced ? undefined : { opacity: 1, y: 0 }}
          transition={reduced ? { duration: 0 } : { type: 'spring', duration: .7, bounce: 0 }}
        >
          <img className="landing-hero-logo" src={BRAND_LOGO} alt="Fit Pro Player" fetchPriority="high" />
          <h1>Seu treino, no bolso.</h1>
          <p>Plano do dia, execução e evolução — como no app.</p>
          <div className="landing-actions">
            <Button variant="primary" icon="figureStrength" disabled={entryUnavailable} onClick={primaryAction}>
              {primaryLabel}
            </Button>
          </div>
          {!localEntry && (
            <div className="landing-account-actions">
              {auth.configured && <button onClick={() => openAuthSheet('entry')}>{t('Protect your training')}</button>}
              {canGuest && <button onClick={enter}>Continuar sem conta</button>}
            </div>
          )}
        </motion.section>

        <section className="landing-showcase">
          <HomePreview reduced={reduced} />
        </section>

        <section className="landing-block" id="treino">
          <h2>Treino</h2>
          <p>Mesma tela de séries, carga e animação.</p>
          <WorkoutPreview reduced={reduced} />
        </section>

        <section className="landing-block" id="estatisticas">
          <h2>Corpo</h2>
          <p>Equilíbrio, fadiga e força no mapa.</p>
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
            <a href="#/data-rights">Direitos</a>
          </nav>
        </footer>
      </div>
    </main>
  )
}
