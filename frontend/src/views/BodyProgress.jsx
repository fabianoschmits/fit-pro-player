import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { fmtDate, fmtNum, todayISO } from '../lib/format.js'
import {
  BODY_MEASUREMENT_BY_ID, BODY_MEASUREMENT_PARTS, bodyMeasurementDelta,
  bodyMeasurementHistory, bodyMeasurementWeekKey, currentBodyMeasurementCheckin,
  latestBodyMeasurements, normalizeBodyMeasurementCheckins, removeBodyMeasurement,
  upsertBodyMeasurement,
} from '../lib/body-measurements.js'
import { t } from '../lib/i18n.js'
import { confirmSheet } from '../sheets.jsx'
import Icon from '../components/Icon.jsx'
import LineChart from '../components/LineChart.jsx'
import MeasurementBodyMap from '../components/MeasurementBodyMap.jsx'
import { Button, NumberField, Segmented } from '../components/ui.jsx'
import '../body-progress.css'

const PERIODS = [
  { value: 30, label: '30 dias' },
  { value: 90, label: '3 meses' },
  { value: 180, label: '6 meses' },
  { value: 0, label: t('All') },
]

const MODES = [
  { value: 'checkin', label: 'Check-in' },
  { value: 'history', label: t('History') },
  { value: 'compare', label: 'Comparar' },
]

const formatCm = value => value == null ? '—' : `${fmtNum(value)} cm`
const formatDelta = value => value == null ? 'Sem comparação' : `${value > 0 ? '+' : ''}${fmtNum(value)} cm`

function nextWeekDate(today) {
  const monday = new Date(`${bodyMeasurementWeekKey(today)}T12:00:00`)
  monday.setDate(monday.getDate() + 7)
  return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`
}

function ProgressRing({ value }) {
  const radius = 25
  const circumference = Math.PI * 2 * radius
  return <svg className="bp-progress-ring" viewBox="0 0 64 64" aria-hidden="true">
    <circle cx="32" cy="32" r={radius} />
    <circle className="fill" cx="32" cy="32" r={radius} strokeDasharray={circumference} strokeDashoffset={circumference * (1 - value / 100)} />
  </svg>
}

function PartSelector({ selected, latestValues, weekValues, onSelect, compact = false }) {
  return <div className={`bp-part-selector${compact ? ' compact' : ''}`} role="group" aria-label="Regiões do corpo">
    {BODY_MEASUREMENT_PARTS.map(part => {
      const measured = weekValues[part.id] != null
      const value = measured ? weekValues[part.id] : latestValues[part.id]
      return <button
        type="button"
        key={part.id}
        className={`${selected === part.id ? 'selected' : ''}${measured ? ' measured' : ''}`}
        aria-current={selected === part.id ? 'true' : undefined}
        onClick={() => onSelect(part.id)}
      >
        <span className="bp-part-status" aria-hidden="true">{measured ? <Icon name="check" /> : <span />}</span>
        <span className="bp-part-name">{part.label}</span>
        <strong>{formatCm(value)}</strong>
        <Icon name="chevronRight" className="bp-part-chevron" />
      </button>
    })}
  </div>
}

function CheckinView({ S, checkins, selected, setSelected, period, setPeriod, view, setView }) {
  const update = useStore(state => state.update)
  const reducedMotion = useReducedMotion()
  const today = todayISO()
  const currentCheckin = currentBodyMeasurementCheckin(checkins, today)
  const weekValues = currentCheckin?.values || {}
  const latestValues = latestBodyMeasurements(checkins)
  const part = BODY_MEASUREMENT_BY_ID[selected]
  const history = bodyMeasurementHistory(checkins, selected)
  const trend = bodyMeasurementDelta(checkins, selected, period)
  const pair = part.pair ? BODY_MEASUREMENT_PARTS.filter(item => item.pair === part.pair) : []
  const [draft, setDraft] = useState(null)
  const [goalDraft, setGoalDraft] = useState(null)
  const [savedPart, setSavedPart] = useState(null)
  const goal = S.bodyMeasurementGoals?.[selected] ?? null

  useEffect(() => setDraft(weekValues[selected] ?? null), [selected, currentCheckin?.week, weekValues[selected]])
  useEffect(() => setGoalDraft(goal), [selected, goal])
  useEffect(() => {
    if (!savedPart) return undefined
    const timeout = window.setTimeout(() => setSavedPart(null), 1600)
    return () => window.clearTimeout(timeout)
  }, [savedPart])

  const selectPart = id => {
    setSelected(id)
    const next = BODY_MEASUREMENT_BY_ID[id]
    if (next?.view) setView(next.view)
  }

  const saveMeasurement = event => {
    event.preventDefault()
    if (!(draft > 0) || draft > 400) return
    update(state => { state.bodyMeasurements = upsertBodyMeasurement(state.bodyMeasurements, { date: today, partId: selected, value: draft }) })
    setSavedPart(selected)
    useUI.getState().toast(`${part.label}: ${formatCm(draft)} · ${t('Saved')}`)
  }

  const saveGoal = () => {
    update(state => {
      state.bodyMeasurementGoals = { ...(state.bodyMeasurementGoals || {}) }
      if (goalDraft > 0 && goalDraft <= 400) state.bodyMeasurementGoals[selected] = Math.round(goalDraft * 10) / 10
      else delete state.bodyMeasurementGoals[selected]
    })
    useUI.getState().toast(goalDraft > 0 ? 'Meta salva' : 'Meta removida')
  }

  const currentValue = latestValues[selected]
  const goalDistance = goal != null && currentValue != null ? Math.round(Math.abs(goal - currentValue) * 10) / 10 : null
  const points = history.map(point => ({ t: point.t, y: point.value, d: point.date }))

  return <div className="bp-workspace">
    <section className="card bp-map-card" aria-labelledby="bp-map-title">
      <div className="bp-card-head">
        <div><span className="bp-eyebrow">Mapa corporal</span><h2 id="bp-map-title">Escolha uma região</h2></div>
        <Segmented className="seg-inline" value={view} onChange={setView} options={[{ value: 'front', label: 'Frente' }, { value: 'back', label: 'Costas' }]} />
      </div>
      <MeasurementBodyMap body={S.body} view={view} selected={selected} latestValues={latestValues} weekValues={weekValues} onSelect={setSelected} />
      <div className="bp-map-legend"><span><i className="current" />Medido esta semana</span><span><i className="known" />Último valor</span><span><i />Pendente</span></div>
      <p className="bp-map-help"><Icon name="info" /> Toque nos pontos do corpo ou escolha uma região na lista.</p>
    </section>

    <div className="bp-workspace-side">
      <section className="card bp-editor-card" aria-live="polite">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={selected}
            initial={reducedMotion ? false : { opacity: 0, y: 6, filter: 'blur(3px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -3, filter: 'blur(2px)' }}
            transition={{ duration: reducedMotion ? 0 : 0.18, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <div className="bp-editor-heading">
              <div><span className="bp-eyebrow">Medida selecionada</span><h2>{part.label}</h2></div>
              <span className={`bp-state-pill${weekValues[selected] != null ? ' complete' : ''}`}>
                {weekValues[selected] != null ? <><Icon name="check" /> Feita</> : 'Pendente'}
              </span>
            </div>

            {pair.length === 2 && <Segmented className="bp-side-choice" value={selected} onChange={setSelected} options={pair.map(item => ({ value: item.id, label: item.side === 'left' ? 'Esquerdo' : 'Direito' }))} />}

            <div className="bp-reading-row">
              <div><span>Atual</span><strong>{formatCm(currentValue)}</strong></div>
              <div><span>Variação</span><strong>{formatDelta(trend.delta)}</strong></div>
              <div><span>Meta</span><strong>{formatCm(goal)}</strong></div>
            </div>

            <form className="bp-measure-form" onSubmit={saveMeasurement}>
              <label htmlFor="body-measurement-value">Medida desta semana</label>
              <div className="bp-measure-input">
                <NumberField id="body-measurement-value" value={draft} onChange={setDraft} nullable decimal aria-label={`Medida de ${part.label} em centímetros`} />
                <span>cm</span>
              </div>
              <Button type="submit" variant="primary" icon={savedPart === selected ? 'check' : 'ruler'} disabled={!(draft > 0) || draft > 400}>
                {savedPart === selected ? 'Medida salva' : weekValues[selected] != null ? 'Atualizar medida' : 'Salvar medida'}
              </Button>
            </form>

            <div className="bp-guide"><Icon name="info" /><p><strong>Como medir</strong><span>{part.guide}</span></p></div>

            <div className="bp-goal-row">
              <div><strong>Meta para {part.shortLabel.toLowerCase()}</strong><span>{goalDistance != null ? `${formatCm(goalDistance)} de distância` : 'Opcional · ajuda a interpretar a evolução'}</span></div>
              <div className="bp-goal-control"><NumberField value={goalDraft} onChange={setGoalDraft} nullable decimal aria-label={`Meta para ${part.label}`} /><span>cm</span><Button size="sm" onClick={saveGoal}>{t('Save')}</Button></div>
            </div>
          </motion.div>
        </AnimatePresence>

        <div className="bp-mini-history">
          <div className="bp-section-head"><div><span className="bp-eyebrow">Evolução</span><h3>{part.label}</h3></div><Segmented className="seg-inline" value={period} onChange={setPeriod} options={PERIODS} /></div>
          <LineChart points={points} h={138} unit="cm" goal={goal} />
        </div>
      </section>

      <section className="card bp-parts-card">
        <div className="bp-section-head"><div><span className="bp-eyebrow">Check-in atual</span><h2>Todas as medidas</h2></div><span>{Object.keys(weekValues).length}/{BODY_MEASUREMENT_PARTS.length}</span></div>
        <PartSelector selected={selected} latestValues={latestValues} weekValues={weekValues} onSelect={selectPart} />
      </section>
    </div>
  </div>
}

function HistoryView({ checkins, selected, setSelected, period, setPeriod }) {
  const update = useStore(state => state.update)
  const part = BODY_MEASUREMENT_BY_ID[selected]
  const latestValues = latestBodyMeasurements(checkins)
  const history = bodyMeasurementHistory(checkins, selected)
  const trend = bodyMeasurementDelta(checkins, selected, period)
  const goal = useStore(state => state.S.bodyMeasurementGoals?.[selected] ?? null)
  const points = history.map(point => ({ t: point.t, y: point.value, d: point.date }))

  const remove = point => confirmSheet({
    title: `Excluir medida de ${fmtDate(point.date)}?`,
    message: 'Esta medida será removida do histórico corporal.',
    confirmText: t('Delete'),
    danger: true,
    onConfirm: () => {
      update(state => { state.bodyMeasurements = removeBodyMeasurement(state.bodyMeasurements, point.id, selected) })
      useUI.getState().toast('Medida excluída')
    },
  })

  return <div className="bp-history-layout">
    <section className="card bp-history-chart-card">
      <div className="bp-section-head responsive"><div><span className="bp-eyebrow">Histórico por região</span><h2>{part.label}</h2></div><Segmented className="seg-inline" value={period} onChange={setPeriod} options={PERIODS} /></div>
      <div className="bp-history-metrics">
        <div><span>Atual</span><strong>{formatCm(trend.current?.value)}</strong></div>
        <div><span>Primeira</span><strong>{formatCm(history[0]?.value)}</strong></div>
        <div><span>No período</span><strong>{formatDelta(trend.delta)}</strong></div>
        <div><span>Registros</span><strong>{history.length}</strong></div>
      </div>
      <LineChart points={points} h={210} unit="cm" goal={goal} />
    </section>
    <section className="card bp-history-parts"><div className="bp-section-head"><div><span className="bp-eyebrow">Regiões</span><h2>Escolha para analisar</h2></div></div><PartSelector compact selected={selected} latestValues={latestValues} weekValues={{}} onSelect={setSelected} /></section>
    <section className="card bp-timeline-card">
      <div className="bp-section-head"><div><span className="bp-eyebrow">Linha do tempo</span><h2>{history.length ? `${history.length} registros` : 'Nenhum registro ainda'}</h2></div></div>
      {history.length ? <div className="bp-timeline">{[...history].reverse().map((point, index, reversed) => {
        const previous = reversed[index + 1]
        const delta = previous ? Math.round((point.value - previous.value) * 10) / 10 : null
        return <div key={point.id} className="bp-timeline-row"><span className="bp-timeline-dot" /><div><strong>{fmtDate(point.date, true)}</strong><span>{delta == null ? 'Primeiro registro' : `${formatDelta(delta)} desde a medição anterior`}</span></div><b>{formatCm(point.value)}</b><button type="button" onClick={() => remove(point)} aria-label={`Excluir medida de ${fmtDate(point.date)}`}><Icon name="trash" /></button></div>
      })}</div> : <div className="bp-empty"><Icon name="chartLine" /><strong>Seu histórico começa no primeiro check-in</strong><span>Registre uma medida para acompanhar a evolução ao longo das semanas.</span></div>}
    </section>
  </div>
}

function CompareView({ checkins }) {
  const [fromId, setFromId] = useState(checkins.at(-2)?.id || checkins[0]?.id || '')
  const [toId, setToId] = useState(checkins.at(-1)?.id || '')
  const from = checkins.find(item => item.id === fromId) || checkins[0]
  const to = checkins.find(item => item.id === toId) || checkins.at(-1)

  useEffect(() => {
    if (!checkins.some(item => item.id === fromId)) setFromId(checkins.at(-2)?.id || checkins[0]?.id || '')
    if (!checkins.some(item => item.id === toId)) setToId(checkins.at(-1)?.id || '')
  }, [checkins, fromId, toId])

  if (checkins.length < 2) return <section className="card bp-empty large"><Icon name="chartLine" /><strong>Faça pelo menos dois check-ins</strong><span>Quando houver duas semanas registradas, você poderá comparar todas as regiões lado a lado.</span></section>

  const fromValues = latestBodyMeasurements(checkins, from.date)
  const toValues = latestBodyMeasurements(checkins, to.date)
  const rows = BODY_MEASUREMENT_PARTS.filter(part => fromValues[part.id] != null || toValues[part.id] != null)

  return <div className="bp-compare-layout">
    <section className="card bp-compare-controls">
      <div className="bp-section-head"><div><span className="bp-eyebrow">Comparação corporal</span><h2>Escolha dois momentos</h2></div></div>
      <div className="bp-date-selectors">
        <label><span>Início</span><select value={from.id} onChange={event => setFromId(event.target.value)}>{checkins.map(item => <option key={item.id} value={item.id}>{fmtDate(item.date, true)}</option>)}</select></label>
        <Icon name="chevronRight" />
        <label><span>Atual</span><select value={to.id} onChange={event => setToId(event.target.value)}>{checkins.map(item => <option key={item.id} value={item.id}>{fmtDate(item.date, true)}</option>)}</select></label>
      </div>
    </section>
    <section className="card bp-compare-table-card">
      <div className="bp-compare-table" role="table" aria-label="Comparação das medidas corporais">
        <div className="bp-compare-row header" role="row"><span role="columnheader">Região</span><span role="columnheader">Início</span><span role="columnheader">Atual</span><span role="columnheader">Variação</span></div>
        {rows.map(part => {
          const before = fromValues[part.id]
          const after = toValues[part.id]
          const delta = before != null && after != null ? Math.round((after - before) * 10) / 10 : null
          return <div className="bp-compare-row" role="row" key={part.id}><strong role="cell">{part.label}</strong><span role="cell">{formatCm(before)}</span><span role="cell">{formatCm(after)}</span><b role="cell">{formatDelta(delta)}</b></div>
        })}
      </div>
      <p className="bp-neutral-note"><Icon name="info" /> Aumento ou redução não é marcado como bom ou ruim: o significado depende da sua meta para cada região.</p>
    </section>
  </div>
}

export default function BodyProgress() {
  const navigate = useNavigate()
  const S = useStore(state => state.S)
  const [mode, setMode] = useState('checkin')
  const [view, setView] = useState('front')
  const [selected, setSelected] = useState('chest')
  const [period, setPeriod] = useState(90)
  const checkins = useMemo(() => normalizeBodyMeasurementCheckins(S.bodyMeasurements), [S.bodyMeasurements])
  const current = currentBodyMeasurementCheckin(checkins, todayISO())
  const done = Object.keys(current?.values || {}).length
  const total = BODY_MEASUREMENT_PARTS.length
  const percent = Math.round(done / total * 100)
  const nextPending = BODY_MEASUREMENT_PARTS.find(part => current?.values?.[part.id] == null)

  useEffect(() => {
    document.body.classList.add('body-progress-mode')
    return () => document.body.classList.remove('body-progress-mode')
  }, [])

  const continueCheckin = () => {
    if (!nextPending) return
    setSelected(nextPending.id)
    setView(nextPending.view)
    setMode('checkin')
    window.requestAnimationFrame(() => document.getElementById('body-measurement-value')?.focus())
  }

  return <main className="body-progress-view">
    <header className="bp-header">
      <button className="iconbtn" type="button" onClick={() => navigate(-1)} aria-label={t('Back')}><Icon name="chevronLeft" /></button>
      <div><h1>Evolução corporal</h1><p>Medidas semanais, metas e progresso em um só lugar.</p></div>
      <button className="bp-header-history" type="button" onClick={() => setMode('history')}><Icon name="history" /><span>{t('History')}</span></button>
    </header>

    <section className={`card bp-week-card${done === total ? ' complete' : ''}`}>
      <ProgressRing value={percent} />
      <div className="bp-week-copy"><span className="bp-eyebrow">Check-in desta semana</span><strong>{done === total ? 'Tudo registrado' : `${done} de ${total} medidas`}</strong><p>{done === total ? `Próximo check-in a partir de ${fmtDate(nextWeekDate(todayISO()))}.` : done ? `${total - done} regiões ainda estão pendentes.` : 'Comece por uma região e use sempre o mesmo ponto de referência.'}</p></div>
      {nextPending ? <Button size="sm" variant="tinted" onClick={continueCheckin}>{done ? 'Continuar' : 'Começar'}</Button> : <span className="bp-complete-icon"><Icon name="check" /></span>}
    </section>

    <Segmented className="bp-mode-tabs" value={mode} onChange={setMode} options={MODES} />

    {mode === 'checkin' && <CheckinView S={S} checkins={checkins} selected={selected} setSelected={setSelected} period={period} setPeriod={setPeriod} view={view} setView={setView} />}
    {mode === 'history' && <HistoryView checkins={checkins} selected={selected} setSelected={setSelected} period={period} setPeriod={setPeriod} />}
    {mode === 'compare' && <CompareView checkins={checkins} />}
  </main>
}
