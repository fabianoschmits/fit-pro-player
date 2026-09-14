import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { fmtDate, fmtNum, todayISO } from '../lib/format.js'
import {
  BODY_MEASUREMENT_BY_ID, BODY_MEASUREMENT_PARTS, BODY_MEASUREMENT_PROTOCOL,
  bodyMeasurementDelta, bodyMeasurementHistoryInPeriod,
  bodyMeasurementSnapshots, bodyMeasurementWeekKey, currentBodyMeasurementCheckin,
  interpolateBodyMeasurementSnapshot, latestBodyMeasurements,
  normalizeBodyMeasurementCheckins, removeBodyMeasurement, upsertBodyMeasurement,
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
  { value: 365, label: '1 ano' },
  { value: 0, label: t('All') },
]

const MODES = [
  { value: 'checkin', label: 'Check-in' },
  { value: 'history', label: 'Evolução' },
  { value: 'compare', label: 'Comparar' },
]

const CHECKIN_HISTORY_PAGE_SIZE = 6
const CHECKIN_DETAILS_MOTION = {
  hidden: instant => instant ? { opacity: 1, y: 0, filter: 'blur(0px)' } : { opacity: 0, y: -6, filter: 'blur(2px)' },
  visible: instant => ({ opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: instant ? 0 : 0.18, ease: [0.2, 0.8, 0.2, 1] } }),
  exit: instant => ({ opacity: 0, y: instant ? 0 : -3, filter: instant ? 'blur(0px)' : 'blur(2px)', transition: { duration: instant ? 0 : 0.18, ease: [0.2, 0.8, 0.2, 1] } }),
}

const formatCm = value => value == null ? '—' : `${fmtNum(value)} cm`
const formatDelta = value => value == null ? 'Sem comparação' : `${value > 0 ? '+' : ''}${fmtNum(value)} cm`
const timestampOf = date => new Date(`${date}T12:00:00`).getTime()

function nextWeekDate(today) {
  const monday = new Date(`${bodyMeasurementWeekKey(today)}T12:00:00`)
  monday.setDate(monday.getDate() + 7)
  return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`
}

function weightAtDate(bodyweight, date) {
  return (Array.isArray(bodyweight) ? bodyweight : []).reduce((closest, entry) => {
    if (!entry?.d || !(entry.w > 0) || entry.d > date) return closest
    return !closest || entry.d > closest.d || (entry.d === closest.d && (entry.t || 0) > (closest.t || 0)) ? entry : closest
  }, null)
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
  return <div className={`bp-part-selector${compact ? ' compact' : ''}`} role="group" aria-label="Circunferências do corpo">
    {BODY_MEASUREMENT_PARTS.map(part => {
      const measured = weekValues[part.id] != null
      const value = measured ? weekValues[part.id] : latestValues[part.id]
      return <button
        type="button"
        key={part.id}
        className={`${selected === part.id ? 'selected' : ''}${measured ? ' measured' : ''}`}
        aria-label={`${part.circumferenceLabel}: ${formatCm(value)}`}
        aria-current={selected === part.id ? 'true' : undefined}
        onClick={() => onSelect(part.id)}
      >
        <span className="bp-part-status" aria-hidden="true">{measured ? <Icon name="check" /> : <span />}</span>
        <span className="bp-part-name">{part.shortLabel}</span>
        <strong>{formatCm(value)}</strong>
        <Icon name="chevronRight" className="bp-part-chevron" />
      </button>
    })}
  </div>
}

function BodyHistoryScrubber({ snapshots, value, onChange, onScrubbingChange, weight, unit = 'kg' }) {
  const railRef = useRef(null)
  const [railWidth, setRailWidth] = useState(0)
  const times = snapshots.map(item => timestampOf(item.date))
  const first = times[0]
  const last = times.at(-1)
  const safeValue = Math.min(last, Math.max(first, Number(value) || last))
  const nearestIndex = times.reduce((best, time, index) => Math.abs(time - safeValue) < Math.abs(times[best] - safeValue) ? index : best, 0)
  const active = snapshots[nearestIndex]
  const progress = last === first ? 1 : (safeValue - first) / (last - first)
  const thumbX = railWidth * progress
  const bubbleX = Math.max(44, Math.min(Math.max(44, railWidth - 44), thumbX))

  useLayoutEffect(() => {
    const rail = railRef.current
    if (!rail) return undefined
    const measure = () => setRailWidth(rail.getBoundingClientRect().width)
    measure()
    if (typeof ResizeObserver !== 'function') return undefined
    const observer = new ResizeObserver(measure)
    observer.observe(rail)
    return () => observer.disconnect()
  }, [])

  if (snapshots.length === 1) return <div className="bp-scrubber-single">
    <Icon name="calendar" />
    <span><strong>{fmtDate(active.date, true)}</strong><small>O corpo começará a mudar quando houver outro check-in.</small></span>
  </div>

  const finish = raw => {
    const closest = times.reduce((best, time, index) => Math.abs(time - raw) < Math.abs(times[best] - raw) ? index : best, 0)
    onChange(times[closest])
    onScrubbingChange(false)
  }
  const moveByKeyboard = event => {
    let index = null
    if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') index = Math.max(0, nearestIndex - 1)
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') index = Math.min(times.length - 1, nearestIndex + 1)
    if (event.key === 'Home') index = 0
    if (event.key === 'End') index = times.length - 1
    if (index == null) return
    event.preventDefault()
    onScrubbingChange(true)
    onChange(times[index])
    window.requestAnimationFrame(() => onScrubbingChange(false))
  }

  return <div className="bp-scrubber">
    <div className="bp-scrubber-heading">
      <div><span className="bp-eyebrow">Corpo nesta data</span><strong>{fmtDate(active.date, true)}</strong></div>
      <div className="bp-scrubber-reading"><span>{nearestIndex + 1} de {snapshots.length}</span>{weight && <b>{fmtNum(weight.w)} {unit}</b>}</div>
    </div>
    <div className="bp-scrubber-control" ref={railRef}>
      <input
        type="range"
        min={first}
        max={last}
        step={60 * 60 * 1000}
        value={safeValue}
        aria-label="Momento da evolução corporal"
        aria-valuetext={`${fmtDate(active.date, true)}, registro ${nearestIndex + 1} de ${snapshots.length}`}
        onChange={event => onChange(Number(event.target.value))}
        onKeyDown={moveByKeyboard}
        onPointerDown={() => onScrubbingChange(true)}
        onPointerUp={event => finish(Number(event.currentTarget.value))}
        onPointerCancel={event => finish(Number(event.currentTarget.value))}
        onBlur={event => finish(Number(event.currentTarget.value))}
      />
      <div className="bp-scrubber-rail" aria-hidden="true">
        <span className="bp-scrubber-fill" style={{ transform: `scaleX(${progress})` }} />
        {times.map((time, index) => <i key={snapshots[index].id} className={index <= nearestIndex ? 'past' : ''} style={{ left: `${(time - first) / (last - first) * 100}%` }} />)}
        <span className="bp-scrubber-thumb" style={{ transform: `translate3d(${thumbX}px,0,0) translateX(-50%)` }} />
        <span className="bp-scrubber-bubble" style={{ transform: `translate3d(${bubbleX}px,0,0) translateX(-50%)` }}>{fmtDate(active.date)}</span>
      </div>
    </div>
    <div className="bp-scrubber-ends"><span>{fmtDate(snapshots[0].date)}</span><span>Arraste para rever</span><span>{fmtDate(snapshots.at(-1).date)}</span></div>
  </div>
}

function CheckinView({ S, checkins, selected, setSelected, period, setPeriod, view, setView }) {
  const update = useStore(state => state.update)
  const reducedMotion = useReducedMotion()
  const today = todayISO()
  const currentCheckin = currentBodyMeasurementCheckin(checkins, today)
  const weekValues = currentCheckin?.values || {}
  const latestValues = latestBodyMeasurements(checkins)
  const baselineValues = bodyMeasurementSnapshots(checkins)[0]?.values || {}
  const part = BODY_MEASUREMENT_BY_ID[selected]
  const history = bodyMeasurementHistoryInPeriod(checkins, selected, period)
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

  const selectPart = id => setSelected(id)
  const saveMeasurement = event => {
    event.preventDefault()
    if (!(draft > 0) || draft > 400) return
    update(state => { state.bodyMeasurements = upsertBodyMeasurement(state.bodyMeasurements, { date: today, partId: selected, value: draft }) })
    setSavedPart(selected)
    useUI.getState().toast(`${part.circumferenceLabel}: ${formatCm(draft)} · ${t('Saved')}`)
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
        <div><span className="bp-eyebrow">Guia da fita métrica</span><h2 id="bp-map-title">Circunferências corporais</h2></div>
        <Segmented className="seg-inline" value={view} onChange={setView} options={[{ value: 'front', label: 'Frente' }, { value: 'back', label: 'Costas' }]} />
      </div>
      <MeasurementBodyMap body={S.body} view={view} selected={selected} latestValues={latestValues} weekValues={weekValues} shapeValues={latestValues} baselineValues={baselineValues} onSelect={selectPart} />
      <div className="bp-map-legend"><span><i className="selected" />Região selecionada</span><span><i className="current" />Nesta semana</span><span><i className="known" />Valor anterior</span><span><i />Sem registro</span></div>
      <p className="bp-map-help"><Icon name="info" /> Os músculos destacados mostram a região selecionada; o anel indica onde a fita deve contornar o corpo. Toque em outra região para medir.</p>
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
              <div><span className="bp-eyebrow">Medida selecionada</span><h2>{part.circumferenceLabel}</h2></div>
              <span className={`bp-state-pill${weekValues[selected] != null ? ' complete' : ''}`}>
                {weekValues[selected] != null ? <><Icon name="check" /> Feita</> : 'Pendente'}
              </span>
            </div>

            {pair.length === 2 && <Segmented className="bp-side-choice" value={selected} onChange={setSelected} options={pair.map(item => ({ value: item.id, label: item.side === 'left' ? 'Esquerdo' : 'Direito' }))} />}

            <div className="bp-reading-row">
              <div><span>Última medida</span><strong>{formatCm(currentValue)}</strong></div>
              <div><span>Variação</span><strong>{formatDelta(trend.delta)}</strong></div>
              <div><span>Meta</span><strong>{formatCm(goal)}</strong></div>
            </div>

            <form className="bp-measure-form" onSubmit={saveMeasurement}>
              <label htmlFor="body-measurement-value">Circunferência desta semana</label>
              <div className="bp-measure-input">
                <NumberField id="body-measurement-value" value={draft} onChange={setDraft} nullable decimal aria-label={`${part.circumferenceLabel} em centímetros`} />
                <span>cm</span>
              </div>
              <Button type="submit" variant="primary" icon={savedPart === selected ? 'check' : 'ruler'} disabled={!(draft > 0) || draft > 400}>
                {savedPart === selected ? 'Circunferência salva' : weekValues[selected] != null ? 'Atualizar medida' : 'Salvar medida'}
              </Button>
            </form>

            <div className="bp-guide"><Icon name="info" /><p><strong>Como medir esta circunferência</strong><span>{part.guide}</span></p></div>
            <p className="bp-protocol">{BODY_MEASUREMENT_PROTOCOL}</p>

            <div className="bp-goal-row">
              <div><strong>Meta para {part.shortLabel.toLowerCase()}</strong><span>{goalDistance != null ? `${formatCm(goalDistance)} de distância` : 'Opcional · ajuda a interpretar a evolução'}</span></div>
              <div className="bp-goal-control"><NumberField value={goalDraft} onChange={setGoalDraft} nullable decimal aria-label={`Meta para ${part.circumferenceLabel}`} /><span>cm</span><Button size="sm" onClick={saveGoal}>{t('Save')}</Button></div>
            </div>
          </motion.div>
        </AnimatePresence>

        <div className="bp-mini-history">
          <div className="bp-section-head responsive"><div><span className="bp-eyebrow">Histórico em centímetros</span><h3>{part.circumferenceLabel}</h3></div><Segmented className="seg-inline" value={period} onChange={setPeriod} options={PERIODS} /></div>
          <LineChart points={points} h={138} unit="cm" goal={goal} />
        </div>
      </section>

      <section className="card bp-parts-card">
        <div className="bp-section-head"><div><span className="bp-eyebrow">Check-in atual</span><h2>Todas as circunferências</h2></div><span>{Object.keys(weekValues).length}/{BODY_MEASUREMENT_PARTS.length}</span></div>
        <PartSelector selected={selected} latestValues={latestValues} weekValues={weekValues} onSelect={selectPart} />
      </section>
    </div>
  </div>
}

function EvolutionView({ S, checkins, selected, setSelected, period, setPeriod, view, setView, focusRequest }) {
  const update = useStore(state => state.update)
  const snapshots = useMemo(() => bodyMeasurementSnapshots(checkins), [checkins])
  const firstTime = snapshots.length ? timestampOf(snapshots[0].date) : null
  const lastTime = snapshots.length ? timestampOf(snapshots.at(-1).date) : null
  const initialTime = lastTime == null || focusRequest?.timestamp == null
    ? lastTime : Math.min(lastTime, Math.max(firstTime, focusRequest.timestamp))
  const [scrubTime, setScrubTime] = useState(initialTime)
  const [scrubbing, setScrubbing] = useState(false)

  useEffect(() => {
    if (lastTime == null) return
    setScrubTime(current => current == null ? lastTime : Math.min(lastTime, Math.max(firstTime, current)))
  }, [firstTime, lastTime])

  useLayoutEffect(() => {
    if (lastTime == null || focusRequest?.timestamp == null) return
    setScrubTime(Math.min(lastTime, Math.max(firstTime, focusRequest.timestamp)))
    setScrubbing(false)
  }, [firstTime, focusRequest?.nonce, focusRequest?.timestamp, lastTime])

  if (!snapshots.length) return <section className="card bp-empty large"><Icon name="ruler" /><strong>Sua evolução começa no primeiro check-in</strong><span>Registre uma circunferência para criar a primeira forma corporal e liberar a linha do tempo.</span></section>

  const interpolation = interpolateBodyMeasurementSnapshot(checkins, scrubTime)
  const active = interpolation.nearest
  const activeTime = timestampOf(active.date)
  const baselineValues = snapshots[0].values
  const visibleHistory = bodyMeasurementHistoryInPeriod(checkins, selected, period, activeTime)
  const part = BODY_MEASUREMENT_BY_ID[selected]
  const selectedValue = active.values[selected]
  const sourceDate = active.sources[selected]
  const direct = active.directValues[selected] != null
  const firstValue = visibleHistory[0]?.value
  const delta = selectedValue != null && firstValue != null && sourceDate !== visibleHistory[0]?.date
    ? Math.round((selectedValue - firstValue) * 10) / 10 : null
  const points = visibleHistory.map(point => ({
    t: point.t, y: point.value, d: point.date, selected: point.date === sourceDate,
  }))
  const weight = weightAtDate(S.bodyweight, active.date)

  const selectPart = id => setSelected(id)
  const remove = point => confirmSheet({
    title: `Excluir medida de ${fmtDate(point.date)}?`,
    message: 'Esta circunferência será removida do histórico corporal.',
    confirmText: t('Delete'),
    danger: true,
    onConfirm: () => {
      update(state => { state.bodyMeasurements = removeBodyMeasurement(state.bodyMeasurements, point.id, selected) })
      useUI.getState().toast('Circunferência excluída')
    },
  })

  return <div className="bp-evolution-layout">
    <section id="bp-evolution-map" className="card bp-evolution-map-card" aria-labelledby="bp-evolution-map-title" tabIndex="-1">
      <div className="bp-card-head">
        <div><span className="bp-eyebrow">Forma corporal relativa</span><h2 id="bp-evolution-map-title">Evolução no tempo</h2></div>
        <Segmented className="seg-inline" value={view} onChange={setView} options={[{ value: 'front', label: 'Frente' }, { value: 'back', label: 'Costas' }]} />
      </div>
      <MeasurementBodyMap
        body={S.body} view={view} selected={selected} latestValues={active.values}
        weekValues={active.directValues} directValues={active.directValues}
        shapeValues={interpolation.values} baselineValues={baselineValues}
        instant={scrubbing} onSelect={selectPart}
      />
      <BodyHistoryScrubber snapshots={snapshots} value={scrubTime} onChange={setScrubTime} onScrubbingChange={setScrubbing} weight={weight} unit={S.unit} />
      <p className="bp-relative-note"><Icon name="info" /> Representação proporcional das circunferências registradas. Ela mostra a mudança relativa e não reconstrói nem diagnostica a anatomia real.</p>
    </section>

    <div className="bp-evolution-side">
      <section className="card bp-history-chart-card">
        <div className="bp-section-head responsive">
          <div><span className="bp-eyebrow">Região analisada</span><h2>{part.circumferenceLabel}</h2><small>{direct ? `Medida diretamente em ${fmtDate(active.date)}` : sourceDate ? `Último valor disponível: ${fmtDate(sourceDate)}` : 'Sem medida até esta data'}</small></div>
          <Segmented className="seg-inline" value={period} onChange={setPeriod} options={PERIODS} />
        </div>
        <div className="bp-history-metrics">
          <div><span>Nesta data</span><strong>{formatCm(selectedValue)}</strong></div>
          <div><span>Início do período</span><strong>{formatCm(firstValue)}</strong></div>
          <div><span>Variação</span><strong>{formatDelta(delta)}</strong></div>
          <div><span>Medições reais</span><strong>{visibleHistory.length}</strong></div>
        </div>
        <LineChart points={points} h={210} unit="cm" goal={S.bodyMeasurementGoals?.[selected] ?? null} selectedDate={sourceDate} />
      </section>

      <section className="card bp-history-parts">
        <div className="bp-section-head"><div><span className="bp-eyebrow">Circunferências</span><h2>Escolha o que analisar</h2></div></div>
        <PartSelector compact selected={selected} latestValues={active.values} weekValues={active.directValues} onSelect={selectPart} />
      </section>

      <section className="card bp-timeline-card">
        <div className="bp-section-head"><div><span className="bp-eyebrow">Medições reais no período</span><h2>{visibleHistory.length ? `${visibleHistory.length} registros` : 'Nenhum registro'}</h2></div></div>
        {visibleHistory.length ? <div className="bp-timeline">{[...visibleHistory].reverse().map((point, index, reversed) => {
          const previous = reversed[index + 1]
          const pointDelta = previous ? Math.round((point.value - previous.value) * 10) / 10 : null
          return <div key={point.id} className={`bp-timeline-row${point.date === sourceDate ? ' selected' : ''}`}><span className="bp-timeline-dot" /><div><strong>{fmtDate(point.date, true)}</strong><span>{pointDelta == null ? 'Primeiro registro deste período' : `${formatDelta(pointDelta)} desde a medição anterior`}</span></div><b>{formatCm(point.value)}</b><button type="button" onClick={() => remove(point)} aria-label={`Excluir circunferência de ${fmtDate(point.date)}`}><Icon name="trash" /></button></div>
        })}</div> : <div className="bp-empty"><Icon name="chartLine" /><strong>Sem medição desta região</strong><span>Escolha outra circunferência ou volte para o check-in.</span></div>}
      </section>
    </div>
  </div>
}

function CheckinHistory({ S, checkins, onOpenEvolution }) {
  const reducedMotion = useReducedMotion()
  const today = todayISO()
  const currentWeek = bodyMeasurementWeekKey(today)
  const [expandedWeek, setExpandedWeek] = useState(null)
  const [visibleCount, setVisibleCount] = useState(CHECKIN_HISTORY_PAGE_SIZE)
  const [instantToggle, setInstantToggle] = useState(false)
  const pastCheckins = useMemo(() => checkins
    .filter(item => item.date <= today && item.week !== currentWeek)
    .sort((a, b) => b.date.localeCompare(a.date)), [checkins, currentWeek, today])
  const deltasByWeek = useMemo(() => {
    const previousValues = {}
    const result = {}
    checkins.forEach(item => {
      const deltas = {}
      BODY_MEASUREMENT_PARTS.forEach(part => {
        const value = item.values[part.id]
        if (value == null) return
        const previous = previousValues[part.id]
        deltas[part.id] = previous == null ? null : Math.round((value - previous) * 10) / 10
        previousValues[part.id] = value
      })
      result[item.week] = deltas
    })
    return result
  }, [checkins])

  useEffect(() => {
    if (expandedWeek && !pastCheckins.some(item => item.week === expandedWeek)) setExpandedWeek(null)
  }, [expandedWeek, pastCheckins])

  const visibleCheckins = pastCheckins.slice(0, visibleCount)
  const remaining = Math.max(0, pastCheckins.length - visibleCount)
  const toggle = (event, week) => {
    setInstantToggle(Boolean(reducedMotion) || event.detail === 0)
    setExpandedWeek(current => current === week ? null : week)
  }
  const deltaLabel = delta => delta == null
    ? 'Primeira medição'
    : delta === 0 ? 'Sem alteração' : `${formatDelta(delta)} desde o registro anterior`

  return <section className="card bp-checkin-history" aria-labelledby="bp-checkin-history-title">
    <div className="bp-checkin-history-head">
      <div><span className="bp-eyebrow">Histórico de medidas</span><h2 id="bp-checkin-history-title">Check-ins anteriores</h2><p>Abra uma semana para rever todas as circunferências registradas.</p></div>
      <span>{pastCheckins.length} {pastCheckins.length === 1 ? 'registro' : 'registros'}</span>
    </div>

    {pastCheckins.length ? <>
      <ol className="bp-checkin-list">
        {visibleCheckins.map(item => {
          const expanded = expandedWeek === item.week
          const count = Object.keys(item.values).length
          const panelId = `bp-checkin-${item.week}`
          const triggerId = `${panelId}-trigger`
          const directWeight = item.weight != null
          const weight = directWeight ? { w: item.weight } : weightAtDate(S.bodyweight, item.date)
          const deltas = deltasByWeek[item.week] || {}
          return <motion.li
            className={`bp-checkin-item${expanded ? ' expanded' : ''}${instantToggle ? ' instant' : ''}`}
            data-checkin-date={item.date}
            layout={!instantToggle && !reducedMotion ? 'position' : false}
            transition={{ layout: { duration: 0.18, ease: [0.2, 0.8, 0.2, 1] } }}
            key={item.week}
          >
            <button
              id={triggerId}
              className="bp-checkin-summary"
              type="button"
              aria-expanded={expanded}
              aria-controls={panelId}
              onClick={event => toggle(event, item.week)}
            >
              <span className="sr-only">{expanded ? 'Recolher' : 'Expandir'} detalhes do check-in de </span>
              <span className="bp-checkin-date"><strong>{fmtDate(item.date, true)}</strong><small>{weight ? `${directWeight ? 'Peso do check-in' : 'Último peso'} · ${fmtNum(weight.w)} ${S.unit || 'kg'}` : 'Peso não registrado'}</small></span>
              <span className={`bp-checkin-status${count === BODY_MEASUREMENT_PARTS.length ? ' complete' : ''}`}>{count === BODY_MEASUREMENT_PARTS.length ? <Icon name="check" /> : null}{count === BODY_MEASUREMENT_PARTS.length ? `${count}/${BODY_MEASUREMENT_PARTS.length} medidas` : `Parcial · ${count}/${BODY_MEASUREMENT_PARTS.length}`}</span>
              <span className="bp-checkin-quick" aria-hidden="true">
                {['abdomen', 'waist', 'chest'].map(partId => <span key={partId}><small>{BODY_MEASUREMENT_BY_ID[partId].shortLabel}</small><strong>{formatCm(item.values[partId])}</strong></span>)}
              </span>
              <Icon name="chevronDown" className="bp-checkin-chevron" />
            </button>

            <AnimatePresence initial={false} custom={instantToggle}>
              {expanded && <motion.div
                id={panelId}
                className="bp-checkin-details"
                role="region"
                aria-labelledby={triggerId}
                custom={instantToggle}
                variants={CHECKIN_DETAILS_MOTION}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                <p className="bp-checkin-details-intro">Medidas feitas neste check-in, sem preenchimento automático de semanas anteriores.</p>
                <dl className="bp-checkin-values">
                  {BODY_MEASUREMENT_PARTS.map(part => {
                    const value = item.values[part.id]
                    return <div className={`bp-checkin-value${value == null ? ' missing' : ''}`} key={part.id}>
                      <dt>{part.shortLabel}</dt>
                      <dd><strong>{value == null ? 'Não registrada' : formatCm(value)}</strong><span>{value == null ? 'Sem medida nesta semana' : deltaLabel(deltas[part.id])}</span></dd>
                    </div>
                  })}
                </dl>
                <div className="bp-checkin-footer">
                  <div>{item.notes ? <><strong>Observação</strong><span>{item.notes}</span></> : <span>Use este registro para rever a forma corporal daquele momento.</span>}</div>
                  <Button variant="tinted" icon="history" trailingIcon="chevronRight" onClick={event => onOpenEvolution(item.date, event.detail > 0)} aria-label={`Abrir na evolução, check-in de ${fmtDate(item.date, true)}`}>Abrir na evolução</Button>
                </div>
              </motion.div>}
            </AnimatePresence>
          </motion.li>
        })}
      </ol>
      {pastCheckins.length > CHECKIN_HISTORY_PAGE_SIZE && <div className="bp-checkin-more-row">
        {remaining ? <Button variant="plain" icon="chevronDown" onClick={() => setVisibleCount(count => count + CHECKIN_HISTORY_PAGE_SIZE)}>Mostrar mais ({remaining})</Button>
          : <Button variant="plain" icon="chevronUp" onClick={() => { setVisibleCount(CHECKIN_HISTORY_PAGE_SIZE); setExpandedWeek(null) }}>Recolher histórico</Button>}
      </div>}
    </> : <div className="bp-empty bp-checkin-empty"><Icon name="history" /><strong>Nenhum check-in anterior</strong><span>Depois da primeira semana, suas medidas antigas aparecerão aqui, da mais recente para a mais antiga.</span></div>}
  </section>
}

function CompareView({ checkins }) {
  const [fromId, setFromId] = useState(checkins[0]?.id || '')
  const [toId, setToId] = useState(checkins.at(-1)?.id || '')
  const from = checkins.find(item => item.id === fromId) || checkins[0]
  const to = checkins.find(item => item.id === toId) || checkins.at(-1)

  useEffect(() => {
    if (!checkins.some(item => item.id === fromId)) setFromId(checkins[0]?.id || '')
    if (!checkins.some(item => item.id === toId)) setToId(checkins.at(-1)?.id || '')
  }, [checkins, fromId, toId])

  if (checkins.length < 2) return <section className="card bp-empty large"><Icon name="chartLine" /><strong>Faça pelo menos dois check-ins</strong><span>Quando houver duas semanas registradas, você poderá comparar todas as circunferências lado a lado.</span></section>

  const fromValues = latestBodyMeasurements(checkins, from.date)
  const toValues = latestBodyMeasurements(checkins, to.date)
  const rows = BODY_MEASUREMENT_PARTS.filter(part => fromValues[part.id] != null || toValues[part.id] != null)

  return <div className="bp-compare-layout">
    <section className="card bp-compare-controls">
      <div className="bp-section-head"><div><span className="bp-eyebrow">Comparação corporal</span><h2>Escolha dois momentos</h2></div></div>
      <div className="bp-date-selectors">
        <label><span>Início</span><select value={from.id} onChange={event => setFromId(event.target.value)}>{checkins.filter(item => item.date <= to.date).map(item => <option key={item.id} value={item.id}>{fmtDate(item.date, true)}</option>)}</select></label>
        <Icon name="chevronRight" />
        <label><span>Final</span><select value={to.id} onChange={event => setToId(event.target.value)}>{checkins.filter(item => item.date >= from.date).map(item => <option key={item.id} value={item.id}>{fmtDate(item.date, true)}</option>)}</select></label>
      </div>
    </section>
    <section className="card bp-compare-table-card">
      <div className="bp-compare-table" role="table" aria-label="Comparação das circunferências corporais">
        <div className="bp-compare-row header" role="row"><span role="columnheader">Região</span><span role="columnheader">Início</span><span role="columnheader">Final</span><span role="columnheader">Variação</span></div>
        {rows.map(part => {
          const before = fromValues[part.id]
          const after = toValues[part.id]
          const delta = before != null && after != null ? Math.round((after - before) * 10) / 10 : null
          return <div className="bp-compare-row" role="row" key={part.id}><strong role="cell">{part.shortLabel}</strong><span role="cell">{formatCm(before)}</span><span role="cell">{formatCm(after)}</span><b role="cell">{formatDelta(delta)}</b></div>
        })}
      </div>
      <p className="bp-neutral-note"><Icon name="info" /> Aumento ou redução não é marcado como bom ou ruim: o significado depende da meta definida para cada circunferência.</p>
    </section>
  </div>
}

export default function BodyProgress() {
  const navigate = useNavigate()
  const S = useStore(state => state.S)
  const reducedMotion = useReducedMotion()
  const focusNonce = useRef(0)
  const [mode, setMode] = useState('checkin')
  const [view, setView] = useState('front')
  const [selected, setSelected] = useState('chest')
  const [period, setPeriod] = useState(90)
  const [historyFocus, setHistoryFocus] = useState(null)
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

  useEffect(() => {
    if (mode !== 'history' || !historyFocus) return undefined
    const frame = window.requestAnimationFrame(() => {
      const target = document.getElementById('bp-evolution-map')
      target?.focus?.({ preventScroll: true })
      target?.scrollIntoView?.({ behavior: historyFocus.smooth ? 'smooth' : 'auto', block: 'start' })
    })
    return () => {
      if (frame != null && typeof window.cancelAnimationFrame === 'function') window.cancelAnimationFrame(frame)
    }
  }, [historyFocus, mode])

  const continueCheckin = () => {
    if (!nextPending) return
    setSelected(nextPending.id)
    setView(nextPending.view)
    setHistoryFocus(null)
    setMode('checkin')
    window.requestAnimationFrame(() => document.getElementById('body-measurement-value')?.focus())
  }

  const changeMode = nextMode => {
    setHistoryFocus(null)
    setMode(nextMode)
  }

  const openHistoricalCheckin = (date, pointerInitiated) => {
    focusNonce.current += 1
    setHistoryFocus({ timestamp: timestampOf(date), nonce: focusNonce.current, smooth: pointerInitiated && !reducedMotion })
    setMode('history')
  }

  return <main className="body-progress-view">
    <header className="bp-header">
      <button className="iconbtn" type="button" onClick={() => navigate(-1)} aria-label={t('Back')}><Icon name="chevronLeft" /></button>
      <div><h1>Evolução corporal</h1><p>Circunferências semanais, forma corporal e progresso em um só lugar.</p></div>
      <button className="bp-header-history" type="button" onClick={() => changeMode('history')}><Icon name="history" /><span>Evolução</span></button>
    </header>

    <Segmented className="bp-mode-tabs" value={mode} onChange={changeMode} options={MODES} />

    {mode === 'checkin' && <section className={`card bp-week-card${done === total ? ' complete' : ''}`}>
      <ProgressRing value={percent} />
      <div className="bp-week-copy"><span className="bp-eyebrow">Check-in desta semana</span><strong>{done === total ? 'Tudo registrado' : `${done} de ${total} circunferências`}</strong><p>{done === total ? `Próximo check-in a partir de ${fmtDate(nextWeekDate(todayISO()))}.` : done ? `${total - done} medidas ainda estão pendentes.` : 'Use sempre os mesmos pontos anatômicos e as mesmas condições.'}</p></div>
      {nextPending ? <Button size="sm" variant="tinted" onClick={continueCheckin}>{done ? 'Continuar' : 'Começar'}</Button> : <span className="bp-complete-icon"><Icon name="check" /></span>}
    </section>}

    {mode === 'checkin' && <CheckinView S={S} checkins={checkins} selected={selected} setSelected={setSelected} period={period} setPeriod={setPeriod} view={view} setView={setView} />}
    {mode === 'history' && <EvolutionView S={S} checkins={checkins} selected={selected} setSelected={setSelected} period={period} setPeriod={setPeriod} view={view} setView={setView} focusRequest={historyFocus} />}
    {mode === 'compare' && <CompareView checkins={checkins} />}
    <CheckinHistory S={S} checkins={checkins} onOpenEvolution={openHistoricalCheckin} />
  </main>
}
