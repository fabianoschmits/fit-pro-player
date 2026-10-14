import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider.jsx'
import { t } from '../lib/i18n.js'
import Icon from '../components/Icon.jsx'
import AvatarImage from '../components/AvatarImage.jsx'
import { Section, Row } from '../components/ui.jsx'
import { DEMO, STANDALONE } from '../lib/demo.js'
import { MOBILE } from '../lib/mobile.js'
import { EXDB } from '../lib/exercises.js'
import AppHeader from '../components/AppHeader.jsx'
import { getBrowserSupabaseClient } from '../lib/supabase-client.js'
import { createProfessionalWorkflowRepository } from '../lib/professional-workflow.js'
import { createConsoleRepository } from '../lib/console.js'
import { useStore } from '../store/useStore.js'
import { confirmSheet } from '../sheets.jsx'
import { useEffect, useMemo, useState } from 'react'

function MenuRow({ icon, tint, title, subtitle, onClick, danger = false }) {
  return <Row icon={icon} iconTint={tint} title={title} subtitle={subtitle} accessory="chevron" danger={danger} onClick={onClick} />
}

export default function More() {
  const nav = useNavigate()
  const auth = useAuth()
  const profile = useStore(state => state.S.profile) || {}
  const account = auth.status === 'authenticated' ? auth.user : null
  const repo = useMemo(() => createProfessionalWorkflowRepository({ client: getBrowserSupabaseClient() }), [])
  const consoleRepo = useMemo(() => createConsoleRepository({ client: getBrowserSupabaseClient() }), [])
  const [professional, setProfessional] = useState(false)
  const [consoleAccess, setConsoleAccess] = useState(false)
  useEffect(() => {
    let current = true
    setProfessional(false)
    setConsoleAccess(false)
    if (account?.id) {
      repo.professionalRole(account.id).then(value => { if (current) setProfessional(value) }).catch(() => { if (current) setProfessional(false) })
      consoleRepo.adminRole(account.id).then(value => { if (current) setConsoleAccess(value) }).catch(() => { if (current) setConsoleAccess(false) })
    }
    return () => { current = false }
  }, [account?.id, repo, consoleRepo])

  const guestName = MOBILE || STANDALONE ? t('Guest mode') : DEMO ? t('Demo') : t('Guest mode')
  const displayName = profile.name || guestName
  const email = account?.email || (account ? t('Signed in to your account') : t('Local profile'))
  const signOut = () => confirmSheet({
    title: 'Sair da conta?', message: 'Sua sessão será encerrada neste dispositivo.', confirmText: 'Sair', danger: true,
    onConfirm: async () => { await auth.signOut(); nav('/') },
  })

  return <div className="narrow more-page">
    <AppHeader title={t('More')} subtitle={t('Settings, history & account')} />

    <button type="button" className="more-account-card" onClick={() => nav('/personal-data')}>
      <span className="more-account-avatar"><AvatarImage avatarId={profile.avatarId} alt="" /></span>
      <span className="more-account-copy"><strong>{displayName}</strong><span>{email}</span><em>{account ? 'Ver conta' : 'Editar perfil'} <Icon name="chevronRight" /></em></span>
      <Icon name="chevronRight" className="more-account-chevron" />
    </button>

    <Section title="Geral" className="more-section" collapsible defaultOpen>
      <MenuRow icon="person" tint="var(--teal)" title="Dados pessoais" subtitle="Seus dados e informações" onClick={() => nav('/personal-data')} />
      <MenuRow icon="gear" tint="var(--acc)" title={t('Settings')} subtitle={t('Language, units, backup & preferences')} onClick={() => nav('/settings')} />
      <MenuRow icon="info" tint="var(--blue)" title="Ajuda e suporte" subtitle="Dúvidas e suporte" onClick={() => { window.location.href = 'mailto:contato@appconfilar.com.br' }} />
      {consoleAccess && <MenuRow icon="gear" tint="var(--purple)" title="Central da plataforma" subtitle="Operação da plataforma" onClick={() => nav('/console')} />}
    </Section>

    <Section title="Treino" className="more-section" collapsible defaultOpen={false}>
      <MenuRow icon="list" tint="var(--teal)" title={t('Exercises')} subtitle={t('{0} exercises in the catalogue', EXDB.length)} onClick={() => nav('/library')} />
      <MenuRow icon="history" tint="var(--blue)" title={t('History')} subtitle={t('All your past workouts')} onClick={() => nav('/history')} />
      <MenuRow icon="chartLine" tint="var(--teal)" title="Evolução corporal" subtitle="Medidas semanais e evolução do corpo" onClick={() => nav('/body-progress')} />
    </Section>

    {(account || professional) && <Section title="Profissional" className="more-section" collapsible defaultOpen={false}>
      {account && <MenuRow icon="personCircle" tint="var(--teal)" title="Meus profissionais" subtitle="Programas e prescrições dos seus profissionais" onClick={() => nav('/student/professionals')} />}
      {professional && <MenuRow icon="clipboard" tint="var(--purple)" title="Área profissional" subtitle="Alunos, convites e programas" onClick={() => nav('/professional')} />}
      {professional && <MenuRow icon="personCircle" tint="var(--purple)" title="Perfil profissional" subtitle="Sua apresentação para os alunos" onClick={() => nav('/professional/profile')} />}
    </Section>}

    <Section title="Sobre o Fit Pro Player" className="more-section" collapsible defaultOpen={false}>
      <MenuRow icon="info" tint="var(--blue)" title="Sobre o Fit Pro Player" subtitle="Informações do aplicativo" onClick={() => nav('/privacy')} />
      <MenuRow icon="shield" tint="var(--teal)" title="Termos e privacidade" subtitle="Privacidade, cookies e direitos LGPD" onClick={() => nav('/privacy-settings')} />
      {account && <MenuRow icon="signOut" tint="var(--red)" title="Sair da conta" subtitle="Encerrar a sessão neste dispositivo" danger onClick={signOut} />}
    </Section>
  </div>
}
