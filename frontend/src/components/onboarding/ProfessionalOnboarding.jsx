import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider.jsx'
import { useStore } from '../../store/useStore.js'
import { t } from '../../lib/i18n.js'
import { appErrorMessage } from '../../lib/app-errors.js'
import { BRAZILIAN_STATES, composeCityRegion } from '../../lib/brazil-locations.js'
import { createProfessionalProfileRepository, normalizeProfessionalProfile } from '../../lib/professional-profile.js'
import { describeSpecialty, MAX_PROFESSIONAL_SPECIALTIES, MAX_SPECIALTY_LENGTH, normalizeSpecialtyValue, PRACTICE_SPECIALTIES, teachingSpecialty } from '../../lib/professional-specialties.js'
import { getBrowserSupabaseClient } from '../../lib/supabase-client.js'
import AccountPhone from '../AccountPhone.jsx'
import JourneyLayout from '../JourneyLayout.jsx'
import { Button, TextArea, TextField } from '../ui.jsx'
import './professional-onboarding.css'

const TITLES = ['Sua experiência em primeiro plano', 'Onde você atua', 'Confira seu perfil profissional']
const DESCRIPTIONS = ['Apresente seu trabalho para os alunos que vão treinar com você.', 'Complete os dados que ajudam seus alunos a reconhecer seu trabalho.', 'Revise os dados antes de abrir seu espaço de acompanhamento.']
const EMPTY = { professionalName: '', bio: '', specialties: [], stateUf: '', cityName: '', neighborhood: '', registrationType: '', registrationNumber: '', customSpecialty: '' }

function profileValues(source = {}, fallbackName = '') {
  const normalized = normalizeProfessionalProfile(source)
  return {
    professionalName: normalized.professionalName || fallbackName.slice(0, 120),
    bio: normalized.bio || '',
    specialties: normalized.specialties,
    stateUf: normalized.stateUf || '',
    cityName: normalized.cityName || '',
    neighborhood: normalized.neighborhood || '',
    registrationType: normalized.registrationType || '',
    registrationNumber: normalized.registrationNumber || '',
    customSpecialty: typeof source.customSpecialty === 'string' ? source.customSpecialty.slice(0, MAX_SPECIALTY_LENGTH) : '',
  }
}

function restoredDraft(userId) {
  const store = useStore.getState()
  const scope = store.getActiveLocalScope()
  const draft = store.S.onboardingDraft
  if (scope.kind !== 'account' || scope.userId !== userId || draft?.owner !== `account:${userId}` || draft.version !== 1 || draft.kind !== 'professional' || !draft.values || typeof draft.values !== 'object') return null
  return { step: Math.max(0, Math.min(2, Number.isInteger(draft.step) ? draft.step : 0)), values: profileValues(draft.values) }
}

function collectedValues(values) {
  const next = profileValues(values)
  const pending = normalizeSpecialtyValue(next.customSpecialty)
  if (pending && !next.specialties.includes(pending) && next.specialties.length < MAX_PROFESSIONAL_SPECIALTIES) next.specialties.push(pending)
  return { ...next, customSpecialty: '' }
}

function specialtyLabel(value) {
  const item = describeSpecialty(value)
  return item.kind === 'teaching' ? `${t('Lecionar')}: ${t(item.label)}` : t(item.label)
}

export default function ProfessionalOnboarding({ onDone = undefined }) {
  const auth = useAuth()
  const generation = useStore(state => state.getScopeToken().generation)
  return <ProfessionalSetup key={`${auth.status}:${auth.user?.id || ''}:${generation}`} auth={auth} onDone={onDone} />
}

function ProfessionalSetup({ auth, onDone }) {
  const navigate = useNavigate()
  const id = useId()
  const userId = auth.status === 'authenticated' ? auth.user?.id : null
  const token = useRef(useStore.getState().getScopeToken())
  const active = useRef(false)
  const locked = useRef(false)
  const nameRef = useRef(null)
  const initial = useRef(restoredDraft(userId))
  const repository = useMemo(() => createProfessionalProfileRepository({ client: getBrowserSupabaseClient() }), [])
  const [step, setStep] = useState(initial.current?.step || 0)
  const [values, setValues] = useState(() => initial.current?.values || { ...EMPTY, specialties: [], professionalName: auth.user?.displayName || '' })
  const [capability, setCapability] = useState(false)
  const [verification, setVerification] = useState('unverified')
  const [busy, setBusy] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [nameInvalid, setNameInvalid] = useState(false)
  const [complete, setComplete] = useState(false)
  const isCurrent = useCallback(() => active.current && !!userId && token.current.scope.kind === 'account' && token.current.scope.userId === userId && useStore.getState().isScopeCurrent(token.current), [userId])

  useEffect(() => {
    active.current = true
    return () => { active.current = false }
  }, [])

  useEffect(() => {
    let current = true
    if (!isCurrent()) { setBusy(false); return undefined }
    setBusy(true); setLoadError(false)
    Promise.all([repository.role(userId), repository.own(userId)]).then(([role, profile]) => {
      if (!current || !isCurrent()) return
      setCapability(role)
      setVerification(profile?.verificationStatus || 'unverified')
      if (!initial.current) setValues(profileValues(profile || {}, auth.user?.displayName || ''))
    }).catch(() => { if (current && isCurrent()) setLoadError(true) }).finally(() => { if (current && isCurrent()) setBusy(false) })
    return () => { current = false }
  }, [userId, auth.user?.displayName, repository, attempt, isCurrent])

  const update = (key, value) => { setValues(previous => ({ ...previous, [key]: value })); setError('') }
  const toggleSpecialty = value => setValues(previous => {
    const selected = previous.specialties.includes(value)
    if (!selected && previous.specialties.length >= MAX_PROFESSIONAL_SPECIALTIES) return previous
    return { ...previous, specialties: selected ? previous.specialties.filter(item => item !== value) : [...previous.specialties, value] }
  })
  const persistDraft = async (nextStep, nextValues) => {
    if (!isCurrent()) return false
    const store = useStore.getState()
    store.update(state => { state.onboardingDraft = { version: 1, owner: `account:${userId}`, kind: 'professional', step: nextStep, values: nextValues } })
    const ok = typeof store.flushPersistence === 'function' ? await store.flushPersistence() : useStore.getState().persistence?.state !== 'error'
    if (!isCurrent()) return false
    if (!ok) throw new Error('local-write-failed')
    return true
  }
  const localFailure = () => t('Não foi possível salvar neste dispositivo. Libere espaço e tente novamente.')
  const submit = async event => {
    event.preventDefault()
    if (locked.current || !isCurrent()) return
    if (!values.professionalName.trim()) { setNameInvalid(true); nameRef.current?.focus(); return }
    locked.current = true; setSaving(true); setError(''); setNameInvalid(false)
    const nextValues = collectedValues(values)
    let completing = false
    let previousCompletion
    try {
      if (step < 2) {
        if (await persistDraft(step + 1, nextValues)) { setValues(nextValues); setStep(step + 1) }
        return
      }
      if (!await persistDraft(2, nextValues)) return
      const payload = { ...nextValues, cityRegion: composeCityRegion(nextValues) }
      const profile = await (capability ? repository.save(userId, payload) : repository.provision(userId, payload))
      if (!isCurrent()) return
      if (!profile?.professionalName) throw new Error('professional-profile-save-failed')
      setCapability(true)
      completing = true
      const store = useStore.getState()
      previousCompletion = { profile: store.S.profile, version: store.S.onboardingVersion }
      store.update(state => { state.profile = { ...state.profile, name: nextValues.professionalName, completedAt: new Date().toISOString() }; state.onboardingDone = true; state.onboardingVersion = 1; state.onboardingDraft = null })
      const ok = typeof store.flushPersistence === 'function' ? await store.flushPersistence() : useStore.getState().persistence?.state !== 'error'
      if (!isCurrent()) return
      if (!ok) throw new Error('local-write-failed')
      setValues(nextValues); setComplete(true)
    } catch (cause) {
      if (!isCurrent()) return
      if (completing) {
        const store = useStore.getState()
        store.update(state => { state.profile = previousCompletion.profile; state.onboardingDone = false; if (previousCompletion.version === undefined) delete state.onboardingVersion; else state.onboardingVersion = previousCompletion.version; state.onboardingDraft = { version: 1, owner: `account:${userId}`, kind: 'professional', step: 2, values: nextValues } })
        if (typeof store.flushPersistence === 'function') await store.flushPersistence().catch(() => false)
        if (!isCurrent()) return
      }
      setError(cause.message === 'local-write-failed' ? localFailure() : appErrorMessage(cause, t('Não foi possível salvar o perfil profissional. Verifique sua conexão e tente novamente.')))
    } finally {
      locked.current = false
      if (isCurrent()) setSaving(false)
    }
  }
  const back = async () => {
    if (locked.current || !step || !isCurrent()) return
    locked.current = true; setSaving(true); setError('')
    try {
      const next = collectedValues(values)
      if (await persistDraft(step - 1, next)) { setValues(next); setStep(step - 1) }
    } catch { if (isCurrent()) setError(localFailure()) }
    finally { locked.current = false; if (isCurrent()) setSaving(false) }
  }
  const finish = destination => { if (isCurrent() && complete) { if (onDone) onDone(destination); else navigate(destination, { replace: true }) } }
  const unavailable = !userId || token.current.scope.kind !== 'account' || token.current.scope.userId !== userId
  const chips = (teaching = false) => <div className="professional-onboarding-chips" role="group" aria-label={teaching ? t('Lecionar') : t('Especialidades')}>
    {PRACTICE_SPECIALTIES.map(item => {
      const value = teaching ? teachingSpecialty(item.id) : item.id
      const selected = values.specialties.includes(value)
      return <button key={value} type="button" className="professional-onboarding-chip" aria-pressed={selected} disabled={saving || (!selected && values.specialties.length >= MAX_PROFESSIONAL_SPECIALTIES)} onClick={() => toggleSpecialty(value)}>{t(item.label)}</button>
    })}
  </div>
  const verificationLabel = verification === 'verified' ? t('Verificado') : verification === 'pending' ? t('Em análise') : verification === 'rejected' ? t('Não aprovado') : t('Não verificado')
  const nameErrorId = `${id}-name-error`

  return <JourneyLayout variant="professional" title={complete ? t('Seu espaço profissional está pronto') : t(TITLES[step])} description={complete ? t('Agora você pode convidar seus alunos e organizar os próximos treinos.') : t(DESCRIPTIONS[step])} step={complete ? 3 : step + 1} total={3} onBack={!complete && step > 0 && !saving ? back : undefined}>
    <div className="professional-onboarding">
      {unavailable ? <p role="status" className="journey-note">{t('Entre na sua conta para concluir o perfil profissional.')}</p>
        : busy ? <p role="status" className="journey-note">{t('Carregando…')}</p>
          : loadError ? <div className="professional-onboarding-error"><p role="alert">{t('Não foi possível carregar o perfil profissional.')}</p><Button activation="immediate" onClick={() => setAttempt(value => value + 1)}>{t('Tentar novamente')}</Button></div>
            : complete ? <div className="professional-onboarding-complete">
              <div className="professional-onboarding-identity"><span className="professional-onboarding-monogram" aria-hidden="true">{values.professionalName.charAt(0).toUpperCase()}</span><div><p className="journey-eyebrow">{t('Perfil profissional')}</p><h2>{values.professionalName}</h2><p>{t('Tudo pronto para acompanhar seus alunos.')}</p></div></div>
              <div className="professional-onboarding-next">
                <Button variant="primary" activation="immediate" onClick={() => finish('/professional')}>{t('Abrir painel profissional')}</Button>
                <Button activation="immediate" onClick={() => finish('/professional/invites')}>{t('Convidar alunos')}</Button>
                <Button activation="immediate" onClick={() => finish('/professional/programs')}>{t('Criar meu primeiro modelo')}</Button>
              </div>
            </div> : <form onSubmit={submit} noValidate aria-busy={saving || undefined}>
              {error && <p role="alert" className="professional-onboarding-error">{error}</p>}
              {step === 0 && <fieldset disabled={saving} className="professional-onboarding-fields">
                <legend className="journey-eyebrow">{t('Apresentação')}</legend>
                <label htmlFor={`${id}-name`}>{t('Nome profissional')}<TextField id={`${id}-name`} ref={nameRef} name="professionalName" value={values.professionalName} maxLength={120} required autoComplete="name" aria-invalid={nameInvalid || undefined} aria-describedby={nameInvalid ? nameErrorId : undefined} onChange={event => { update('professionalName', event.target.value); setNameInvalid(false) }} /></label>
                {nameInvalid && <p role="alert" id={nameErrorId} className="professional-onboarding-error">{t('Informe seu nome profissional.')}</p>}
                <label htmlFor={`${id}-bio`}>{t('Bio')} <span className="professional-onboarding-optional">{t('opcional')}</span><TextArea id={`${id}-bio`} name="bio" value={values.bio} maxLength={2000} rows={3} onChange={event => update('bio', event.target.value)} /></label>
                <div><p className="professional-onboarding-label">{t('Especialidades')} <span className="professional-onboarding-optional">{t('opcional')}</span></p>{chips()}</div>
                <details className="professional-onboarding-extra"><summary>{t('Também leciono')}</summary>{chips(true)}</details>
                <label htmlFor={`${id}-specialty`}>{t('Outra especialidade')}<TextField id={`${id}-specialty`} name="customSpecialty" value={values.customSpecialty} maxLength={MAX_SPECIALTY_LENGTH} disabled={values.specialties.length >= MAX_PROFESSIONAL_SPECIALTIES} onChange={event => update('customSpecialty', event.target.value)} /></label>
                {values.specialties.some(value => !PRACTICE_SPECIALTIES.some(item => value === item.id || value === teachingSpecialty(item.id))) && <div className="professional-onboarding-chips">{values.specialties.filter(value => !PRACTICE_SPECIALTIES.some(item => value === item.id || value === teachingSpecialty(item.id))).map(value => <button key={value} type="button" className="professional-onboarding-chip" aria-pressed="true" title={t('Clique para remover')} onClick={() => toggleSpecialty(value)}>{specialtyLabel(value)} <span aria-hidden="true">×</span></button>)}</div>}
                <p className="journey-note">{t('Escolha até {0} especialidades. Você pode editar seu perfil depois.', MAX_PROFESSIONAL_SPECIALTIES)}</p>
              </fieldset>}
              {step === 1 && <fieldset disabled={saving} className="professional-onboarding-fields">
                <legend className="journey-eyebrow">{t('Dados profissionais')}</legend>
                <p className="journey-note">{t('Estes dados são opcionais e podem ser preenchidos depois.')}</p>
                <div className="journey-field-grid professional-onboarding-location">
                  <label htmlFor={`${id}-state`}>{t('Estado')}<select id={`${id}-state`} name="stateUf" className="field" autoComplete="address-level1" value={values.stateUf} onChange={event => setValues(previous => ({ ...previous, stateUf: event.target.value, cityName: '' }))}><option value="">{t('Selecione o estado')}</option>{BRAZILIAN_STATES.map(state => <option key={state.uf} value={state.uf}>{state.name} ({state.uf})</option>)}</select></label>
                  <label htmlFor={`${id}-city`}>{t('Cidade')}<TextField id={`${id}-city`} name="cityName" autoComplete="address-level2" value={values.cityName} maxLength={80} onChange={event => update('cityName', event.target.value)} /></label>
                </div>
                <label htmlFor={`${id}-neighborhood`}>{t('Bairro')}<TextField id={`${id}-neighborhood`} name="neighborhood" autoComplete="address-level3" value={values.neighborhood} maxLength={80} onChange={event => update('neighborhood', event.target.value)} /></label>
                <div className="professional-onboarding-registration"><h2>{t('Registro profissional')}</h2><div className="journey-field-grid">
                  <label htmlFor={`${id}-registration-type`}>{t('Tipo de registro')}<TextField id={`${id}-registration-type`} name="registrationType" value={values.registrationType} maxLength={40} onChange={event => update('registrationType', event.target.value)} /></label>
                  <label htmlFor={`${id}-registration-number`}>{t('Número do registro')}<TextField id={`${id}-registration-number`} name="registrationNumber" value={values.registrationNumber} maxLength={80} onChange={event => update('registrationNumber', event.target.value)} /></label>
                </div><p className="journey-note">{t('Informar um registro não significa que ele foi verificado. O status é controlado pelo sistema.')}</p></div>
                <div className="professional-onboarding-contact"><p className="professional-onboarding-label">{t('Contato opcional')}</p><AccountPhone editable /><p className="journey-note">{t('O telefone usa o contato da sua conta e é salvo separadamente.')}</p></div>
              </fieldset>}
              {step === 2 && <div className="professional-onboarding-review">
                <div className="professional-onboarding-identity"><span className="professional-onboarding-monogram" aria-hidden="true">{values.professionalName.charAt(0).toUpperCase()}</span><div><p className="journey-eyebrow">{t('Apresentação')}</p><h2>{values.professionalName}</h2>{values.bio && <p>{values.bio}</p>}</div></div>
                <dl className="journey-summary"><div><dt>{t('Especialidades')}</dt><dd>{values.specialties.length ? values.specialties.map(specialtyLabel).join(' · ') : t('Não informado')}</dd></div><div><dt>{t('Localização')}</dt><dd>{composeCityRegion(values) || t('Não informado')}</dd></div><div><dt>{t('Registro profissional')}</dt><dd>{[values.registrationType, values.registrationNumber].filter(Boolean).join(' · ') || t('Não informado')}<span className="professional-onboarding-status">{verificationLabel}</span></dd></div></dl>
                <p className="journey-note">{t('Seu perfil será salvo ao concluir. O registro continua com o status informado pelo sistema.')}</p>
              </div>}
              <div className="journey-actions"><Button variant="primary" type="submit" activation="immediate" disabled={saving}>{saving ? t('Salvando…') : step === 2 ? t('Concluir perfil profissional') : t('Continue')}</Button></div>
            </form>}
    </div>
  </JourneyLayout>
}
