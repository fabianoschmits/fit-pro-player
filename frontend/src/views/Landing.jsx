import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore, hasData } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { webauthnOK, passkeyLogin, passkeyRegister, BIO } from '../lib/api.js'
import { DEMO, STANDALONE } from '../lib/demo.js'
import { guestAllowed } from '../lib/guest.js'
import { EXIDX, exerciseName } from '../lib/exercises.js'
import { t } from '../lib/i18n.js'
import ExerciseGuideAnimation from '../components/ExerciseGuideAnimation.jsx'
import BodyMap from '../components/BodyMap.jsx'
import LineChart from '../components/LineChart.jsx'
import Icon from '../components/Icon.jsx'
import { Button } from '../components/ui.jsx'

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

function RegisterSheet({ close }) {
  const { setUser, pushState, pullState, loadConfig } = useStore()
  const config = useStore(state => state.config)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const inviteOnly = !!config?.invite_only
  const inputRef = useRef(null)

  useEffect(() => { window.setTimeout(() => inputRef.current?.focus(), 250) }, [])
  useEffect(() => { loadConfig() }, [loadConfig])

  const register = async () => {
    const trimmedName = name.trim()
    if (!trimmedName) { useUI.getState().toast('Digite um nome'); return }
    if (inviteOnly && !code.trim()) { useUI.getState().toast('O código de convite é obrigatório'); return }
    try {
      const user = await passkeyRegister(trimmedName, code.trim())
      setUser(user)
      close()
      if (hasData(useStore.getState().S)) {
        await pushState()
        useUI.getState().toast('Perfil criado — os dados deste dispositivo foram transferidos')
      } else {
        await pullState()
        useUI.getState().toast(`Bem-vindo, ${user.name}`)
      }
    } catch (error) {
      if (error.name !== 'NotAllowedError' && error.name !== 'AbortError') {
        useUI.getState().toast(error.message || 'Não foi possível criar o perfil')
      }
    }
  }

  return <>
    <h3>Crie seu perfil</h3>
    <div className="muted small" style={{ marginBottom: 14 }}>
      Escolha um nome e confirme com {t(BIO)}. A chave de acesso fica protegida no seu dispositivo.
    </div>
    <input ref={inputRef} className="input" placeholder="Seu nome" maxLength={40} value={name} onChange={event => setName(event.target.value)} />
    {inviteOnly && <>
      <div style={{ height: 10 }} />
      <input className="input" placeholder="Código de convite" maxLength={40} value={code}
        onChange={event => setCode(event.target.value.toUpperCase())}
        style={{ letterSpacing: '.14em', fontWeight: 600, textAlign: 'center' }} />
    </>}
    <div style={{ height: 12 }} />
    <Button variant="primary" onClick={register}>Criar chave de acesso</Button>
  </>
}

function ExerciseCarousel({ paused, reduced }) {
  const copies = [0, 1]
  return (
    <div className="landing-exercise-marquee">
      <div className={'landing-exercise-track' + (paused || reduced ? ' is-paused' : '')}>
        {copies.map(copy => (
          <div className="landing-exercise-set" key={copy} aria-hidden={copy === 1 ? 'true' : undefined}>
            {SHOWCASE_EXERCISES.map((exercise, index) => (
              <article className="landing-exercise-card" key={`${copy}-${exercise.id}`}>
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

function StatsPreview({ paused, reduced, setPaused }) {
  const [active, setActive] = useState(0)

  useEffect(() => {
    if (paused || reduced) return undefined
    const timer = setInterval(() => setActive(index => (index + 1) % STAT_VIEWS.length), 4200)
    return () => clearInterval(timer)
  }, [paused, reduced])

  const view = STAT_VIEWS[active]
  return (
    <div className="landing-product-card landing-stats-card">
      <div className="landing-stats-head">
        <div>
          <div className="landing-card-kicker">ANÁLISE DOS ÚLTIMOS 30 DIAS</div>
          <h3>{view.title}</h3>
          <p>{view.subtitle}</p>
        </div>
        <button className="landing-pause" disabled={reduced} onClick={() => setPaused(value => !value)}
          aria-label={reduced ? 'Movimento reduzido pela preferência do sistema' : paused ? 'Continuar demonstração' : 'Pausar demonstração'}>
          <Icon name={paused ? 'play' : 'pause'} />
        </button>
      </div>
      <div className="landing-stat-tabs" role="tablist" aria-label="Visualizações de estatísticas">
        {STAT_VIEWS.map((item, index) => (
          <button key={item.id} role="tab" aria-selected={index === active} className={index === active ? 'is-active' : ''}
            onClick={() => { setActive(index); setPaused(true) }}>{item.label}</button>
        ))}
      </div>
      <div className={'landing-stat-stage ' + (view.className || '')} key={view.id}>
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
      <div className="landing-loop-progress" aria-hidden="true"><i className={paused || reduced ? 'is-paused' : ''} key={`${view.id}-${paused}`} /></div>
    </div>
  )
}

function WorkoutPreview({ playing }) {
  const exercise = SHOWCASE_EXERCISES[0]
  return (
    <div className="landing-phone" aria-label="Prévia de um treino em andamento">
      <div className="landing-phone-status" aria-hidden="true"><b>9:41</b><span><i /><i /><i /></span></div>
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
      <div className="landing-home-indicator" aria-hidden="true" />
    </div>
  )
}

export default function Landing() {
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
  const openRegister = () => useUI.getState().openSheet(close => <RegisterSheet close={close} />)
  const entryUnavailable = !localEntry && !hasPasskey && !canGuest
  const primaryAction = localEntry || (!hasPasskey && canGuest) ? enter : signIn
  const primaryLabel = localEntry
    ? (DEMO ? 'Abrir demonstração' : 'Começar agora')
    : hasPasskey ? 'Entrar com chave de acesso' : canGuest ? 'Usar neste dispositivo' : 'Chave de acesso indisponível'

  return (
    <main className="landing-page">
      <header className="landing-nav-shell">
        <div className="landing-nav">
          <a className="landing-brand" href="#top" aria-label="Fit Pro Player — início"><img src={BRAND_LOGO} alt="" /></a>
          <nav aria-label="Seções da página">
            <a href="#como-funciona">Exercícios</a>
            <a href="#progresso">Progresso</a>
            <a href="#estatisticas">Análise corporal</a>
          </nav>
          <button className="landing-nav-cta" disabled={entryUnavailable} onClick={primaryAction}>{localEntry ? 'Abrir aplicativo' : 'Entrar'}</button>
        </div>
      </header>

      <section className="landing-hero" id="top">
        <div className="landing-hero-copy">
          <img className="landing-hero-logo" src={BRAND_LOGO} alt="Fit Pro Player" />
          <div className="landing-eyebrow">TREINO, PROGRESSO E RECUPERAÇÃO</div>
          <h1>Seu treino fica mais claro quando tudo está no mesmo lugar.</h1>
          <p>Planeje a semana, registre cada série e entenda a sua evolução em um aplicativo feito para acompanhar você na academia.</p>
          <div className="landing-actions">
            <Button variant="primary" icon="figureStrength" disabled={entryUnavailable} onClick={primaryAction}>{primaryLabel}</Button>
            <a className="landing-secondary-action" href="#como-funciona">Conhecer o aplicativo <Icon name="chevronRight" /></a>
          </div>
          {!localEntry && <div className="landing-account-actions">
            {hasPasskey && <button onClick={openRegister}>Criar novo perfil</button>}
            {canGuest && <button onClick={enter}>Continuar sem conta</button>}
          </div>}
          <div className="landing-trust">
            <span><b>156</b> exercícios animados</span>
            <span><b>100%</b> funcional offline</span>
            <span><b>0</b> anúncios</span>
          </div>
        </div>
        <div className="landing-hero-visual">
          <div className="landing-demo-label"><span /> TREINO EM ANDAMENTO <b>TERÇA · 09:41</b></div>
          <WorkoutPreview playing={!paused && !reduced} />
        </div>
      </section>

      <section className="landing-section landing-exercises" id="como-funciona">
        <div className="landing-section-head">
          <div><span className="landing-section-index">EXERCÍCIOS</span><h2>Veja a execução. Sem sair do treino.</h2></div>
          <div className="landing-section-side">
            <p>Cada movimento é mostrado dentro do próprio aplicativo, com animações rápidas para consultar entre uma série e outra.</p>
            <button className="landing-pause-text" disabled={reduced} onClick={() => setPaused(value => !value)}>
              <Icon name={paused ? 'play' : 'pause'} /> {reduced ? 'Movimento reduzido pelo sistema' : paused ? 'Continuar animações' : 'Pausar animações'}
            </button>
          </div>
        </div>
        <ExerciseCarousel paused={paused} reduced={reduced} />
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
        <StatsPreview paused={paused} reduced={reduced} setPaused={setPaused} />
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
        <a className="landing-brand" href="#top" aria-label="Fit Pro Player — início"><img src={BRAND_LOGO} alt="" /></a>
        <p>Treine com intenção. Acompanhe com clareza.</p>
        <span>Todos os direitos reservados.</span>
      </footer>
    </main>
  )
}
