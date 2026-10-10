import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider.jsx'
import { useStore } from '../store/useStore.js'
import { t } from '../lib/i18n.js'
import { Section, Row } from '../components/ui.jsx'
import { EXDB } from '../lib/exercises.js'
import AppHeader from '../components/AppHeader.jsx'
import AvatarImage from '../components/AvatarImage.jsx'
import Icon from '../components/Icon.jsx'
import { getBrowserSupabaseClient } from '../lib/supabase-client.js'
import { createProfessionalWorkflowRepository } from '../lib/professional-workflow.js'
import { createConsoleRepository } from '../lib/console.js'
import '../settings.css'

export default function More() {
  const nav = useNavigate(), auth = useAuth(), profile = useStore(store => store.S.profile)
  const account = auth.status === 'authenticated' ? auth.user : null
  const repo = useMemo(() => createProfessionalWorkflowRepository({ client: getBrowserSupabaseClient() }), [])
  const consoleRepo = useMemo(() => createConsoleRepository({ client: getBrowserSupabaseClient() }), [])
  const [roles, setRoles] = useState(null), [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let current = true
    if (account?.id) Promise.allSettled([repo.professionalRole(account.id), consoleRepo.adminRole(account.id)]).then(([professional, admin]) => {
      if (current) setRoles({ owner: account.id, professional: professional.status === 'fulfilled' && professional.value, admin: admin.status === 'fulfilled' && admin.value, error: professional.status === 'rejected' || admin.status === 'rejected' })
    })
    return () => { current = false }
  }, [account?.id, repo, consoleRepo, attempt])
  const permissions = roles?.owner === account?.id ? roles : null
  const row = (title, icon, to, subtitle) => <Row key={to} title={t(title)} icon={icon} subtitle={subtitle ? t(subtitle) : undefined} accessory="chevron" onClick={() => nav(to)} className="more-row" />
  return <div className="narrow more-page">
    <AppHeader title={t('More')} subtitle={t('Your training, workspaces and preferences')} />
    <button type="button" className="menu-profile" onClick={() => nav('/settings')}>
      <AvatarImage avatarId={profile?.avatarId} /><span><strong>{profile?.name || t('Your profile')}</strong><small>{account?.email || t('Guest mode')}</small><span className="menu-profile-link">{t('Account and settings')}</span></span><Icon name="chevronRight" />
    </button>
    {account && <p className="menu-account-status">{t('Signed in to your account')}</p>}
    {permissions?.error && <p role="alert" className="settings-error">{t('Could not load your workspaces.')} <button className="link" onClick={() => setAttempt(value => value + 1)}>{t('Retry')}</button></p>}
    {permissions?.admin && <div data-menu-group="admin"><Section title={t('Administration')} className="menu-workspace menu-admin">
      {row('Central', 'gear', '/console', 'Platform overview')}
      {row('Users', 'person', '/console/users')}
      {row('Professionals', 'personCircle', '/console/professionals')}
    </Section></div>}
    {permissions?.professional && <div data-menu-group="professional"><Section title={t('Área profissional')} className="menu-workspace">
      {row('Gestão', 'chart', '/professional', 'Alunos, convites e programas')}
      {row('Alunos', 'person', '/professional/students')}
      {row('Programas', 'list', '/professional/programs')}
      {row('Convidar aluno', 'plus', '/professional/invites?section=create')}
      {row('Perfil profissional', 'personCircle', '/professional/profile', 'Sua apresentação para os alunos.')}
    </Section></div>}
    <Section title={t('My training')} className="more-section">
      {row('History', 'history', '/history', 'All your past workouts')}
      {row('Body progress', 'chart', '/body-progress', 'Weight and body measurements')}
      {row('Exercises', 'list', '/library', t('{0} exercises in the catalogue', EXDB.length))}
    </Section>
    {account && <Section title={t('Professional support')} className="more-section">
      {row('Meus profissionais', 'personCircle', '/student/professionals', 'Programas e prescrições dos seus profissionais')}
      {row('Received training', 'dumbbell', '/student/professionals/materials')}
      {row('Adicionar profissional', 'plus', '/student/professionals/add')}
    </Section>}
    <Section title={t('Account and settings')} className="more-section">
      {row('Personal data', 'person', '/settings?profile=edit', 'Name, birth date, body, measurements and training goal')}
      {row('Settings', 'gear', '/settings', 'Language, units, backup & preferences')}
    </Section>
  </div>
}
