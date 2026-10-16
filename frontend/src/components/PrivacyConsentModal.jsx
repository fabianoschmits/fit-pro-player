import { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthProvider.jsx'
import { getBrowserSupabaseClient } from '../lib/supabase-client.js'
import { DEFAULT_PRIVACY_CONSENT, readPrivacyConsent, savePrivacyConsent } from '../lib/privacy-consent.js'
import { Button } from './ui.jsx'

const REMOTE_PURPOSE = 'cookie_preferences'

function preferencesFromRows(rows) {
  const row = rows?.find(item => item.purpose === REMOTE_PURPOSE && item.granted)
  if (!row) return null
  try { return { ...DEFAULT_PRIVACY_CONSENT, ...JSON.parse(row.details || '{}') } } catch { return DEFAULT_PRIVACY_CONSENT }
}

export default function PrivacyConsentModal() {
  const auth = useAuth()
  const [consent, setConsent] = useState(() => readPrivacyConsent())
  const [customizing, setCustomizing] = useState(false)
  const [draft, setDraft] = useState(() => readPrivacyConsent() || DEFAULT_PRIVACY_CONSENT)
  const [ready, setReady] = useState(false)
  const [visible, setVisible] = useState(false)
  const [saveError, setSaveError] = useState('')

  useEffect(() => {
    let active = true
    const load = async () => {
      let next = readPrivacyConsent()
      const client = getBrowserSupabaseClient()
      if (auth.status === 'authenticated' && auth.user?.id && client) {
        const { data } = await client.from('privacy_consents').select('purpose,granted,details').eq('user_id', auth.user.id)
        const remote = preferencesFromRows(data)
        if (remote) next = savePrivacyConsent(remote)
        else if (next) await persistConsent(client, next)
      }
      if (!active) return
      setConsent(next); setDraft(next || DEFAULT_PRIVACY_CONSENT); setVisible(!next); setReady(true)
    }
    load().catch(() => { if (active) { setReady(true); setVisible(!readPrivacyConsent()) } })
    return () => { active = false }
  }, [auth.status, auth.user?.id])

  useEffect(() => {
    const reopen = () => { setDraft(readPrivacyConsent() || DEFAULT_PRIVACY_CONSENT); setCustomizing(true); setVisible(true) }
    window.addEventListener('fitproplayer:privacy-settings', reopen)
    return () => window.removeEventListener('fitproplayer:privacy-settings', reopen)
  }, [])

  if (!ready || !visible) return null
  const save = async next => {
    setSaveError('')
    const saved = savePrivacyConsent(next)
    setConsent(saved); setDraft(saved)
    const client = getBrowserSupabaseClient()
    try {
      if (auth.status === 'authenticated' && client) await persistConsent(client, saved)
      return saved
    } catch (error) {
      setSaveError('Suas escolhas foram salvas neste dispositivo. Não foi possível sincronizá-las; tente novamente quando estiver conectado.')
      throw error
    }
  }
  const closeAfterSave = () => { setVisible(false); setCustomizing(false) }
  const all = { ...DEFAULT_PRIVACY_CONSENT, preferences: true, analytics: true, communications: true }
  return <div className="privacy-consent-backdrop" role="presentation">
    <section className="privacy-consent-modal" role="dialog" aria-modal="true" aria-labelledby="privacy-consent-title">
      <div className="privacy-consent-heading"><div><span className="privacy-consent-kicker">PRIVACIDADE</span><h2 id="privacy-consent-title">Privacidade e cookies</h2></div><button type="button" className="privacy-consent-settings" aria-label="Personalizar privacidade" onClick={() => setCustomizing(value => !value)}>⚙</button></div>
      <p>Usamos dados necessários para o app funcionar. Você pode escolher se permite recursos opcionais.</p>
      {!customizing ? <div className="privacy-consent-actions"><Button variant="primary" onAction={() => save(all)} onSuccess={closeAfterSave} loadingLabel="Salvando…" successLabel="Salvo" errorLabel="Tentar novamente">Aceitar</Button><button type="button" className="btn ghost" onClick={() => setCustomizing(true)}>Personalizar</button></div> : <>
        <div className="privacy-consent-options">
          <ConsentOption label="Necessários" description="Essenciais para login, segurança e funcionamento." checked disabled />
          <ConsentOption label="Preferências" description="Lembra escolhas e melhora a experiência." checked={draft.preferences} onChange={value => setDraft(current => ({ ...current, preferences: value }))} />
          <ConsentOption label="Medição de uso" description="Ajuda a entender desempenho e erros do app." checked={draft.analytics} onChange={value => setDraft(current => ({ ...current, analytics: value }))} />
          <ConsentOption label="Comunicações" description="Permite mensagens opcionais e novidades." checked={draft.communications} onChange={value => setDraft(current => ({ ...current, communications: value }))} />
        </div>
        <div className="privacy-consent-actions"><Button variant="primary" onAction={() => save(draft)} onSuccess={closeAfterSave} loadingLabel="Salvando…" successLabel="Salvo" errorLabel="Tentar novamente">Salvar escolhas</Button></div>
      </>}
      {saveError && <p className="error" role="alert">{saveError}</p>}
      <p className="privacy-consent-links"><a href="#/privacy">Aviso de Privacidade</a> · <a href="#/data-rights">Seus direitos</a></p>
    </section>
  </div>
}

function ConsentOption({ label, description, checked, disabled, onChange }) {
  return <label className="privacy-consent-option"><span><strong>{label}</strong><small>{description}</small></span><input type="checkbox" checked={checked} disabled={disabled} onChange={event => onChange?.(event.target.checked)} /></label>
}

async function persistConsent(client, consent) {
  const details = JSON.stringify({ version: consent.version, preferences: consent.preferences, analytics: consent.analytics, communications: consent.communications })
  const { error } = await client.rpc('record_privacy_consent', { p_version: consent.version, p_purpose: REMOTE_PURPOSE, p_granted: true, p_details: details })
  if (error) throw error
}
