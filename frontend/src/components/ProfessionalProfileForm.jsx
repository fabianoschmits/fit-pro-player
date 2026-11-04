import { useEffect, useId, useRef, useState } from 'react'
import { BRAZILIAN_STATES, composeCityRegion, fetchBrazilianCities, fetchBrazilianStates } from '../lib/brazil-locations.js'
import { t } from '../lib/i18n.js'
import { combineProfessionalSpecialties, MAX_PROFESSIONAL_SPECIALTIES, MAX_SPECIALTY_LENGTH, PRACTICE_SPECIALTIES, splitProfessionalSpecialties } from '../lib/professional-specialties.js'
import { Button, TextArea, TextField } from './ui.jsx'

function emptyDraft(profile) {
  const split = splitProfessionalSpecialties(profile.specialties || [])
  return {
    professionalName: profile.professionalName || '',
    bio: profile.bio || '',
    practice: split.practice,
    teaching: split.teaching,
    custom: split.custom,
    customDraft: '',
    stateUf: profile.stateUf || '',
    cityName: profile.cityName || '',
    neighborhood: profile.neighborhood || '',
    registrationType: profile.registrationType || '',
    registrationNumber: profile.registrationNumber || '',
  }
}

export default function ProfessionalProfileForm({
  profile,
  onSave = undefined,
  onCancel = undefined,
  saving,
  state = 'idle',
  provisioning = false,
  submitLabel = undefined,
  cancelLabel = undefined,
}) {
  const id = useId()
  const nameRef = useRef(null)
  const [draft, setDraft] = useState(() => emptyDraft(profile))
  const [nameError, setNameError] = useState(false)
  const [states, setStates] = useState(() => BRAZILIAN_STATES)
  const [cities, setCities] = useState([])
  const [locationError, setLocationError] = useState('')
  const [practiceOpen, setPracticeOpen] = useState(false)
  const [teachingOpen, setTeachingOpen] = useState(false)
  const selectedCount = draft.practice.length + draft.teaching.length + draft.custom.length
  const atLimit = selectedCount >= MAX_PROFESSIONAL_SPECIALTIES

  useEffect(() => {
    let current = true
    fetchBrazilianStates().then(items => { if (current && items?.length) { setStates(items); setLocationError('') } }).catch(() => { if (current) setLocationError(t('Não foi possível carregar estados e cidades agora.')) })
    return () => { current = false }
  }, [])

  useEffect(() => {
    if (!draft.stateUf) { setCities([]); return undefined }
    let current = true
    fetchBrazilianCities(draft.stateUf).then(items => { if (current) setCities(items) }).catch(() => { if (current) setLocationError(t('Não foi possível carregar as cidades deste estado.')) })
    return () => { current = false }
  }, [draft.stateUf])

  const update = (key, value) => setDraft(current => ({ ...current, [key]: value }))
  const toggle = (group, value) => setDraft(current => {
    const selected = current[group].includes(value)
    if (!selected && current.practice.length + current.teaching.length + current.custom.length >= MAX_PROFESSIONAL_SPECIALTIES) return current
    return { ...current, [group]: selected ? current[group].filter(item => item !== value) : [...current[group], value] }
  })
  const addCustom = () => {
    const value = draft.customDraft.trim().toLowerCase().slice(0, MAX_SPECIALTY_LENGTH)
    if (!value || draft.custom.includes(value) || atLimit) return
    setDraft(current => ({ ...current, custom: [...current.custom, value], customDraft: '' }))
  }
  const submit = event => {
    event.preventDefault()
    if (saving) return
    if (!draft.professionalName.trim()) { setNameError(true); nameRef.current?.focus(); return }
    setNameError(false)
    const pending = draft.customDraft.trim().toLowerCase().slice(0, MAX_SPECIALTY_LENGTH)
    const custom = pending && !draft.custom.includes(pending) && !atLimit ? [...draft.custom, pending] : draft.custom
    const specialties = combineProfessionalSpecialties({ ...draft, custom })
    const cityRegion = composeCityRegion(draft)
    onSave({
      ...draft,
      professionalName: draft.professionalName.trim(),
      bio: draft.bio,
      specialties,
      cityRegion,
      stateUf: draft.stateUf || null,
      cityName: draft.cityName || null,
      neighborhood: draft.neighborhood.trim() || null,
      registrationType: draft.registrationType,
      registrationNumber: draft.registrationNumber,
    }, event)
  }
  const chips = (group, items, prefix = '') => (
    <div className="management-choice-chips" role="group">
      {items.map(item => {
        const pressed = draft[group].includes(item.id)
        return <button key={`${group}-${item.id}`} type="button" className="management-choice-chip" aria-pressed={pressed} disabled={saving || (!pressed && atLimit)} onClick={() => toggle(group, item.id)}>{prefix}{item.label}</button>
      })}
    </div>
  )

  const selectedPracticeChips = PRACTICE_SPECIALTIES.filter(item => draft.practice.includes(item.id))
  const selectedTeachingChips = PRACTICE_SPECIALTIES.filter(item => draft.teaching.includes(item.id))

  return <form className="management-profile-form" onSubmit={submit} aria-busy={saving || undefined} noValidate>
    <fieldset disabled={saving} className="management-form-group">
      <legend>{t('Apresentação')}</legend>
      <label htmlFor={`${id}-name`}>{t('Nome profissional')}<TextField id={`${id}-name`} ref={nameRef} name="professionalName" autoComplete="name" value={draft.professionalName} onChange={event => { update('professionalName', event.target.value); setNameError(false) }} maxLength={120} required aria-invalid={nameError || undefined} aria-describedby={nameError ? `${id}-name-error` : undefined} /></label>
      {nameError && <p id={`${id}-name-error`} role="alert" className="management-error">{t('Informe seu nome profissional.')}</p>}
      <label htmlFor={`${id}-bio`}>{t('Bio')}<TextArea id={`${id}-bio`} name="bio" value={draft.bio || ''} onChange={event => update('bio', event.target.value)} maxLength={2000} rows={3} /></label>
    </fieldset>
    <fieldset disabled={saving} className="management-form-group">
      <legend>{t('Atuação')}</legend>
      <div>
        <p id={`${id}-practice-label`} className="management-field-label">{t('Especialidades')}</p>
        <button
          type="button"
          className="management-accordion-toggle"
          aria-expanded={practiceOpen}
          aria-controls={`${id}-practice-panel`}
          onClick={() => setPracticeOpen(v => !v)}
        >
          <span>{practiceOpen ? t('Fechar lista de especialidades') : t('Selecionar especialidades')}</span>
          <span className="management-toggle-badge">{draft.practice.length ? `${draft.practice.length} selecionada(s)` : t('Toque para escolher')} {practiceOpen ? '▲' : '▼'}</span>
        </button>
        {practiceOpen && (
          <div id={`${id}-practice-panel`} className="management-scroll-panel">
            {chips('practice', PRACTICE_SPECIALTIES)}
          </div>
        )}
        {Boolean(selectedPracticeChips.length) && (
          <div style={{ marginTop: 8 }}>
            <p className="management-help" style={{ marginBottom: 4 }}>{t('Especialidades selecionadas:')}</p>
            <div className="management-choice-chips">
              {selectedPracticeChips.map(item => (
                <button
                  key={`selected-practice-${item.id}`}
                  type="button"
                  className="management-choice-chip"
                  aria-pressed="true"
                  title={t('Clique para desmarcar')}
                  onClick={() => toggle('practice', item.id)}
                >
                  {item.label} ✕
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div>
        <p id={`${id}-teaching-label`} className="management-field-label">{t('Lecionar')}</p>
        <p className="management-help">{t('Marque também as especialidades que você leciona.')}</p>
        <button
          type="button"
          className="management-accordion-toggle"
          aria-expanded={teachingOpen}
          aria-controls={`${id}-teaching-panel`}
          onClick={() => setTeachingOpen(v => !v)}
        >
          <span>{teachingOpen ? t('Fechar lista para lecionar') : t('Selecionar o que leciona')}</span>
          <span className="management-toggle-badge">{draft.teaching.length ? `${draft.teaching.length} selecionada(s)` : t('Toque para escolher')} {teachingOpen ? '▲' : '▼'}</span>
        </button>
        {teachingOpen && (
          <div id={`${id}-teaching-panel`} className="management-scroll-panel">
            {chips('teaching', PRACTICE_SPECIALTIES, `${t('Lecionar')} `)}
          </div>
        )}
        {Boolean(selectedTeachingChips.length) && (
          <div style={{ marginTop: 8 }}>
            <p className="management-help" style={{ marginBottom: 4 }}>{t('Disciplinas que você leciona:')}</p>
            <div className="management-choice-chips">
              {selectedTeachingChips.map(item => (
                <button
                  key={`selected-teaching-${item.id}`}
                  type="button"
                  className="management-choice-chip"
                  aria-pressed="true"
                  title={t('Clique para desmarcar')}
                  onClick={() => toggle('teaching', item.id)}
                >
                  {t('Lecionar')} {item.label} ✕
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <label htmlFor={`${id}-custom`}>{t('Outra especialidade')}
        <span className="management-chip-input management-chip-input--stacked">
          <TextField id={`${id}-custom`} name="customSpecialty" value={draft.customDraft} onChange={event => update('customDraft', event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); addCustom() } }} maxLength={MAX_SPECIALTY_LENGTH} aria-describedby={`${id}-specialties-hint`} disabled={atLimit} />
          <Button type="button" activation="immediate" disabled={saving || atLimit || !draft.customDraft.trim()} onClick={addCustom}>{t('Adicionar')}</Button>
        </span>
      </label>
      {!!draft.custom.length && <ul className="management-specialties">{draft.custom.map(value => (
        <li key={value}><button type="button" className="management-choice-chip" aria-pressed="true" title={t('Clique para remover')} onClick={() => setDraft(current => ({ ...current, custom: current.custom.filter(item => item !== value) }))}>{value} ✕</button></li>
      ))}</ul>}
      <p id={`${id}-specialties-hint`} className="management-help">{t('Escolha uma ou mais opções e, se quiser, digite especialidades extras. Até {0} no total.', MAX_PROFESSIONAL_SPECIALTIES)}</p>
      
      <div className="management-form-columns">
        <label htmlFor={`${id}-state`}>{t('Estado')}
          <select id={`${id}-state`} className="field" name="stateUf" aria-label={t('Estado')} value={draft.stateUf} onChange={event => setDraft(current => ({ ...current, stateUf: event.target.value, cityName: '' }))}>
            <option value="">{t('Selecione o estado')}</option>
            {states.map(item => <option key={item.uf} value={item.uf}>{item.name} ({item.uf})</option>)}
          </select>
        </label>
        <label htmlFor={`${id}-city`}>{t('Cidade')}
          <select id={`${id}-city`} className="field" name="cityName" aria-label={t('Cidade')} value={draft.cityName} onChange={event => update('cityName', event.target.value)} disabled={!draft.stateUf}>
            <option value="">{t('Selecione a cidade')}</option>
            {cities.map(item => <option key={item.id || item.name} value={item.name}>{item.name}</option>)}
            {draft.cityName && !cities.some(item => item.name === draft.cityName) && <option value={draft.cityName}>{draft.cityName}</option>}
          </select>
        </label>
      </div>
      <label htmlFor={`${id}-neighborhood`}>{t('Bairro')}<TextField id={`${id}-neighborhood`} name="neighborhood" value={draft.neighborhood} onChange={event => update('neighborhood', event.target.value)} maxLength={80} autoComplete="address-level3" /></label>
      {locationError && <p className="management-help" role="status">{locationError}</p>}
    </fieldset>
    <fieldset disabled={saving} className="management-form-group">
      <legend>{t('Registro profissional')}</legend>
      <div className="management-form-columns">
        <label htmlFor={`${id}-type`}>{t('Tipo de registro')}<TextField id={`${id}-type`} name="registrationType" value={draft.registrationType || ''} onChange={event => update('registrationType', event.target.value)} maxLength={40} /></label>
        <label htmlFor={`${id}-number`}>{t('Número do registro')}<TextField id={`${id}-number`} name="registrationNumber" value={draft.registrationNumber || ''} onChange={event => update('registrationNumber', event.target.value)} maxLength={80} /></label>
      </div>
      <p className="management-help">{t('Salvar exige conexão. O status de verificação é controlado pelo sistema.')}</p>
    </fieldset>
    <div className="management-form-actions">
      <Button feedback="persistence" type="submit" variant="primary" intent="primary" state={state === 'success' ? state : saving ? 'loading' : state} loadingLabel={provisioning ? t('Criando…') : t('Salvando…')} successLabel={t('Perfil salvo.')} errorLabel={t('Tentar novamente')} disabled={saving}>{submitLabel || (provisioning ? t('Criar perfil profissional') : t('Salvar perfil'))}</Button>
      <Button type="button" activation="immediate" disabled={saving} onClick={onCancel}>{cancelLabel || t('Cancelar')}</Button>
    </div>
  </form>
}
