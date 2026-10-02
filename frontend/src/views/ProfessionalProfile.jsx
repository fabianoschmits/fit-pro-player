import { t } from '../lib/i18n.js'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider.jsx'
import { getBrowserSupabaseClient } from '../lib/supabase-client.js'
import { createProfessionalProfileRepository } from '../lib/professional-profile.js'
import { TextArea, TextField, Button, Section } from '../components/ui.jsx'
import AppHeader from '../components/AppHeader.jsx'

const EMPTY = { professionalName: '', bio: '', specialties: [], cityRegion: '', registrationType: '', registrationNumber: '', verificationStatus: 'unverified' }

export default function ProfessionalProfile() {
  const nav = useNavigate()
  const [params] = useSearchParams()
  const auth = useAuth()
  const client = useMemo(() => getBrowserSupabaseClient(), [])
  const repository = useMemo(() => createProfessionalProfileRepository({ client }), [client])
  const [profile, setProfile] = useState(EMPTY)
  const [mode, setMode] = useState(() => params.get('onboarding') === '1' ? 'onboarding' : 'view')
  const [capability, setCapability] = useState(null)
  const [busy, setBusy] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    if (auth.status !== 'authenticated' || !auth.user?.id) { setBusy(false); return undefined }
    Promise.all([repository.role(auth.user.id), repository.own(auth.user.id)]).then(([role, current]) => {
      if (!active) return
      setCapability(role)
      if (current) setProfile({ ...EMPTY, ...current })
    }).catch(() => { if (active) setError(t('Não foi possível carregar o perfil profissional.')) }).finally(() => { if (active) setBusy(false) })
    return () => { active = false }
  }, [auth.status, auth.user?.id, repository])

  const update = (key, value) => setProfile(current => ({ ...current, [key]: value }))
  const save = async () => {
    setSaving(true); setError('')
    try {
      const next = await repository.save(auth.user.id, profile)
      setProfile({ ...EMPTY, ...next }); setMode('view')
    } catch (cause) { setError(cause.message === 'professional-profile-forbidden' ? t('Sua conta não possui a capability profissional.') : t('Não foi possível salvar agora. Verifique sua conexão.')) }
    finally { setSaving(false) }
  }
  const provision = async () => {
    setSaving(true); setError('')
    try {
      const next = await repository.provision(auth.user.id, profile)
      setProfile({ ...EMPTY, ...next }); setCapability(true); setMode('view'); nav('/professional-profile', { replace: true })
    } catch (cause) { setError(cause.message === 'professional-name-required' ? t('Informe seu nome profissional.') : t('Não foi possível criar o perfil profissional. Verifique sua conexão.')) }
    finally { setSaving(false) }
  }

  if (auth.status !== 'authenticated') return <div className="narrow"><AppHeader title={t("Perfil profissional")} backTo="/more" /><Section><p>{t("Entre em uma conta para acessar o perfil profissional.")}</p></Section></div>
  if (busy) return <div className="narrow"><AppHeader title={t("Perfil profissional")} backTo="/more" /><p role="status">{t("Carregando…")}</p></div>
  if (!capability) return <div className="narrow">
    <AppHeader title={t("Tornar-se profissional")} backTo="/settings" />
    <Section title={t("Crie seu perfil profissional")}>
      <p className="muted small">{t("Ative a área profissional para enviar treinos, gerar convites e acompanhar seus alunos.")}</p>
      {error && <p role="alert" className="error">{error}</p>}
      <label>{t("Nome profissional")}<TextField value={profile.professionalName} onChange={event => update('professionalName', event.target.value)} maxLength={120} /></label>
      <label>{t("Bio")}<TextArea value={profile.bio || ''} onChange={event => update('bio', event.target.value)} maxLength={2000} rows={5} /></label>
      <label>{t("Especialidades")}<TextField value={(profile.specialties || []).join(', ')} onChange={event => update('specialties', event.target.value.split(',').map(value => value.trim().toLowerCase()).filter(Boolean).slice(0, 8))} /></label>
      <label>{t("Cidade/região")}<TextField value={profile.cityRegion || ''} onChange={event => update('cityRegion', event.target.value)} maxLength={120} /></label>
      <label>{t("Tipo de registro")}<TextField value={profile.registrationType || ''} onChange={event => update('registrationType', event.target.value)} maxLength={40} /></label>
      <label>{t("Número do registro")}<TextField value={profile.registrationNumber || ''} onChange={event => update('registrationNumber', event.target.value)} maxLength={80} /></label>
      <Button disabled={saving} onClick={provision}>{saving ? t('Criando…') : t('Criar perfil profissional')}</Button>
    </Section>
  </div>

  const preview = mode === 'preview'
  return <div className="narrow">
    <AppHeader title={t("Perfil profissional")} backTo="/more" />
    <div className="seg" role="tablist" aria-label={t("Modo do perfil")}>
      {['view', 'edit', 'preview'].map(item => <button key={item} type="button" role="tab" aria-selected={mode === item} onClick={() => setMode(item)}>{t(item === 'view' ? 'Ver' : item === 'edit' ? 'Editar' : 'Preview')}</button>)}
    </div>
    {error && <p role="alert" className="error">{error}</p>}
    {preview || mode === 'view' ? <Section title={profile.professionalName || t('Sem perfil profissional')}>
      <p>{profile.bio || t('Adicione uma apresentação curta.')}</p>
      {!!profile.specialties?.length && <p><strong>{t("Especialidades:")}</strong> {profile.specialties.join(', ')}</p>}
      {profile.cityRegion && <p>{profile.cityRegion}</p>}
      {profile.registrationType && <p>{t('Registro informado: {0} {1}', profile.registrationType, profile.registrationNumber || '')}</p>}
      <p className="muted small">{t('Status do registro: {0}', profile.verificationStatus === 'unverified' ? t('não verificado') : profile.verificationStatus)}</p>
      {mode === 'view' && <Button onClick={() => setMode('edit')}>{t("Editar perfil")}</Button>}
    </Section> : <Section title={t("Editar perfil")}>
      <label>{t("Nome profissional")}<TextField value={profile.professionalName} onChange={event => update('professionalName', event.target.value)} maxLength={120} /></label>
      <label>{t("Bio")}<TextArea value={profile.bio || ''} onChange={event => update('bio', event.target.value)} maxLength={2000} rows={5} /></label>
      <label>{t("Especialidades")}<TextField value={(profile.specialties || []).join(', ')} onChange={event => update('specialties', event.target.value.split(',').map(value => value.trim().toLowerCase()).filter(Boolean).slice(0, 8))} /></label>
      <label>{t("Cidade/região")}<TextField value={profile.cityRegion || ''} onChange={event => update('cityRegion', event.target.value)} maxLength={120} /></label>
      <label>{t("Tipo de registro")}<TextField value={profile.registrationType || ''} onChange={event => update('registrationType', event.target.value)} maxLength={40} /></label>
      <label>{t("Número do registro")}<TextField value={profile.registrationNumber || ''} onChange={event => update('registrationNumber', event.target.value)} maxLength={80} /></label>
      <p className="muted small">{t("Salvar exige conexão. O status de verificação é controlado pelo sistema.")}</p>
      <Button disabled={saving} onClick={save}>{saving ? t('Salvando…') : t('Salvar perfil')}</Button>
    </Section>}
  </div>
}
