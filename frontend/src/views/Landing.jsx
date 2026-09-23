import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { useAuth } from '../auth/AuthProvider.jsx'
import { webauthnOK, passkeyLogin, BIO } from '../lib/api.js'
import { DEMO, STANDALONE } from '../lib/demo.js'
import { guestAllowed } from '../lib/guest.js'
import { EXIDX, exerciseName } from '../lib/exercises.js'
import { t } from '../lib/i18n.js'
import ExerciseGuideAnimation from '../components/ExerciseGuideAnimation.jsx'
import AvatarImage from '../components/AvatarImage.jsx'
import BodyMap from '../components/BodyMap.jsx'
import LineChart from '../components/LineChart.jsx'
import Icon from '../components/Icon.jsx'
import { Button } from '../components/ui.jsx'
import { openAuthSheet } from '../components/AuthSheet.jsx'
import '../landing.css'

const DAY = 86400000
const SHOWCASE_EXERCISES = ['0025', '0043', '0032', '0198', '0334']
  .map(id => EXIDX[id])
  .filter(Boolean)

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
  {
    id: 'balance', label: 'Equilíbrio muscular', title: 'Volume bem distribuído',
    subtitle: 'Últimos 30 dias · por séries trabalhadas', load: BALANCE_LOAD,
    rows: [['Quadríceps', '19 séries', 1], ['Peito', '18 séries', .95], ['Costas', '17 séries', .89]],
  },
  {
    id: 'fatigue', label: 'Fadiga', title: 'Recuperação em andamento',
    subtitle: 'O mapa mostra onde é melhor descansar', load: FATIGUE_LOAD,
    thresholds: FATIGUE_LEVELS, className: 'hm-fatigue',
    rows: [['Peito', 'Fadigado', 1], ['Ombros', 'Recuperando', .72], ['Costas', 'Pronto', .35]],
  },
  {
    id: 'strength', label: 'Força', title: 'Força retida',
    subtitle: 'Estimativa baseada no histórico de treino', load: STRENGTH_LOAD,
    thresholds: STRENGTH_LEVELS, className: 'hm-strength',
    rows: [['Quadríceps', '100%', 1], ['Peito', '98%', .98], ['Tríceps', '95%', .95]],
  },
]

const FEATURES = [
  { step: '01', icon: 'calendar', title: 'Organize', label: 'Plano semanal', copy: 'Rotinas e dias de treino em uma agenda que acompanha a sua semana.' },
  { step: '02', icon: 'figureStrength', title: 'Execute', label: 'Treino guiado', copy: 'Animação, séries, carga, repetições e descanso na mesma tela.' },
  { step: '03', icon: 'chartLine', title: 'Acompanhe', label: 'Evolução real', copy: 'Peso, volume e desempenho transformados em histórico legível.' },
  { step: '04', icon: 'shield', title: 'Decida', label: 'Leitura corporal', copy: 'Equilíbrio, fadiga e força para orientar o próximo treino.' },
]
const BRAND_LOGO = '/brand-logo.png'

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

function ExerciseShowcase({ paused, reduced }) {
  return (
    <div className="landing-exercise-marquee">
      <div className={'landing-exercise-track' + (paused || reduced ? ' is-paused' : '')}>
        <div className="landing-exercise-set">
          {SHOWCASE_EXERCISES.map((exercise, index) => (
            <article className="landing-exercise-card" key={exercise.id}>
              <div className="landing-exercise-media">
                <ExerciseGuideAnimation ex={exercise} playing={!paused && !reduced} />
              </div>
              <div className="landing-exercise-copy">
                <span className="landing-exercise-number">{String(index + 1).padStart(2, '0')}</span>
                <div><strong>{exerciseName(exercise)}</strong><span>{t(exercise.eq || exercise.bp)}</span></div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  )
}

function HomePreview() {
  return (
    <div className="landing-home-preview" aria-label="Prévia da tela inicial do aplicativo">
      <div className="landing-home-preview-top">
        <div><span>SEU DIA</span><strong>Hoje</strong></div>
        <time dateTime="2026-09-13">DOM · 13 SET.</time>
      </div>
      <div className="landing-profile-preview">
        <div className="landing-profile-avatar" aria-hidden="true">
          <AvatarImage avatarId="avatar-27" loading="lazy" />
        </div>
        <div className="landing-profile-copy">
          <strong>Alex</strong>
          <p>Hoje o frango evolui.</p>
          <span>34 anos · 1,78 m · 78,6 kg</span>
          <div className="landing-profile-goal">
            <div><small>META DE PESO</small><b>70%</b></div>
            <i><b /></i>
          </div>
        </div>
      </div>
      <div className="landing-today-preview">
        <div className="landing-today-heading"><span>PLANO DE HOJE</span><small>6 EXERCÍCIOS</small></div>
        <div className="landing-today-row">
          <span className="landing-today-icon"><Icon name="figureStrength" /></span>
          <div><strong>Dia de Peito</strong><small>Peitorais · última vez há 6 dias</small></div>
          <span className="landing-today-action">Começar <Icon name="chevronRight" /></span>
        </div>
      </div>
      <div className="landing-week-preview" aria-hidden="true">
        {[['SEG', '07', true], ['TER', '08'], ['QUA', '09', true], ['QUI', '10'], ['SEX', '11', true], ['SÁB', '12'], ['DOM', '13', false, true]].map(([day, date, done, today]) => (
          <span className={today ? 'is-today' : done ? 'is-done' : ''} key={day}><small>{day}</small><b>{date}</b><i /></span>
        ))}
      </div>
    </div>
  )
}

function WeightPreview() {
  const points = useMemo(() => buildWeightPreviewPoints(), [])
  return (
    <div className="landing-product-card landing-weight-card">
      <div className="landing-preview-toolbar">
        <div><span className="landing-preview-icon"><Icon name="scale" /></span><div><strong>Peso corporal</strong><span>Visão mensal</span></div></div>
        <span className="landing-preview-period">30 dias</span>
      </div>
      <div className="landing-weight-heading">
        <div><small>HOJE</small><strong>79,8 <span>kg</span></strong></div>
        <span className="landing-positive"><Icon name="arrowDown" /> 2,6 kg no período</span>
      </div>
      <div className="landing-weight-meta"><span>08 de setembro</span><span><i /> Meta 79,5 kg</span></div>
      <div className="chart landing-weight-chart"><LineChart points={points} h={190} unit="kg" goal={79.5} /></div>
      <div className="landing-insight"><span className="landing-insight-icon"><Icon name="chartLine" /></span><span><b>Ritmo consistente</b><small>7 das 8 últimas medições ficaram abaixo da anterior.</small></span></div>
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
    <div className="landing-product-card landing-stats-card">
      <div className="landing-stats-head">
        <div>
          <div className="landing-card-kicker">ANÁLISE DOS ÚLTIMOS 30 DIAS</div>
          <h3>{view.title}</h3>
          <p>{view.subtitle}</p>
        </div>
        <span className="landing-preview-live"><i /> DADOS CONECTADOS</span>
      </div>
      <div className="landing-stat-tabs" role="tablist" aria-label="Visualizações de estatísticas">
        {STAT_VIEWS.map((item, index) => (
          <button key={item.id} ref={element => { tabs.current[index] = element }} role="tab"
            id={`landing-tab-${item.id}`} aria-controls={`landing-panel-${item.id}`} aria-selected={index === active}
            tabIndex={index === active ? 0 : -1} className={index === active ? 'is-active' : ''}
            onKeyDown={event => onTabKeyDown(event, index)} onClick={() => setActive(index)}>{item.label}</button>
        ))}
      </div>
      <div className={'landing-stat-stage ' + (view.className || '')} key={view.id} role="tabpanel"
        id={`landing-panel-${view.id}`} aria-labelledby={`landing-tab-${view.id}`}>
        <BodyMap load={view.load} thresholds={view.thresholds} body="male" decorative />
        <div className="landing-muscle-list">
          {view.rows.map(([label, value, level]) => (
            <div className="landing-muscle-row" key={label}>
              <span>{label}</span>
              <i><b style={{ '--landing-level': level }} /></i>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function WorkoutPreview({ playing }) {
  const exercise = SHOWCASE_EXERCISES[0]
  return (
    <div className="landing-phone" aria-label="Prévia de um treino em andamento">
      <div className="landing-phone-top"><span><i><Icon name="chevronLeft" /></i> Treino A</span><span>3 de 5</span></div>
      <div className="landing-phone-progress"><i /></div>
      <div className="landing-phone-title">
        <div><small>EXERCÍCIO 3 DE 5</small><strong>{exerciseName(exercise)}</strong></div>
        <span>Peito · Barra</span>
      </div>
      <div className="landing-phone-media"><ExerciseGuideAnimation ex={exercise} playing={playing} /></div>
      <div className="landing-set-head"><span>SÉRIE</span><span>PESO</span><span>REPS</span><span>FEITO</span></div>
      {[['1', '60 kg', '10'], ['2', '62,5 kg', '10'], ['3', '62,5 kg', '8']].map((row, index) => (
        <div className="landing-set-row" key={row[0]}>
          <span>{row[0]}</span><strong>{row[1]}</strong><strong>{row[2]}</strong>
          <i className={index < 2 ? 'is-done' : ''}>{index < 2 && <Icon name="check" />}</i>
        </div>
      ))}
      <div className="landing-rest"><span><Icon name="timer" /></span><div><small>DESCANSO</small><b>01:18</b></div><span className="landing-rest-control" aria-hidden="true"><Icon name="pause" /></span></div>
    </div>
  )
}

export default function Landing() {
  const auth = useAuth()
  const { setUser, pullState, setGuest } = useStore()
  const config = useStore(state => state.config)
  const canGuest = guestAllowed(config)
  const hasPasskey = webauthnOK()
  const reduced = useReducedMotion()
  const [paused, setPaused] = useState(false)
  const localEntry = STANDALONE || DEMO

  useEffect(() => {
    document.body.classList.add('landing-mode')
    return () => document.body.classList.remove('landing-mode')
  }, [])

  const signIn = async () => {
    try {
      const user = await passkeyLogin()
      setUser(user)
      await pullState()
      useUI.getState().toast(`Bem-vindo de volta, ${user.name}`)
    } catch (error) {
      if (error.name !== 'NotAllowedError' && error.name !== 'AbortError') {
        useUI.getState().toast(error.message || 'Não foi possível entrar')
      }
    }
  }

  const enter = () => setGuest(true)
  const entryUnavailable = !localEntry && !hasPasskey && !canGuest
  const primaryAction = localEntry || (!hasPasskey && canGuest) ? enter : signIn
  const primaryLabel = localEntry
    ? (DEMO ? 'Abrir demonstração' : 'Começar agora')
    : hasPasskey ? 'Entrar com chave de acesso' : canGuest ? 'Usar neste dispositivo' : 'Chave de acesso indisponível'

  return (
    <main className="landing-page">
      <header className="landing-nav-shell">
        <div className="landing-nav">
          <a className="landing-nav-brand" href="#top" aria-label="Fit Pro Player — início">
            <img src={BRAND_LOGO} alt="" />
            <span>FIT PRO PLAYER</span>
          </a>
          <nav aria-label="Seções da página">
            <a href="#treino">Treino</a>
            <a href="#exercicios">Exercícios</a>
            <a href="#progresso">Progresso</a>
            <a href="#estatisticas">Análise corporal</a>
          </nav>
          <button className="landing-nav-cta" disabled={entryUnavailable} onClick={primaryAction}>{localEntry ? 'Abrir aplicativo' : 'Entrar'}</button>
        </div>
      </header>

      <section className="landing-hero" id="top">
        <div className="landing-hero-copy">
          <img className="landing-hero-logo" src={BRAND_LOGO} alt="Fit Pro Player" fetchPriority="high" />
          <div className="landing-eyebrow">SEU TREINO, SEM RUÍDO</div>
          <h1>Treine com contexto. Evolua com clareza.</h1>
          <p>Planejamento, execução, progresso e recuperação vivem no mesmo lugar — do primeiro exercício à decisão sobre o próximo treino.</p>
          <div className="landing-actions">
            <Button variant="primary" icon="figureStrength" disabled={entryUnavailable} onClick={primaryAction}>{primaryLabel}</Button>
            <a className="landing-secondary-action" href="#treino">Conhecer o aplicativo <Icon name="chevronRight" /></a>
          </div>
           {!localEntry && <div className="landing-account-actions">
             {auth.configured && <button onClick={() => openAuthSheet('entry')}>{t('Protect your training')}</button>}
            {canGuest && <button onClick={enter}>Continuar sem conta</button>}
          </div>}
        </div>
        <div className="landing-hero-visual">
          <div className="landing-demo-label"><span /> SUA ROTINA, EM CONTEXTO <b>PRÉVIA DO APP</b></div>
          <HomePreview />
        </div>
        <div className="landing-trust">
          <span><b>156</b><small>exercícios animados</small></span>
          <span><b>100%</b><small>funcional offline</small></span>
          <span><b>0</b><small>anúncios</small></span>
        </div>
      </section>

      <section className="landing-section landing-workout-section" id="treino">
        <div className="landing-workout-copy">
          <span className="landing-section-index">TREINO GUIADO</span>
          <h2>Da primeira à última série, sem perder o foco.</h2>
          <p>Carga, repetições, descanso e histórico recente aparecem no momento em que você precisa. Nada compete com a execução.</p>
          <ul>
            <li><span>01</span><p><b>Continue de onde parou</b><small>As últimas cargas ficam prontas para consultar.</small></p></li>
            <li><span>02</span><p><b>Registre no ritmo do treino</b><small>Controles diretos e descanso no mesmo fluxo.</small></p></li>
            <li><span>03</span><p><b>Termine com o histórico pronto</b><small>Volume e desempenho são calculados na hora.</small></p></li>
          </ul>
        </div>
        <div className="landing-workout-visual">
          <div className="landing-demo-label"><span /> TREINO EM ANDAMENTO <b>TERÇA · 09:41</b></div>
          <WorkoutPreview playing={!paused && !reduced} />
        </div>
      </section>

      <section className="landing-section landing-exercises" id="exercicios">
        <div className="landing-section-head">
          <div><span className="landing-section-index">BIBLIOTECA VISUAL</span><h2>O movimento certo, na hora que você precisa.</h2></div>
          <div className="landing-section-side">
            <p>Consulte a execução dentro do próprio treino. As animações são rápidas, objetivas e podem ser pausadas a qualquer momento.</p>
            <button className="landing-pause-text" disabled={reduced} onClick={() => setPaused(value => !value)}>
              <Icon name={paused ? 'play' : 'pause'} /> {reduced ? 'Movimento reduzido pelo sistema' : paused ? 'Continuar animações' : 'Pausar animações'}
            </button>
          </div>
        </div>
        <ExerciseShowcase paused={paused} reduced={reduced} />
      </section>

      <section className="landing-section landing-progress-section" id="progresso">
        <div className="landing-progress-copy">
          <span className="landing-section-index">PROGRESSO</span>
          <h2>Um mês inteiro, entendido em poucos segundos.</h2>
          <p>Cada pesagem aparece na curva. A tendência, a distância até a meta e o ritmo da mudança ficam visíveis de imediato.</p>
          <div className="landing-mini-metrics">
            <div><strong>−2,6 kg</strong><span>em 30 dias</span></div>
            <div><strong>9</strong><span>pesagens</span></div>
            <div><strong>88%</strong><span>da meta mensal</span></div>
          </div>
        </div>
        <WeightPreview />
      </section>

      <section className="landing-section landing-stats-section" id="estatisticas">
        <div className="landing-stats-copy">
          <span className="landing-section-index">ANÁLISE CORPORAL</span>
          <h2>Mais contexto para decidir o próximo treino.</h2>
          <p>O mapa corporal reúne equilíbrio muscular, fadiga e força retida. Você entende onde avançar e onde vale recuperar.</p>
          <ul>
            <li><Icon name="chart" /><span><b>Equilíbrio muscular</b> mostra onde o volume está concentrado.</span></li>
            <li><Icon name="flame" /><span><b>Fadiga</b> ajuda a respeitar o tempo de recuperação.</span></li>
            <li><Icon name="bolt" /><span><b>Força</b> estima o quanto cada grupo muscular reteve.</span></li>
          </ul>
        </div>
        <StatsPreview />
      </section>

      <section className="landing-section landing-feature-section">
        <div className="landing-flow-head"><span className="landing-section-index">COMO FUNCIONA</span><h2>Da agenda à próxima decisão.</h2><p>O histórico nasce durante o treino. Nada depende de preencher planilhas depois.</p></div>
        <div className="landing-feature-list">
          {FEATURES.map(({ step, icon, title, label, copy }) => <article key={title}>
            <span className="landing-feature-step">{step}</span>
            <span className="landing-feature-icon"><Icon name={icon} /></span>
            <div><small>{label}</small><h3>{title}</h3></div>
            <p>{copy}</p>
          </article>)}
        </div>
      </section>

      <section className="landing-final-cta">
        <div><span className="landing-section-index">COMECE PELO PRÓXIMO TREINO</span><h2>Menos tempo organizando. Mais clareza para evoluir.</h2><p>Abra o Fit Pro Player e monte a sua primeira rotina em poucos minutos.</p></div>
        <div className="landing-final-actions">
          <Button variant="primary" icon="figureStrength" disabled={entryUnavailable} onClick={primaryAction}>{primaryLabel}</Button>
          <span>{localEntry ? 'Os dados ficam salvos neste navegador.' : `Protegido com ${t(BIO)}, sem senha.`}</span>
        </div>
      </section>

      <footer className="landing-footer">
        <a className="landing-footer-brand" href="#top"><img src={BRAND_LOGO} alt="" /><span>FIT PRO PLAYER</span></a>
        <p>Treine com intenção. Acompanhe com clareza.</p>
        <span>Todos os direitos reservados.</span>
      </footer>
    </main>
  )
}
