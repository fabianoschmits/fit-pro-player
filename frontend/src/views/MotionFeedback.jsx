import { useEffect, useRef, useState } from 'react'
import { Button, Check, Switch } from '../components/ui.jsx'
import { FppActionFeedback, FppProgress, FppSkeleton, FppSpinner, FppStatusAnimation } from '../components/FppFeedback.jsx'
import { ACCENTS } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import AppHeader from '../components/AppHeader.jsx'
import { confirmSheet } from '../sheets.jsx'
import '../motion-showcase.css'

const states = ['idle', 'pressed', 'loading', 'processing', 'success', 'error', 'disabled', 'uploading', 'syncing', 'offline', 'warning']

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
    <AppHeader title={t('Motion & feedback')} subtitle="FIT PRO PLAYER" backTo="/settings" />
    <p className="muted small">{t('Performance · progress · precision')}</p>
    <div className="motion-showcase-controls">
      <label>{t('Theme')}<select aria-label="Tema do showcase" value={theme} onChange={event => setTheme(event.target.value)}><option value="dark">{t('Dark')}</option><option value="light">{t('Light')}</option></select></label>
      <label>{t('Accent color')}<select aria-label="Cor de destaque do showcase" value={accent} onChange={event => setAccent(event.target.value)}>{Object.keys(ACCENTS).map(value => <option key={value}>{value}</option>)}</select></label>
    </div>
    <section aria-label={t('Action states')}>
      <div className="motion-showcase-section-heading"><h2>{t('Action states')}</h2><p className="muted small">{t('Every button keeps its width and announces its result.')}</p></div>
      <div className="motion-showcase-grid">
        {states.map(state => <Sample key={state} dataSample={state} name={state} action={`state=${state}`} animation={state === 'success' ? 'check 360ms' : state === 'error' ? 'retry stays available' : state === 'disabled' ? 'no interaction' : 'energy rail after 160ms'}>
          <Button variant="primary" size="sm" state={state} loadingLabel={t('Saving…')} successLabel={t('Saved')} errorLabel={t('Try again')}>{t('Save')}</Button>
        </Sample>)}
      </div>
    </section>
    <section aria-label={t('Button intents')} className="motion-showcase-grid">
      <Sample name="primary" action="intent=primary · Save" animation="press + rail + check"><Button variant="primary" size="sm" intent="primary" onAction={() => true} successLabel={t('Saved')}>{t('Save')}</Button></Sample>
      <Sample name="quick" action="intent=quick · Copy" animation="instant local check"><Button variant="secondary" size="sm" intent="quick" onAction={() => true} successLabel={t('Done')}>{t('Copy')}</Button></Sample>
      <Sample name="critical" action="intent=critical · Delete" animation="confirmation before commit"><Button variant="danger" size="sm" intent="critical" onClick={() => confirmSheet({ title: t('Delete'), message: t('Confirm'), confirmText: t('Delete'), danger: true, onConfirm: () => { setCriticalCount(value => value + 1); return true } })}>{t('Delete')} <span className="sr-only">{criticalCount}</span></Button></Sample>
    </section>
    <section className="motion-showcase-panel">
      <div className="motion-showcase-label"><strong>{t('Try an action')}</strong><code>onAction → Promise</code><span>loading → success/error → retry</span></div>
      <p className="muted small">{t('Start the action, then confirm the result or simulate an error.')}</p>
      <Button variant="primary" size="sm" data-probe-action onAction={probe} loadingLabel={t('Saving…')} successLabel={t('Saved')} errorLabel={t('Try again')}>{t('Save')}</Button>
      <div className="motion-showcase-controls"><Button size="sm" disabled={!pending} onClick={() => complete(false)}>{t('Confirm result')}</Button><Button size="sm" disabled={!pending} intent="critical" onClick={() => complete(true)}>{t('Simulate error')}</Button></div>
      <p className="muted small">{t('Executions')}: <output data-probe-count>{count}</output></p>
    </section>
    <section className="motion-showcase-panel">
      <div className="motion-showcase-label"><strong>{t('Quick actions')}</strong><code>Check · Switch · intent=quick</code><span>immediate local feedback</span></div>
      <div className="motion-showcase-controls"><Check checked={checked} onChange={setChecked} ariaLabel={t('Complete set')} /><Switch checked={enabled} onChange={setEnabled} ariaLabel={t('Notifications')} /><Button size="sm" intent="quick" onAction={() => true} successLabel={t('Done')}>{t('Copy')}</Button></div>
    </section>
    <section className="motion-showcase-panel">
      <h2>{t('Progress and status')}</h2>
      <FppProgress value={60} label={t('Progress')} />
      <FppProgress label={t('Syncing…')} />
      <FppActionFeedback state="success">{t('Saved on this device')}</FppActionFeedback>
      <FppActionFeedback state="error">{t('Check your connection and try again.')}</FppActionFeedback>
      <FppActionFeedback state="offline">{t('Offline — changes stay on this device until you reconnect.')}</FppActionFeedback>
      <div className="motion-showcase-controls"><FppStatusAnimation state="warning" /><FppSpinner label={t('Loading…')} /></div>
      <FppSkeleton label={t('Loading…')} rows={3} />
    </section>
  </main>
}
