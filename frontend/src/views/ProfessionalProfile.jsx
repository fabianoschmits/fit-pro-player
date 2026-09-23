import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider.jsx'
import { getBrowserSupabaseClient } from '../lib/supabase-client.js'
import { createProfessionalProfileRepository } from '../lib/professional-profile.js'
import { TextArea, TextField, Button, Section } from '../components/ui.jsx'
import AppHeader from '../components/AppHeader.jsx'

const EMPTY = { professionalName: '', bio: '', specialties: [], cityRegion: '', registrationType: '', registrationNumber: '', verificationStatus: 'unverified' }

export default function ProfessionalProfile() {
  const nav = useNavigate()
  const auth = useAuth()
  const client = useMemo(() => getBrowserSupabaseClient(), [])
  const repository = useMemo(() => createProfessionalProfileRepository({ client }), [client])
  const [profile, setProfile] = useState(EMPTY)
  const [mode, setMode] = useState('view')
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
    }).catch(() => { if (active) setError('Não foi possível carregar o perfil profissional.') }).finally(() => { if (active) setBusy(false) })
    return () => { active = false }
  }, [auth.status, auth.user?.id, repository])

  const update = (key, value) => setProfile(current => ({ ...current, [key]: value }))
  const save = async () => {
    setSaving(true); setError('')
    try {
      const next = await repository.save(auth.user.id, profile)
      setProfile({ ...EMPTY, ...next }); setMode('view')
    } catch (cause) { setError(cause.message === 'professional-profile-forbidden' ? 'Sua conta não possui a capability profissional.' : 'Não foi possível salvar agora. Verifique sua conexão.') }
    finally { setSaving(false) }
  }

  if (auth.status !== 'authenticated') return <div className="narrow"><AppHeader title="Perfil profissional" backTo="/more" /><Section><p>Entre em uma conta para acessar o perfil profissional.</p></Section></div>
  if (busy) return <div className="narrow"><AppHeader title="Perfil profissional" backTo="/more" /><p role="status">Carregando…</p></div>
  if (!capability) return <div className="narrow"><AppHeader title="Perfil profissional" backTo="/more" /><Section><p>Esta área exige a capability profissional. Seu perfil de treino continua disponível.</p></Section></div>

  const preview = mode === 'preview'
  return <div className="narrow">
    <AppHeader title="Perfil profissional" backTo="/more" />
    <div className="seg" role="tablist" aria-label="Modo do perfil">
      {['view', 'edit', 'preview'].map(item => <button key={item} type="button" role="tab" aria-selected={mode === item} onClick={() => setMode(item)}>{item === 'view' ? 'Ver' : item === 'edit' ? 'Editar' : 'Preview'}</button>)}
    </div>
    {error && <p role="alert" className="error">{error}</p>}
    {preview || mode === 'view' ? <Section title={profile.professionalName || 'Sem perfil profissional'}>
      <p>{profile.bio || 'Adicione uma apresentação curta.'}</p>
      {!!profile.specialties?.length && <p><strong>Especialidades:</strong> {profile.specialties.join(', ')}</p>}
      {profile.cityRegion && <p>{profile.cityRegion}</p>}
      {profile.registrationType && <p>Registro informado: {profile.registrationType} {profile.registrationNumber || ''}</p>}
      <p className="muted small">Status do registro: {profile.verificationStatus === 'unverified' ? 'não verificado' : profile.verificationStatus}</p>
      {mode === 'view' && <Button onClick={() => setMode('edit')}>Editar perfil</Button>}
    </Section> : <Section title="Editar perfil">
      <label>Nome profissional<TextField value={profile.professionalName} onChange={event => update('professionalName', event.target.value)} maxLength={120} /></label>
      <label>Bio<TextArea value={profile.bio || ''} onChange={event => update('bio', event.target.value)} maxLength={2000} rows={5} /></label>
      <label>Especialidades<TextField value={(profile.specialties || []).join(', ')} onChange={event => update('specialties', event.target.value.split(',').map(value => value.trim().toLowerCase()).filter(Boolean).slice(0, 8))} /></label>
      <label>Cidade/região<TextField value={profile.cityRegion || ''} onChange={event => update('cityRegion', event.target.value)} maxLength={120} /></label>
      <label>Tipo de registro<TextField value={profile.registrationType || ''} onChange={event => update('registrationType', event.target.value)} maxLength={40} /></label>
      <label>Número do registro<TextField value={profile.registrationNumber || ''} onChange={event => update('registrationNumber', event.target.value)} maxLength={80} /></label>
      <p className="muted small">Salvar exige conexão. O status de verificação é controlado pelo sistema.</p>
      <Button disabled={saving} onClick={save}>{saving ? 'Salvando…' : 'Salvar perfil'}</Button>
    </Section>}
  </div>
}
