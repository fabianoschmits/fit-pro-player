import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider.jsx'
import { t } from '../lib/i18n.js'
import Icon from '../components/Icon.jsx'
import { Section, Row } from '../components/ui.jsx'
import { DEMO, STANDALONE } from '../lib/demo.js'
import { MOBILE } from '../lib/mobile.js'
import { EXDB } from '../lib/exercises.js'
import AppHeader from '../components/AppHeader.jsx'

export default function More() {
  const nav = useNavigate()
  const auth = useAuth()
  const account = auth.status === 'authenticated' ? auth.user : null

  return <div className="narrow">
    <AppHeader title={t('More')} subtitle={t('Settings, history & account')} />

    <Section title={t('Your app')}>
      <Row icon="list" iconTint="var(--blue)" title={t('Exercises')} subtitle={t('{0} exercises in the catalogue', EXDB.length)}
        accessory="chevron" onClick={() => nav('/library')} />
      <Row icon="personCircle" iconTint="var(--teal)" title={t('Edit your personal data')} subtitle={t('These details personalize your progress, body map and training suggestions.')}
        accessory="chevron" onClick={() => nav('/plan?profile=edit')} />
      <Row icon="gear" iconTint="var(--acc)" title={t('Settings')} subtitle={t('Language, units, backup & preferences')}
        accessory="chevron" onClick={() => nav('/settings')} />
      <Row icon="history" iconTint="var(--blue)" title={t('History')} subtitle={t('All your past workouts')}
        accessory="chevron" onClick={() => nav('/history')} />
      <Row icon="personCircle" iconTint="var(--teal)" title="Evolução corporal" subtitle="Medidas semanais e evolução do corpo"
        accessory="chevron" onClick={() => nav('/body-progress')} />
      {account && <Row icon="personCircle" iconTint="var(--purple)" title="Perfil profissional" subtitle="Nome, especialidades e registro informado"
        accessory="chevron" onClick={() => nav('/professional-profile')} />}
    </Section>

    <Section title={t('About')}>
      <Row icon="personCircle" iconTint="var(--teal)" title={account?.email || (MOBILE || STANDALONE ? t('Guest mode') : DEMO ? t('Demo') : t('Guest mode'))}
        subtitle={account ? t('Signed in to your account') : t('Guest data stays on this device — export a backup now and then!')} />
    </Section>
  </div>
}
