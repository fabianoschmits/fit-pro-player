import { useRef, useState } from 'react'
import { useAuth } from '../../auth/AuthProvider.jsx'
import { useStore } from '../../store/useStore.js'
import { DAYN, todayISO } from '../../lib/format.js'
import { t } from '../../lib/i18n.js'
import { fromDisplayMass, toDisplayMass } from '../../lib/mass.js'
import {
  decimalNumber, EXPERIENCE_LABELS, EXPERIENCE_LEVELS, formatPersonName, heightCmFromText,
  heightInput, isValidWorkoutMinutes, PROFILE_GOAL_LABELS, PROFILE_GOALS, weightInput, weightText,
} from '../../lib/profile.js'
import {
  completeTrainingOnboarding, createTrainingDraft, onboardingOwner, readTrainingDraft, saveTrainingDraft,
} from '../../lib/onboarding.js'
import AvatarPicker from '../AvatarPicker.jsx'
import BodyMap from '../BodyMap.jsx'
import Icon from '../Icon.jsx'
import JourneyLayout from '../JourneyLayout.jsx'
import WorkoutMinutesSelector from '../WorkoutMinutesSelector.jsx'
import { Button } from '../ui.jsx'
import './training-onboarding.css'

const WEEK_DAYS = [1, 2, 3, 4, 5, 6, 0]

function Choice({ selected, icon, title, description = undefined, onClick }) {
  return <button type="button" className={`journey-choice training-choice${selected ? ' is-selected' : ''}`} aria-pressed={selected} onClick={onClick}>
    <span className="training-choice__icon" aria-hidden="true"><Icon name={icon} /></span>
    <span className="training-choice__copy"><strong>{title}</strong>{description && <small>{description}</small>}</span>
    <Icon name={selected ? 'checkCircle' : 'chevronRight'} />
  </button>
}

function errorMessage(error) {
  switch (error?.message) {
    case 'onboarding-name-required': return t('Enter your name to continue.')
    case 'onboarding-intention-required': return t('Escolha como você quer começar.')
    case 'onboarding-training-profile-required': return t('Choose a goal and experience level.')
    case 'onboarding-weight-required': return t('Informe um peso válido para continuar.')
    case 'onboarding-duration-invalid': return t('Escolha de 15 a 180 minutos, em intervalos de 5.')
    case 'onboarding-days-required': return t('Choose at least one training day.')
    case 'onboarding-height-invalid': return t('Informe uma altura entre 1,00 e 2,50 m ou deixe em branco.')
    case 'onboarding-birth-invalid': return t('Enter a valid date of birth.')
    case 'onboarding-account-changed': return t('Sua conta mudou. Abra a configuração novamente.')
    default: return t('Não foi possível salvar neste dispositivo. Tente novamente.')
  }
}

function TrainingJourney({ owner, user, onDone }) {
  const state = useStore.getState().S
  const [draft, setDraft] = useState(() => readTrainingDraft(state, owner) || createTrainingDraft(state, user))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [destination, setDestination] = useState('')
  const locked = useRef(false)
  const { values, days, step } = draft
  const professional = values.intention === 'professional'
  const set = patch => { setError(''); setSaved(false); setDraft(current => ({ ...current, values: { ...current.values, ...patch } })) }
  const total = professional ? 2 : 4
  const progress = professional && step === 3 ? 2 : step + 1

  const validate = () => {
    if (step === 0) {
      if (values.name.trim().length < 2) return 'onboarding-name-required'
      if (!values.intention) return 'onboarding-intention-required'
    }
    if (step === 1) {
      if (!values.goal || !values.experience) return 'onboarding-training-profile-required'
      if (!decimalNumber(values.startWeight) || (values.targetWeight && !decimalNumber(values.targetWeight))) return 'onboarding-weight-required'
      if (values.height && (!heightCmFromText(values.height) || heightCmFromText(values.height) < 100 || heightCmFromText(values.height) > 250)) return 'onboarding-height-invalid'
      if (values.birthDate && (values.birthDate < '1900-01-01' || values.birthDate > todayISO())) return 'onboarding-birth-invalid'
    }
    if (step === 2) {
      if (!isValidWorkoutMinutes(values.preferredWorkoutMinutes)) return 'onboarding-duration-invalid'
      if (values.planMode === 'weekly' && !days.length) return 'onboarding-days-required'
    }
    return ''
  }

  const saveAndGo = async (next, forward = true) => {
    if (locked.current) return
    const invalid = forward ? validate() : ''
    if (invalid) { setError(errorMessage(new Error(invalid))); return }
    locked.current = true; setBusy(true); setError('')
    try {
      const stored = await saveTrainingDraft(useStore, owner, { ...draft, step: next })
      setDraft(stored); setSaved(true)
    } catch (failure) { setError(errorMessage(failure)) }
    finally { locked.current = false; setBusy(false) }
  }

  const finish = async () => {
    if (locked.current) return
    locked.current = true; setBusy(true); setError('')
    try { setDestination(await completeTrainingOnboarding(useStore, owner, draft)) }
    catch (failure) { setError(errorMessage(failure)) }
    finally { locked.current = false; setBusy(false) }
  }

  const switchUnit = unit => {
    if (unit === values.unit) return
    const convert = text => decimalNumber(text) ? weightText(toDisplayMass(fromDisplayMass(decimalNumber(text), values.unit), unit)) : text
    set({ unit, startWeight: convert(values.startWeight), targetWeight: convert(values.targetWeight) })
  }
  const back = () => saveAndGo(step === 3 && professional ? 0 : step - 1, false)
  const titles = [t('Seu próximo treino começa aqui.'), t('Um plano com o seu ponto de partida.'), t('Como o treino cabe na sua rotina?'), t('Confira antes de começar.')]
  const descriptions = [
    t('Escolha como você quer treinar. Você poderá mudar depois.'),
    t('Seu objetivo, experiência e peso inicial orientam a primeira versão do plano.'),
    t('Defina o tempo e a frequência. Seu plano se adapta à sua disponibilidade.'),
    professional ? t('Seu perfil ficará pronto para conectar o profissional que acompanha você.') : t('Estas escolhas vão organizar seus primeiros treinos. Você poderá ajustar tudo depois.'),
  ]

  if (destination) return <JourneyLayout title={professional ? t('Tudo pronto para treinar com acompanhamento.') : t('Seu plano está pronto.')} description={professional ? t('Conecte seu profissional para receber e acompanhar seus treinos.') : t('Abra seu plano para conhecer os exercícios e a organização dos seus dias.')} variant="training">
    <div className="training-complete">
      <span className="training-complete__check" aria-hidden="true"><Icon name="checkCircle" /></span>
      <p>{t('Configuração salva. Vamos ao próximo passo?')}</p>
      <div className="journey-actions"><Button variant="primary" trailingIcon="chevronRight" onClick={() => onDone?.(destination)}>{professional ? t('Conectar profissional') : t('Abrir meu plano')}</Button></div>
    </div>
  </JourneyLayout>

  return <JourneyLayout title={titles[step]} description={descriptions[step]} step={progress} total={total} onBack={step > 0 && !busy ? back : undefined} variant="training">
    <form className="training-onboarding" noValidate onSubmit={event => { event.preventDefault(); if (step === 3) void finish(); else void saveAndGo(professional ? 3 : step + 1) }}>
      <fieldset disabled={busy}>
        {step === 0 && <div className="training-step">
          <label className="training-field" htmlFor="training-name"><span>{t('Your name')}</span><input className="field" id="training-name" name="name" autoComplete="name" maxLength={50} value={values.name} onChange={event => set({ name: formatPersonName(event.target.value) })} /></label>
          <div className="journey-choice-grid training-intentions" role="group" aria-label={t('Como você quer treinar?')}>
            <Choice selected={values.intention === 'self'} icon="dumbbell" title={t('Criar meu plano')} description={t('O FPP organiza seus primeiros treinos com base no seu perfil.')} onClick={() => set({ intention: 'self' })} />
            <Choice selected={professional} icon="person2" title={t('Seguir um profissional')} description={t('Conecte quem acompanha você e receba seus treinos.')} onClick={() => set({ intention: 'professional' })} />
          </div>
        </div>}

        {step === 1 && <div className="training-step">
          <div className="training-group" role="group" aria-labelledby="training-goal-label"><span className="training-label" id="training-goal-label">{t('Main goal')}</span>
            <div className="training-goals">{PROFILE_GOALS.map((goal, index) => <Choice key={goal} selected={values.goal === goal} icon={['scale', 'figureStrength', 'bolt', 'heart'][index]} title={t(PROFILE_GOAL_LABELS[goal])} onClick={() => set({ goal })} />)}</div>
          </div>
          <div className="training-group" role="group" aria-labelledby="training-experience-label"><span className="training-label" id="training-experience-label">{t('Experience')}</span>
            <div className="training-chips">{EXPERIENCE_LEVELS.map(experience => <button type="button" key={experience} aria-pressed={values.experience === experience} onClick={() => set({ experience })}>{t(EXPERIENCE_LABELS[experience])}</button>)}</div>
          </div>
          <div className="training-weight-row"><label className="training-field" htmlFor="training-weight"><span>{t('Body weight')}</span><span className="training-unit-input"><input className="field" id="training-weight" name="startWeight" inputMode="decimal" value={values.startWeight} onChange={event => set({ startWeight: weightInput(event.target.value) })} /><span>{values.unit}</span></span></label>
            <div className="training-chips training-units" role="group" aria-label={t('Weight unit')}>{['kg', 'lb'].map(unit => <button type="button" key={unit} aria-pressed={values.unit === unit} onClick={() => switchUnit(unit)}>{unit}</button>)}</div>
          </div>
          <details className="training-optional"><summary>{t('Dados complementares')} <span>{t('optional')}</span></summary><div className="training-optional__body">
            <p className="journey-note">{t('Preencha apenas o que quiser. Esses dados podem ser adicionados depois.')}</p>
            <span className="training-label">{t('Your avatar')}</span><AvatarPicker value={values.avatarId} onChange={avatarId => set({ avatarId })} t={t} orientation="horizontal" />
            <div className="training-body-choice">
              {values.sex && <div className="training-body-map" aria-hidden="true"><BodyMap body={values.sex} view="front" decorative /></div>}
              <div className="training-group" role="group" aria-label={t('Sex')}><span className="training-label">{t('Seu mapa corporal')}</span><div className="training-chips">
                <button type="button" aria-pressed={values.sex === 'male'} onClick={() => set({ sex: values.sex === 'male' ? '' : 'male' })}>{t('Male')}</button>
                <button type="button" aria-pressed={values.sex === 'female'} onClick={() => set({ sex: values.sex === 'female' ? '' : 'female' })}>{t('Female')}</button>
              </div><small className="journey-note">{t('The body map and body statistics follow this selection.')}</small></div>
            </div>
            <div className="journey-field-grid"><label className="training-field" htmlFor="training-height"><span>{t('Height')}</span><span className="training-unit-input"><input className="field" id="training-height" name="height" inputMode="decimal" value={values.height} onChange={event => set({ height: heightInput(event.target.value, values.height) })} /><span>m</span></span></label>
              <label className="training-field" htmlFor="training-target"><span>{t('Target weight')}</span><span className="training-unit-input"><input className="field" id="training-target" name="targetWeight" inputMode="decimal" value={values.targetWeight} onChange={event => set({ targetWeight: weightInput(event.target.value) })} /><span>{values.unit}</span></span></label>
            </div>
            <label className="training-field" htmlFor="training-birth"><span>{t('Date of birth')}</span><input className="field" type="date" id="training-birth" name="birthDate" min="1900-01-01" max={todayISO()} value={values.birthDate} onChange={event => set({ birthDate: event.target.value })} /></label>
          </div></details>
        </div>}

        {step === 2 && <div className="training-step">
          <div className="training-group"><span className="training-label">{t('Tempo por treino')}</span><WorkoutMinutesSelector value={values.preferredWorkoutMinutes} onChange={preferredWorkoutMinutes => set({ preferredWorkoutMinutes })} /></div>
          <div className="journey-choice-grid training-modes" role="group" aria-label={t('Plan style')}>
            <Choice selected={values.planMode === 'weekly'} icon="calendar" title={t('Weekly plan')} description={t('Choose your training days and follow a recurring schedule.')} onClick={() => set({ planMode: 'weekly' })} />
            <Choice selected={values.planMode === 'daily'} icon="dumbbell" title={t('Daily plan')} description={t('Escolha seu treino a cada dia, de acordo com a sua rotina.')} onClick={() => set({ planMode: 'daily' })} />
          </div>
          {values.planMode === 'weekly' ? <div className="training-group"><span className="training-label">{t('Training days')}</span><div className="training-days" role="group" aria-label={t('Training days')}>{WEEK_DAYS.map(day => <button type="button" key={day} aria-label={t(DAYN[day])} aria-pressed={days.includes(day)} onClick={() => { setSaved(false); setError(''); setDraft(current => ({ ...current, days: current.days.includes(day) ? current.days.filter(item => item !== day) : [...current.days, day] })) }}>{t(DAYN[day]).slice(0, 3)}</button>)}</div></div> : <p className="training-callout"><Icon name="calendar" />{t('Você começa com um treino para hoje e pode trocar quando quiser.')}</p>}
        </div>}

        {step === 3 && <div className="training-step training-review">
          <div className="training-review__heading"><Icon name={professional ? 'person2' : 'dumbbell'} /><div><strong>{values.name}</strong><span>{professional ? t('Seguir um profissional') : t('Criar meu plano')}</span></div></div>
          {!professional && <dl className="journey-summary training-summary">
            <div><dt>{t('Main goal')}</dt><dd>{t(PROFILE_GOAL_LABELS[values.goal])}</dd></div>
            <div><dt>{t('Experience')}</dt><dd>{t(EXPERIENCE_LABELS[values.experience])}</dd></div>
            <div><dt>{t('Body weight')}</dt><dd>{values.startWeight} {values.unit}</dd></div>
            <div><dt>{t('Tempo por treino')}</dt><dd>{values.preferredWorkoutMinutes} min</dd></div>
            <div><dt>{t('Plan style')}</dt><dd>{values.planMode === 'weekly' ? t('Weekly plan') : t('Daily plan')}</dd></div>
            {values.planMode === 'weekly' && <div><dt>{t('Training days')}</dt><dd>{WEEK_DAYS.filter(day => days.includes(day)).map(day => t(DAYN[day]).slice(0, 3)).join(', ')}</dd></div>}
          </dl>}
          <p className="training-callout"><Icon name={professional ? 'link' : 'info'} />{professional ? t('Seu profissional define os treinos. Vamos abrir a conexão no próximo passo.') : t('Starting loads are estimates. Adjust them whenever technique or comfort requires it.')}</p>
          <button type="button" className="training-edit" onClick={back}>{t('Revisar minhas escolhas')}</button>
        </div>}
      </fieldset>
      {error && <div className="training-error" role="alert"><Icon name="info" />{error}</div>}
      <div className="journey-actions training-actions"><Button type="submit" variant="primary" disabled={busy} trailingIcon={step === 3 ? 'check' : 'chevronRight'}>{busy ? t('Salvando…') : step === 3 ? t('Finish setup') : t('Continue')}</Button></div>
      {saved && !error && <p className="training-saved" role="status"><Icon name="check" />{t('Progresso salvo neste dispositivo.')}</p>}
    </form>
  </JourneyLayout>
}

/** onDone is called by the explicit final action, after durable completion. */
export default function TrainingOnboarding({ onDone = undefined }) {
  const auth = useAuth()
  useStore(current => current.S)
  const owner = onboardingOwner(useStore, auth.user || null)
  if (!owner) return <JourneyLayout title={t('Preparando sua configuração…')} aside={false}><p role="status">{t('Aguarde enquanto sua conta é carregada.')}</p></JourneyLayout>
  return <TrainingJourney key={owner} owner={owner} user={auth.user} onDone={onDone} />
}
