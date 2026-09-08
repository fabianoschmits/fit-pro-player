import { useMemo, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useStore } from '../store/useStore.js'
import { DAYN, DAYS, exCount, todayISO } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import { lastBW } from '../lib/history.js'
import { ensureStarterRoutines, routineName } from '../lib/starter.js'
import { EXPERIENCE_LEVELS, PROFILE_GOALS, normalizeProfile } from '../lib/profile.js'
import BodyMap from './BodyMap.jsx'
import Icon from './Icon.jsx'
import { Button, Segmented, TextField } from './ui.jsx'
import { glyphOf } from '../lib/glyphs.js'

const WEEK_DAYS = [1, 2, 3, 4, 5, 6, 0]
const DEFAULT_DAYS = [1, 3, 5]
const GOAL_LABELS = {
  lose_weight: 'Lose weight',
  build_muscle: 'Build muscle',
  improve_fitness: 'Improve fitness',
  maintain_weight: 'Maintain weight',
}
const EXPERIENCE_LABELS = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
}

const numberOrNull = value => {
  const n = Number(String(value).replace(',', '.'))
  return Number.isFinite(n) && n > 0 ? n : null
}

function Choice({ selected, icon, title, copy, onClick }) {
  return <button type="button" className={'wizard-choice' + (selected ? ' on' : '')} aria-pressed={selected} onClick={onClick}>
    <span className="wizard-choice-icon"><Icon name={icon} /></span>
    <span className="wizard-choice-copy"><strong>{title}</strong>{copy && <small>{copy}</small>}</span>
    <span className="wizard-choice-check"><Icon name={selected ? 'checkCircle' : 'chevronRight'} /></span>
  </button>
}

export default function PlanWizard({ editing = false, onCancel, onDone }) {
  const S = useStore(s => s.S)
  const user = useStore(s => s.user)
  const update = useStore(s => s.update)
  const reduceMotion = useReducedMotion()
  const profile = normalizeProfile(S.profile, S.body)
  const lastWeight = lastBW(S)?.w || null
  const scheduled = WEEK_DAYS.filter(day => S.week?.[day] && S.routines.some(r => r.id === S.week[day]))
  const [step, setStep] = useState(0)
  const [direction, setDirection] = useState(1)
  const [error, setError] = useState('')
  const [draft, setDraft] = useState(() => ({
    name: profile.name || user?.name || '',
    birthDate: profile.birthDate || '',
    sex: profile.sex || (S.body === 'female' ? 'female' : 'male'),
    heightCm: profile.heightCm || null,
    startWeight: profile.startWeight || lastWeight,
    targetWeight: S.targetW || null,
    goal: profile.goal || '',
    experience: profile.experience || '',
    unit: S.unit === 'lb' ? 'lb' : 'kg',
    planMode: S.planMode === 'daily' ? 'daily' : 'weekly',
  }))
  const [days, setDays] = useState(scheduled.length ? scheduled : DEFAULT_DAYS)
  const [dailyRoutineId, setDailyRoutineId] = useState(() => {
    const value = S.dayPlan?.[todayISO()]
    return S.routines.some(r => r.id === value) ? value : ''
  })

  // A first-run state already carries these routines. The fallback only covers old backups
  // whose user intentionally removed every routine and then chose to edit their setup.
  const previewRoutines = useMemo(() => {
    if (S.routines.length) return S.routines
    const temp = { ...S, routines: [] }
    return ensureStarterRoutines(temp)
  }, [S])

  const set = patch => setDraft(current => ({ ...current, ...patch }))
  const toggleDay = day => setDays(current => current.includes(day) ? current.filter(d => d !== day) : [...current, day])
  const maxDate = todayISO()
  const total = 6

  const validate = () => {
    if (step === 0 && draft.name.trim().length < 2) return t('Enter your name to continue.')
    if (step === 1 && (!draft.birthDate || draft.birthDate > maxDate)) return t('Enter a valid date of birth.')
    if (step === 2 && (!draft.heightCm || draft.heightCm < 100 || draft.heightCm > 250 || !draft.startWeight)) return t('Enter valid measurements to continue.')
    if (step === 3 && (!draft.goal || !draft.experience)) return t('Choose a goal and experience level.')
    if (step === 4 && !draft.planMode) return t('Choose how you want to plan your workouts.')
    if (step === 5 && draft.planMode === 'weekly' && !days.length) return t('Choose at least one training day.')
    if (step === 5 && draft.planMode === 'daily' && !dailyRoutineId) return t("Choose today's workout.")
    return ''
  }

  const go = next => {
    const message = next > step ? validate() : ''
    if (message) { setError(message); return }
    setError('')
    setDirection(next > step ? 1 : -1)
    setStep(next)
  }

  const finish = () => {
    const message = validate()
    if (message) { setError(message); return }
    const today = todayISO()
    update(state => {
      state.profile = {
        ...normalizeProfile(state.profile, state.body),
        name: draft.name.trim(),
        birthDate: draft.birthDate,
        sex: draft.sex,
        heightCm: draft.heightCm,
        startWeight: draft.startWeight,
        goal: draft.goal,
        experience: draft.experience,
        completedAt: state.profile?.completedAt || Date.now(),
      }
      state.body = draft.sex
      state.unit = draft.unit
      state.targetW = draft.targetWeight || null
      state.planMode = draft.planMode

      if (!editing) {
        const existing = state.bodyweight.find(entry => entry.d === today)
        if (existing) { existing.w = draft.startWeight; existing.t = Date.now() }
        else state.bodyweight.push({ d: today, w: draft.startWeight, t: Date.now() })
        state.bodyweight.sort((a, b) => a.d.localeCompare(b.d))
      }

      const ready = ensureStarterRoutines(state)
      if (draft.planMode === 'weekly') {
        WEEK_DAYS.filter(day => !days.includes(day)).forEach(day => { delete state.week[day] })
        WEEK_DAYS.filter(day => days.includes(day)).forEach((day, index) => {
          const current = state.week[day]
          if (!editing || !state.routines.some(r => r.id === current)) state.week[day] = ready[index % ready.length].id
        })
      } else if (dailyRoutineId) {
        const chosen = state.routines.find(r => r.id === dailyRoutineId)
          || ready.find(r => r.starterKey === previewRoutines.find(x => x.id === dailyRoutineId)?.starterKey)
        if (chosen) state.dayPlan[today] = chosen.id
      }
      state.onboardingDone = true
    })
    onDone?.()
  }

  const slide = reduceMotion ? {} : {
    initial: { opacity: 0, x: direction * 24 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: direction * -18 },
    transition: { duration: 0.2, ease: [0.2, 0.8, 0.2, 1] },
  }

  const views = [
    <div className="wizard-step" key="name">
      <span className="wizard-kicker">{t('Your profile')}</span>
      <h1>{editing ? t('Edit your personal data') : t("Let's build your plan")}</h1>
      <p>{t('These details personalize your progress, body map and training suggestions.')}</p>
      <label className="wizard-label" htmlFor="wizard-name">{t('Your name')}</label>
      <TextField id="wizard-name" autoFocus={!reduceMotion} maxLength={50} autoComplete="name" value={draft.name} onChange={event => set({ name: event.target.value })} placeholder={t('How should we call you?')} />
    </div>,
    <div className="wizard-step wizard-body-step" key="body">
      <span className="wizard-kicker">{t('About you')}</span>
      <h1>{t('Your body profile')}</h1>
      <p>{t('The body diagram adapts to your selection and is used in your statistics.')}</p>
      <div className="wizard-body-layout">
        <div className="wizard-avatar" aria-hidden="true"><BodyMap body={draft.sex} view="front" decorative /></div>
        <div className="wizard-body-fields">
          <label className="wizard-label" htmlFor="wizard-birth">{t('Date of birth')}</label>
          <input id="wizard-birth" className="field" type="date" min="1900-01-01" max={maxDate} value={draft.birthDate} onInput={event => set({ birthDate: event.currentTarget.value })} onChange={event => set({ birthDate: event.target.value })} />
          <span className="wizard-label">{t('Sex')}</span>
          <Segmented options={[{ value: 'male', label: t('Male') }, { value: 'female', label: t('Female') }]} value={draft.sex} onChange={sex => set({ sex })} />
        </div>
      </div>
    </div>,
    <div className="wizard-step" key="measurements">
      <span className="wizard-kicker">{t('Measurements')}</span>
      <h1>{t('Your starting point')}</h1>
      <p>{t('Your first weight starts the progress chart and remains saved as your registration weight.')}</p>
      <span className="wizard-label">{t('Weight unit')}</span>
      <Segmented options={[{ value: 'kg', label: 'kg' }, { value: 'lb', label: 'lb' }]} value={draft.unit} onChange={unit => set({ unit })} />
      <div className="wizard-measure-grid">
        <label><span>{t('Height')}</span><span className="wizard-input-unit"><input className="field" inputMode="numeric" value={draft.heightCm || ''} onChange={event => set({ heightCm: numberOrNull(event.target.value) })} /><i>cm</i></span></label>
        <label><span>{t('Weight at signup')}</span><span className="wizard-input-unit"><input className="field" inputMode="decimal" value={draft.startWeight || ''} onChange={event => set({ startWeight: numberOrNull(event.target.value) })} /><i>{draft.unit}</i></span></label>
      </div>
      <label className="wizard-label" htmlFor="wizard-target">{t('Target weight')} <small>{t('optional')}</small></label>
      <span className="wizard-input-unit"><input id="wizard-target" className="field" inputMode="decimal" value={draft.targetWeight || ''} onChange={event => set({ targetWeight: numberOrNull(event.target.value) })} /><i>{draft.unit}</i></span>
    </div>,
    <div className="wizard-step" key="goal">
      <span className="wizard-kicker">{t('Training profile')}</span>
      <h1>{t('What are you training for?')}</h1>
      <p>{t('You can change these answers later without losing any history.')}</p>
      <span className="wizard-label">{t('Main goal')}</span>
      <div className="wizard-choice-grid compact">
        {PROFILE_GOALS.map((goal, index) => <Choice key={goal} selected={draft.goal === goal} icon={['scale', 'figureStrength', 'bolt', 'heart'][index]} title={t(GOAL_LABELS[goal])} onClick={() => set({ goal })} />)}
      </div>
      <span className="wizard-label">{t('Experience')}</span>
      <div className="wizard-levels">
        {EXPERIENCE_LEVELS.map(level => <button type="button" key={level} className={draft.experience === level ? 'on' : ''} aria-pressed={draft.experience === level} onClick={() => set({ experience: level })}>{t(EXPERIENCE_LABELS[level])}</button>)}
      </div>
    </div>,
    <div className="wizard-step" key="mode">
      <span className="wizard-kicker">{t('Plan style')}</span>
      <h1>{t('How do you want to train?')}</h1>
      <p>{t('Both modes keep the same profile, routines and workout history.')}</p>
      <div className="wizard-choice-grid">
        <Choice selected={draft.planMode === 'weekly'} icon="calendar" title={t('Weekly plan')} copy={t('Choose your training days and follow a recurring schedule.')} onClick={() => set({ planMode: 'weekly' })} />
        <Choice selected={draft.planMode === 'daily'} icon="dumbbell" title={t('Daily plan')} copy={t('Choose the workout you want each day and keep previous days in history.')} onClick={() => set({ planMode: 'daily' })} />
      </div>
    </div>,
    <div className="wizard-step" key="schedule">
      <span className="wizard-kicker">{draft.planMode === 'weekly' ? t('Weekly plan') : t('Daily plan')}</span>
      <h1>{draft.planMode === 'weekly' ? t('Choose your training days') : t("Choose today's workout")}</h1>
      <p>{draft.planMode === 'weekly' ? t('The ready-made routines are distributed across the days you select.') : t('Tomorrow you can choose again. Your completed workouts stay in history.')}</p>
      {draft.planMode === 'weekly' ? <>
        <div className="wizard-week" role="group" aria-label={t('Training days')}>
          {WEEK_DAYS.map(day => <button type="button" key={day} className={days.includes(day) ? 'on' : ''} aria-pressed={days.includes(day)} onClick={() => toggleDay(day)}><span>{t(DAYS[day])}</span><strong>{t(DAYN[day]).slice(0, 3)}</strong></button>)}
        </div>
        <div className="wizard-schedule-preview">
          {WEEK_DAYS.filter(day => days.includes(day)).map((day, index) => {
            const routine = (editing && S.routines.find(item => item.id === S.week[day])) || previewRoutines[index % previewRoutines.length]
            return <div key={day}><span>{t(DAYN[day])}</span><strong>{routineName(routine)}</strong></div>
          })}
        </div>
      </> : <div className="wizard-routine-grid">
        {previewRoutines.map(routine => <button type="button" key={routine.id} className={dailyRoutineId === routine.id ? 'on' : ''} aria-pressed={dailyRoutineId === routine.id} onClick={() => setDailyRoutineId(routine.id)}>
          <span><Icon name={glyphOf(routine.emoji)} /></span><strong>{routineName(routine)}</strong><small>{exCount(routine.ex.length)}</small>
        </button>)}
      </div>}
    </div>,
  ]

  return <main className="plan-wizard" aria-labelledby="wizard-title">
    <div className="wizard-shell">
      <div className="wizard-topbar">
        <button type="button" className="iconbtn" disabled={step === 0} onClick={() => go(step - 1)} aria-label={t('Back')}><Icon name="chevronLeft" /></button>
        <div className="wizard-progress" role="progressbar" aria-valuemin="1" aria-valuemax={total} aria-valuenow={step + 1}><i style={{ width: `${((step + 1) / total) * 100}%` }} /></div>
        <span>{step + 1}/{total}</span>
      </div>
      <div className="wizard-stage" id="wizard-title">
        <AnimatePresence mode="wait" initial={false} custom={direction}>
          <motion.div key={step} {...slide}>{views[step]}</motion.div>
        </AnimatePresence>
      </div>
      {error && <div className="wizard-error" role="alert"><Icon name="info" />{error}</div>}
      <div className="wizard-actions">
        {editing && step === 0 && <Button variant="ghost" onClick={onCancel}>{t('Cancel')}</Button>}
        {step < total - 1
          ? <Button variant="primary" trailingIcon="chevronRight" onClick={() => go(step + 1)}>{t('Continue')}</Button>
          : <Button variant="primary" icon="check" onClick={finish}>{editing ? t('Save changes') : t('Finish setup')}</Button>}
      </div>
    </div>
  </main>
}
