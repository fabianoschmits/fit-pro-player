import { useId, useRef, useState } from 'react'
import { t } from '../lib/i18n.js'
import { Button, TextArea, TextField } from './ui.jsx'

export default function ProfessionalProfileForm({ profile, onSave, onCancel, saving, provisioning = false }) {
  const id = useId()
  const nameRef = useRef(null)
  const [draft, setDraft] = useState(() => ({ ...profile, specialties: (profile.specialties || []).join(', ') }))
  const [nameError, setNameError] = useState(false)
  const update = (key, value) => setDraft(current => ({ ...current, [key]: value }))
  const submit = event => {
    event.preventDefault()
    if (saving) return
    if (!draft.professionalName.trim()) { setNameError(true); nameRef.current?.focus(); return }
    setNameError(false)
    onSave({ ...draft, professionalName: draft.professionalName.trim(), specialties: draft.specialties.split(',').map(value => value.trim().toLowerCase()).filter(Boolean).slice(0, 8) })
  }
  return <form className="management-profile-form" onSubmit={submit} noValidate>
    <fieldset disabled={saving} className="management-form-group">
      <legend>{t('Apresentação')}</legend>
      <label htmlFor={`${id}-name`}>{t('Nome profissional')}<TextField id={`${id}-name`} ref={nameRef} name="professionalName" autoComplete="name" value={draft.professionalName} onChange={event => { update('professionalName', event.target.value); setNameError(false) }} maxLength={120} required aria-invalid={nameError || undefined} aria-describedby={nameError ? `${id}-name-error` : undefined} /></label>
      {nameError && <p id={`${id}-name-error`} role="alert" className="management-error">{t('Informe seu nome profissional.')}</p>}
      <label htmlFor={`${id}-bio`}>{t('Bio')}<TextArea id={`${id}-bio`} name="bio" value={draft.bio || ''} onChange={event => update('bio', event.target.value)} maxLength={2000} rows={5} /></label>
    </fieldset>
    <fieldset disabled={saving} className="management-form-group">
      <legend>{t('Atuação')}</legend>
      <label htmlFor={`${id}-specialties`}>{t('Especialidades')}<TextField id={`${id}-specialties`} name="specialties" value={draft.specialties} onChange={event => update('specialties', event.target.value)} aria-describedby={`${id}-specialties-hint`} /></label>
      <p id={`${id}-specialties-hint`} className="management-help">{t('Separe por vírgulas. Até 8 especialidades.')}</p>
      <label htmlFor={`${id}-city`}>{t('Cidade/região')}<TextField id={`${id}-city`} name="cityRegion" autoComplete="address-level2" value={draft.cityRegion || ''} onChange={event => update('cityRegion', event.target.value)} maxLength={120} /></label>
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
      <Button type="submit" variant="primary" disabled={saving}>{saving ? (provisioning ? t('Criando…') : t('Salvando…')) : (provisioning ? t('Criar perfil profissional') : t('Salvar perfil'))}</Button>
      <Button type="button" disabled={saving} onClick={onCancel}>{t('Cancelar')}</Button>
    </div>
  </form>
}
