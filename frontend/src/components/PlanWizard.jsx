import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useStore } from '../store/useStore.js'
import { DAYN, DAYS, exCount, todayISO } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import { isStarterRoutine, routineName } from '../lib/starter.js'
import {
  EXPERIENCE_LABELS, EXPERIENCE_LEVELS, PROFILE_GOAL_LABELS, PROFILE_GOALS,
  currentProfileWeight,
  decimalNumber, defaultBirthDate, formatPersonName, heightCmFromText, heightInput,
  heightText, normalizeProfile, weightInput, weightText,
} from '../lib/profile.js'
import { applyPersonalizedPlan, personalizedRoutineSpecs } from '../lib/personalized-plan.js'
import BodyMap from './BodyMap.jsx'
import DateWheelPicker from './DateWheelPicker.jsx'
import AvatarPicker from './AvatarPicker.jsx'
import Icon from './Icon.jsx'
import { Button, Segmented, TextField } from './ui.jsx'
import { glyphOf } from '../lib/glyphs.js'

const WEEK_DAYS = [1, 2, 3, 4, 5, 6, 0]
const DEFAULT_DAYS = [1, 3, 5]
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
  const lastWeight = currentProfileWeight(S)
  const scheduled = WEEK_DAYS.filter(day => S.week?.[day] && S.routines.some(r => r.id === S.week[day]))
  const [step, setStep] = useState(0)
  const [direction, setDirection] = useState(1)
  const [error, setError] = useState('')
  const [draft, setDraft] = useState(() => ({
    name: formatPersonName(profile.name || user?.name || ''),
    avatarId: profile.avatarId,
    birthDate: profile.birthDate || defaultBirthDate(),
    sex: profile.sex || (S.body === 'female' ? 'female' : 'male'),
    height: heightText(profile.heightCm),
    startWeight: weightText(lastWeight || profile.startWeight),
    targetWeight: weightText(S.targetW),
    goal: profile.goal || '',
    experience: profile.experience || '',
    unit: S.unit === 'lb' ? 'lb' : 'kg',
    planMode: S.planMode === 'daily' ? 'daily' : 'weekly',
  }))
  const [days, setDays] = useState(scheduled.length ? scheduled : DEFAULT_DAYS)
  const [dailyRoutineKey, setDailyRoutineKey] = useState(() => {
    const value = S.dayPlan?.[todayISO()]
    const routine = S.routines.find(r => r.id === value)
    return routine?.personalizedKey || routine?.starterKey || (routine ? `custom:${routine.id}` : '')
  })

  const previewRoutines = useMemo(() => {
    const startWeight = decimalNumber(draft.startWeight)
    const generated = personalizedRoutineSpecs({
      goal: draft.goal, experience: draft.experience, startWeight,
    }, draft.planMode === 'daily' ? 7 : Math.max(1, days.length), {
      daily: draft.planMode === 'daily', state: S,
    }).map(routine => ({ ...routine, id: `plan:${routine.personalizedKey}`, name: routine.starterKey }))
    if (draft.planMode !== 'daily') return generated
    const custom = S.routines.filter(routine => !routine.planGenerated && !isStarterRoutine(routine))
    return [...generated, ...custom]
  }, [S, days.length, draft.experience, draft.goal, draft.planMode, draft.startWeight])

  const set = patch => setDraft(current => ({ ...current, ...patch }))
  const toggleDay = day => setDays(current => current.includes(day) ? current.filter(d => d !== day) : [...current, day])
  const maxDate = todayISO()
  const total = 7

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [step])

  const validate = () => {
    if (step === 0 && draft.name.trim().length < 2) return t('Enter your name to continue.')
    if (step === 2 && (!draft.birthDate || draft.birthDate < '1900-01-01' || draft.birthDate > maxDate)) return t('Enter a valid date of birth.')
    const heightCm = heightCmFromText(draft.height)
    const startWeight = decimalNumber(draft.startWeight)
    if (step === 3 && (!heightCm || heightCm < 100 || heightCm > 250 || !startWeight)) return t('Enter valid measurements to continue.')
    if (step === 4 && (!draft.goal || !draft.experience)) return t('Choose a goal and experience level.')
    if (step === 5 && !draft.planMode) return t('Choose how you want to plan your workouts.')
    if (step === 6 && draft.planMode === 'weekly' && !days.length) return t('Choose at least one training day.')
    if (step === 6 && draft.planMode === 'daily' && !dailyRoutineKey) return t("Choose today's workout.")
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
    const heightCm = heightCmFromText(draft.height)
    const startWeight = decimalNumber(draft.startWeight)
    const targetWeight = decimalNumber(draft.targetWeight)
    const name = formatPersonName(draft.name).trim()
    const planInputsChanged = !editing
      || !S.routines.some(routine => routine.planGenerated)
      || S.profile?.goal !== draft.goal
      || S.profile?.experience !== draft.experience
      || Number(currentProfileWeight(S)) !== startWeight
      || S.planMode !== draft.planMode
      || (draft.planMode === 'weekly' && scheduled.length !== days.length)
    update(state => {
      state.profile = {
        ...normalizeProfile(state.profile, state.body),
        name,
        avatarId: draft.avatarId,
        birthDate: draft.birthDate,
        sex: draft.sex,
        heightCm,
        startWeight,
        goal: draft.goal,
        experience: draft.experience,
        completedAt: state.profile?.completedAt || Date.now(),
      }
      state.body = draft.sex
      state.unit = draft.unit
      state.targetW = targetWeight
      state.planMode = draft.planMode

      const existing = state.bodyweight.find(entry => entry.d === today)
      if (existing) { existing.w = startWeight; existing.t = Date.now() }
      else state.bodyweight.push({ d: today, w: startWeight, t: Date.now() })
      state.bodyweight.sort((a, b) => a.d.localeCompare(b.d))

      const ready = planInputsChanged
        ? applyPersonalizedPlan(state, state.profile, draft.planMode === 'daily' ? 7 : days.length, { daily: draft.planMode === 'daily' })
        : state.routines
      if (draft.planMode === 'weekly') {
        WEEK_DAYS.filter(day => !days.includes(day)).forEach(day => { delete state.week[day] })
        WEEK_DAYS.filter(day => days.includes(day)).forEach((day, index) => {
          const current = state.week[day]
          if (planInputsChanged || !editing || !state.routines.some(r => r.id === current)) state.week[day] = ready[index % ready.length].id
        })
      } else if (dailyRoutineKey) {
        const customId = dailyRoutineKey.startsWith('custom:') ? dailyRoutineKey.slice(7) : ''
        const chosen = state.routines.find(routine => routine.id === customId)
          || ready.find(routine => routine.personalizedKey === dailyRoutineKey || routine.starterKey === dailyRoutineKey)
        if (chosen) state.dayPlan[today] = chosen.id
      }
      state.onboardingDone = true
    })
    onDone?.()
  }

  const saveProgress = () => {
    const heightCm = heightCmFromText(draft.height)
    const startWeight = decimalNumber(draft.startWeight)
    const targetWeight = decimalNumber(draft.targetWeight)
    const name = formatPersonName(draft.name).trim()
    if (!name && !S.profile?.name) { setError(t('Enter your name to continue.')); return }
    update(state => {
      const current = normalizeProfile(state.profile, state.body)
      state.profile = {
        ...current,
        ...(name ? { name } : {}),
        ...(draft.avatarId ? { avatarId: draft.avatarId } : {}),
        ...(draft.birthDate ? { birthDate: draft.birthDate } : {}),
        ...(draft.sex ? { sex: draft.sex } : {}),
        ...(heightCm ? { heightCm } : {}),
        ...(startWeight ? { startWeight } : {}),
        ...(draft.goal ? { goal: draft.goal } : {}),
        ...(draft.experience ? { experience: draft.experience } : {}),
      }
      state.body = draft.sex || state.body
      state.unit = draft.unit
      if (targetWeight) state.targetW = targetWeight
      state.planMode = draft.planMode
      if (startWeight) {
        const today = todayISO()
        const existing = state.bodyweight.find(entry => entry.d === today)
        if (existing) { existing.w = startWeight; existing.t = Date.now() }
        else state.bodyweight.push({ d: today, w: startWeight, t: Date.now() })
        state.bodyweight.sort((a, b) => a.d.localeCompare(b.d))
      }
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
      <TextField id="wizard-name" autoFocus={!reduceMotion} maxLength={50} autoComplete="name" value={draft.name} onChange={event => set({ name: formatPersonName(event.target.value) })} placeholder={t('How should we call you?')} />
    </div>,
    <div className="wizard-step wizard-avatar-step" key="avatar">
      <span className="wizard-kicker">{t('Your avatar')}</span>
      <h1>{t('Choose your avatar')}</h1>
      <p>{t('Pick the character that will represent you in the app. You can change it whenever you want.')}</p>
      <AvatarPicker value={draft.avatarId} onChange={avatarId => set({ avatarId })} t={t} />
    </div>,
    <div className="wizard-step wizard-body-step" key="body">
      <span className="wizard-kicker">{t('About you')}</span>
      <h1>{t('Your body profile')}</h1>
      <p>{t('The body diagram adapts to your selection and is used in your statistics.')}</p>
      <div className="wizard-body-choice">
        <div className="wizard-avatar" aria-hidden="true"><BodyMap body={draft.sex} view="front" decorative /></div>
        <div className="wizard-body-fields">
          <span className="wizard-label">{t('Sex')}</span>
          <Segmented options={[{ value: 'male', label: t('Male') }, { value: 'female', label: t('Female') }]} value={draft.sex} onChange={sex => set({ sex })} />
          <small>{t('The body map and body statistics follow this selection.')}</small>
        </div>
      </div>
      <span className="wizard-label">{t('Date of birth')}</span>
      <DateWheelPicker value={draft.birthDate} max={maxDate} reducedMotion={reduceMotion} onChange={birthDate => set({ birthDate })} />
    </div>,
    <div className="wizard-step" key="measurements">
      <span className="wizard-kicker">{t('Measurements')}</span>
      <h1>{t('Your starting point')}</h1>
      <p>{t('Your first weight starts the progress chart and remains saved as your registration weight.')}</p>
      <span className="wizard-label">{t('Weight unit')}</span>
      <Segmented options={[{ value: 'kg', label: 'kg' }, { value: 'lb', label: 'lb' }]} value={draft.unit} onChange={unit => set({ unit })} />
      <div className="wizard-measure-grid">
        <label><span>{t('Height')}</span><span className="wizard-input-unit"><input className="field" inputMode="decimal" placeholder="1,76" value={draft.height} onChange={event => set({ height: heightInput(event.target.value) })} /><i>m</i></span></label>
        <label><span>{t('Body weight')}</span><span className="wizard-input-unit"><input className="field" inputMode="decimal" placeholder="71,2" value={draft.startWeight} onChange={event => set({ startWeight: weightInput(event.target.value) })} /><i>{draft.unit}</i></span></label>
      </div>
      <label className="wizard-label" htmlFor="wizard-target">{t('Target weight')} <small>{t('optional')}</small></label>
      <span className="wizard-input-unit"><input id="wizard-target" className="field" inputMode="decimal" placeholder="68,0" value={draft.targetWeight} onChange={event => set({ targetWeight: weightInput(event.target.value) })} /><i>{draft.unit}</i></span>
    </div>,
    <div className="wizard-step" key="goal">
      <span className="wizard-kicker">{t('Training profile')}</span>
      <h1>{t('What are you training for?')}</h1>
      <p>{t('You can change these answers later without losing any history.')}</p>
      <span className="wizard-label">{t('Main goal')}</span>
      <div className="wizard-choice-grid compact">
        {PROFILE_GOALS.map((goal, index) => <Choice key={goal} selected={draft.goal === goal} icon={['scale', 'figureStrength', 'bolt', 'heart'][index]} title={t(PROFILE_GOAL_LABELS[goal])} onClick={() => set({ goal })} />)}
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
      <p>{draft.planMode === 'weekly' ? t('Your exercises, sets, repetitions and starting loads adapt to the number of days you select.') : t('Tomorrow you can choose again. Your completed workouts stay in history.')}</p>
      <div className="wizard-plan-fit"><Icon name="sparkles" /><span><strong>{t('Personalized for {0} · {1}', t(PROFILE_GOAL_LABELS[draft.goal]), t(EXPERIENCE_LABELS[draft.experience]))}</strong><small>{t('Built from your goal, experience, weight and training frequency.')} {t('Starting loads are estimates. Adjust them whenever technique or comfort requires it.')}</small></span></div>
      {draft.planMode === 'weekly' ? <>
        <div className="wizard-week" role="group" aria-label={t('Training days')}>
          {WEEK_DAYS.map(day => <button type="button" key={day} className={days.includes(day) ? 'on' : ''} aria-pressed={days.includes(day)} onClick={() => toggleDay(day)}><span>{t(DAYS[day])}</span><strong>{t(DAYN[day]).slice(0, 3)}</strong></button>)}
        </div>
        <div className="wizard-schedule-preview">
          {WEEK_DAYS.filter(day => days.includes(day)).map((day, index) => {
            const routine = previewRoutines[index % previewRoutines.length]
            return <div key={day}><span>{t(DAYN[day])}</span><p><strong>{routineName(routine)}</strong><small>{exCount(routine.ex.length)}</small></p></div>
          })}
        </div>
      </> : <div className="wizard-routine-grid">
        {previewRoutines.map(routine => {
          const key = routine.personalizedKey || routine.starterKey || `custom:${routine.id}`
          const selected = dailyRoutineKey === key || dailyRoutineKey === routine.starterKey
          return <button type="button" key={routine.id} className={selected ? 'on' : ''} aria-pressed={selected} onClick={() => setDailyRoutineKey(key)}>
          <span><Icon name={glyphOf(routine.emoji)} /></span><strong>{routineName(routine)}</strong><small>{exCount(routine.ex.length)}</small>
          </button>
        })}
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
        {editing && <Button variant="ghost" onClick={saveProgress}>{t('Save')}</Button>}
        {step < total - 1
          ? <Button variant="primary" trailingIcon="chevronRight" onClick={() => go(step + 1)}>{t('Continue')}</Button>
          : <Button variant="primary" icon="check" onClick={finish}>{editing ? t('Save changes') : t('Finish setup')}</Button>}
      </div>
    </div>
  </main>
}
