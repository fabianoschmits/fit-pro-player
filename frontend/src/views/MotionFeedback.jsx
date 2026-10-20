import { useEffect, useRef, useState } from 'react'
import { Button, Check, Section, Switch } from '../components/ui.jsx'
import { FppActionFeedback, FppProgress, FppSkeleton, FppSpinner, FppStatusAnimation, FppToast } from '../components/FppFeedback.jsx'
import { ACCENTS } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import AppHeader from '../components/AppHeader.jsx'
import { confirmSheet } from '../sheets.jsx'
import '../motion-showcase.css'

const states = ['idle', 'pressed', 'loading', 'processing', 'success', 'error', 'disabled', 'uploading', 'syncing', 'offline', 'warning']
const LAB_TABS = [
  { id: 'buttons', label: 'Botões', hint: 'Pressão, resultado e ações críticas' },
  { id: 'flows', label: 'Fluxos', hint: 'Ordem entre confirmação e ação' },
  { id: 'states', label: 'Estados', hint: 'Progresso, status e carregamento' },
  { id: 'structures', label: 'Estruturas', hint: 'Seções, detalhes e painel de treino' },
  { id: 'recovery', label: 'Recuperação', hint: 'Toast, falha de leitura e nova tentativa' },
]

function Sample({ name, action, animation, children, className = '', dataSample }) {
  return <article className={`motion-showcase-sample ${className}`.trim()} data-sample={dataSample}>
    <div className="motion-showcase-label"><strong>{name}</strong><code>{action}</code><span>{animation}</span></div>
    {children}
  </article>
}

// A manually settled promise exercises the real lifecycle without fake service delays.
export default function MotionFeedback() {
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || 'dark')
  const [accent, setAccent] = useState(() => document.documentElement.dataset.accent || 'lime')
  const [checked, setChecked] = useState(false), [enabled, setEnabled] = useState(false)
  const [count, setCount] = useState(0), [pending, setPending] = useState(false), [criticalCount, setCriticalCount] = useState(0)
  const [tab, setTab] = useState('buttons')
  const [toast, setToast] = useState('')
  const [exercise, setExercise] = useState('Agachamento')
  const [recoveryAttempt, setRecoveryAttempt] = useState(0)
  const settle = useRef(null)
  useEffect(() => {
    const root = document.documentElement, original = { theme: root.dataset.theme, accent: root.dataset.accent }
    return () => { Object.assign(root.dataset, original); settle.current?.resolve(false) }
  }, [])
  useEffect(() => { Object.assign(document.documentElement.dataset, { theme, accent }) }, [theme, accent])
  const probe = () => {
    setCount(value => value + 1); setPending(true)
    return new Promise((resolve, reject) => { settle.current = { resolve, reject } })
  }
  const complete = fail => {
    if (!settle.current) return
    const current = settle.current; settle.current = null; setPending(false)
    if (fail) current.reject(new Error('showcase'))
    else current.resolve(true)
  }
  return <main className="narrow motion-showcase" data-motion-showcase>
    <AppHeader title={t('Motion & feedback')} subtitle="FIT PRO PLAYER" backTo="/console/laboratory" />
    <p className="muted small">{t('Performance · progress · precision')}</p>
    <div className="motion-showcase-controls">
      <label>{t('Theme')}<select aria-label="Tema do showcase" value={theme} onChange={event => setTheme(event.target.value)}><option value="dark">{t('Dark')}</option><option value="light">{t('Light')}</option></select></label>
      <label>{t('Accent color')}<select aria-label="Cor de destaque do showcase" value={accent} onChange={event => setAccent(event.target.value)}>{Object.keys(ACCENTS).map(value => <option key={value}>{value}</option>)}</select></label>
    </div>
    <div className="motion-showcase-tabs" role="tablist" aria-label="Categorias de testes">
      {LAB_TABS.map(item => <button key={item.id} type="button" role="tab" id={`motion-tab-${item.id}`} aria-selected={tab === item.id} aria-controls={`motion-panel-${item.id}`} onClick={() => setTab(item.id)}>
        <strong>{item.label}</strong><small>{item.hint}</small>
      </button>)}
    </div>
    {tab === 'buttons' && <section role="tabpanel" id="motion-panel-buttons" aria-labelledby="motion-tab-buttons" aria-label="Botões">
    <section aria-label={t('Action states')}>
      <div className="motion-showcase-section-heading"><h2>{t('Action states')}</h2><p className="muted small">{t('Every button keeps its width and announces its result.')}</p></div>
      <div className="motion-showcase-grid">
        {states.map(state => <Sample key={state} dataSample={state} name={state} action={`state=${state}`} animation={state === 'success' ? 'check 480ms' : state === 'error' ? 'retry stays available' : state === 'disabled' ? 'no interaction' : 'press 320ms · rail after 220ms'}>
          <Button variant="primary" size="sm" state={state} loadingLabel={t('Saving…')} successLabel={t('Saved')} errorLabel={t('Try again')}>{t('Save')}</Button>
        </Sample>)}
      </div>
    </section>
    <section aria-label={t('Button intents')} className="motion-showcase-grid">
      <Sample name="primary" action="intent=primary · Save" animation="press + rail + check"><Button variant="primary" size="sm" intent="primary" onAction={() => true} successLabel={t('Saved')}>{t('Save')}</Button></Sample>
      <Sample name="quick" action="intent=quick · Copy" animation="instant local check"><Button variant="secondary" size="sm" intent="quick" onAction={() => true} successLabel={t('Done')}>{t('Copy')}</Button></Sample>
      <Sample name="critical" action="intent=critical · Delete" animation="confirmation before commit"><Button variant="danger" size="sm" intent="critical" onClick={() => confirmSheet({ title: t('Delete'), message: t('Confirm'), confirmText: t('Delete'), danger: true, onConfirm: () => { setCriticalCount(value => value + 1); return true } })}>{t('Delete')} <span className="sr-only">{criticalCount}</span></Button></Sample>
    </section></section>}
    {tab === 'flows' && <section role="tabpanel" id="motion-panel-flows" aria-labelledby="motion-tab-flows" aria-label="Fluxos">
    <section className="motion-showcase-panel">
      <div className="motion-showcase-label"><strong>{t('Try an action')}</strong><code>press → onAction → success → continuation</code><span>press 320ms · result visible 520ms</span></div>
      <p className="muted small">A contagem só muda depois da pressão. Confirme o resultado para testar sucesso, erro e repetição.</p>
      <Button variant="primary" size="sm" data-probe-action onAction={probe} loadingLabel={t('Saving…')} successLabel={t('Saved')} errorLabel={t('Try again')}>{t('Save')}</Button>
      <div className="motion-showcase-controls"><Button size="sm" disabled={!pending} onClick={() => complete(false)}>{t('Confirm result')}</Button><Button size="sm" disabled={!pending} intent="critical" onClick={() => complete(true)}>{t('Simulate error')}</Button></div>
      <p className="muted small">{t('Executions')}: <output data-probe-count>{count}</output></p>
    </section>
    <section className="motion-showcase-panel">
      <div className="motion-showcase-label"><strong>{t('Quick actions')}</strong><code>Check · Switch · intent=quick</code><span>immediate local feedback</span></div>
      <div className="motion-showcase-controls"><Check checked={checked} onChange={setChecked} ariaLabel={t('Complete set')} /><Switch checked={enabled} onChange={setEnabled} ariaLabel={t('Notifications')} /><Button size="sm" intent="quick" onAction={() => true} successLabel={t('Done')}>{t('Copy')}</Button></div>
    </section>
    </section>}
    {tab === 'states' && <section role="tabpanel" id="motion-panel-states" aria-labelledby="motion-tab-states" aria-label="Estados">
    <section className="motion-showcase-panel">
      <h2>{t('Progress and status')}</h2>
      <FppProgress value={60} label={t('Progress')} />
      <FppProgress label={t('Saving…')} />
      <FppActionFeedback state="success">{t('Saved on this device')}</FppActionFeedback>
      <FppActionFeedback state="error">{t('Check your connection and try again.')}</FppActionFeedback>
      <FppActionFeedback state="offline">{t('Offline — changes stay on this device until you reconnect.')}</FppActionFeedback>
      <div className="motion-showcase-controls"><FppStatusAnimation state="warning" /><FppSpinner label={t('Loading…')} /></div>
      <FppSkeleton label={t('Loading…')} rows={3} />
    </section>
    </section>}
    {tab === 'structures' && <section role="tabpanel" id="motion-panel-structures" aria-labelledby="motion-tab-structures" aria-label="Estruturas">
      <section className="motion-showcase-panel">
        <div className="motion-showcase-label"><strong>Seção expansível</strong><code>Section collapsible</code><span>entrada e saída de 180 ms</span></div>
        <Section collapsible defaultOpen={false} title="Ajustes do treino" footer="O conteúdo permanece acessível sem movimento reduzido."><p className="muted small">Controles, explicações e resultados entram sem deslocar bruscamente a leitura.</p></Section>
      </section>
      <section className="motion-showcase-panel">
        <div className="motion-showcase-label"><strong>Detalhe nativo</strong><code>details → conteúdo</code><span>revelação curta de 180 ms</span></div>
        <details><summary>Ver prescrição de exemplo</summary><p className="muted small">3 séries · 8–12 repetições · descanso de 90 segundos.</p></details>
      </section>
      <section className="motion-showcase-panel">
        <div className="motion-showcase-label"><strong>Painel de treino</strong><code>troca de exercício</code><span>contexto entra em 200 ms · séries continuam imediatas</span></div>
        <div className="motion-showcase-controls"><Button size="sm" intent="quick" onClick={() => setExercise('Agachamento')}>Agachamento</Button><Button size="sm" intent="quick" onClick={() => setExercise('Supino')}>Supino</Button></div>
        <div key={exercise} className="motion-showcase-workout-stage"><strong>{exercise}</strong><span>3 séries · próxima ação permanece pronta</span></div>
      </section>
    </section>}
    {tab === 'recovery' && <section role="tabpanel" id="motion-panel-recovery" aria-labelledby="motion-tab-recovery" aria-label="Recuperação">
      <section className="motion-showcase-panel">
        <div className="motion-showcase-label"><strong>Toast com saída</strong><code>mensagem preservada</code><span>continua visível durante os 180 ms de saída</span></div>
        <div className="motion-showcase-controls"><Button size="sm" intent="quick" onClick={() => setToast('Alteração salva neste dispositivo')}>Mostrar toast</Button><Button size="sm" intent="quick" onClick={() => setToast('')}>Ocultar toast</Button></div>
        <FppToast id="showcase-toast" message={toast} tone="success" />
      </section>
      <section className="motion-showcase-panel">
        <div className="motion-showcase-label"><strong>Leitura recuperável</strong><code>falha → tentar novamente</code><span>a tela não fica presa em carregamento</span></div>
        <FppActionFeedback state={recoveryAttempt ? 'success' : 'error'}>{recoveryAttempt ? `Mapa corporal carregado na tentativa ${recoveryAttempt}.` : 'Não foi possível carregar o mapa corporal.'}</FppActionFeedback>
        <Button size="sm" onAction={() => { setRecoveryAttempt(value => value + 1); return true }} successLabel="Carregado">Tentar novamente</Button>
      </section>
    </section>}
  </main>
}
