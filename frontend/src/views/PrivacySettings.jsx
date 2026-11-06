import { useUI } from '../store/useUI.js'
import AppHeader from '../components/AppHeader.jsx'
import PrivacyControls from '../components/PrivacyControls.jsx'
import { Button } from '../components/ui.jsx'

export default function PrivacySettings() {
  const toast = useUI(state => state.toast)
  return <div className="narrow privacy-settings-page fpp-ui-view fpp-screen-privacy">
    <AppHeader title="Privacidade e dados" subtitle="Gerencie seus direitos, consentimentos e solicitações LGPD" backTo="/more" />
    <Button variant="ghost" onClick={() => window.dispatchEvent(new Event('fitproplayer:privacy-settings'))}>Personalizar privacidade e cookies</Button>
    <PrivacyControls toast={toast} />
  </div>
}
