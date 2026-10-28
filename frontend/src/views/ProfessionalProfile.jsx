import { useStore } from '../store/useStore.js'
import Link from '../components/ManagementLink.jsx'
import { t } from '../lib/i18n.js'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider.jsx'
import { getBrowserSupabaseClient } from '../lib/supabase-client.js'
import { createProfessionalProfileRepository } from '../lib/professional-profile.js'
import { Button } from '../components/ui.jsx'
import ManagementLayout from '../components/ManagementLayout.jsx'
import { ManagementAvatar, ManagementPanel, ManagementStatus } from '../components/ManagementUI.jsx'
import ProfessionalProfileForm from '../components/ProfessionalProfileForm.jsx'
import { FppActionFeedback, FppSkeleton } from '../components/FppFeedback.jsx'
import { waitForFppConfirmation } from '../components/fpp-action-timing.js'

const EMPTY = { professionalName: '', bio: '', specialties: [], cityRegion: '', registrationType: '', registrationNumber: '', verificationStatus: 'unverified' }

// Changing the authenticated owner immediately removes all saved and draft identity data.
export default function ProfessionalProfile() {
  const auth = useAuth()
  return <ProfileWorkspace key={`${auth.status}:${auth.user?.id || ''}`} auth={auth} />
}

function ProfileWorkspace({ auth }) {
  const navigate = useNavigate()
  const avatarId = useStore(s => s.S.profile?.avatarId)
  const { pathname } = useLocation()
  const repository = useMemo(() => createProfessionalProfileRepository({ client: getBrowserSupabaseClient() }), [])
  const [profile, setProfile] = useState(EMPTY)
  const [capability, setCapability] = useState(null)
  const [busy, setBusy] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveState, setSaveState] = useState('idle')
  const savingRef = useRef(false)
  const [loadError, setLoadError] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [attempt, setAttempt] = useState(0)
  const active = useRef(false)
  const confirmation = useRef(null)
  const authenticated = auth.status === 'authenticated' && !!auth.user?.id
  const editing = pathname === '/professional/profile/edit'

  useEffect(() => {
    active.current = true
    return () => { active.current = false; confirmation.current?.abort() }
  }, [])

  useEffect(() => {
    let current = true
    if (!authenticated) { setBusy(false); return undefined }
    setBusy(true); setLoadError(false)
    Promise.all([repository.role(auth.user.id), repository.own(auth.user.id)]).then(([role, saved]) => {
      if (!current) return
      setCapability(role); setProfile({ ...EMPTY, ...saved })
    }).catch(() => { if (current) setLoadError(true) }).finally(() => { if (current) setBusy(false) })
    return () => { current = false }
  }, [authenticated, auth.user?.id, repository, attempt])

  useEffect(() => { setError(''); setSaveState('idle') }, [pathname])

  const persist = async (draft, event) => {
    if (savingRef.current) return false
    savingRef.current = true
    const provisioning = !capability
    setSaving(true); setSaveState('loading'); setError(''); setNotice('')
    try {
      const next = await (provisioning ? repository.provision(auth.user.id, draft) : repository.save(auth.user.id, draft))
      if (!active.current) return false
      setSaveState('success')
      confirmation.current = new AbortController()
      const confirmed = await waitForFppConfirmation(event, { signal: confirmation.current.signal })
      confirmation.current = null
      if (!confirmed || !active.current) return false
      setProfile({ ...EMPTY, ...next }); setCapability(true)
      setNotice(provisioning ? t('Perfil profissional criado.') : '')
      navigate(provisioning ? '/professional-profile' : '/professional/profile', { replace: true })
    } catch (cause) {
      if (!active.current) return false
      setSaveState('error')
      setError(cause.message === 'professional-name-required' ? t('Informe seu nome profissional.')
        : cause.message === 'professional-profile-forbidden' ? t('Sua conta não tem acesso à edição profissional.')
          : provisioning ? t('Não foi possível criar o perfil profissional. Verifique sua conexão.') : t('Não foi possível salvar agora. Verifique sua conexão.'))
      return false
    } finally { savingRef.current = false; if (active.current) setSaving(false) }
  }

  if (!authenticated) return <ManagementLayout title={t('Perfil profissional')} backTo="/more" nav={false}><ManagementPanel><p>{t('Entre em uma conta para acessar o perfil profissional.')}</p></ManagementPanel></ManagementLayout>
  if (busy) return <ManagementLayout title={t('Perfil profissional')} backTo="/more" nav={false}><FppSkeleton label={t('Carregando…')} /></ManagementLayout>
  if (loadError) return <ManagementLayout title={t('Perfil profissional')} backTo="/more" nav={false}><ManagementPanel><p role="alert" className="management-error">{t('Não foi possível carregar o perfil profissional.')}</p><Button onClick={() => setAttempt(value => value + 1)}>{t('Tentar novamente')}</Button></ManagementPanel></ManagementLayout>

  if (!capability || editing) return <ManagementLayout
    title={capability ? t('Editar perfil') : t('Tornar-se profissional')}
    subtitle={capability ? t('Atualize sua apresentação e seus dados profissionais.') : t('Ative a área profissional para enviar treinos, gerar convites e acompanhar seus alunos.')}
    backTo={capability ? '/professional/profile' : '/settings'}
    nav={capability ? undefined : false}
  >
    {error && <p role="alert" className="management-error">{error}</p>}
    <ProfessionalProfileForm key={pathname} profile={profile} saving={saving} state={saveState} provisioning={!capability} onSave={persist} onCancel={() => navigate(capability ? '/professional/profile' : '/settings')} />
  </ManagementLayout>

  const status = profile.verificationStatus === 'verified' ? t('Verificado') : profile.verificationStatus === 'pending' ? t('Em análise') : profile.verificationStatus === 'rejected' ? t('Não aprovado') : t('Não verificado')
  return <ManagementLayout title={t('Perfil profissional')} subtitle={t('Sua apresentação para os alunos.')} backTo="/more" action={<Link className="management-button management-button-primary" to="/professional/profile/edit">{t('Editar perfil')}</Link>}>
    {notice && <FppActionFeedback state="success" className="management-notice">{notice}</FppActionFeedback>}
    <ManagementPanel className="management-profile-identity">
      <div className="management-person-heading"><ManagementAvatar name={profile.professionalName} avatarRef={avatarId} userId={auth.user?.id} /><div><h2>{profile.professionalName || t('Sem perfil profissional')}</h2>{profile.cityRegion && <p>{profile.cityRegion}</p>}</div></div>
      <div className="management-profile-bio"><h3>{t('Apresentação')}</h3><p>{profile.bio || t('Adicione uma apresentação curta.')}</p></div>
    </ManagementPanel>
    <div className="management-profile-details">
      <ManagementPanel title={t('Atuação')}>
        <dl className="management-facts"><div><dt>{t('Especialidades')}</dt><dd>{profile.specialties.length ? <ul className="management-specialties">{profile.specialties.map(value => <li key={value}>{value}</li>)}</ul> : t('Não informado')}</dd></div><div><dt>{t('Cidade/região')}</dt><dd>{profile.cityRegion || t('Não informado')}</dd></div></dl>
      </ManagementPanel>
      <ManagementPanel title={t('Registro profissional')}>
        <dl className="management-facts"><div><dt>{t('Tipo de registro')}</dt><dd>{profile.registrationType || t('Não informado')}</dd></div><div><dt>{t('Número do registro')}</dt><dd>{profile.registrationNumber || t('Não informado')}</dd></div><div><dt>{t('Status do registro')}</dt><dd><ManagementStatus tone={profile.verificationStatus === 'verified' ? 'success' : 'neutral'}>{status}</ManagementStatus></dd></div></dl>
      </ManagementPanel>
    </div>
  </ManagementLayout>
}
