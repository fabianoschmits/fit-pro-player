import { useRef, useState } from 'react'
import { useStore } from '../store/useStore.js'
import { t, dateLocale } from '../lib/i18n.js'
import { todayISO } from '../lib/format.js'
import { EXPERIENCE_LABELS, EXPERIENCE_LEVELS, PROFILE_GOAL_LABELS, PROFILE_GOALS, currentProfileWeight, heightInput, weightInput } from '../lib/profile.js'
import { applyPersonalSettings, personalSettingsDraft } from '../lib/personal-settings.js'
import AvatarImage from './AvatarImage.jsx'
import AvatarPicker from './AvatarPicker.jsx'
import { Button, Segmented, TextField } from './ui.jsx'

const ERRORS = { name: 'Enter your name to continue.', birthDate: 'Enter a valid date of birth.', height: 'Enter valid measurements to continue.', weight: 'Enter valid measurements to continue.', targetWeight: 'Enter valid measurements to continue.', goal: 'Choose a goal and experience level.', 'settings-context-changed': 'Your settings changed. Reopen personal data and try again.' }

export default function PersonalSettings({ initiallyEditing = false }) {
  const state = useStore(store => store.S)
  const update = useStore(store => store.update)
  const [editing, setEditing] = useState(initiallyEditing)
  const [saved, setSaved] = useState(false)
  return <div className="personal-settings">
    <div className="settings-person"><AvatarImage avatarId={state.profile?.avatarId} /><div><strong>{state.profile?.name || t('Your profile')}</strong><small>{t('These details personalize your progress, body map and training suggestions.')}</small></div></div>
    {editing ? <PersonalForm key="form" state={state} update={update} onClose={success => { setEditing(false); setSaved(Boolean(success)) }} /> : <>
      <dl className="settings-profile-facts">
        <Fact label={t('Date of birth')} value={state.profile?.birthDate ? new Date(`${state.profile.birthDate}T12:00:00`).toLocaleDateString(dateLocale()) : t('Not set')} />
        <Fact label={t('Sex')} value={t(state.profile?.sex === 'female' ? 'Female' : 'Male')} />
        <Fact label={t('Height')} value={state.profile?.heightCm ? `${state.profile.heightCm} cm` : t('Not set')} />
        <Fact label={t('Body weight')} value={currentProfileWeight(state) ? `${currentProfileWeight(state)} ${state.unit}` : t('Not set')} />
        <Fact label={t('Target weight')} value={state.targetW ? `${state.targetW} ${state.unit}` : t('Not set')} />
        <Fact label={t('Main goal')} value={state.profile?.goal ? t(PROFILE_GOAL_LABELS[state.profile.goal]) : t('Not set')} />
        <Fact label={t('Experience')} value={state.profile?.experience ? t(EXPERIENCE_LABELS[state.profile.experience]) : t('Not set')} />
      </dl>
      {saved && <p role="status" className="settings-save-notice">{t('Personal data saved.')}</p>}
      <Button variant="primary" onClick={() => { setEditing(true); setSaved(false) }}>{t('Edit your personal data')}</Button>
    </>}
  </div>
}

function Fact({ label, value }) { return <div><dt>{label}</dt><dd>{value}</dd></div> }

function PersonalForm({ state, update, onClose }) {
  const [baseline] = useState(() => personalSettingsDraft(state))
  const [draft, setDraft] = useState(baseline)
  const [error, setError] = useState('')
  const form = useRef(null)
  const [scope] = useState(() => useStore.getState().getScopeToken?.())
  const change = patch => { setDraft(current => ({ ...current, ...patch })); setError('') }
  const submit = event => {
    event.preventDefault()
    const store = useStore.getState()
    if (scope && !store.isScopeCurrent(scope)) { setError('settings-context-changed'); return }
    try {
      applyPersonalSettings(structuredClone(store.S), draft, baseline, { today: todayISO() })
      update(current => applyPersonalSettings(current, draft, baseline, { today: todayISO() }))
      if (useStore.getState().persistence?.state === 'error') { setError('save-failed'); return }
      onClose(true)
    } catch (cause) {
      setError(cause.message)
      form.current?.elements.namedItem(cause.message)?.focus()
    }
  }
  const invalid = name => error === name || undefined
  return <form ref={form} className="personal-settings-form" onSubmit={submit} noValidate>
    <label>{t('Your name')}<TextField name="name" autoComplete="name" maxLength={50} value={draft.name} aria-invalid={invalid('name')} onChange={event => change({ name: event.target.value })} /></label>
    <details className="settings-avatar-choices"><summary>{t('Choose your avatar')}</summary><AvatarPicker value={draft.avatarId} onChange={avatarId => change({ avatarId })} t={t} /></details>
    <label>{t('Date of birth')}<input className="field" name="birthDate" type="date" min="1900-01-01" max={todayISO()} autoComplete="bday" value={draft.birthDate} aria-invalid={invalid('birthDate')} onChange={event => change({ birthDate: event.target.value })} /></label>
    <fieldset><legend>{t('Sex')}</legend><Segmented options={[{value:'male',label:t('Male')},{value:'female',label:t('Female')}]} value={draft.sex} onChange={sex => change({ sex })} /></fieldset>
    <div className="settings-measure-fields">
      <label>{t('Height')} (m)<TextField name="height" inputMode="decimal" value={draft.height} aria-invalid={invalid('height')} onChange={event => change({ height: heightInput(event.target.value) })} /></label>
      <label>{t('Body weight')} ({draft.unit})<TextField name="weight" inputMode="decimal" value={draft.weight} aria-invalid={invalid('weight')} onChange={event => change({ weight: weightInput(event.target.value) })} /></label>
    </div>
    <label>{t('Target weight')} ({draft.unit}) · {t('optional')}<TextField name="targetWeight" inputMode="decimal" value={draft.targetWeight} aria-invalid={invalid('targetWeight')} onChange={event => change({ targetWeight: weightInput(event.target.value) })} /></label>
    <label>{t('Main goal')}<select className="field" name="goal" value={draft.goal} aria-invalid={invalid('goal')} onChange={event => change({ goal: event.target.value })}><option value="">{t('Choose a goal and experience level.')}</option>{PROFILE_GOALS.map(goal => <option key={goal} value={goal}>{t(PROFILE_GOAL_LABELS[goal])}</option>)}</select></label>
    <label>{t('Experience')}<select className="field" name="experience" value={draft.experience} onChange={event => change({ experience: event.target.value })}><option value="">{t('Choose a goal and experience level.')}</option>{EXPERIENCE_LEVELS.map(level => <option key={level} value={level}>{t(EXPERIENCE_LABELS[level])}</option>)}</select></label>
    <p className="settings-help">{t('Editing your profile keeps your plan, assigned training and history.')}</p>
    {error && <p role="alert" className="settings-error">{t(ERRORS[error] || 'Could not save on this device. Export a backup before closing the app.')}</p>}
    <div className="settings-form-actions"><Button type="submit" variant="primary">{t('Save')}</Button><Button type="button" onClick={() => onClose(false)}>{t('Cancel')}</Button></div>
  </form>
}
