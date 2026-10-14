import { useUI } from '../store/useUI.js'
import AppHeader from '../components/AppHeader.jsx'
import PrivacyControls from '../components/PrivacyControls.jsx'

export default function PrivacySettings() {
  const toast = useUI(state => state.toast)
  return <div className="narrow">
    <AppHeader title="Privacidade e dados" subtitle="Gerencie seus direitos, consentimentos e solicitações LGPD" backTo="/more" />
    <button className="btn ghost" type="button" onClick={() => window.dispatchEvent(new Event('fitproplayer:privacy-settings'))}>Personalizar privacidade e cookies</button>
    <PrivacyControls toast={toast} />
  </div>
}
