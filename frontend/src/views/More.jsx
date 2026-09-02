import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { t } from '../lib/i18n.js'
import Icon from '../components/Icon.jsx'
import { Section, Row } from '../components/ui.jsx'
import { DEMO, STANDALONE } from '../lib/demo.js'
import { MOBILE } from '../lib/mobile.js'

export default function More() {
  const nav = useNavigate()
  const user = useStore(s => s.user)

  return <div className="narrow">
    <div className="hdr">
      <div><h1>{t('More')}</h1><div className="sub">{t('Settings, history & account')}</div></div>
    </div>

    <Section title={t('Your app')}>
      <Row icon="gear" iconTint="var(--acc)" title={t('Settings')} subtitle={t('Language, units, backup & preferences')}
        accessory="chevron" onClick={() => nav('/settings')} />
      <Row icon="history" iconTint="var(--blue)" title={t('History')} subtitle={t('All your past workouts')}
        accessory="chevron" onClick={() => nav('/history')} />
    </Section>

    {(user?.admin) && <Section title={t('Admin')}>
      <Row icon="shield" iconTint="var(--purple)" title={t('Admin dashboard')} accessory="chevron" onClick={() => nav('/admin')} />
    </Section>}

    <Section title={t('About')}>
      <Row icon="personCircle" iconTint="var(--teal)" title={user ? user.name : (MOBILE || STANDALONE ? t('Guest mode') : DEMO ? t('Demo') : t('Guest mode'))}
        subtitle={user ? t('Signed in with passkey') : t('Guest data stays on this device — export a backup now and then!')} />
    </Section>
  </div>
}
