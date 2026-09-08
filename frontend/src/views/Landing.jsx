import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore, hasData } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { webauthnOK, passkeyLogin, passkeyRegister, BIO } from '../lib/api.js'
import { DEMO, STANDALONE, REPO } from '../lib/demo.js'
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
  ['calendar', 'Planeje a semana', 'Monte rotinas, distribua os treinos pelos dias e ajuste o plano quando a agenda mudar.'],
  ['figureStrength', 'Treine com orientação', 'Veja a execução do exercício, registre cada série e deixe o descanso acontecer no tempo certo.'],
  ['chartLine', 'Enxergue a evolução', 'Peso corporal, carga, volume, esforço e constância viram tendências fáceis de acompanhar.'],
  ['shield', 'Seus dados são seus', 'Use no próprio navegador ou hospede a sua instância. Exporte backups quando quiser.'],
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
            {SHOWCASE_EXERCISES.map(exercise => (
              <article className="landing-exercise-card" key={`${copy}-${exercise.id}`}>
                <div className="landing-exercise-media">
                  <ExerciseGuideAnimation ex={exercise} playing={!paused && !reduced} />
                </div>
                <div className="landing-exercise-copy">
                  <strong>{exerciseName(exercise)}</strong>
                  <span>{t(exercise.eq || exercise.bp)}</span>
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
      <div className="landing-card-kicker"><Icon name="scale" /> Peso corporal</div>
      <div className="landing-weight-heading">
        <div><strong>79,8</strong> <span>kg</span></div>
        <span className="landing-positive"><Icon name="arrowDown" /> 2,6 kg</span>
      </div>
      <div className="landing-weight-meta"><span>Últimos 30 dias</span><span>Meta 79,5 kg</span></div>
      <div className="chart landing-weight-chart"><LineChart points={points} h={190} unit="kg" goal={79.5} /></div>
      <div className="landing-insight"><Icon name="sparkles" /><span><b>Progresso consistente.</b> O peso caiu em sete das oito medições.</span></div>
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
          <div className="landing-card-kicker"><Icon name="chart" /> Leitura corporal</div>
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
            onClick={() => setActive(index)}>{item.label}</button>
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
      <div className="landing-phone-top"><span>Treino A</span><span>3 de 5</span></div>
      <div className="landing-phone-progress"><i /></div>
      <div className="landing-phone-title">
        <div><small>EXERCÍCIO ATUAL</small><strong>{exerciseName(exercise)}</strong></div>
        <span>Peito</span>
      </div>
      <div className="landing-phone-media"><ExerciseGuideAnimation ex={exercise} playing={playing} /></div>
      <div className="landing-set-head"><span>SÉRIE</span><span>PESO</span><span>REPS</span><span>FEITO</span></div>
      {[['1', '60 kg', '10'], ['2', '62,5 kg', '10'], ['3', '62,5 kg', '8']].map((row, index) => (
        <div className="landing-set-row" key={row[0]}>
          <span>{row[0]}</span><strong>{row[1]}</strong><strong>{row[2]}</strong>
          <i className={index < 2 ? 'is-done' : ''}>{index < 2 && <Icon name="check" />}</i>
        </div>
      ))}
      <div className="landing-rest"><Icon name="timer" /><span><b>01:18</b> de descanso</span><span>90s</span></div>
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
      <header className="landing-nav">
        <a className="landing-brand" href="#top" aria-label="Fit Pro Player — início"><span><Icon name="dumbbell" /></span>Fit Pro Player</a>
        <nav aria-label="Seções da página">
          <a href="#como-funciona">Como funciona</a>
          <a href="#progresso">Progresso</a>
          <a href="#estatisticas">Estatísticas</a>
        </nav>
        <button className="landing-nav-cta" disabled={entryUnavailable} onClick={primaryAction}>{localEntry ? 'Abrir app' : 'Entrar'}</button>
      </header>

      <section className="landing-hero" id="top">
        <div className="landing-hero-copy">
          <div className="landing-eyebrow"><span /> Treino, evolução e recuperação em um só lugar</div>
          <h1>Seu treino fica mais claro quando tudo conversa.</h1>
          <p>Planeje a semana, acompanhe cada série e transforme seu histórico em decisões melhores — sem planilhas soltas e sem adivinhação.</p>
          <div className="landing-actions">
            <Button variant="primary" icon="figureStrength" disabled={entryUnavailable} onClick={primaryAction}>{primaryLabel}</Button>
            <a className="landing-secondary-action" href="#como-funciona"><Icon name="play" /> Ver como funciona</a>
          </div>
          {!localEntry && <div className="landing-account-actions">
            {hasPasskey && <button onClick={openRegister}>Criar novo perfil</button>}
            {canGuest && <button onClick={enter}>Continuar sem conta</button>}
          </div>}
          <div className="landing-trust">
            <span><Icon name="checkCircle" /> 156 exercícios animados</span>
            <span><Icon name="checkCircle" /> Funciona offline</span>
            <span><Icon name="checkCircle" /> Sem anúncios</span>
          </div>
        </div>
        <div className="landing-hero-visual"><WorkoutPreview playing={!paused && !reduced} /></div>
      </section>

      <section className="landing-section landing-exercises" id="como-funciona">
        <div className="landing-section-head">
          <div><span className="landing-section-index">01 · EXECUÇÃO</span><h2>Saiba o que fazer antes da primeira repetição.</h2></div>
          <div className="landing-section-side">
            <p>As animações mostram o movimento dentro do próprio treino. Sem abrir vídeo, trocar de aplicativo ou perder o ritmo.</p>
            <button className="landing-pause-text" disabled={reduced} onClick={() => setPaused(value => !value)}>
              <Icon name={paused ? 'play' : 'pause'} /> {reduced ? 'Movimento reduzido pelo sistema' : paused ? 'Continuar animações' : 'Pausar animações'}
            </button>
          </div>
        </div>
        <ExerciseCarousel paused={paused} reduced={reduced} />
      </section>

      <section className="landing-section landing-progress-section" id="progresso">
        <div className="landing-progress-copy">
          <span className="landing-section-index">02 · PROGRESSO</span>
          <h2>Um mês deixa de ser uma sequência de números.</h2>
          <p>Cada pesagem fica marcada na curva. Você vê a direção, compara com a meta e entende se o plano está funcionando.</p>
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
          <span className="landing-section-index">03 · LEITURA CORPORAL</span>
          <h2>O corpo conta a história que a carga sozinha não mostra.</h2>
          <p>O mesmo mapa alterna entre equilíbrio muscular, fadiga e força retida. Assim fica simples decidir o que treinar, recuperar ou reforçar.</p>
          <ul>
            <li><Icon name="chart" /><span><b>Equilíbrio muscular</b> mostra onde o volume está concentrado.</span></li>
            <li><Icon name="flame" /><span><b>Fadiga</b> ajuda a respeitar o tempo de recuperação.</span></li>
            <li><Icon name="bolt" /><span><b>Força</b> estima o quanto cada grupo muscular reteve.</span></li>
          </ul>
        </div>
        <StatsPreview paused={paused} reduced={reduced} setPaused={setPaused} />
      </section>

      <section className="landing-section landing-feature-section">
        <div className="landing-centered-head"><span className="landing-section-index">DO PLANO AO RESULTADO</span><h2>O ciclo inteiro do treino, sem ruído.</h2></div>
        <div className="landing-feature-grid">
          {FEATURES.map(([icon, title, copy]) => <article key={title}>
            <span className="landing-feature-icon"><Icon name={icon} /></span><h3>{title}</h3><p>{copy}</p>
          </article>)}
        </div>
      </section>

      <section className="landing-final-cta">
        <div><span className="landing-section-index">PRONTO PARA COMEÇAR?</span><h2>Seu próximo treino já pode deixar um histórico melhor.</h2></div>
        <div className="landing-final-actions">
          <Button variant="primary" icon="figureStrength" disabled={entryUnavailable} onClick={primaryAction}>{primaryLabel}</Button>
          <span>{localEntry ? 'Os dados ficam salvos neste navegador.' : `Protegido com ${t(BIO)}, sem senha.`}</span>
        </div>
      </section>

      <footer className="landing-footer">
        <a className="landing-brand" href="#top"><span><Icon name="dumbbell" /></span>Fit Pro Player</a>
        <p>Treine com intenção. Acompanhe com clareza.</p>
        <a href={REPO} target="_blank" rel="noopener">Código aberto <Icon name="chevronRight" /></a>
      </footer>
    </main>
  )
}
