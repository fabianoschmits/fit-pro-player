import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { t } from '../lib/i18n.js'
import { loadStarterPlan } from '../sheets.jsx'
import Icon from '../components/Icon.jsx'
import { Button } from '../components/ui.jsx'

export default function Onboarding() {
  const nav = useNavigate()
  const update = useStore(s => s.update)

  const finish = () => update(s => { s.onboardingDone = true })

  const pickStarter = () => {
    loadStarterPlan()
    finish()
    nav('/plan')
  }
  const pickBuild = () => {
    finish()
    nav('/plan')
  }
  const pickFree = () => {
    finish()
    nav('/workout')
  }

  return (
    <div className="onboarding-overlay" role="dialog" aria-modal="true" aria-labelledby="onb-title">
      <div className="onboarding-card card">
        <div className="onboarding-icon"><Icon name="sparkles" /></div>
        <h2 id="onb-title">{t('Welcome to Fit Pro Player!')}</h2>
        <p className="muted small onboarding-copy">{t('How do you want to start? Pick one — you can change everything later.')}</p>

        <div className="onboarding-steps" aria-hidden="true">
          <div className="on"><span>1</span>{t('Choose')}</div>
          <i />
          <div><span>2</span>{t('Plan')}</div>
          <i />
          <div><span>3</span>{t('Train')}</div>
        </div>

        <Button variant="primary" icon="sparkles" onClick={pickStarter}>{t('Load starter plan (Full)')}</Button>
        <div style={{ height: 8 }} />
        <Button icon="plus" onClick={pickBuild}>{t('Build my own plan')}</Button>
        <div style={{ height: 8 }} />
        <Button variant="ghost" icon="shuffle" onClick={pickFree}>{t('Freestyle — pick exercises as I go')}</Button>
        <div style={{ height: 12 }} />
        <button className="btn plain dim small" onClick={finish}>{t('Skip for now')}</button>
      </div>
    </div>
  )
}
